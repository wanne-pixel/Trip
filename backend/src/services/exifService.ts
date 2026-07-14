import exifr from 'exifr';
import tzlookup from 'tz-lookup';
import type { ExifResult } from '../types/index';

/**
 * Rule 2 — Graceful Fallback
 * EXIF 데이터가 없거나 파싱 실패 시 앱을 멈추지 않고
 * 안전한 기본값 { classified: false, taken_at: null, ... } 을 반환합니다.
 */
const FALLBACK: ExifResult = {
  taken_at: null,
  latitude: null,
  longitude: null,
  classified: false,
  taken_at_local: null,
  tz_offset: null,
};

/** 기본 타임존 오프셋 — EXIF 오프셋도 GPS도 없을 때 (기존 동작 유지) */
const DEFAULT_TZ_OFFSET = '+09:00';

/**
 * IANA 타임존 이름 + 대략적인 시각으로 해당 시점의 UTC 오프셋("+02:00" 형태)을 계산.
 * Intl API(Node 내장)만 사용 — 추가 의존성 없음. 실패 시 null (Rule 2).
 */
function offsetForZone(zone: string, approxDate: Date): string | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'longOffset',
    });
    const tzPart = fmt.formatToParts(approxDate).find((p) => p.type === 'timeZoneName')?.value;
    if (!tzPart) return null;
    if (tzPart === 'GMT') return '+00:00';
    const m = tzPart.match(/GMT([+-]\d{2}:\d{2})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * 이미지 Buffer에서 EXIF 데이터를 추출합니다.
 *
 * 타임존 결정 우선순위 (v3.8):
 *   1. EXIF OffsetTimeOriginal (카메라가 기록한 실제 오프셋)
 *   2. GPS 좌표 → tz-lookup으로 촬영지 타임존 추정
 *   3. 폴백: KST(+09:00) — 기존 동작과 동일
 *
 * taken_at        : 올바른 오프셋이 적용된 절대 시각(ISO, UTC)
 * taken_at_local  : 촬영지 현지 벽시계 시각 ("YYYY-MM-DDTHH:MM:SS") — 프론트 표시용
 * tz_offset       : 적용된 오프셋 문자열
 *
 * @param buffer - 업로드된 이미지의 원본 Buffer
 * @returns ExifResult — EXIF 없음/실패 시 FALLBACK 반환, 절대 throw 하지 않음
 */
export async function extractExif(buffer: Buffer): Promise<ExifResult> {
  try {
    const exif = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
      // 필요한 태그만 추출하여 성능 최적화
      pick: [
        'DateTimeOriginal',
        'OffsetTimeOriginal',
        'GPSLatitude',
        'GPSLongitude',
        'GPSLatitudeRef',
        'GPSLongitudeRef',
      ],
    });

    // EXIF 데이터 자체가 없는 경우 (JPEG가 아닌 포맷, 스크린샷 등)
    if (!exif) {
      console.info('[ExifService] EXIF 데이터 없음 → classified: false 반환');
      return FALLBACK;
    }

    // ── GPS 좌표 파싱 (타임존 추정에 사용하므로 먼저 수행) ──
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
      latitude = exif.latitude;
      longitude = exif.longitude;
    } else if (Array.isArray(exif.GPSLatitude) && Array.isArray(exif.GPSLongitude)) {
      latitude = convertDMSToDecimal(exif.GPSLatitude as number[], exif.GPSLatitudeRef as string);
      longitude = convertDMSToDecimal(exif.GPSLongitude as number[], exif.GPSLongitudeRef as string);
    }

    // ── 촬영 시각(벽시계) 문자열 추출 ──
    let rawDateStr = '';

    if (exif.DateTimeOriginal instanceof Date) {
      // exifr가 타임존 없이 파싱하여 Z를 붙여 반환할 경우, 실제 적힌 '시각' 자체만 추출
      rawDateStr = exif.DateTimeOriginal.toISOString().replace('.000Z', '').replace('Z', '');
    } else if (typeof exif.DateTimeOriginal === 'string') {
      // "YYYY:MM:DD HH:MM:SS" 형식을 "YYYY-MM-DDTHH:MM:SS"로 변환
      rawDateStr = (exif.DateTimeOriginal as string)
        .replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
        .replace(' ', 'T');
    }

    // ── 타임존 오프셋 결정 (v3.8) ──
    let tz_offset: string | null = null;

    // 1순위: EXIF에 기록된 실제 오프셋
    if (typeof exif.OffsetTimeOriginal === 'string' && /^[+-]\d{2}:\d{2}$/.test(exif.OffsetTimeOriginal.trim())) {
      tz_offset = exif.OffsetTimeOriginal.trim();
    }

    // 2순위: GPS 좌표 기반 타임존 추정 (DST 포함 정확한 오프셋)
    if (!tz_offset && latitude != null && longitude != null && rawDateStr) {
      try {
        const zone = tzlookup(latitude, longitude);
        const approx = new Date(`${rawDateStr}Z`); // 오프셋 계산용 근사 시각
        if (!isNaN(approx.getTime())) {
          tz_offset = offsetForZone(zone, approx);
        }
      } catch {
        // Rule 2: tz-lookup 실패 시 무시하고 폴백 사용
      }
    }

    // 3순위: 폴백 — 기존과 동일하게 KST
    if (!tz_offset) tz_offset = DEFAULT_TZ_OFFSET;

    // ── 절대 시각(taken_at) 계산 ──
    let taken_at: string | null = null;
    let taken_at_local: string | null = null;

    if (rawDateStr) {
      const parsed = new Date(`${rawDateStr}${tz_offset}`);
      if (!isNaN(parsed.getTime())) {
        taken_at = parsed.toISOString();
        taken_at_local = rawDateStr; // 촬영지 현지 벽시계 시각 보존
      }
    }

    const classified = taken_at !== null;

    return { taken_at, latitude, longitude, classified, taken_at_local, tz_offset: taken_at ? tz_offset : null };
  } catch (err) {
    // Rule 2: 어떤 에러가 발생해도 FALLBACK 반환, 절대 throw하지 않음
    console.warn('[ExifService] EXIF 파싱 실패 — FALLBACK 반환:', (err as Error).message);
    return FALLBACK;
  }
}

/**
 * DMS(도·분·초) 배열을 십진수 좌표로 변환합니다.
 * exifr가 이미 처리하지 못한 경우의 폴백 처리용.
 */
function convertDMSToDecimal(dms: number[], ref: string): number | null {
  if (!dms || dms.length < 3) return null;
  const [degrees, minutes, seconds] = dms;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (ref === 'S' || ref === 'W') {
    decimal = -decimal;
  }
  return decimal;
}
