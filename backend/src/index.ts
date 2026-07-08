import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { tripsRouter } from './routes/trips';
import { photosRouter } from './routes/photos';
import type { ApiResponse } from './types/index';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─────────────────────────────────────────────
// 미들웨어 설정
// ─────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────────
// 헬스체크 엔드포인트
// ─────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ─────────────────────────────────────────────
// API 라우터 마운트
// ─────────────────────────────────────────────
app.use('/api/trips', tripsRouter);
app.use('/api/photos', photosRouter);

// ─────────────────────────────────────────────
// 404 핸들러
// ─────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  const response: ApiResponse<never> = {
    success: false,
    error: '요청한 엔드포인트를 찾을 수 없습니다.',
  };
  res.status(404).json(response);
});

// ─────────────────────────────────────────────
// 글로벌 에러 핸들러 (Rule 2 — 500으로 서버를 죽이지 않음)
// Express 글로벌 에러 핸들러는 인자가 4개여야 합니다
// ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[GlobalErrorHandler]', err.message, err.stack);

  // multer 파일 크기 초과 에러 처리
  if (err.message === 'File too large') {
    const response: ApiResponse<never> = {
      success: false,
      error: '파일 크기가 20MB를 초과합니다.',
    };
    return res.status(413).json(response);
  }

  const response: ApiResponse<never> = {
    success: false,
    error: err.message ?? '서버 내부 오류가 발생했습니다.',
  };
  return res.status(500).json(response);
});

// ─────────────────────────────────────────────
// 서버 시작
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Trip Backend Server 실행 중: http://localhost:${PORT}`);
  console.log(`📋 API 엔드포인트:`);
  console.log(`   GET    /health`);
  console.log(`   GET    /api/trips`);
  console.log(`   GET    /api/trips/:id`);
  console.log(`   POST   /api/trips`);
  console.log(`   PATCH  /api/trips/:id/metadata`);
  console.log(`   POST   /api/photos/upload`);
  console.log(`   GET    /api/photos/unclassified`);
  console.log(`   GET    /api/photos?trip_id=...`);
});

export default app;
