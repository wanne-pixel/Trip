# Trip Project — 현재 상태판 (Status Board)

*최종 업데이트: 2026-07-13 by Agent B*

---

## 📌 현재 개발 단계: v3.3 (Chunked Batch Upload)

### 1. 에이전트별 상태 및 작업 히스토리

| 에이전트 | 최근 작업 ID | 최신 상태 | 주요 작업 내용 |
| **Master Agent** | `HOTFIX_004` | ✅ 완료 | v2.8 이전 데이터들의 누락된 `start_date` 강제 생성용 DB 마이그레이션 스크립트 작성 및 실행 |
| **Agent C (DevOps)** | `TASK_AgentC_012` | ✅ 완료 | 모든 코드 변경사항 Git 반영(b2c174c) 및 Render 자동 배포 트리거 완료 |
| **Agent A (Frontend)** | `TASK_AgentA_019` | ✅ 완료 | 사진 다중 업로드 150장 제한 상향 및 10장 단위 청크 분할 업로드 구현 |
| **Agent A (Frontend)** | `TASK_AgentA_018` | ✅ 완료 | 여행 상단(Trip) 메타데이터 3종(동반자, 한줄평, 총점) 인라인 렌더링 및 편집 UI 구현 |
| **Agent A (Frontend)** | `TASK_AgentA_017` | ✅ 완료 | 사진 수동 메타데이터(카테고리, 장소, 별점, 메모) 입력 및 인라인 편집 UI 구현 |
| **Agent B (Backend)** | `TASK_AgentB_008` | ✅ 완료 | 다중 업로드 한도 200장 상향 및 백엔드 5장 단위 동시성 제어(Batch) 구현 |

### 2. 현재 활성화된 로컬 서버 주소
- 프론트엔드: http://localhost:3000 (Agent C 기동 필요)
- 백엔드: http://localhost:4000 (Agent C 기동 필요)

---

## 🛠️ 시스템 정보 및 DB 스키마 정보
- Node.js: v24.16.0
- DB: Supabase (연동 완료)
- Git Branch: `master` (최신 커밋: `59e4eb6`)

### Master/Agent 최근 구현 완료 파일
| 파일 | 상태 |
|---|---|
| `frontend/app.js` | ✅ 완료 (v2.5 슬라이더, v2.6 수동 묶기/분리 핸들러, v2.7 목적지 수정 및 EXIF chunk 추출 로직) |
| `frontend/style.css` | ✅ 완료 (v2.5 `.photo-slider`, v2.6 제어 버튼, v2.7 목적지 텍스트 스타일) |
| `backend/src/routes/trips.ts` | ✅ 완료 (다중 업로드 한도 200장 상향 및 5장 단위 동시성 제어 적용) |
| `backend/src/routes/photos.ts` | ✅ 완료 (PATCH /api/photos/:id/metadata 라우트 추가) |

---

## 📝 To-Do List (앞으로 해야 할 일)
- [x] 백엔드 v1.0 기능 구현 및 환경 구성 완료
- [x] 프론트엔드 v1.0 책 테마 UI 및 통신 연동 완료
- [x] v2.0 - 다중 업로드 및 AI 자동 여행 생성
- [x] v2.1 - 연쇄 삭제 및 Storage 파일 삭제
- [x] v2.2 - 단일 포트 통합 배포 (Render)
- [x] v2.3 - 브라우저 단 대용량 이미지 다중 압축
- [x] v2.4 - VisionTags 개편 및 기존 여행 사진 추가 연동
- [x] v2.5 - 타임라인 3분 이내 근접 사진 가로 슬라이더(Carousel) UI 적용
- [x] v2.6 - 사용자 수동 사진 그룹 묶기 / 떼어내기 (Merge/Split) 직관적 UX 적용
- [x] v2.7 - 목적지(Destination) 직접 입력 기능 추가 및 EXIF 압축 시 2026년 오기록 버그 해결 (Chunk 분리 전송)
- [x] v2.8+ - 새 기능 논의 (인터랙티브 지도 뷰, AI 기반 일기 자동 작성 등)
- [x] v2.8 - AI 기반 여행 일기 자동 작성 API 구현 완료
- [x] v2.9 - Day 탭 UI 및 편집 모드 추가 (isEditMode, selectedDay 적용)
- [x] v2.9 - AI 일기 작성 UI 및 API 연동 (프론트엔드 완료)
- [x] v3.0 - AI 여행 일기 자동 작성 기능 통합 완료 (Agent C)
- [x] v2.10 - 사진 수동 정렬 기능 및 분리/묶기 UI 텍스트 개선 (Agent A)
- [x] v3.1 - 사진 메타데이터 업데이트 API (`PATCH /api/photos/:id/metadata`) 구현 (Agent B)
- [x] v3.2 - 사진 수동 메타데이터 입력 UI (카테고리, 장소, 별점, 메모) 구현 (Agent A)
- [x] v3.3 - 대량 사진(150장) 10장 단위 Chunked Batch 업로드 구현 (Agent A)
- [x] v3.4 - 백엔드 사진 업로드(최대 200장) 동시성 제어(Concurrency Limit) 5개 단위 배치 처리 구현 (Agent B)
