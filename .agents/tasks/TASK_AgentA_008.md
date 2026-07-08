# TASK — AgentA (Frontend) — 008

## 메타
- 작업 ID: `TASK_AgentA_008`
- 담당 에이전트: Agent A (Frontend)
- 추천 모델: **Gemini 1.5 Pro** 또는 **Claude 3.5 Sonnet** (데이터 통신 로직 및 상태 관리 변경이 포함되므로 높은 추론 능력 필요)
- 우선순위: 🔴 최상위

---

## 공통 규칙
> 아래 파일을 항상 먼저 읽을 것:
> `C:\Users\nckic\OneDrive\Desktop\Google Drive\Trip\.agents\AGENTS.md`

---

## 작업 목적

현재 `app.js`에 하드코딩되어 있는 `MOCK_DATA`와 `MOCK_PHOTOS`를 완전히 제거하고, **실제 로컬 백엔드 서버(`http://localhost:4000`)의 API와 연동**한다.

---

## 작업 상세 내용

### 1. API 주소(Base URL) 설정
- `app.js` 최상단에 `API_BASE_URL` 상수를 정의하라.
  ```javascript
  const API_BASE_URL = 'http://localhost:4000/api';
  ```

### 2. 여행 목록(Trips) 연동
- 기존의 `MOCK_DATA` 배열을 삭제하라.
- `fetchTrips()` 함수를 비동기 통신으로 변경하라.
  - `GET /api/trips` 호출
  - 응답 포맷: `{ success: true, data: Trip[] }`
  - 받은 `data`를 `state.trips`에 저장하고 화면을 다시 렌더링하도록 처리하라.

### 3. 사진 목록(Photos) 연동 (임시 보관함이 삭제되었으므로 여행 상세 사진 위주)
- 기존의 `MOCK_PHOTOS` 배열을 삭제하라.
- 각 여행의 상세 페이지(책 내지)를 렌더링할 때, 해당 여행에 속한 사진만 불러오도록 하라.
  - `GET /api/photos?trip_id={id}` 호출
  - 받아온 사진 데이터를 해당 여행 페이지에 렌더링하라.

### 4. 새 여행 생성 연동
- [새 여행 만들기] 기능에서 폼을 제출할 때 `POST /api/trips`를 호출하라.
  - Body: `{ title, description, theme, metadata }`
  - 성공적으로 생성되면 `fetchTrips()`를 다시 호출하거나 `state.trips`에 직접 추가하여 화면을 갱신하라.

### 5. 사진 업로드 연동
- (주의: v1.7에서 업로드 버튼이 삭제되었다면, 책 표지 혹은 목차 화면 어딘가에 작게 **테스트용 사진 업로드 버튼**을 하나 임시로 만들어 연동 테스트를 진행하라.)
- `POST /api/photos/upload` 호출
  - `FormData`를 사용하여 파일(`photo`) 전송 (멀티파트 폼)
  - 서버 응답을 확인하고 콘솔에 출력하라.

---

## 에러 핸들링 (Rule 2)
- 모든 `fetch` 함수에는 `try...catch`를 적용하라.
- 네트워크 에러나 서버 에러가 발생해도 화면이 완전히 멈추거나 하얗게 변하지 않도록 `console.error`로 로그를 남기고, 사용자에게는 UI 알림창(Toast 등)으로 조용히 실패를 알려라.

---

## 완료 기준
1. `app.js`에서 더 이상 정적 Mock 데이터를 사용하지 않는다.
2. 백엔드가 켜져 있을 때 화면이 정상적으로 표지 및 목차를 렌더링한다.
3. 데이터가 없을 경우 에러가 나지 않고 "아직 여행 기록이 없습니다" 등의 빈 상태를 보여준다.

---

## 보고 방법
작업 완료 후 "끝"이라고 입력하여:
1. `.agents/reports/REPORT_AgentA_008.md`를 생성하라.
2. `.agents/status.md`에 API 연동 완료 내역을 업데이트하라.
