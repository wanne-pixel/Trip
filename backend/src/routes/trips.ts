import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { supabase } from '../config/supabase';
import { extractExif } from '../services/exifService';
import { extractVisionTags } from '../services/visionService';
import type { Trip, Photo, ApiResponse, CreateTripBody, PatchTripMetadataBody, ExifResult, VisionTags } from '../types/index';

export const tripsRouter = Router();

// ─────────────────────────────────────────────
// Multer 설정 — 다중 사진 업로드 (from-photos용)
// 최대 200장 / 장당 20MB / 이미지 파일만 허용
// ─────────────────────────────────────────────
const uploadMulti = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const ext = file.originalname.toLowerCase().split('.').pop() || '';
    if (allowed.includes(file.mimetype) || (file.mimetype === 'application/octet-stream' && ['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext)) || file.mimetype === '') {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식: ${file.mimetype}`));
    }
  },
});

// ─────────────────────────────────────────────
// 공통 헬퍼 (v3.8) — from-photos와 :id/photos의 중복 로직 통합
// ─────────────────────────────────────────────
interface ProcessedFile {
  file: Express.Multer.File;
  exif: ExifResult;
  vision: VisionTags | null;
}

const META_CONCURRENCY_LIMIT = 3;   // EXIF + Vision 동시 처리 수
const UPLOAD_CONCURRENCY_LIMIT = 3; // Storage + DB INSERT 동시 처리 수

/** 각 사진의 EXIF + Vision 메타를 병렬 추출 (Promise.allSettled — 일부 실패 허용, Rule 2) */
async function extractPhotoMeta(
  files: Express.Multer.File[],
  exifChunks?: Express.Multer.File[]
): Promise<ProcessedFile[]> {
  const metaResults: PromiseSettledResult<ProcessedFile>[] = [];
  for (let i = 0; i < files.length; i += META_CONCURRENCY_LIMIT) {
    const chunk = files.slice(i, i + META_CONCURRENCY_LIMIT);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (file, idx) => {
        const globalIdx = i + idx;
        const exifFile = exifChunks?.[globalIdx] || file;
        const exif: ExifResult = await extractExif(exifFile.buffer);

        // 모든 사진에 Vision API 호출 (category 태그 부여)
        const base64 = file.buffer.toString('base64');
        const vision: VisionTags | null = await extractVisionTags(base64, file.mimetype);

        return { file, exif, vision };
      })
    );
    metaResults.push(...chunkResults);
  }

  // 실패한 파일은 FALLBACK으로 대체 (Rule 2)
  return metaResults.map((result, idx) => {
    if (result.status === 'fulfilled') return result.value;
    console.warn(`[TripsRoute/extractPhotoMeta] 파일[${idx}] 메타 추출 실패 — FALLBACK:`, result.reason);
    return {
      file: files[idx],
      exif: { taken_at: null, latitude: null, longitude: null, classified: false } as ExifResult,
      vision: null,
    };
  });
}

