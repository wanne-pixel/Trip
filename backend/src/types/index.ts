// ─────────────────────────────────────────────
// Trip Project — Core Type Definitions
// Rule 3: API Contract First — 이 파일이 모든 에이전트의 계약 기준
// ─────────────────────────────────────────────

// v2.4: VisionTags — 실용적인 카테고리 단일 필드로 개편
// 기존 time_of_day, environment → category 하나로 통합
export interface VisionTags {
  category?: 'food' | 'scenery' | 'accommodation' | 'activity' | 'people' | 'other';
}

export interface Photo {
  id: string;                         // UUID
  trip_id: string;                    // 소속 여행 ID
  storage_path: string;               // Supabase Storage URL
  original_filename: string;
  taken_at: string | null;            // ISO 8601 — EXIF 없으면 null
  latitude: number | null;            // EXIF 없으면 null
  longitude: number | null;           // EXIF 없으면 null
  classified: boolean;                // false = 미분류 서랍행
  vision_tags: VisionTags | null;     // Vision API 실패 시 null
  metadata: Record<string, unknown>;  // 테마별 부가 정보 (JSONB)
  created_at: string;                 // ISO 8601
}

export interface Trip {
  id: string;
  title: string;
  description: string | null;
  theme: string;                      // "travel" | "food" | "diary" | ...
  metadata: Record<string, unknown>;  // 테마별 부가 정보 (JSONB)
  created_at: string;
}

// ─────────────────────────────────────────────
// API 응답 표준 포맷 (Rule 2 — Graceful Fallback)
// 모든 엔드포인트는 반드시 이 형태로만 응답
// ─────────────────────────────────────────────
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// EXIF 추출 결과 내부 타입
// v3.8: 타임존 정보 추가 — DB 컬럼이 아닌 photos.metadata(JSONB)에 저장 (Rule 1)
export interface ExifResult {
  taken_at: string | null;
  latitude: number | null;
  longitude: number | null;
  classified: boolean;
  taken_at_local?: string | null;  // 촬영지 현지 벽시계 시각 "YYYY-MM-DDTHH:MM:SS"
  tz_offset?: string | null;       // 적용된 UTC 오프셋 "+09:00" | "+02:00" | ...
}

// 사진 업로드 요청 Body
export interface UploadPhotoBody {
  trip_id?: string;
  metadata?: Record<string, unknown>;
}

// 여행 생성 요청 Body
export interface CreateTripBody {
  title: string;
  description?: string;
  theme: string;
  metadata?: Record<string, unknown>;
}

// 여행 메타데이터 부분 업데이트 요청 Body (Rule 1 — Flexible Schema)
export interface PatchTripMetadataBody {
  metadata: Record<string, unknown>;
}
