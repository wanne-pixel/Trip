# Trip Project — 현재 상태판 (Status Board)

*최종 업데이트: 2026-07-08 by Agent C*

---

## 📌 현재 개발 단계: v1.7 (네비게이션 개편 및 추가 UI 간소화 완료)

### 1. 에이전트별 상태 및 작업 히스토리

| 에이전트 | 최근 작업 ID | 최신 상태 | 주요 작업 내용 |
|----------|-------------|-----------|----------------|
| **Agent A (Frontend)** | `TASK_AgentA_008` | ✅ 완료 | 로컬 백엔드 서버(API) 실제 연동 완료 (MOCK 데이터 제거) |
| **Agent B (Backend)** | `TASK_AgentB_001` | ✅ 완료 | Express 서버 구조 구축, EXIF/Vision 서비스 구현, Supabase 스키마 설계, REST API 8개 엔드포인트 완성 |
| **Agent C (DevOps)** | `TASK_AgentC_002` | ✅ 완료 | 사진 업로드 기능 End-to-End 테스트 완료 |
| **Agent Test (임시)** | `TASK_AgentTest_001` | ✅ 완료 | Vision API 비교 테스트용 독립 로컬 서버(PORT 8080) 구축 |

### 2. 현재 활성화된 로컬 서버 주소
- 프론트엔드: http://localhost:3000 (Agent C 기동 중)
- 백엔드: http://localhost:4000 (Agent C 기동 중)

---

## 🛠️ 시스템 정보 및 DB 스키마 정보
- Node.js: v24.16.0
- DB: Supabase (연결 대기 중 — .env 환경 변수 입력 필요)
- Git Branch: `master` (최신 커밋: `3be71cc`)

### Agent B 구현 완료 파일
| 파일 | 상태 |
|---|---|
| `backend/src/index.ts` | ✅ 완료 |
| `backend/src/config/supabase.ts` | ✅ 완료 |
| `backend/src/services/exifService.ts` | ✅ 완료 |
| `backend/src/services/visionService.ts` | ✅ 완료 |
| `backend/src/routes/photos.ts` | ✅ 완료 |
| `backend/src/routes/trips.ts` | ✅ 완료 |
| `backend/SUPABASE_SCHEMA.sql` | ✅ 완료 |
| `backend/.env.example` | ✅ 완료 |

---

## 📝 To-Do List (앞으로 해야 할 일)
- [x] 백엔드 Express 서버 구축 (Agent B) — TASK_AgentB_001 완료
- [x] Supabase 데이터베이스 테이블 및 Storage 스키마 설계 (Agent B) — TASK_AgentB_001 완료
- [x] 사진 업로드 및 새 여행 추가 모달 UI 구현 (Agent A) — TASK_AgentA_002 완료
- [x] 3D 책 테마 UI 전환 및 3D Flip 인터랙션 탑재 (Agent A) — TASK_AgentA_003 완료
- [x] 리얼 책장 넘기기 3D Flip & 책갈피 탭 고도화 (Agent A) — TASK_AgentA_004 완료
- [x] Full Book DOM Stack 구조 개편 및 우측 세로 책갈피 적용 (Agent A) — TASK_AgentA_005 완료
- [x] 목차(TOC) UI 도입 및 보관함/예산입력란 제거 (Agent A) — TASK_AgentA_006 완료
- [x] 책갈피/업로드 버튼 삭제 및 좌측 뒤로가기 네비게이션 적용 (Agent A) — TASK_AgentA_007 완료
- [x] `.env` 환경 변수 입력 (Supabase URL/Key, OpenAI API Key)
- [x] `SUPABASE_SCHEMA.sql` Supabase 대시보드에 적용
- [x] `npm install` 및 백엔드 서버(PORT 4000) 기동 확인 (Agent C)
- [x] 프론트엔드와 백엔드 API 연동 완료 (Agent A) — TASK_AgentA_008 완료
- [x] 사진 업로드 기능 End-to-End 테스트 (Agent C) — TASK_AgentC_002 완료
- [x] Vision API 테스트용 임시 로컬 서버(PORT 8080) 구현 (Agent Test) — TASK_AgentTest_001 완료