/** Storage 업로드 + photos 테이블 INSERT (Promise.allSettled — 일부 실패 허용, Rule 2) */
async function uploadAndInsertPhotos(
  tripId: string,
  processedFiles: ProcessedFile[]
): Promise<{ succeededPhotos: Photo[]; failedCount: number }> {
  const photoResults: PromiseSettledResult<Photo>[] = [];
  for (let i = 0; i < processedFiles.length; i += UPLOAD_CONCURRENCY_LIMIT) {
    const chunk = processedFiles.slice(i, i + UPLOAD_CONCURRENCY_LIMIT);
    const chunkResults = await Promise.allSettled(
      chunk.map(async ({ file, exif, vision }) => {
        const ext = path.extname(file.originalname) || '.jpg';
        const photoId = uuidv4();
        const storagePath = `photos/${tripId}/${photoId}${ext}`;

        // Storage 업로드
        const { error: storageError } = await supabase.storage
          .from('trip-photos')
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (storageError) {
          throw new Error(`Storage 업로드 실패 (${file.originalname}): ${storageError.message}`);
        }

        // 공개 URL 획득
        const { data: publicUrlData } = supabase.storage
          .from('trip-photos')
          .getPublicUrl(storagePath);

        // v3.8: 촬영지 현지 시각/오프셋을 metadata(JSONB)에 저장 (Rule 1 — DDL 변경 없음)
        const metadata = exif.taken_at_local
          ? { taken_at_local: exif.taken_at_local, tz_offset: exif.tz_offset }
          : {};

        // photos 테이블 INSERT
        const { data: photoData, error: dbError } = await supabase
          .from('photos')
          .insert({
            id: photoId,
            trip_id: tripId,
            storage_path: publicUrlData.publicUrl,
            original_filename: file.originalname,
            taken_at: exif.taken_at,
            latitude: exif.latitude,
            longitude: exif.longitude,
            classified: exif.classified,
            vision_tags: vision,
            metadata,
          })
          .select()
          .single();

        if (dbError) {
          throw new Error(`DB INSERT 실패 (${file.originalname}): ${dbError.message}`);
        }

        return photoData as Photo;
      })
    );
    photoResults.push(...chunkResults);
  }

  // 성공한 사진만 모아 반환 / 실패한 사진은 경고 로그
  const succeededPhotos: Photo[] = [];
  let failedCount = 0;
  photoResults.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      succeededPhotos.push(result.value);
    } else {
      failedCount++;
      console.warn(
        `[TripsRoute/uploadAndInsertPhotos] 사진[${idx}] 저장 실패:`,
        result.reason instanceof Error ? result.reason.message : result.reason
      );
    }
  });

  return { succeededPhotos, failedCount };
}

// ─────────────────────────────────────────────
// GET /api/trips — 모든 여행 목록 조회
// ─────────────────────────────────────────────
tripsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // v3.8: photos(id) 전체 로드 대신 count 집계만 조회 — 전송량·메모리 대폭 절감
    const { data, error } = await supabase
      .from('trips')
      .select('*, photos(count)')
      .order('created_at', { ascending: false });

    if (error) {
      const response: ApiResponse<never> = { success: false, error: error.message };
      return res.status(500).json(response);
    }

    const tripsWithCount = (data as any[]).map(t => {
      const photo_count = t.photos?.[0]?.count ?? 0;
      delete t.photos;
      return { ...t, metadata: { ...t.metadata, photo_count } };
    });

    const response: ApiResponse<Trip[]> = { success: true, data: tripsWithCount as Trip[] };
    return res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});

// ─────────────────────────────────────────────
// POST /api/trips/recalculate-dates — 기존 모든 여행의 기간(description) 일괄 재계산
// 각 여행의 사진들의 taken_at_local(또는 taken_at)을 기반으로 정확한 기간을 다시 계산
// ─────────────────────────────────────────────
tripsRouter.post('/recalculate-dates', async (_req: Request, res: Response) => {
  try {
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id, description, metadata');

    if (tripsError || !trips) {
      return res.json({ success: false, error: tripsError?.message || '여행 목록 조회 실패' });
    }

    let updatedCount = 0;
    for (const trip of trips) {
      try {
        await updateTripDateRange(trip.id);
        updatedCount++;
      } catch (e) {
        console.warn(`[recalculate-dates] trip ${trip.id} 실패:`, (e as Error).message);
      }
    }

    return res.json({
      success: true,
      data: { total: trips.length, updated: updatedCount }
    });
  } catch (err) {
    return res.json({ success: false, error: (err as Error).message });
  }
});

// ─────────────────────────────────────────────
// GET /api/trips/:id — 특정 여행 조회
// ─────────────────────────────────────────────
tripsRouter.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      const statusCode = error.code === 'PGRST116' ? 404 : 500;
      const response: ApiResponse<never> = {
        success: false,
        error: statusCode === 404 ? `여행(id: ${id})을 찾을 수 없습니다.` : error.message,
      };
      return res.status(statusCode).json(response);
    }

    const response: ApiResponse<Trip> = { success: true, data: data as Trip };
    return res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});

