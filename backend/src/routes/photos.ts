import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { supabase } from '../config/supabase';
import { extractExif } from '../services/exifService';
import { extractVisionTags } from '../services/visionService';
import type { Photo, ApiResponse, UploadPhotoBody } from '../types/index';

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
    const ext = file.originalname.toLowerCase().split('.').pop() || '';
    if (allowed.includes(file.mimetype) || (file.mimetype === 'application/octet-stream' && ['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext)) || file.mimetype === '') {
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

    // v2.0: trip_id는 필수 (photos.trip_id NOT NULL)
    if (!trip_id || trip_id === '') {
      const response: ApiResponse<never> = {
        success: false,
        error: 'trip_id가 필요합니다. 먼저 POST /api/trips로 여행을 생성하거나, POST /api/trips/from-photos를 사용하세요.',
      };
      return res.status(400).json(response);
    }
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

      // ── Step 2: Vision 태그 추출 (모든 사진에 태그 부여) ──
      const base64 = file.buffer.toString('base64');
      const vision_tags = await extractVisionTags(base64, file.mimetype);

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
      const newPhotoRow = {
        id: photoId,
        trip_id: trip_id as string,    // v2.0: NOT NULL — 이미 위에서 검증됨
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
        .insert(newPhotoRow)
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
// DELETE /api/photos/:id — 사진 단건 삭제 (v2.1)
// 처리 순서: storage_path 조회 → Storage 파일 삭제 → DB 레코드 삭제
// Storage 삭제 실패 시 경고만 남기고 DB 삭제는 계속 진행 (Rule 2)
// ─────────────────────────────────────────────
photosRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const id = req.params.id;

  try {
    // Step 1: 해당 사진의 storage_path 조회
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('id, storage_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      const statusCode = fetchError.code === 'PGRST116' ? 404 : 500;
      const response: ApiResponse<never> = {
        success: false,
        error: statusCode === 404 ? `사진(id: ${id})을 찾을 수 없습니다.` : fetchError.message,
      };
      return res.status(statusCode).json(response);
    }

    // Step 2: Supabase Storage에서 파일 삭제
    // 공개 URL에서 버킷 이후 경로만 추출
    const match = (photo as { storage_path: string }).storage_path.match(/trip-photos\/(.+)$/);
    if (match) {
      const storagePath = match[1];
      const { error: storageError } = await supabase.storage
        .from('trip-photos')
        .remove([storagePath]);

      if (storageError) {
        // Rule 2: Storage 삭제 실패해도 DB 삭제는 계속 진행
        console.warn(`[PhotosRoute/DELETE] Storage 파일 삭제 실패 (무시): ${storageError.message}`);
      }
    } else {
      console.warn(`[PhotosRoute/DELETE] storage_path 파싱 실패, Storage 삭제 건너뜀: ${(photo as { storage_path: string }).storage_path}`);
    }

    // Step 3: photos 테이블에서 레코드 삭제
    const { error: deleteError } = await supabase
      .from('photos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      const response: ApiResponse<never> = {
        success: false,
        error: `사진 삭제 실패: ${deleteError.message}`,
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse<{ deleted_photo_id: string }> = {
      success: true,
      data: { deleted_photo_id: id },
    };
    return res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});

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
// GET /api/photos/locations — 모든 여행의 위치 데이터 조회 (v2.17)
// ─────────────────────────────────────────────
photosRouter.get('/locations', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('id, trip_id, storage_path, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      const response: ApiResponse<never> = { success: false, error: error.message };
      return res.status(500).json(response);
    }

    // data format is what we want
    const response: ApiResponse<any[]> = { success: true, data: data ?? [] };
    return res.json(response);
  } catch (err) {
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});

// ─────────────────────────────────────────────
// GET /api/photos — 특정 trip의 사진 목록 조회 (선택적 trip_id 필터)
// TASK_AgentB_002: taken_at ASC 정렬 보강 (NULL은 맨 뒤 — 미분류 사진)
// ─────────────────────────────────────────────
photosRouter.get('/', async (req: Request, res: Response) => {
  const { trip_id, category } = req.query;

  try {
    // taken_at ASC 정렬: NULL(미분류)은 항상 맨 뒤 (nullsFirst: false)
    // 이렇게 해야 타임라인에서 시간순 정렬 후 미분류 서랍 항목이 뒤에 위치함
    let query = supabase
      .from('photos')
      .select('*')
      .order('taken_at', { ascending: true, nullsFirst: false });

    if (trip_id && typeof trip_id === 'string') {
      query = query.eq('trip_id', trip_id);
    }

    // v2.17 카테고리별 글로벌 모아보기 필터 지원
    if (category && typeof category === 'string') {
      query = query.eq('vision_tags->>category', category);
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

// ─────────────────────────────────────────────
// PATCH /api/photos/:id/metadata — 메타데이터 업데이트 (Rule 1, Rule 2)
// ─────────────────────────────────────────────
photosRouter.patch('/:id/metadata', async (req: Request<{ id: string }>, res: Response) => {
  const id = req.params.id;
  const newMetadata = req.body.metadata;

  if (!newMetadata || typeof newMetadata !== 'object') {
    const response: ApiResponse<never> = { success: false, error: '유효한 metadata 객체가 필요합니다.' };
    return res.status(400).json(response);
  }

  try {
    // 1. 기존 사진 조회
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('metadata')
      .eq('id', id)
      .single();

    if (fetchError) {
      const statusCode = fetchError.code === 'PGRST116' ? 404 : 500;
      const response: ApiResponse<never> = { 
        success: false, 
        error: statusCode === 404 ? `사진(id: ${id})을 찾을 수 없습니다.` : fetchError.message 
      };
      return res.status(statusCode).json(response);
    }

    // 2. 메타데이터 얕은 병합 (Rule 1)
    const existingMetadata = (photo.metadata as Record<string, any>) || {};
    const mergedMetadata = { ...existingMetadata, ...newMetadata };

    // 3. 업데이트 반영
    const { data: updatedData, error: updateError } = await supabase
      .from('photos')
      .update({ metadata: mergedMetadata })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      const response: ApiResponse<never> = { success: false, error: `메타데이터 업데이트 실패: ${updateError.message}` };
      return res.status(500).json(response);
    }

    // 4. 성공 응답
    const response: ApiResponse<Photo> = { success: true, data: updatedData as Photo };
    return res.json(response);

  } catch (err) {
    // Rule 2: 실패에 대한 방어 로직 (500 에러로 서버를 죽이지 않고 일관된 JSON 포맷 응답)
    const response: ApiResponse<never> = { success: false, error: (err as Error).message };
    return res.status(500).json(response);
  }
});
