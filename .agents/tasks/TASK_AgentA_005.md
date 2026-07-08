# TASK — AgentA (Frontend) — 005

## 메타
- 작업 ID: `TASK_AgentA_005`
- 담당 에이전트: Agent A (Frontend & UI)
- 우선순위: 🔴 최상위
- 의존성: 없음 (Mock 데이터 기반)

---

## 공통 규칙 (절대 엄수)
> 아래 파일을 먼저 읽을 것:
> `C:\Users\nckic\OneDrive\Desktop\Google Drive\Trip\.agents\AGENTS.md`

---

## 작업 목적

Trip 앱의 전체 UI를 **"한 권의 책을 펼쳐보는 경험"** 메타포로 전면 재설계한다.
기존의 카드 리스트/모달 방식을 모두 폐기하고, 아래 3가지 핵심 요구사항을 완벽하게 구현한다.

---

## 핵심 요구사항 3가지

### 1. 📕 책 표지 (Book Cover) — 첫 화면

- 앱을 처음 열면 **책 한 권의 표지**만 화면 중앙에 보인다.
- 표지 디자인:
  - 가죽 질감 또는 감성적인 텍스처 배경 (CSS로 구현)
  - 중앙에 "Trip" 타이틀 (Playfair Display, 골드 색상)
  - 하단에 부제: "나의 여행 기록" (Noto Sans KR, 연한 색상)
  - 미세한 엠보싱/음각 느낌의 장식 테두리
- **표지 클릭 시**: 책의 첫 장을 여는 **3D 페이지 플립 애니메이션**으로 표지가 왼쪽으로 넘어가며 내지(콘텐츠)가 드러난다.
- 표지가 열리면 다시 닫기 전까지 표지는 보이지 않는다.

### 2. 📖 페이지 플립 애니메이션 — 모든 화면 전환

- **모든 화면 전환**은 책장을 넘기는 3D Flip 애니메이션으로 통일한다.
- 구현 방식:
  - CSS `perspective`, `transform: rotateY()`, `transform-origin: left`를 활용
  - 페이지가 넘어갈 때 뒷면이 살짝 비치는 반투명 효과
  - 넘기는 방향: 다음 페이지 = 오른쪽→왼쪽 플립, 이전 페이지 = 왼쪽→오른쪽 플립
- 각 "페이지"는 하나의 여행 상세 내용이다:
  - 여행 제목, 설명, 사진 목록, metadata 태그 등
  - 페이지 양 옆에 **종이 질감 배경** (연한 크림색 + 미세한 노이즈 텍스처)
  - 페이지 하단에 **페이지 번호** 표시
- 스와이프(터치) 또는 좌/우 화살표 버튼으로 페이지 넘기기 가능

### 3. 🔖 책갈피 탭 (Bookmark Tabs) — 여행 목록 네비게이션

- 화면 **오른쪽 가장자리**에 세로로 정렬된 책갈피 탭들이 **항상** 보인다.
- 각 책갈피에는 **도시 또는 나라 이름만** 표시한다:
  - Mock 데이터 기준: "도쿄", "오사카", "제주도", "부산"
  - `metadata.location` 값을 사용
  - `metadata.location`이 없으면 Trip의 `title`에서 첫 단어 추출
- 책갈피 디자인:
  - 실제 책갈피처럼 **오른쪽으로 살짝 튀어나온** 직사각형 탭
  - 각 탭은 세로 방향 텍스트 (writing-mode: vertical-rl)
  - 탭 사이즈: 폭 25~30px, 높이 60~80px (여행 수에 따라 균등 배분)
  - 테마별 색상 구분: travel=보라, food=핑크, diary=파랑
  - 현재 보고 있는 페이지의 책갈피는 **더 많이 튀어나오고** 강조 색상
  - 호버 시 살짝 더 튀어나오는 애니메이션
- **책갈피 클릭 시**: 해당 여행의 페이지로 플립 애니메이션과 함께 이동

---

## 기술 구현 명세

### 전체 구조 (DOM)

```html
<div id="app">
  <!-- 책 전체를 감싸는 컨테이너 -->
  <div class="book-container">
    <!-- 책갈피 탭 (항상 우측에 고정) -->
    <nav class="bookmarks">
      <button class="bookmark-tab active" data-page="0">도쿄</button>
      <button class="bookmark-tab" data-page="1">오사카</button>
      ...
    </nav>
    
    <!-- 책 본체 -->
    <div class="book">
      <!-- 표지 (page-0) -->
      <div class="page cover-page" data-page="cover">
        ...표지 내용...
      </div>
      
      <!-- 내지들 (각 여행 = 한 페이지) -->
      <div class="page" data-page="0">
        ...도쿄 여행 내용...
      </div>
      <div class="page" data-page="1">
        ...오사카 여행 내용...
      </div>
    </div>
  </div>
</div>
```

### 핵심 CSS (참고용 — 세부 구현은 자유)

```css
.book-container {
  perspective: 1800px;
  max-width: 430px;
  min-height: 100dvh;
  margin: 0 auto;
  position: relative;
}

.book {
  position: relative;
  width: 100%;
  height: 100dvh;
  transform-style: preserve-3d;
}

.page {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  transform-origin: left center;
  transition: transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1);
  background: #FBF8F3; /* 종이 질감 */
}

.page.flipped {
  transform: rotateY(-180deg);
}

.bookmarks {
  position: fixed;
  right: calc(50% - 215px); /* 책 우측 가장자리에 맞춤 */
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 100;
}

.bookmark-tab {
  writing-mode: vertical-rl;
  width: 28px;
  padding: 10px 4px;
  border-radius: 0 6px 6px 0;
  transform: translateX(8px);
  transition: transform 0.2s ease;
}
.bookmark-tab.active { transform: translateX(18px); }
.bookmark-tab:hover { transform: translateX(14px); }
```

### app.js 상태 관리

```javascript
let state = {
  trips: [],
  currentPage: 'cover',  // 'cover' | 0 | 1 | 2 | ...
  coverOpen: false,       // 표지가 열렸는지
  unclassifiedPhotos: [],
  // ... 기존 상태 유지
};
```

---

## Mock 데이터 규칙 (Rule 3 유지)

- 기존 `MOCK_DATA` 배열 구조 그대로 유지
- `metadata.location` 값을 책갈피 레이블로 사용
- `fetchTrips()` 레이어 분리 구조 유지

---

## 완료 기준

1. 앱 첫 진입 → 책 표지만 보임
2. 표지 클릭 → 3D 플립으로 첫 번째 여행 페이지 등장
3. 좌/우 스와이프 또는 버튼 → 페이지 플립 전환
4. 우측 책갈피 탭 → 도시/나라 이름만 표시, 클릭 시 해당 페이지로 이동
5. 전체적으로 종이 질감 + 감성적 디자인
6. 브라우저에서 http://localhost:3000 으로 정상 동작

---

## 보고 방법
완료 후, 혹은 사용자가 "끝"이라고 입력하면:
1. `.agents/reports/REPORT_AgentA_005.md` 파일을 생성하라.
2. `.agents/status.md` 파일을 열어 최근 작업 상태와 To-Do 현황을 최신 정보로 갱신하라.
3. "상태판 및 보고서 업데이트가 완료되었습니다."라고만 응답하라.
