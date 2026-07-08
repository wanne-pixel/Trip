/* ============================================================
   Trip — 나의 여행 기록
   app.js  v1.6 (목차 페이지 도입 및 보관함 완전 삭제)
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   1. MOCK 데이터 (Rule 3 — API Contract)
   ────────────────────────────────────────────────────────── */
const MOCK_DATA = [
  {
    id: 'trip-001',
    title: '도쿄 벚꽃 여행',
    description: '2024년 봄, 처음 가본 일본. 우에노 공원의 벚꽃이 정말 아름다웠어요.',
    theme: 'travel',
    cover_photo: null,
    photo_count: 47,
    metadata: { location: '도쿄', season: '봄' },
    created_at: '2024-03-20'
  },
  {
    id: 'trip-002',
    title: '오사카 맛집 투어',
    description: '타코야키, 라멘, 오코노미야키. 매 끼니가 행복이었던 3박 4일.',
    theme: 'food',
    cover_photo: null,
    photo_count: 28,
    metadata: { location: '오사카' }, // budget_total hidden from UI
    created_at: '2024-04-05'
  },
  {
    id: 'trip-003',
    title: '제주 혼행 일기',
    description: '혼자 떠난 첫 힐링 여행. 성산일출봉에서 맞은 해돋이.',
    theme: 'diary',
    cover_photo: null,
    photo_count: 61,
    metadata: { location: '제주도', emotion: '힐링' },
    created_at: '2024-05-10'
  },
  {
    id: 'trip-004',
    title: '부산 바다 여행',
    description: '광안리 야경과 해운대 바다. 친구들과 함께한 여름 추억.',
    theme: 'travel',
    cover_photo: null,
    photo_count: 33,
    metadata: { location: '부산', season: '여름' },
    created_at: '2024-07-22'
  }
];

async function fetchTrips() {
  return Promise.resolve(MOCK_DATA);
}

/* ──────────────────────────────────────────────────────────
   2. 상태 관리
   ────────────────────────────────────────────────────────── */
let state = {
  trips: [],
  currentPage: 'cover', // 'cover', 'index', 또는 trip.id
  uploadModalOpen: false,
  createModalOpen: false,
};

/* ──────────────────────────────────────────────────────────
   3. 유틸 함수
   ────────────────────────────────────────────────────────── */
const THEME_CONFIG = {
  travel: { emoji: '✈️', label: '여행', gradient: 'linear-gradient(135deg, #7C6251 0%, #4E2816 100%)' },
  food:   { emoji: '🍜', label: '맛집', gradient: 'linear-gradient(135deg, #E8A87C 0%, #C17D52 100%)' },
  diary:  { emoji: '📔', label: '일기', gradient: 'linear-gradient(135deg, #D4AF37 0%, #A57B1B 100%)' },
  default:{ emoji: '🗺️', label: '기타', gradient: 'linear-gradient(135deg, #A39081 0%, #7C6251 100%)' }
};

function formatMetaKey(key) {
  const map = { location: '📍', season: '🌸', emotion: '💭', weather: '⛅' };
  return map[key] || '·';
}

function formatMetaValue(key, val) {
  return String(val);
}

function showToast(msg) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function updatePageFlips() {
  const pages = document.querySelectorAll('.page');
  const pageOrder = ['cover', 'index', ...state.trips.map(t => t.id)];
  const currentIndex = pageOrder.indexOf(state.currentPage);
  
  pages.forEach(page => {
    const pageId = page.dataset.page;
    const pageIndex = pageOrder.indexOf(pageId);
    if (pageIndex < currentIndex) page.classList.add('flipped');
    else page.classList.remove('flipped');
  });
}

function flipToPage(pageId) {
  state.currentPage = pageId;
  updatePageFlips();
}


/* ──────────────────────────────────────────────────────────
   4. 렌더링 함수들
   ────────────────────────────────────────────────────────── */

function renderHeader(type) {
  let actionBtn = '';
  if (type === 'index') {
    actionBtn = `<button class="header-btn text-btn" id="btnGoCover">표지로</button>`;
  } else if (type === 'trip') {
    actionBtn = `<button class="header-btn text-btn" id="btnGoTOC">목차로</button>`;
  }

  return `
    <header class="app-header" id="appHeader">
      <div class="header-actions-left">
        ${actionBtn}
      </div>
      <div class="header-logo">Trip Book</div>
      <div class="header-actions"></div>
    </header>`;
}

