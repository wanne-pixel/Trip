# TASK — AgentB (Backend) — 004

## 메타
- 작업 ID: `TASK_AgentB_004`
- 담당 에이전트: Agent B (Backend)
- 추천 모델: **Claude 3.5 Sonnet** 또는 **Gemini 1.5 Pro**
- 우선순위: 🔴 최상위

---

## 작업 목적
기존 여행에 다중 사진을 추가하는 전용 엔드포인트를 구현하고, Vision API의 태그(프롬프트 및 타입)를 더 실용적인 카테고리로 개편합니다.

---

## 작업 상세 내용

### 1. Vision API 타입 및 프롬프트 개편
- `backend/src/types/index.ts`
  - `VisionTags` 인터페이스를 아래와 같이 변경하세요. (기존 필드는 제거)
    ```typescript
    export interface VisionTags {
      category?: 'food' | 'scenery' | 'accommodation' | 'activity' | 'people' | 'other';
    }
    ```
- `backend/src/services/visionService.ts`
  - `VISION_PROMPT`를 수정하세요: `이 사진을 보고 JSON으로만 답하세요. 다른 텍스트는 일절 포함하지 마세요. 형식: {"category":"food"|"scenery"|"accommodation"|"activity"|"people"|"other"}` (정확한 영단어 중 하나만 고르게 할 것).
  - 결과 파싱 로직에서 `time_of_day`, `environment` 부분을 모두 지우고 `category`를 파싱 및 할당하도록 수정하세요.

### 2. 다중 사진 추가 API 구현
- `backend/src/routes/trips.ts`
  - 기존의 `uploadMulti` 미들웨어를 사용하여 `POST /api/trips/:id/photos` 엔드포인트를 생성하세요. (라우터 상단 또는 적절한 위치)
  - 이 엔드포인트의 역할:
    1. `req.files`에서 다수의 파일 받음.
    2. `req.params.id`로 기존 여행 ID(`trip_id`)를 가져옴. (해당 여행이 존재하는지 DB에서 굳이 검사하지 않아도 됨, 에러나면 catch).
    3. 각 파일에 대해 EXIF 추출, Vision API 호출(`category`), Supabase Storage(`trip-photos`) 업로드 수행 (`Promise.all` 사용).
    4. 각 사진 정보를 DB `photos` 테이블에 INSERT (trip_id 부여).
    5. 생성된 Photo 배열 반환. (여행 제목/테마 생성은 **하지 않음**)
  - 로직은 `POST /from-photos`에서 사진 업로드하는 부분과 거의 동일합니다 (추출해서 배열 만들기).

---

## 완료 보고 규칙
작업 완료 후 "끝"이라고 입력하여:
1. `.agents/reports/REPORT_AgentB_004.md` 파일을 생성하여 구현된 내용을 요약하라.
2. `.agents/status.md` 파일에 "v2.4 기존 여행 사진 추가 API 및 Vision 태그 개편" 작업을 완료([x]) 처리하라.
