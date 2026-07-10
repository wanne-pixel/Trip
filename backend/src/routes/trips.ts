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
// 최대 50장 / 장당 20MB / 이미지 파일만 허용
// ─────────────────────────────────────────────
const uploadMulti = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식: ${file.mimetype}`));
    }
  },
});

// ─────────────────────────────────────────────
// GET /api/trips — 모든 여행 목록 조회
// ─────────────────────────────────────────────
tripsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      const response: ApiResponse<never> = { success: false, error: error.message };
      return res.status(500).json(response);
    }

    const response: ApiResponse<Trip[]> = { success: true, data: (data as Trip[]) ?? [] };
    return res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
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
// 1. multer.array('photos', 50)로 최대 50장 수신
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
function calculateTripDateDescription(takenAts: (string | null)[]): string {
  const validDates: Date[] = takenAts
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .map((t) => new Date(t))
    .filter((d) => !isNaN(d.getTime()));

  if (validDates.length === 0) return '날짜 정보 없음';

  const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));

  const formatMD = (d: Date): string => {
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}월 ${day}일`;
  };

  const minStr = formatMD(minDate);
  const maxStr = formatMD(maxDate);

  // 같은 날인지 확인 (년·월·일 모두 비교)
  const isSameDay =
    minDate.getFullYear() === maxDate.getFullYear() &&
    minDate.getMonth() === maxDate.getMonth() &&
    minDate.getDate() === maxDate.getDate();

  if (isSameDay) {
    return `${minStr} (당일치기)`;
  }

  // 박수 계산: 자정 기준으로 날짜 차이
  const msPerDay = 1000 * 60 * 60 * 24;
  const minMidnight = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  const maxMidnight = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
  const diffDays = Math.round((maxMidnight.getTime() - minMidnight.getTime()) / msPerDay);
  const nights = diffDays;
  const days = diffDays + 1;

  return `${minStr} ~ ${maxStr} (${nights}박 ${days}일)`;
}