function renderCoverPage() {
  return `
    <div class="page cover-page" data-page="cover" id="page-cover">
      <div class="book-cover-border"><div class="book-cover-border-inner"></div></div>
      <div class="book-title-group">
        <p class="book-title-sub">MEMORIES OF LIFE</p>
        <h1 class="book-title-main">Trip</h1>
        <div class="book-title-divider"></div>
        <p class="book-author">나의 여행 기록</p>
      </div>
    </div>
  `;
}

// v1.6 신규: 목차(Table of Contents) 렌더링
function renderTOCPage() {
  // 연도별 그룹핑
  const groups = {};
  state.trips.forEach((trip, idx) => {
    const year = new Date(trip.created_at).getFullYear() + '년';
    if (!groups[year]) groups[year] = [];
    groups[year].push({ trip, index: idx + 1 });
  });

  const groupKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a)); // 최신 연도순

  let tocHTML = '';
  groupKeys.forEach(year => {
    tocHTML += `
      <div class="toc-group">
        <div class="toc-year-title">${year}</div>
        <div class="toc-list">
    `;
    groups[year].forEach(item => {
      const loc = item.trip.metadata?.location || '어딘가';
      let titleDisplay = item.trip.title;
      // location 부분이 중복되면 제외 로직 (간단히 앞부분 매칭 시 제거)
      if (titleDisplay.startsWith(loc)) {
        titleDisplay = titleDisplay.substring(loc.length).trim();
      }
      if (titleDisplay.startsWith('—') || titleDisplay.startsWith('-')) {
        titleDisplay = titleDisplay.substring(1).trim();
      }
      
      const fullTitle = `${loc} — ${titleDisplay}`;
      
      tocHTML += `
        <div class="toc-item" data-trip-id="${item.trip.id}">
          <span class="toc-item-title">(${item.index}) ${fullTitle}</span>
          <span class="toc-leader"></span>
          <span class="toc-item-page">p.${item.index}</span>
        </div>
      `;
    });
    tocHTML += `</div></div>`;
  });

  if (state.trips.length === 0) {
    tocHTML = `<div style="text-align:center; color:#A39081; padding: 40px;">아직 기록된 목차가 없습니다.</div>`;
  }

  return `
    <div class="page" data-page="index" id="page-index">
      <div class="page-content">
        ${renderHeader('index')}
        <div class="toc-container">
          <div class="toc-header">
            <div class="toc-header-line"></div>
            <div class="toc-header-title">목 차</div>
            <div class="toc-header-line" style="margin-top:16px;"></div>
          </div>
          ${tocHTML}
        </div>
        <button class="fab" id="fabAdd" title="새 챕터 추가">+</button>
      </div>
      <div class="page-number">TOC.</div>
    </div>
  `;
}

