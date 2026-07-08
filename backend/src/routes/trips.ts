import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import type { Trip, ApiResponse, CreateTripBody, PatchTripMetadataBody } from '../types/index';

export const tripsRouter = Router();

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
tripsRouter.get('/:id', async (req: Request, res: Response) => {
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
