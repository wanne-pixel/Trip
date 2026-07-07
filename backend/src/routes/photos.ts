import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { supabase } from '../config/supabase.js';
import { extractExif } from '../services/exifService.js';
import { extractVisionTags } from '../services/visionService.js';
import type { Photo, ApiResponse, UploadPhotoBody } from '../types/index.js';

export const photosRouter = Router();

// ─────────────────────────────────────────────
// Multer 설정 — 메모리 스토리지 (Supabase에 직접 업로드)
// 파일 크기 제한: 20MB
// ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식입니다: ${file.mimetype}`));
    }
  },
});

// ─────────────────────────────────────────────
// POST /api/photos/upload — 사진 업로드
//
// 처리 순서:
// 1. multer로 파일 수신
// 2. EXIF 추출 (실패 시 classified: false, Rule 2)
// 3. classified: false → Vision API 호출 (실패 시 null, Rule 2)
// 4. Supabase Storage에 업로드
// 5. photos 테이블에 INSERT
// 6. Photo 객체 반환
// ─────────────────────────────────────────────
photosRouter.post(
  '/upload',
  upload.single('photo'),
  async (req: Request<object, object, UploadPhotoBody>, res: Response) => {
    // 파일 존재 여부 확인
    if (!req.file) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'photo 파일이 없습니다. multipart/form-data로 "photo" 필드를 전송하세요.',
      };
      return res.status(400).json(response);
    }

    const file = req.file;
    const trip_id = req.body.trip_id ?? null;
    const metadata = (() => {
      try {
        return req.body.metadata
          ? (JSON.parse(req.body.metadata as unknown as string) as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    })();

    try {
      // ── Step 1: EXIF 추출 (Rule 2: 실패해도 앱 계속 동작) ──
      const exifResult = await extractExif(file.buffer);

      // ── Step 2: Vision 태그 추출 (classified: false인 경우에만) ──
      // classified: true = 타임라인 배치, false = 미분류 서랍 → Vision으로 보완
      let vision_tags = null;
      if (!exifResult.classified) {
        const base64 = file.buffer.toString('base64');
        vision_tags = await extractVisionTags(base64, file.mimetype);
        // Rule 2: extractVisionTags는 절대 throw하지 않으므로 null이면 그냥 진행
      }

      // ── Step 3: Supabase Storage에 업로드 ──
      const ext = path.extname(file.originalname) || '.jpg';
      const photoId = uuidv4();
      const storagePath = `photos/${photoId}${ext}`;

      const { error: storageError } = await supabase.storage
        .from('trip-photos') // Supabase Storage 버킷 이름
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (storageError) {
        console.error('[PhotosRoute] Storage 업로드 실패:', storageError.message);
        const response: ApiResponse<never> = {
          success: false,
          error: `스토리지 업로드 실패: ${storageError.message}`,
        };
        return res.status(500).json(response);
      }

      // Storage 공개 URL 획득
      const { data: publicUrlData } = supabase.storage
        .from('trip-photos')
        .getPublicUrl(storagePath);
      const storage_path = publicUrlData.publicUrl;

      // ── Step 4: photos 테이블에 INSERT ──
      const newPhoto: Omit<Photo, 'created_at'> & { id: string } = {
        id: photoId,
        trip_id: trip_id ?? '',
        storage_path,
        original_filename: file.originalname,
        taken_at: exifResult.taken_at,
        latitude: exifResult.latitude,
        longitude: exifResult.longitude,
        classified: exifResult.classified,
        vision_tags,
        metadata, // Rule 1: JSONB 필드에 모든 부가정보 저장
      };

      const { data, error: dbError } = await supabase
        .from('photos')
        .insert(newPhoto)
        .select()
        .single();

      if (dbError) {
        console.error('[PhotosRoute] DB INSERT 실패:', dbError.message);
        const response: ApiResponse<never> = {
          success: false,
          error: `데이터베이스 저장 실패: ${dbError.message}`,
        };
        return res.status(500).json(response);
      }

      const response: ApiResponse<Photo> = { success: true, data: data as Photo };
      return res.status(201).json(response);
    } catch (err) {
      // Rule 2: 최상위 catch — 절대 500으로 서버 죽이지 않음
      console.error('[PhotosRoute] 예상치 못한 오류:', (err as Error).message);
      const response: ApiResponse<never> = {
        success: false,
        error: (err as Error).message,
      };
      return res.status(500).json(response);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/photos/unclassified — 미분류 사진 목록 조회
// Rule 2: classified: false인 사진을 "미분류 서랍(Unclassified Drawer)"으로 분기
// ─────────────────────────────────────────────
photosRouter.get('/unclassified', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('classified', false)
      .order('created_at', { ascending: false });

    if (error) {
      const response: ApiResponse<never> = { success: false, error: error.message };
      return res.status(500).json(response);
    }

    const response: ApiResponse<Photo[]> = { success: true, data: (data as Photo[]) ?? [] };
    return res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});

// ─────────────────────────────────────────────
// GET /api/photos — 특정 trip의 사진 목록 조회 (선택적 trip_id 필터)
// ─────────────────────────────────────────────
photosRouter.get('/', async (req: Request, res: Response) => {
  const { trip_id } = req.query;

  try {
    let query = supabase.from('photos').select('*').order('taken_at', { ascending: true });

    if (trip_id && typeof trip_id === 'string') {
      query = query.eq('trip_id', trip_id);
    }

    const { data, error } = await query;

    if (error) {
      const response: ApiResponse<never> = { success: false, error: error.message };
      return res.status(500).json(response);
    }

    const response: ApiResponse<Photo[]> = { success: true, data: (data as Photo[]) ?? [] };
    return res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});