function renderTripPage(trip, indexNumber) {
  const cfg = THEME_CONFIG[trip.theme] || THEME_CONFIG.default;
  
  // Dynamic Form (예산 제거)
  let formFields = '';
  if (trip.theme === 'travel') {
    formFields = `
      <div class="form-group"><label class="form-label" for="field-season-${trip.id}">🌸 계절</label><select class="form-select" id="field-season-${trip.id}"><option value="">계절 선택</option><option value="봄">🌸 봄</option><option value="여름">☀️ 여름</option><option value="가을">🍂 가을</option><option value="겨울">❄️ 겨울</option></select></div>
      <div class="form-group"><label class="form-label" for="field-companion-${trip.id}">👥 동반인</label><select class="form-select" id="field-companion-${trip.id}"><option value="">동반자 선택</option><option value="혼자">🧍 혼자</option><option value="연인">💑 연인</option><option value="가족">👨‍👩‍👧 가족</option><option value="친구">👫 친구</option></select></div>
    `;
  } else if (trip.theme === 'food') {
    formFields = `
      <div class="form-group"><label class="form-label" for="field-restaurant-${trip.id}">🏪 식당 이름</label><input type="text" class="form-input" id="field-restaurant-${trip.id}" placeholder="식당명을 입력하세요"></div>
      <div class="form-group"><label class="form-label">⭐ 별점 평가</label><div class="star-rating" id="starRating-${trip.id}" data-trip="${trip.id}">${[1,2,3,4,5].map(n => `<button class="star-btn" data-star="${n}" id="star-${trip.id}-${n}">★</button>`).join('')}<span class="star-value-label" id="starLabel-${trip.id}">선택 대기</span></div></div>
      <div class="form-group"><label class="form-label">💳 가격 정보</label><div class="price-chip-group" id="priceChips-${trip.id}"><button class="price-chip" data-value="저렴" id="price-cheap-${trip.id}">💰 저렴</button><button class="price-chip" data-value="보통" id="price-mid-${trip.id}">💵 보통</button><button class="price-chip" data-value="고급" id="price-high-${trip.id}">💳 고급</button></div></div>
    `;
  } else if (trip.theme === 'diary') {
    formFields = `
      <div class="form-group"><label class="form-label">💭 오늘의 감정</label><div class="emotion-chip-group" id="emotionChips-${trip.id}"><button class="emotion-chip" data-value="행복" id="emotion-happy-${trip.id}">😌 행복</button><button class="emotion-chip" data-value="설렘" id="emotion-excited-${trip.id}">🥰 설렘</button><button class="emotion-chip" data-value="힐링" id="emotion-healing-${trip.id}">🌿 힐링</button><button class="emotion-chip" data-value="피곤" id="emotion-tired-${trip.id}">😮‍💨 피곤</button></div></div>
      <div class="form-group"><label class="form-label">⛅ 오늘 날씨</label><div class="weather-chip-group" id="weatherChips-${trip.id}"><button class="weather-chip" data-value="맑음" id="weather-sun-${trip.id}">☀️ 맑음</button><button class="weather-chip" data-value="흐림" id="weather-cloud-${trip.id}">☁️ 흐림</button><button class="weather-chip" data-value="비" id="weather-rain-${trip.id}">🌧️ 비</button></div></div>
      <div class="form-group"><label class="form-label" for="field-memo-${trip.id}">📝 일기 초안</label><textarea class="form-textarea" id="field-memo-${trip.id}" placeholder="오늘의 추억 한 줄을 남겨보세요."></textarea></div>
    `;
  }

  return `
    <div class="page" data-page="${trip.id}" id="page-${trip.id}">
      <div class="page-content">
        ${renderHeader('trip')}
        <div class="inner-page-details">
          <div class="details-header">
            <div class="details-cover" style="background: ${cfg.gradient};">${cfg.emoji}</div>
            <div class="details-title-block">
              <span class="details-theme theme-${trip.theme}">${cfg.emoji} ${cfg.label}</span>
              <h2 class="details-title">${trip.title}</h2>
              <p class="details-desc">${trip.description || '이 챕터에 대한 설명이 기록되지 않았습니다.'}</p>
            </div>
          </div>
          <div>
            <p class="modal-section-title">✏️ 본문 기록 양식</p>
            <div class="dynamic-form">
              ${formFields}
              <button class="form-save-btn" id="formSaveBtn-${trip.id}" data-trip="${trip.id}">✍️ 책에 쓰기 (저장)</button>
            </div>
          </div>
        </div>
      </div>
      <div class="page-number">${indexNumber}</div>
    </div>
  `;
}

function renderApp() {
  const root = document.getElementById('app');
  
  const pageOrder = ['cover', 'index', ...state.trips.map(t => t.id)];
  let pagesHTML = '';
  
  pageOrder.forEach((pageId, idx) => {
    const zIndex = pageOrder.length - idx;
    let html = '';
    if (pageId === 'cover') html = renderCoverPage();
    else if (pageId === 'index') html = renderTOCPage();
    else {
      const trip = state.trips.find(t => t.id === pageId);
      html = renderTripPage(trip, idx);
    }
    pagesHTML += html.replace('class="page', `style="z-index:${zIndex};" class="page`);
  });

  root.innerHTML = `
    <div class="book-container">
      <div class="book">
        <div class="book-spine"></div>
        ${pagesHTML}
      </div>
      <div id="extraMount">
        ${renderUploadModal()}
        ${renderCreateTripModal()}
      </div>
    </div>
  `;

  updatePageFlips();
  attachEventListeners();
}

/* ──────────────────────────────────────────────────────────
   5. Modals
   ────────────────────────────────────────────────────────── */
