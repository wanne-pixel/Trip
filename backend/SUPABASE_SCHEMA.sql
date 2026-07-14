-- ═══════════════════════════════════════════════════════════════
-- Trip Project — Supabase Schema (PostgreSQL)
-- v2.0 (TASK_AgentB_002)
-- Rule 1: 유연한 데이터 스키마 — metadata JSONB로 모든 부가정보 수용
-- Rule 2: 실패 시 앱 중단 없이 graceful fallback
-- v2.0 변경: trip_id NOT NULL — 모든 사진(미분류 포함)은 여행에 종속됨
-- DDL을 변경하지 않고 새 테마를 추가할 수 있도록 설계
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- Extension: UUID 생성을 위한 pgcrypto
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ═══════════════════════════════════════════════════════════════
-- 테이블: trips
-- 여행(Trip) 단위의 메타데이터를 저장합니다.
-- theme 컬럼: "travel" | "food" | "diary" | ... (자유 문자열)
-- metadata: 테마별 부가 정보를 JSONB로 저장 (Rule 1)
--   예시: { "total_budget": 500000, "destination": "제주" }
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS trips (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,                                         -- nullable: 입력 안 할 수 있음
  theme       TEXT        NOT NULL DEFAULT 'travel',        -- "travel" | "food" | "diary" | ...
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,     -- Rule 1: 테마별 부가 정보 (절대 컬럼 추가 금지)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  trips              IS 'Trip 프로젝트의 여행 단위. 테마별 부가정보는 metadata JSONB에 저장.';
COMMENT ON COLUMN trips.theme        IS '여행 테마. travel | food | diary | ... 자유 문자열.';
COMMENT ON COLUMN trips.metadata     IS 'Rule 1: 새 테마 추가 시 이 컬럼에만 데이터 추가. DDL 변경 금지.';


-- ═══════════════════════════════════════════════════════════════
-- 테이블: photos
-- 개별 사진의 EXIF, Vision, 메타데이터를 저장합니다.
--
-- classified: true  → EXIF DateTimeOriginal 존재 → 타임라인 배치
-- classified: false → EXIF 없음 → 미분류 서랍 (Rule 2)
-- vision_tags: JSONB → Vision API 실패 시 NULL (Rule 2)
-- metadata: JSONB → 테마별 부가 정보 (Rule 1)
--   예시: { "rating": 4.5, "caption": "맛있었다", "restaurant_name": "어머니 김밥" }
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS photos (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE, -- v2.0: NOT NULL — 모든 사진은 여행에 종속
  storage_path      TEXT        NOT NULL,                                 -- Supabase Storage 공개 URL
  original_filename TEXT        NOT NULL,
  taken_at          TIMESTAMPTZ,                                          -- Rule 2: EXIF 없으면 NULL
  latitude          DOUBLE PRECISION,                                     -- Rule 2: GPS 없으면 NULL
  longitude         DOUBLE PRECISION,                                     -- Rule 2: GPS 없으면 NULL
  classified        BOOLEAN     NOT NULL DEFAULT FALSE,                   -- Rule 2: EXIF 없으면 false
  vision_tags       JSONB,                                                -- Rule 2: Vision 실패 시 NULL
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,             -- Rule 1: 부가정보 JSONB
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  photos                 IS 'Trip 프로젝트의 사진. EXIF/Vision 정보 및 부가정보 저장.';
COMMENT ON COLUMN photos.trip_id         IS 'v2.0: NOT NULL — 미분류 사진(classified=false)도 반드시 trip_id 필요. from-photos API로 생성된 trip_id 부여.';
COMMENT ON COLUMN photos.taken_at        IS 'Rule 2: EXIF DateTimeOriginal 없으면 NULL. 앱 중단 금지.';
COMMENT ON COLUMN photos.classified      IS 'false = 미분류 서랍(Unclassified Drawer). true = 타임라인 배치.';
COMMENT ON COLUMN photos.vision_tags     IS 'Rule 2: OpenAI Vision API 결과. 실패 시 NULL. 재시도 없음.';
COMMENT ON COLUMN photos.vision_tags     IS 'Schema(v2.4): { category?: food|scenery|accommodation|activity|people|other }';
COMMENT ON COLUMN photos.metadata        IS 'Rule 1: 테마별 부가정보. DDL 변경 금지. 예: { rating, caption, restaurant_name }';


-- ═══════════════════════════════════════════════════════════════
-- 인덱스 (조회 성능 최적화)
-- ═══════════════════════════════════════════════════════════════

-- 미분류 서랍 조회: GET /api/photos/unclassified → classified = false 필터
CREATE INDEX IF NOT EXISTS idx_photos_classified ON photos(classified);

-- 여행별 사진 조회: GET /api/photos?trip_id=... → trip_id 필터
CREATE INDEX IF NOT EXISTS idx_photos_trip_id ON photos(trip_id);

-- 타임라인 정렬: taken_at 기준 정렬
CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON photos(taken_at);

-- 여행 목록 정렬: created_at 기준 내림차순
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);

-- JSONB 인덱스: metadata 내 검색 최적화 (GIN)
CREATE INDEX IF NOT EXISTS idx_trips_metadata   ON trips USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_photos_metadata  ON photos USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_photos_vision    ON photos USING GIN(vision_tags);


-- ═══════════════════════════════════════════════════════════════
-- Supabase Storage 버킷 설정 안내
-- ═══════════════════════════════════════════════════════════════
-- Supabase 대시보드 > Storage > New Bucket 에서 아래 버킷 생성:
--   이름: trip-photos
--   공개 여부: Public (공개 URL 사용)
--
-- 또는 SQL로 생성 (supabase_storage_admin 역할 필요):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('trip-photos', 'trip-photos', true)
-- ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- Row Level Security (RLS) 정책 설명
-- 현재는 Service Role Key를 사용하므로 RLS를 우회합니다.
-- 추후 프론트엔드 직접 연결 시 아래 정책 활성화를 권장합니다.
-- ═══════════════════════════════════════════════════════════════

-- RLS 활성화 (현재 비활성 상태 — Service Role Key 사용)
-- ALTER TABLE trips  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- 예시 정책: 인증된 사용자는 자신의 데이터만 접근
-- CREATE POLICY "trips_auth_select" ON trips
--   FOR SELECT TO authenticated USING (true);
--
-- CREATE POLICY "trips_auth_insert" ON trips
--   FOR INSERT TO authenticated WITH CHECK (true);
--
-- CREATE POLICY "photos_auth_select" ON photos
--   FOR SELECT TO authenticated USING (true);
--
-- CREATE POLICY "photos_auth_insert" ON photos
--   FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 초기 더미 데이터 (개발/테스트용)
-- ═══════════════════════════════════════════════════════════════

-- 여행 샘플 데이터 (Rule 1: metadata JSONB에 부가정보 저장)
INSERT INTO trips (title, description, theme, metadata) VALUES
  (
    '2024 제주도 여행',
    '가족과 함께한 제주도 3박 4일',
    'travel',
    '{"destination": "제주도", "duration_days": 4, "total_budget": 800000, "companions": ["가족"]}'::jsonb
  ),
  (
    '서울 맛집 탐방',
    '성수동, 이태원 맛집 투어',
    'food',
    '{"area": "서울", "visited_count": 12, "avg_budget_per_meal": 35000}'::jsonb
  )
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- v2.0 마이그레이션 (TASK_AgentB_002)
-- 이미 스키마가 존재하는 경우, 아래 SQL을 별도로 실행하세요.
-- 주의: trip_id가 NULL인 기존 레코드가 있으면 먼저 처리 필요.
-- ═══════════════════════════════════════════════════════════════

-- Step 1. 기존 NULL trip_id 레코드를 임시 여행에 연결 (선택 사항)
-- DO $$
-- DECLARE
--   temp_trip_id UUID;
-- BEGIN
--   IF EXISTS (SELECT 1 FROM photos WHERE trip_id IS NULL) THEN
--     INSERT INTO trips (title, theme, metadata)
--     VALUES ('미분류 보관함', 'diary', '{"auto_created": true}'::jsonb)
--     RETURNING id INTO temp_trip_id;
--     UPDATE photos SET trip_id = temp_trip_id WHERE trip_id IS NULL;
--   END IF;
-- END $$;

-- Step 2. trip_id 컬럼을 NOT NULL + CASCADE DELETE로 변경
-- ALTER TABLE photos
--   ALTER COLUMN trip_id SET NOT NULL;
-- ALTER TABLE photos
--   DROP CONSTRAINT IF EXISTS photos_trip_id_fkey,
--   ADD CONSTRAINT photos_trip_id_fkey
--     FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