// ─────────────────────────────────────────────
// DELETE /api/trips/:id — 여행 삭제 (v2.1)
// 처리 순서: Storage 파일 삭제 → photos DB 삭제 → trips DB 삭제 (CASCADE)
// Storage 삭제 실패 시 경고만 남기고 DB 삭제는 계속 진행 (Rule 2)
// ─────────────────────────────────────────────
tripsRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const id = req.params.id;

  try {
    // Step 1: 해당 trip의 사진 storage_path 목록 조회
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('id, storage_path')
      .eq('trip_id', id);

    if (fetchError) {
      const response: ApiResponse<never> = { success: false, error: `사진 조회 실패: ${fetchError.message}` };
      return res.status(500).json(response);
    }

    // Step 2: Supabase Storage에서 파일 삭제
    // URL에서 버킷 이후 경로(storagePath)를 추출해야 remove()가 동작함
    if (photos && photos.length > 0) {
      const storagePaths = photos
        .map((p: { storage_path: string }) => {
          // 공개 URL 형태: https://.../storage/v1/object/public/trip-photos/photos/...
          const match = p.storage_path.match(/trip-photos\/(.+)$/);
          return match ? match[1] : null;
        })
        .filter((p): p is string => p !== null);

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('trip-photos')
          .remove(storagePaths);

        if (storageError) {
          // Rule 2: Storage 삭제 실패해도 DB 삭제는 계속 진행
          console.warn('[TripsRoute/DELETE] Storage 파일 삭제 일부 실패 (무시):', storageError.message);
        }
      }
    }

    // Step 3: trips 테이블에서 여행 삭제 (CASCADE로 photos도 자동 삭제됨)
    const { error: deleteError } = await supabase
      .from('trips')
      .delete()
      .eq('id', id);

    if (deleteError) {
      const response: ApiResponse<never> = { success: false, error: `여행 삭제 실패: ${deleteError.message}` };
      return res.status(500).json(response);
    }

    const response: ApiResponse<{ deleted_trip_id: string }> = {
      success: true,
      data: { deleted_trip_id: id },
    };
    return res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});

// ─────────────────────────────────────────────
// POST /api/trips — 새 여행 생성
// ─────────────────────────────────────────────
tripsRouter.post('/', async (req: Request<object, object, CreateTripBody>, res: Response) => {
  const { title, description, theme, metadata } = req.body;

  if (!title || !theme) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'title과 theme은 필수 항목입니다.',
    };
    return res.status(400).json(response);
  }

  try {
    const { data, error } = await supabase
      .from('trips')
      .insert({
        title,
        description: description ?? null,
        theme,
        metadata: metadata ?? {}, // Rule 1: JSONB 필드로 모든 부가정보 수용
      })
      .select()
      .single();

    if (error) {
      const response: ApiResponse<never> = { success: false, error: error.message };
      return res.status(500).json(response);
    }

    const response: ApiResponse<Trip> = { success: true, data: data as Trip };
    return res.status(201).json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});

// ─────────────────────────────────────────────
// PATCH /api/trips/:id — 여행 기본 정보(title, description, theme) 업데이트
// ─────────────────────────────────────────────
tripsRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, theme } = req.body;

  try {
    const updates: Partial<Trip> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (theme !== undefined) updates.theme = theme;

    const { data, error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const response: ApiResponse<never> = { success: false, error: error.message };
      return res.status(500).json(response);
    }

    const response: ApiResponse<Trip> = { success: true, data: data as Trip };
    return res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});