function renderUploadModal() {
  return `
    <div class="modal-overlay${state.uploadModalOpen ? ' open' : ''}" id="uploadModalOverlay">
      <div class="trip-modal slide-up-modal">
        <div class="modal-header">
          <div class="modal-title-block"><h2 class="modal-title">사진 인화 및 보관</h2></div>
          <button class="modal-close-btn" id="uploadModalCloseBtn">✕</button>
        </div>
        <div class="modal-body">
          <div class="upload-dropzone" id="uploadDropzone">
            <div class="upload-dropzone-icon">📥</div><p class="upload-dropzone-title">사진 파일을 올려두세요</p>
            <input type="file" id="fileUploadInput" multiple accept="image/*" style="display: none;">
          </div>
        </div>
      </div>
    </div>`;
}

function renderCreateTripModal() {
  return `
    <div class="modal-overlay${state.createModalOpen ? ' open' : ''}" id="createModalOverlay">
      <div class="trip-modal slide-up-modal">
        <div class="modal-header">
          <div class="modal-title-block"><h2 class="modal-title">새로운 챕터 개설</h2></div>
          <button class="modal-close-btn" id="createModalCloseBtn">✕</button>
        </div>
        <div class="modal-body">
          <form class="dynamic-form" id="createTripForm">
            <div class="form-group"><label class="form-label" for="create-title">🏷️ 챕터 제목</label><input type="text" class="form-input" id="create-title" required></div>
            <div class="form-group">
              <label class="form-label">🎨 챕터 장르</label>
              <div class="theme-selection-grid">
                <button type="button" class="theme-select-card selected" data-theme="travel">여행기</button>
                <button type="button" class="theme-select-card" data-theme="food">미식록</button>
                <button type="button" class="theme-select-card" data-theme="diary">일기</button>
              </div>
            </div>
            <div class="form-group"><label class="form-label" for="create-location">📍 장소</label><input type="text" class="form-input" id="create-location"></div>
            <button type="submit" class="form-save-btn" style="margin-top: 8px;">✍️ 책에 바인딩</button>
          </form>
        </div>
      </div>
    </div>`;
}

/* ──────────────────────────────────────────────────────────
   6. 이벤트 핸들러 및 런타임 제어
   ────────────────────────────────────────────────────────── */
function attachEventListeners() {
  const coverPage = document.getElementById('page-cover');
  if (coverPage) {
    coverPage.addEventListener('click', () => { flipToPage('index'); });
  }

  const pageIndex = document.getElementById('page-index');
  if (pageIndex) {
    // 목차 아이템 클릭 이벤트
    pageIndex.querySelectorAll('.toc-item').forEach(item => {
      item.addEventListener('click', () => {
        flipToPage(item.dataset.tripId);
      });
    });

    document.getElementById('fabAdd')?.addEventListener('click', () => {
      state.createModalOpen = true; renderApp();
    });
  }

  // 상단 네비게이션 버튼 이벤트
  document.querySelectorAll('#btnGoCover').forEach(btn => {
    btn.addEventListener('click', () => flipToPage('cover'));
  });
  document.querySelectorAll('#btnGoTOC').forEach(btn => {
    btn.addEventListener('click', () => flipToPage('index'));
  });

  document.getElementById('uploadModalCloseBtn')?.addEventListener('click', () => {
    state.uploadModalOpen = false; renderApp();
  });
  document.getElementById('createModalCloseBtn')?.addEventListener('click', () => {
    state.createModalOpen = false; renderApp();
  });

  document.querySelectorAll('.theme-select-card').forEach(card => {
    card.addEventListener('click', (e) => {
      document.querySelectorAll('.theme-select-card').forEach(c => c.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
    });
  });

  document.getElementById('createTripForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('create-title')?.value;
    const loc = document.getElementById('create-location')?.value;
    const theme = document.querySelector('.theme-select-card.selected')?.dataset.theme || 'travel';
    
    const newTrip = {
      id: `trip-${Date.now()}`,
      title,
      description: '',
      theme,
      cover_photo: null,
      photo_count: 0,
      metadata: loc ? { location: loc } : {},
      created_at: new Date().toISOString()
    };
    state.trips.unshift(newTrip);
    state.createModalOpen = false;
    showToast('새 챕터가 추가되었습니다.');
    renderApp();
  });

  document.querySelectorAll('.form-save-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showToast('✍️ 책에 성공적으로 기록했습니다!');
      flipToPage('index');
    });
  });
}

async function init() {
  try {
    state.trips = await fetchTrips();
  } catch (err) {
    state.trips = [];
  }
  renderApp();
}

init();
