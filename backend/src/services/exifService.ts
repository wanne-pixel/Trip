import exifr from 'exifr';
import type { ExifResult } from '../types/index.js';

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
};

/**
 * 이미지 Buffer에서 EXIF 데이터를 추출합니다.
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
      pick: ['DateTimeOriginal', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'],
    });

    // EXIF 데이터 자체가 없는 경우 (JPEG가 아닌 포맷, 스크린샷 등)
    if (!exif) {
      console.info('[ExifService] EXIF 데이터 없음 → classified: false 반환');
      return FALLBACK;
    }

    // 촬영 시각 파싱
    let taken_at: string | null = null;
    if (exif.DateTimeOriginal instanceof Date) {
      taken_at = exif.DateTimeOriginal.toISOString();
    } else if (typeof exif.DateTimeOriginal === 'string') {
      // "YYYY:MM:DD HH:MM:SS" 형식을 ISO 8601로 변환
      const normalized = (exif.DateTimeOriginal as string).replace(
        /^(\d{4}):(\d{2}):(\d{2})/,
        '$1-$2-$3'
      );
      const parsed = new Date(normalized);
      if (!isNaN(parsed.getTime())) {
        taken_at = parsed.toISOString();
      }
    }

    // GPS 좌표 파싱 (exifr는 이미 십진수로 변환 제공)
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
      latitude = exif.latitude;
      longitude = exif.longitude;
    } else if (
      Array.isArray(exif.GPSLatitude) &&
      Array.isArray(exif.GPSLongitude)
    ) {
      latitude = convertDMSToDecimal(exif.GPSLatitude as number[], exif.GPSLatitudeRef as string);
      longitude = convertDMSToDecimal(exif.GPSLongitude as number[], exif.GPSLongitudeRef as string);
    }

    const classified = taken_at !== null;

    return { taken_at, latitude, longitude, classified };
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