// ─────────────────────────────────────────────
// PATCH /api/trips/:id/metadata — metadata JSONB 부분 업데이트 (Rule 1)
// 새 테마 추가 시 DDL 변경 없이 이 엔드포인트만 사용
// ─────────────────────────────────────────────
tripsRouter.patch(
  '/:id/metadata',
  async (req: Request<{ id: string }, object, PatchTripMetadataBody>, res: Response) => {
    const { id } = req.params;
    const { metadata } = req.body;

    if (!metadata || typeof metadata !== 'object') {
      const response: ApiResponse<never> = {
        success: false,
        error: 'metadata 객체가 필요합니다.',
      };
      return res.status(400).json(response);
    }

    try {
      // 기존 metadata와 병합하여 부분 업데이트 (JSONB || 연산자 활용)
      const { data: existing, error: fetchError } = await supabase
        .from('trips')
        .select('metadata')
        .eq('id', id)
        .single();

      if (fetchError) {
        const statusCode = fetchError.code === 'PGRST116' ? 404 : 500;
        const response: ApiResponse<never> = {
          success: false,
          error: statusCode === 404 ? `여행(id: ${id})을 찾을 수 없습니다.` : fetchError.message,
        };
        return res.status(statusCode).json(response);
      }

      const mergedMetadata = {
        ...(existing?.metadata as Record<string, unknown> ?? {}),
        ...metadata,
      };

      const { data, error } = await supabase
        .from('trips')
        .update({ metadata: mergedMetadata })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        const response: ApiResponse<never> = { success: false, error: error.message };
        return res.status(500).json(response);
      }

      const response: ApiResponse<Trip> = { success: true, data: data as Trip };
      return res.json(response);
    } catch (err) {
      const response: ApiResponse<never> = { success: false, error: (err as Error).message };
      return res.status(500).json(response);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/trips/from-photos — 다중 사진 업로드 기반 여행 자동 생성 (v2.0)
//
// 처리 흐름:
// 1. uploadMulti.fields로 최대 200장 수신
// 2. 각 사진에 대해 EXIF + Vision 병렬 추출 (Promise.allSettled — 일부 실패 허용)
// 3. 추출된 메타데이터를 종합하여 GPT-4o-mini로 여행 title/description/theme 자동 생성
// 4. trips 테이블에 새 여행 INSERT
// 5. 사진들을 Supabase Storage에 업로드 + photos 테이블 일괄 INSERT (Promise.allSettled)
// 6. { trip, photos } 반환
// ─────────────────────────────────────────────

// ── 내부 헬퍼: OpenAI로 여행 정보 자동 생성 (v2.1) ──
// description은 AI가 생성하지 않음 → 날짜 범위 계산으로 대체
interface GeneratedTripInfo {
  title: string;
  theme: 'travel' | 'food' | 'diary';
}

async function generateTripInfoFromMetadata(
  summaries: string[]
): Promise<GeneratedTripInfo> {
  const FALLBACK_TRIP: GeneratedTripInfo = {
    title: '나의 여행',
    theme: 'travel',
  };

  if (!process.env.OPENAI_API_KEY) {
    console.warn('[TripsRoute/from-photos] OPENAI_API_KEY 없음 — 기본 여행 정보 사용');
    return FALLBACK_TRIP;
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const metaSummary = summaries.slice(0, 30).join('\n'); // 토큰 절약: 최대 30개

    // v2.1: description은 AI가 생성하지 않음 (날짜 범위 계산으로 대체)
    // 제목에 연도를 포함하지 않도록 명시적으로 지시
    const prompt = `다음은 여행 사진들에서 추출한 메타데이터 목록입니다:

${metaSummary}

이 정보를 바탕으로 이 여행의 제목(title)과 테마(theme)만 추론해주세요.
- theme은 반드시 "travel", "food", "diary" 중 하나만 선택
- 한국어로 작성
- 제목에 연도(예: 2026년, 2024년 등)는 절대 포함하지 말 것. 연도는 목차에 따로 표시되므로 중복을 피해야 함.
- 아래 JSON 형식으로만 응답하고, 다른 텍스트는 절대 포함하지 말 것:
{"title":"...","theme":"travel"|"food"|"diary"}`;

    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = res.choices[0]?.message?.content?.trim() ?? '';
    const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr) as Partial<GeneratedTripInfo>;

    const validThemes: Array<'travel' | 'food' | 'diary'> = ['travel', 'food', 'diary'];
    return {
      title: typeof parsed.title === 'string' && parsed.title ? parsed.title : FALLBACK_TRIP.title,
      theme: validThemes.includes(parsed.theme as 'travel' | 'food' | 'diary')
        ? (parsed.theme as 'travel' | 'food' | 'diary')
        : 'travel',
    };
  } catch (err) {
    // Rule 2: GPT 실패 시 기본값 반환, 절대 throw하지 않음
    console.warn('[TripsRoute/from-photos] GPT 여행 정보 생성 실패 — FALLBACK 사용:', (err as Error).message);
    return FALLBACK_TRIP;
  }
}

// ── 내부 헬퍼: EXIF taken_at 배열로 여행 날짜 범위 문자열 계산 (v2.1) ──
// 예시: "6월 15일 ~ 6월 17일 (2박 3일)", "6월 15일 (당일치기)", "날짜 정보 없음"
function calculateTripDateInfo(takenAts: (string | null)[]): { description: string; startDate: string | null } {
  // 문자열에서 YYYY-MM-DD 날짜 부분만 추출 (타임존 파싱 오류 방지)
  // taken_at_local: "2024-06-15T12:00:00" → "2024-06-15"
  // taken_at (UTC): "2024-06-15T03:00:00.000Z" → UTC 기준이므로 가급적 taken_at_local 우선 사용
  interface DateParts { year: number; month: number; day: number; original: string; }

  const dateParts: DateParts[] = [];
  for (const t of takenAts) {
    if (!t || t.length === 0) continue;
    // "YYYY-MM-DD" 패턴 추출 (taken_at_local은 "YYYY-MM-DDTHH:MM:SS" 형태)
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      dateParts.push({ year: parseInt(m[1]), month: parseInt(m[2]), day: parseInt(m[3]), original: t });
    }
  }

  if (dateParts.length === 0) return { description: '날짜 정보 없음', startDate: null };

  // 숫자 비교로 min/max 찾기 (YYYYMMDD 정수로 변환)
  const toNum = (dp: DateParts) => dp.year * 10000 + dp.month * 100 + dp.day;
  dateParts.sort((a, b) => toNum(a) - toNum(b));

  const minDP = dateParts[0];
  const maxDP = dateParts[dateParts.length - 1];

  const formatMD = (dp: DateParts): string => `${dp.month}월 ${dp.day}일`;

  const minStr = formatMD(minDP);
  const maxStr = formatMD(maxDP);

  // startDate를 위한 Date 객체 (UTC 기준으로 안전하게 생성)
  const startDate = new Date(Date.UTC(minDP.year, minDP.month - 1, minDP.day)).toISOString();

  // 같은 날인지 확인
  const isSameDay = toNum(minDP) === toNum(maxDP);

  if (isSameDay) {
    return { description: `${minStr} (당일치기)`, startDate };
  }

  // 박수 계산: 날짜 차이 (Date.UTC 사용으로 DST/timezone 영향 없음)
  const msPerDay = 1000 * 60 * 60 * 24;
  const minMs = Date.UTC(minDP.year, minDP.month - 1, minDP.day);
  const maxMs = Date.UTC(maxDP.year, maxDP.month - 1, maxDP.day);
  const nights = Math.round((maxMs - minMs) / msPerDay);
  const days = nights + 1;

  return { description: `${minStr} ~ ${maxStr} (${nights}박 ${days}일)`, startDate };
}