tripsRouter.post(
  '/from-photos',
  uploadMulti.array('photos', 50),
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: '사진 파일이 없습니다. multipart/form-data로 "photos" 필드에 1장 이상의 이미지를 전송하세요.',
      };
      return res.status(400).json(response);
    }

    try {
      // ── Step 1: 각 사진 EXIF + Vision 병렬 추출 ──
      // Promise.allSettled: 일부 실패해도 전체 중단 없음 (Rule 2)
      const metaResults = await Promise.allSettled(
        files.map(async (file) => {
          const exif: ExifResult = await extractExif(file.buffer);

          // 사진마다 태그를 붙이기 위해 항상 Vision API 호출 (v2.0)
          const base64 = file.buffer.toString('base64');
          const vision: VisionTags | null = await extractVisionTags(base64, file.mimetype);

          return { file, exif, vision };
        })
      );

      // 성공 결과만 추출 (실패한 파일은 기본값으로 대체)
      const processedFiles = metaResults.map((result, idx) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        console.warn(`[TripsRoute/from-photos] 파일[${idx}] 메타 추출 실패 — FALLBACK:`, result.reason);
        return {
          file: files[idx],
          exif: { taken_at: null, latitude: null, longitude: null, classified: false } as ExifResult,
          vision: null as VisionTags | null,
        };
      });

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
      const takenAts = processedFiles.map(({ exif }) => exif.taken_at);
      const tripDescription = calculateTripDateDescription(takenAts);

      // ── Step 4: trips 테이블에 새 여행 INSERT ──
      const { data: newTrip, error: tripError } = await supabase
        .from('trips')
        .insert({
          title: tripInfo.title,
          description: tripDescription,   // v2.1: AI 생성 X → 날짜 범위 자동 계산
          theme: tripInfo.theme,
          metadata: {
            auto_generated: true,
            photo_count: files.length,
            generated_at: new Date().toISOString(),
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

      // ── Step 5: 사진 Storage 업로드 + photos 테이블 일괄 INSERT ──
      // Promise.allSettled: 일부 사진 업로드 실패해도 전체 여행 생성 중단 없음 (Rule 2)
      const photoResults = await Promise.allSettled(
        processedFiles.map(async ({ file, exif, vision }) => {
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

          // photos 테이블 INSERT
          const { data: photoData, error: dbError } = await supabase
            .from('photos')
            .insert({
              id: photoId,
              trip_id: tripId,           // v2.0: NOT NULL — 반드시 부여
              storage_path: publicUrlData.publicUrl,
              original_filename: file.originalname,
              taken_at: exif.taken_at,
              latitude: exif.latitude,
              longitude: exif.longitude,
              classified: exif.classified,
              vision_tags: vision,
              metadata: {},               // Rule 1: JSONB 초기값
            })
            .select()
            .single();

          if (dbError) {
            throw new Error(`DB INSERT 실패 (${file.originalname}): ${dbError.message}`);
          }

          return photoData as Photo;
        })
      );

      // 성공한 사진만 모아 반환 / 실패한 사진은 경고 로그
      const succeededPhotos: Photo[] = [];
      const failedCount = { count: 0 };

      photoResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          succeededPhotos.push(result.value);
        } else {
          failedCount.count++;
          console.warn(
            `[TripsRoute/from-photos] 사진[${idx}] 저장 실패:`,
            result.reason instanceof Error ? result.reason.message : result.reason
          );
        }
      });

      // ── Step 6: 최종 응답 ──
      const responseData = {
        trip: newTrip as Trip,
        photos: succeededPhotos,
        summary: {
          total: files.length,
          succeeded: succeededPhotos.length,
          failed: failedCount.count,
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
// 2. req.files 에서 다수 이미지 수신 (multer.array, 최대 50장)
// 3. 각 파일: EXIF 추출 + Vision API 호출 (Promise.allSettled)
// 4. Supabase Storage 업로드 + photos 테이블 INSERT (Promise.allSettled)
// 5. 성공한 Photo[] 반환
// ─────────────────────────────────────────────
tripsRouter.post(
  '/:id/photos',
  uploadMulti.array('photos', 50),
  async (req: Request<{ id: string }>, res: Response) => {
    const tripId = req.params.id;
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: '사진 파일이 없습니다. multipart/form-data로 "photos" 필드에 1장 이상의 이미지를 전송하세요.',
      };
      return res.status(400).json(response);
    }

    try {
      // ── Step 1: 각 사진 EXIF + Vision 병렬 처리 ──
      // Promise.allSettled: 일부 실패해도 전체 중단 없음 (Rule 2)
      const metaResults = await Promise.allSettled(
        files.map(async (file) => {
          const exif: ExifResult = await extractExif(file.buffer);

          // 모든 사진에 Vision API 호출 (category 태그 부여)
          const base64 = file.buffer.toString('base64');
          const vision: VisionTags | null = await extractVisionTags(base64, file.mimetype);

          return { file, exif, vision };
        })
      );

      // 실패한 파일은 FALLBACK으로 대체
      const processedFiles = metaResults.map((result, idx) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        console.warn(`[TripsRoute/:id/photos] 파일[${idx}] 메타 추출 실패 — FALLBACK:`, result.reason);
        return {
          file: files[idx],
          exif: { taken_at: null, latitude: null, longitude: null, classified: false } as ExifResult,
          vision: null as VisionTags | null,
        };
      });

      // ── Step 2: Storage 업로드 + photos 테이블 INSERT ──
      // Promise.allSettled: 일부 실패해도 다른 사진 계속 저장 (Rule 2)
      const photoResults = await Promise.allSettled(
        processedFiles.map(async ({ file, exif, vision }) => {
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

          // photos 테이블 INSERT
          const { data: photoData, error: dbError } = await supabase
            .from('photos')
            .insert({
              id: photoId,
              trip_id: tripId,              // 기존 여행 ID 부여
              storage_path: publicUrlData.publicUrl,
              original_filename: file.originalname,
              taken_at: exif.taken_at,
              latitude: exif.latitude,
              longitude: exif.longitude,
              classified: exif.classified,
              vision_tags: vision,
              metadata: {},                 // Rule 1: JSONB 초기값
            })
            .select()
            .single();

          if (dbError) {
            throw new Error(`DB INSERT 실패 (${file.originalname}): ${dbError.message}`);
          }

          return photoData as Photo;
        })
      );

      // 성공한 사진만 모아 반환
      const succeededPhotos: Photo[] = [];
      let failedCount = 0;

      photoResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          succeededPhotos.push(result.value);
        } else {
          failedCount++;
          console.warn(
            `[TripsRoute/:id/photos] 사진[${idx}] 저장 실패:`,
            result.reason instanceof Error ? result.reason.message : result.reason
          );
        }
      });

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
