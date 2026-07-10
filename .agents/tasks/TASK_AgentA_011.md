# TASK — AgentA (Frontend) — 011

## 메타
- 작업 ID: `TASK_AgentA_011`
- 담당 에이전트: Agent A (Frontend)
- 추천 모델: **Claude 3.5 Sonnet** (매우 복잡한 타임라인 그룹화 및 DOM 조작 필요)
- 우선순위: 🔴 최상위

---

## 작업 목적
기존 여행에 다중 사진을 추가 업로드하는 UI를 만들고, 타임라인을 Day 1, Day 2 형식으로 일자별로 묶어주며, 새로운 카테고리 태그(음식, 풍경 등)를 알맞은 이모지와 함께 렌더링합니다.

---

## 작업 상세 내용

### 1. 카테고리 태그 렌더링 개편
- `frontend/app.js` 의 `renderTimeline` 및 `renderDrawerContent` 수정.
- 새롭게 반환되는 `p.vision_tags.category` 값을 표시하도록 수정하세요.
- 매핑 로직 (헬퍼 함수 생성 권장):
  - `food` → "🍔 음식"
  - `scenery` → "🏞 풍경"
  - `accommodation` → "🏨 숙소"
  - `activity` → "🏃‍♂️ 액티비티"
  - `people` → "👥 인물"
  - `other` (또는 과거 데이터로 인해 알 수 없는 값) → "📌 기타"
  - 값이 없거나 분석 불가인 경우 → "분석 불가"

### 2. [+ 사진 추가] 버튼 및 업로드 로직 연결
- 여행 상세 페이지 (`renderTripPage`) 내, 제목 바로 아래나 타임라인 상단 등 잘 보이는 곳에 **[+ 사진 추가]** 버튼( `<input type="file" multiple>` 라벨 )을 추가하세요.
- 파일이 선택되면 **기존의 `imageCompression` 로직(v2.3)을 그대로 적용**하여 클라이언트에서 압축한 뒤,
- 백엔드에 새로 만든 `POST /api/trips/:id/photos` 엔드포인트로 `FormData`에 담아 전송하세요.
- 성공적으로 응답(Photo 배열)을 받으면, `state.tripPhotos[tripId]`에 새로운 사진들을 병합(append)하고, `refreshPhotoSection(tripId)`를 호출해 새로고침 없이 타임라인을 즉시 다시 그리세요.

### 3. 타임라인 Day 1, Day 2 그룹화 (어려움 ⭐️)
- `renderTimeline(tripId)` 함수를 대대적으로 개편합니다.
- `classified !== false` 인 사진들을 `taken_at` 기준 오름차순 정렬하는 로직은 유지합니다.
- 정렬된 배열의 **가장 첫 번째 사진의 `taken_at` 날짜 부분(예: 'YYYY-MM-DD')** 을 기준으로 잡습니다. 이 날짜가 **Day 1**입니다.
- 그 이후의 사진들을 순회하며 날짜 문자열(Locale Date)이 바뀔 때마다 **Day 2**, **Day 3** ... 로 숫자를 올려가며 구분선(Header) HTML 블록을 타임라인 리스트 중간중간에 삽입하세요.
  - 예시 HTML 구조: `<div class="timeline-day-header"><h3>Day 1 <span>(6월 15일)</span></h3></div>`
- 날짜 데이터가 없는 사진(과거의 버그 데이터 등)이 타임라인 쪽에 섞여있다면 '알 수 없음' 그룹으로 빼거나 맨 위/아래에 배치하세요.

---

## 에러 핸들링
- 파일 압축 중, 혹은 다중 업로드(`POST /api/trips/:id/photos`) 호출 중 실패 시 토스트로 사용자에게 알리고 로딩창을 닫아야 합니다.

---

## 완료 보고 규칙
작업 완료 후 "끝"이라고 입력하여:
1. `.agents/reports/REPORT_AgentA_011.md`를 생성하여 구현 내역을 요약하라.
2. `.agents/status.md` 파일의 Agent A 최신 상태를 `TASK_AgentA_011`로 갱신하라.
