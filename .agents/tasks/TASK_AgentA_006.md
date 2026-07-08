# TASK — AgentA (Frontend) — 006

## 메타
- 작업 ID: `TASK_AgentA_006`
- 담당 에이전트: Agent A (Frontend & UI)
- 우선순위: 🔴 최상위
- 의존성: `TASK_AgentA_005` 완료 후

---

## 공통 규칙 (절대 엄수)
> 아래 파일을 먼저 읽을 것:
> `C:\Users\nckic\OneDrive\Desktop\Google Drive\Trip\.agents\AGENTS.md`

---

## 작업 내용: 3가지 수정 사항

### 1. 🗑️ 미분류 임시보관함 완전 삭제

- 오른쪽에 있는 미분류 임시보관함(Unclassified Drawer) UI를 **완전히 제거**한다.
- 관련된 것들을 모두 삭제:
  - HTML 렌더링 함수 (drawer 관련)
  - CSS 스타일 (`.photo-drawer`, `.drawer-toggle`, `.drawer-*` 등)
  - JS 상태값 (`state.drawerOpen`, `state.unclassifiedPhotos`, `MOCK_PHOTOS` 등)
  - 드래그 앤 드롭 관련 로직 (`handleDragStart`, `handleDragEnd`, `handleDragOver`, `handleDrop` 등)
  - 카드의 미분류 배지(`unclassified_count`, `unclassified-badge`) 표시 로직
- **주의**: 삭제 시 나머지 기능(책 표지, 페이지 플립, 책갈피)이 깨지지 않도록 주의할 것.

---

### 2. 📑 목차 페이지 (Table of Contents) 구현

- 책 표지를 넘기면 **첫 번째 페이지가 "목차"**로 나오도록 한다.
- 목차는 **연도별로 그룹핑**하여 실제 책의 목차처럼 보여준다.
- 목차 레이아웃 예시:

```
─────────────────────────────
         ✦ 목 차 ✦
─────────────────────────────

  1. 2024년

     (1) 도쿄 — 벚꽃 여행  ···· p.1
     (2) 오사카 — 맛집 투어 ···· p.2
     (3) 제주 — 혼행 일기   ···· p.3
     (4) 부산 — 바다 여행   ···· p.4

─────────────────────────────
```

- 구현 세부사항:
  - `created_at` 날짜에서 연도를 추출하여 그룹핑
  - 각 항목: `(번호) 도시/나라 — 여행 제목 ···· p.페이지번호`
  - 도시/나라는 `metadata.location` 값 사용
  - 제목은 `title` 값 사용 (단, location 부분이 중복되면 제외)
  - 우측에 점선(`····`)과 페이지 번호 표시 (실제 클릭 시 해당 페이지로 플립 이동)
  - 목차 각 항목은 **클릭 가능** — 클릭 시 해당 여행 페이지로 책장 넘기기 애니메이션과 함께 이동
- 디자인:
  - 폰트: 제목 "목차"는 Playfair Display, 항목은 Noto Sans KR
  - 종이 질감 배경 유지
  - 연도 구분선: 가는 실선 또는 장식적 구분
  - 페이지 번호와 항목 사이 점선: `border-bottom: dotted` 또는 `content: '·'` 반복

- 페이지 순서 변경:
  ```
  표지 → 목차 → 여행1 → 여행2 → 여행3 → ...
  ```

- 우측 책갈피 탭에 **"목차"** 탭도 맨 위에 추가 (아이콘: 📑)

---

### 3. 🗑️ 예산 입력 항목 삭제

- 각 여행 상세 페이지에서 **예산(budget) 관련 입력/표시 UI를 모두 제거**한다.
  - 예산 슬라이더, 예산 금액 표시, budget 관련 폼 필드
  - `metadata.budget_total` 렌더링 부분 제거
- Mock 데이터의 `metadata`에서 `budget_total` 키 자체는 남겨도 되나, **UI에서 보이지 않도록** 처리
- `formatMetaValue`의 `budget_total` 특수 처리 로직도 제거

---

## 완료 기준

1. 미분류 임시보관함이 화면에 전혀 보이지 않음
2. 표지 → 목차 → 여행 페이지 순서로 동작
3. 목차에서 항목 클릭 시 해당 페이지로 플립 이동
4. 예산 관련 UI가 전혀 보이지 않음
5. 기존 책 표지, 페이지 플립, 책갈피 기능이 정상 동작

---

## 보고 방법
완료 후, 혹은 사용자가 "끝"이라고 입력하면:
1. `.agents/reports/REPORT_AgentA_006.md` 파일을 생성하라.
2. `.agents/status.md` 파일을 열어 최근 작업 상태와 To-Do 현황을 최신 정보로 갱신하라.
3. "상태판 및 보고서 업데이트가 완료되었습니다."라고만 응답하라.
