import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[Supabase] SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.'
  );
}

// Service Role Key 사용 — RLS 정책을 우회하여 서버 사이드 작업 수행
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 버킷 자동 생성 (trip-photos)
supabase.storage.createBucket('trip-photos', { public: true })
  .then(({ data, error }) => {
    if (error) {
      if (error.message.toLowerCase().includes('already exists') || error.message.toLowerCase().includes('duplicate')) {
        console.log('[Supabase] trip-photos 버킷이 이미 존재합니다.');
      } else {
        console.error('[Supabase] trip-photos 버킷 생성 실패:', error.message);
      }
    } else {
      console.log('[Supabase] trip-photos 버킷이 성공적으로 생성되었습니다.');
    }
  });