// ── 내부 헬퍼: 특정 여행(tripId)의 모든 사진을 조회하여 여행 기간(description, start_date) 재계산 ──
async function updateTripDateRange(tripId: string): Promise<void> {
  const { data: trip } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
  if (!trip) return;

  const { data: photos } = await supabase.from('photos').select('taken_at, metadata').eq('trip_id', tripId);
  if (!photos || photos.length === 0) return;

  const takenAts = photos.map(p => p.metadata?.taken_at_local || p.taken_at);
  const dateInfo = calculateTripDateInfo(takenAts);

  await supabase.from('trips').update({
    description: dateInfo.description,
    metadata: { ...trip.metadata, start_date: dateInfo.startDate }
  }).eq('id', tripId);
}

tripsRouter.post(
  '/from-photos',
  uploadMulti.fields([{ name: 'photos', maxCount: 200 }, { name: 'exif_chunks', maxCount: 200 }]),
  async (req: Request, res: Response) => {
    let files = (req.files as any)?.['photos'] as Express.Multer.File[] | undefined;
    const exifChunks = (req.files as any)?.['exif_chunks'] as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: '사진 파일이 없습니다. multipart/form-data로 "photos" 필드에 1장 이상의 이미지를 전송하세요.',
      };
      return res.status(400).json(response);
    }

    // [v2.15] Batch Deduplication: 한 번의 업로드 내에서 중복된 파일(이름+크기) 제거
    const seenBatch = new Set<string>();
    const uniqueFiles: Express.Multer.File[] = [];
    const uniqueExifChunks: Express.Multer.File[] = [];

    files.forEach((file, idx) => {
      const key = `${file.originalname}-${file.size}`;
      if (!seenBatch.has(key)) {
        seenBatch.add(key);
        uniqueFiles.push(file);
        if (exifChunks) uniqueExifChunks.push(exifChunks[idx]);
      }
    });

    files = uniqueFiles;
    const finalExifChunks = exifChunks ? uniqueExifChunks : undefined;

    try {
      // ── Step 1: 각 사진 EXIF + Vision 병렬 추출 (v3.8: 공통 헬퍼) ──
      const processedFiles = await extractPhotoMeta(files, finalExifChunks);

      // ── Step 2: 메타데이터 요약 문자열 생성 (GPT 입력용) ──
      const summaries = processedFiles.map(({ file, exif, vision }, idx) => {
        const parts: string[] = [`[사진 ${idx + 1}] 파일명: ${file.originalname}`];
        if (exif.taken_at) parts.push(`촬영시각: ${exif.taken_at}`);
        if (exif.latitude != null && exif.longitude != null) {
          parts.push(`위치: 위도 ${exif.latitude.toFixed(4)}, 경도 ${exif.longitude.toFixed(4)}`);
        }
        if (vision?.category) parts.push(`카테고리: ${vision.category}`);  // v2.4: category로 교체
        return parts.join(' | ');
      });

      // ── Step 3: GPT-4o-mini로 여행 제목·테마 자동 생성 ──
      const tripInfo = await generateTripInfoFromMetadata(summaries);

      // ── Step 3-b: EXIF taken_at 배열로 날짜 범위 description 계산 (v2.1) ──
      const takenAts = processedFiles.map(({ exif }) => exif.taken_at_local || exif.taken_at);
      const dateInfo = calculateTripDateInfo(takenAts);

      // ── Step 4: trips 테이블에 새 여행 INSERT ──
      const { data: newTrip, error: tripError } = await supabase
        .from('trips')
        .insert({
          title: tripInfo.title,
          description: dateInfo.description,   // v2.1: AI 생성 X → 날짜 범위 자동 계산
          theme: tripInfo.theme,
          metadata: {
            auto_generated: true,
            photo_count: files.length,
            generated_at: new Date().toISOString(),
            start_date: dateInfo.startDate,
          },
        })
        .select()
        .single();

      if (tripError || !newTrip) {
        const response: ApiResponse<never> = {
          success: false,
          error: `여행 생성 실패: ${tripError?.message ?? '알 수 없는 오류'}`,
        };
        return res.status(500).json(response);
      }

      const tripId = (newTrip as Trip).id;

      // ── Step 5: 사진 Storage 업로드 + photos 테이블 일괄 INSERT (v3.8: 공통 헬퍼) ──
      const { succeededPhotos, failedCount } = await uploadAndInsertPhotos(tripId, processedFiles);

      // ── Step 6: 최종 응답 ──
      const responseData = {
        trip: newTrip as Trip,
        photos: succeededPhotos,
        summary: {
          total: files.length,
          succeeded: succeededPhotos.length,
          failed: failedCount,
          classified: succeededPhotos.filter((p) => p.classified).length,
          unclassified: succeededPhotos.filter((p) => !p.classified).length,
        },
      };

      return res.status(201).json({ success: true, data: responseData });
    } catch (err) {
      // Rule 2: 최상위 catch — 절대 500으로 서버를 죽이지 않음
      console.error('[TripsRoute/from-photos] 예상치 못한 오류:', (err as Error).message);
      const response: ApiResponse<never> = {
        success: false,
        error: (err as Error).message,
      };
      return res.status(500).json(response);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/trips/:id/photos — 기존 여행에 다중 사진 추가 (v2.4)
//
// 역할: 이미 생성된 여행(trip_id = :id)에 사진들을 추가로 업로드
// from-photos와 다른 점: 여행 제목/테마 AI 생성 없음, 사진 처리만 수행
//
// 처리 흐름:
// 1. req.params.id 로 trip_id 획득
// 2. req.files 에서 다수 이미지 수신 (uploadMulti.fields, 최대 200장)
// 3. 각 파일: EXIF 추출 + Vision API 호출 (Promise.allSettled)
// 4. Supabase Storage 업로드 + photos 테이블 INSERT (Promise.allSettled)
// 5. 성공한 Photo[] 반환
// ─────────────────────────────────────────────
tripsRouter.post(
  '/:id/photos',
  uploadMulti.fields([{ name: 'photos', maxCount: 200 }, { name: 'exif_chunks', maxCount: 200 }]),
  async (req: Request<{ id: string }>, res: Response) => {
    const tripId = req.params.id;
    let files = (req.files as any)?.['photos'] as Express.Multer.File[] | undefined;
    const exifChunks = (req.files as any)?.['exif_chunks'] as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: '사진 파일이 없습니다. multipart/form-data로 "photos" 필드에 1장 이상의 이미지를 전송하세요.',
      };
      return res.status(400).json(response);
    }

    try {
      // [v2.15] Deduplication: 기존 DB에 있는 파일명과 Batch 내 중복 제거
      const { data: existingPhotos } = await supabase
        .from('photos')
        .select('original_filename')
        .eq('trip_id', tripId);

      const dbFileNames = new Set(existingPhotos?.map(p => p.original_filename) || []);
      const seenBatch = new Set<string>();
      const uniqueFiles: Express.Multer.File[] = [];
      const uniqueExifChunks: Express.Multer.File[] = [];

      files.forEach((file, idx) => {
        // 이미 DB에 있는 파일명은 건너뜀
        if (dbFileNames.has(file.originalname)) return;

        // 동일한 업로드 묶음 내 중복 방지
        const key = `${file.originalname}-${file.size}`;
        if (!seenBatch.has(key)) {
          seenBatch.add(key);
          uniqueFiles.push(file);
          if (exifChunks) uniqueExifChunks.push(exifChunks[idx]);
        }
      });

      files = uniqueFiles;
      const finalExifChunks = exifChunks ? uniqueExifChunks : undefined;

      // 만약 모든 파일이 중복이라서 남은 파일이 없다면 성공(빈 배열) 반환
      if (files.length === 0) {
        return res.status(201).json({
          success: true,
          data: {
            trip_id: tripId,
            photos: [],
            summary: { total: 0, succeeded: 0, failed: 0, classified: 0, unclassified: 0 }
          }
        });
      }

      // ── Step 1: 각 사진 EXIF + Vision 병렬 처리 (v3.8: 공통 헬퍼) ──
      const processedFiles = await extractPhotoMeta(files, finalExifChunks);

      // ── Step 2: Storage 업로드 + photos 테이블 INSERT (v3.8: 공통 헬퍼) ──
      const { succeededPhotos, failedCount } = await uploadAndInsertPhotos(tripId, processedFiles);

      // v4.0: 사진이 추가되었으므로 전체 사진을 기준으로 여행 기간(당일치기/N박M일)을 다시 계산
      if (succeededPhotos.length > 0) {
        await updateTripDateRange(tripId);
      }

      // ── Step 3: 응답 반환 ──
      const responseData = {
        trip_id: tripId,
        photos: succeededPhotos,
        summary: {
          total: files.length,
          succeeded: succeededPhotos.length,
          failed: failedCount,
          classified: succeededPhotos.filter((p) => p.classified).length,
          unclassified: succeededPhotos.filter((p) => !p.classified).length,
        },
      };

      return res.status(201).json({ success: true, data: responseData });
    } catch (err) {
      // Rule 2: 최상위 catch — 절대 500으로 서버를 죽이지 않음
      console.error('[TripsRoute/:id/photos] 예상치 못한 오류:', (err as Error).message);
      const response: ApiResponse<never> = {
        success: false,
        error: (err as Error).message,
      };
      return res.status(500).json(response);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/trips/:id/diary — AI 기반 여행 일기 자동 생성
// ─────────────────────────────────────────────
tripsRouter.post('/:id/diary', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  try {
    // 1. 여행 정보 및 사진 목록 조회 (taken_at 오름차순)
    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .single();

    if (tripError || !tripData) {
      const response: ApiResponse<never> = { success: false, error: '여행 정보를 찾을 수 없습니다.' };
      return res.status(404).json(response);
    }

    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('*')
      .eq('trip_id', id)
      .order('taken_at', { ascending: true });

    if (photosError) {
      const response: ApiResponse<never> = { success: false, error: '사진 목록을 불러오는 데 실패했습니다.' };
      return res.status(500).json(response);
    }

    if (!photos || photos.length === 0) {
      const response: ApiResponse<never> = { success: false, error: '일기를 생성할 사진이 없습니다.' };
      return res.status(400).json(response);
    }

    // 2. 프롬프트 문자열 구성
    const trip = tripData as Trip;
    const photoSummaries = (photos as Photo[])
      .map((p, idx) => {
        let summary = `[사진 ${idx + 1}]`;
        if (p.taken_at) summary += ` 촬영시각: ${p.taken_at}`;
        
        const tags = p.vision_tags as VisionTags | null;
        if (tags) {
          const parts = [];
          if (tags.category) parts.push(`분류: ${tags.category}`);
          if (parts.length > 0) summary += ` | ${parts.join(', ')}`;
        }
        return summary;
      })
      .join('\n');

    const prompt = `다음은 "${trip.title}" 여행에서 촬영된 사진들의 타임라인 정보입니다:

${photoSummaries}

이 타임라인 데이터를 바탕으로, 이 여행의 과정과 감정을 담아 매우 감성적이고 아름다우며 성찰적인 여행 일기를 한국어로 작성해주세요.
[중요 지침]
1. 절대 "IMG_3027.JPG"와 같은 파일명이나 "[사진 1]" 같은 기계적인 식별자를 일기 본문에 직접 노출하지 마세요.
2. 제공된 사진의 촬영 시간과 분류(카테고리) 정보를 바탕으로, 그 순간 어떤 일이 있었는지 유추하여 각 사진마다 한 문장 정도로 자연스럽고 시적으로 요약 묘사해 주세요.
3. 응답은 다른 인사말 없이 일기 본문 텍스트만 출력해주세요.`;

    // 3. OpenAI API 호출
    if (!process.env.OPENAI_API_KEY) {
      const response: ApiResponse<never> = { success: false, error: 'OpenAI API 키가 설정되지 않았습니다.' };
      return res.status(500).json(response);
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const aiResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '당신은 감수성이 풍부하고 시적인 표현을 잘하는 최고의 여행 작가입니다.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const diary = aiResponse.choices[0]?.message?.content?.trim() || '일기 생성에 실패했습니다.';

    // 4. metadata에 저장 (Rule 1: 기존 JSONB 데이터와 병합)
    const existingMetadata = (trip.metadata as Record<string, any>) || {};
    const mergedMetadata = {
      ...existingMetadata,
      diary,
      diary_generated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('trips')
      .update({ metadata: mergedMetadata })
      .eq('id', id);

    if (updateError) {
      const response: ApiResponse<never> = { success: false, error: '일기를 저장하는 중 오류가 발생했습니다.' };
      return res.status(500).json(response);
    }

    // 5. 응답 반환
    return res.json({ success: true, data: { diary } });

  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});
