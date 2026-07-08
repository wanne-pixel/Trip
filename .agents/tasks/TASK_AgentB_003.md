# TASK — AgentB (Backend) — 003

## 메타
- 작업 ID: `TASK_AgentB_003`
- 담당 에이전트: Agent B (Backend)
- 추천 모델: **Claude 3.5 Sonnet** 또는 **Gemini 1.5 Pro**
- 우선순위: 🔴 최상위

---

## 공통 규칙
> 아래 파일을 항상 먼저 읽을 것:
> `C:\Users\nckic\OneDrive\Desktop\Google Drive\Trip\.agents\AGENTS.md`

---

## 작업 목적
v2.1 개선 사항에 따라 여행/사진 삭제 API를 구현하고, OpenAI 프롬프트를 수정하여 연도를 제외하며, 사진 메타데이터(EXIF)를 바탕으로 여행 기간을 계산하여 description으로 자동 생성한다.

---

## 작업 상세 내용

### 1. 삭제 API 엔드포인트 구현 (Supabase Storage 파일 연쇄 삭제 주의)
`backend/src/routes/trips.ts` 와 `backend/src/routes/photos.ts`에 다음 API를 추가하라.

- **`DELETE /api/trips/:id`**
  1. DB에서 해당 `trip_id`를 가진 사진들의 `storage_path`를 모두 조회한다.
  2. Supabase Storage(`trip-photos` 버킷)에서 해당 파일들을 모두 지운다 (`supabase.storage.from('trip-photos').remove(...)`).
  3. DB의 `photos` 테이블에서 사진 레코드를 지운다 (또는 Supabase에서 CASCADE가 걸려있다면 여행만 지우면 됨, 하지만 Storage 삭제가 필수이므로 먼저 조회해야 함).
  4. DB의 `trips` 테이블에서 해당 여행을 지운다.

- **`DELETE /api/photos/:id`**
  1. DB에서 해당 사진의 `storage_path` 조회.
  2. Storage에서 파일 삭제.
  3. DB `photos` 테이블에서 레코드 삭제.

### 2. OpenAI 프롬프트 수정 (연도 제외)
- `trips.ts`의 `generateTripInfoFromMetadata` 함수 내 프롬프트를 수정하라.
- 지시 사항 추가: **"제목에 연도(예: 2026년, 2024년 등)는 절대 포함하지 말 것. 목차에 연도가 따로 표시되므로 중복을 피해야 함."**
- 지시 사항 변경: AI가 더 이상 `description`을 지어내지 않도록 JSON 응답 구조에서 `description`을 빼거나 무시하라.

### 3. 여행 기간(description) 자동 계산 로직 적용
- `trips.ts`의 `POST /api/trips/from-photos`에서 사진들의 `taken_at` 배열을 추출하라.
- 유효한 날짜(`Date`)들 중 가장 빠른 날짜와 늦은 날짜를 계산한다.
- 계산된 날짜 범위를 바탕으로 `description` 문자열을 만들어라 (예: `6월 15일 ~ 6월 17일 (2박 3일)`, 당일이면 `6월 15일 (당일치기)`). 유효한 날짜가 하나도 없으면 `날짜 정보 없음` 등으로 처리.
- 이 계산된 문자열을 `newTrip` 생성 시 `description` 필드에 주입하라.

---

## 완료 보고 규칙
작업 완료 후 "끝"이라고 입력하여:
1. `.agents/reports/REPORT_AgentB_003.md` 파일을 생성하여 구현된 내용을 요약하라.
2. `.agents/status.md` 파일에 "v2.1 삭제 API 및 프롬프트/날짜 로직 업데이트" 작업을 완료([x]) 처리하라.
