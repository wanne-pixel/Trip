# TASK — AgentB (Backend) — 002

## 메타
- 작업 ID: `TASK_AgentB_002`
- 담당 에이전트: Agent B (Backend)
- 추천 모델: **Gemini 1.5 Pro** 또는 **Claude 3.5 Sonnet**
- 우선순위: 🔴 최상위

---

## 공통 규칙
> 아래 파일을 항상 먼저 읽을 것:
> `C:\Users\nckic\OneDrive\Desktop\Google Drive\Trip\.agents\AGENTS.md`

---

## 작업 목적
Trip 프로젝트의 워크플로우가 "수동 생성"에서 "사진 다중 업로드 기반 자동 생성"으로 개편됨에 따라, 백엔드 데이터베이스 스키마와 API를 확장한다.

---

## 작업 상세 내용

### 1. `SUPABASE_SCHEMA.sql` 수정
- `photos` 테이블의 `trip_id` 컬럼 제약조건을 `NOT NULL`로 변경하라.
  - 모든 사진(미분류 사진 포함)은 이제 특정 여행에 종속되어야 한다.

### 2. 새 엔드포인트 `POST /api/trips/from-photos` 구현
- `backend/src/routes/trips.ts` 파일에 라우트를 추가하라.
- `multer.array('photos', 50)`를 사용하여 한 번에 최대 50장의 이미지를 업로드받아라.
- **처리 흐름**:
  1. 각 사진들에 대해 `exifService`와 `visionService`를 병렬로 호출하여 메타데이터(시간, 장소 태그, 감성 태그)를 추출하라.
  2. 추출된 모든 태그와 위치, 시간 정보를 모아서 문자열로 조합한 뒤, OpenAI API(`gpt-4o-mini`)에 프롬프트로 전송하라.
     - 프롬프트 예시: "다음 사진 메타데이터들을 바탕으로 이 여행의 제목(title), 설명(description), 테마(theme: travel/food/diary 중 택1)를 JSON 형태로 지어줘."
  3. OpenAI 응답을 파싱하여 `trips` 테이블에 새 여행 객체를 INSERT 하라.
  4. 업로드된 사진들을 Supabase Storage에 저장하고, 반환된 `trip_id`를 사용하여 `photos` 테이블에 일괄 INSERT 하라.
     - 단, EXIF 시간이 없는 등 정보가 부족한 사진은 `classified: false`로 저장하되, `trip_id`는 동일하게 부여하라.
  5. 최종 응답으로 생성된 여행(`trip`)과 사진 배열(`photos`)을 반환하라.

### 3. `GET /api/photos` 조회 로직 보강
- 타임라인을 위해 사진을 내려줄 때, 반드시 `taken_at` 기준 오름차순(ASC)으로 자동 정렬하여 반환하도록 쿼리를 보완하라.

---

## 에러 핸들링
- 멀티 업로드 중 일부 사진의 메타데이터 추출이나 스토리지 업로드가 실패하더라도 전체 여행 생성이 멈추지 않도록 `Promise.allSettled` 등을 활용한 안전한 예외 처리를 구성하라.

---

## 완료 보고 규칙
작업 완료 후 "끝"이라고 입력하여:
1. `.agents/reports/REPORT_AgentB_002.md` 파일을 생성하여 구현된 내용을 요약하라.
2. `.agents/status.md` 파일에 "다중 사진 기반 여행 자동 생성 API 구현" 작업을 완료([x]) 처리하라.
