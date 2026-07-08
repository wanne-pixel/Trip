# REPORT_AgentB_001 — 백엔드 초기 설계 및 구현 완료 보고서

- **작업 ID**: TASK_AgentB_001
- **에이전트**: Agent B (Backend & Data)
- **작업 일시**: 2026-07-07
- **상태**: ✅ 완료

---

## 1. 작업 요약

이번 세션에서 Trip 프로젝트의 백엔드 전체 구조를 설계하고 핵심 파일을 구현했습니다.

---

## 2. 구현된 파일 목록

| 파일 경로 | 설명 |
|---|---|
| `backend/src/index.ts` | Express 서버 진입점 (포트 4000, CORS, 헬스체크 포함) |
| `backend/src/config/supabase.ts` | Supabase 클라이언트 초기화 |
| `backend/src/services/exifService.ts` | EXIF 추출 로직 (`exifr`), GPS/시간 없을 시 Null 반환 |
| `backend/src/services/visionService.ts` | OpenAI gpt-4o-mini Vision API 호출, 실패 시 null Fallback |
| `backend/src/routes/photos.ts` | 사진 업로드/조회/메타데이터 수정 API |
| `backend/src/routes/trips.ts` | 여행 생성/조회/수정 API |
| `backend/SUPABASE_SCHEMA.sql` | Supabase 초기 스키마 SQL (trips, photos 테이블 + RLS) |
| `backend/package.json` | 의존성 정의 (express, exifr, openai, @supabase/supabase-js 등) |
| `backend/tsconfig.json` | TypeScript 컴파일러 설정 |
| `backend/.env.example` | 환경 변수 템플릿 |

---

## 3. 핵심 설계 결정

### EXIF 파이프라인
```
사진 업로드 → EXIF 추출(exifr)
  ├── GPS + 시간 있음 → classified: true
  └── 없음 → classified: false (즉시 Null 반환, 타임라인 강제 배치 금지)
              └── Vision API(gpt-4o-mini) 호출
                    ├── 성공 → vision_tags { time_of_day, environment }
                    └── 실패 → vision_tags: null (앱 계속 동작)
```

### 스키마 설계 원칙 (Rule 1 준수)
- `metadata JSONB` 필드로 테마별 부가 정보(예산, 별점, 감정 등) 수용
- DDL 변경 없이 새 테마 추가 가능

### Graceful Fallback (Rule 2 준수)
- EXIF 실패 → 앱 중단 없음, `classified: false` 반환
- Vision API 실패 → 앱 중단 없음, `vision_tags: null` 반환
- 모든 에러 → `{ success: false, error: "..." }` JSON 응답

---

## 4. API 엔드포인트 목록

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 서버 헬스체크 |
| POST | `/api/photos/upload` | 사진 업로드 + EXIF + Vision |
| GET | `/api/photos/trip/:tripId` | 여행별 사진 목록 |
| PATCH | `/api/photos/:id/metadata` | 사진 메타데이터 업데이트 |
| POST | `/api/trips` | 여행 생성 |
| GET | `/api/trips` | 전체 여행 목록 |
| GET | `/api/trips/:id` | 여행 상세 조회 |
| PATCH | `/api/trips/:id` | 여행 정보 수정 |

---

## 5. 다음 단계 (To-Do)

- [ ] `npm install` 실행 후 의존성 설치 확인
- [ ] `.env` 파일에 Supabase URL, Key, OpenAI API Key 입력
- [ ] `SUPABASE_SCHEMA.sql`을 Supabase 대시보드에서 실행
- [ ] `npm run dev`로 로컬 서버(포트 4000) 기동 확인
- [ ] 프론트엔드(Agent A)와 API 연동

---

*보고서 작성: Agent B (Backend & Data) — 2026-07-07*
