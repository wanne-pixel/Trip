/* ============================================================
   Trip — 나의 여행 기록
   app.js  v1.8 (실제 API 연동 — MOCK 데이터 완전 제거)
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   1. API 설정 (Rule 3 — API Contract)
   ────────────────────────────────────────────────────────── */
const API_BASE_URL = 'http://localhost:4000/api';

/* ── API 헬퍼 함수들 ────────────────────────────────── */

/** GET /api/trips → Trip[] */
async function fetchTrips() {
  const res = await fetch(`${API_BASE_URL}/trips`);
  if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '여행 목록을 불러오지 못했습니다.');
  return json.data;
}

/** GET /api/photos?trip_id={id} → Photo[] */
async function fetchPhotosByTrip(tripId) {
  const res = await fetch(`${API_BASE_URL}/photos?trip_id=${tripId}`);
  if (!res.ok) throw new Error(`사진 불러오기 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '사진 목록을 불러오지 못했습니다.');
  return json.data;
}

/** POST /api/trips → 새 Trip 생성 */
async function createTrip(payload) {
  const res = await fetch(`${API_BASE_URL}/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`여행 생성 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '여행을 생성하지 못했습니다.');
  return json.data;
}

/** POST /api/photos/upload → 사진 업로드 (FormData) */
async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append('photo', file);
  const res = await fetch(`${API_BASE_URL}/photos/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`업로드 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '사진을 업로드하지 못했습니다.');
  return json.data;
}

/* ──────────────────────────────────────────────────────────
   2. 상태 관리
   ────────────────────────────────────────────────────────── */
let state = {
  trips: [],
  currentPage: 'cover',   // 'cover' | 'index' | trip.id
  tripPhotos: {},          // { [trip_id]: Photo[] }
  uploadModalOpen: false,
  createModalOpen: false,
  isLoading: false,
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

function showToast(msg, isError = false) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = isError
    ? 'linear-gradient(135deg, #8B2222, #C0392B)'
    : 'linear-gradient(135deg, #2D160C, #4E2816)';
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
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

  // 여행 페이지로 이동 시 사진 지연 로드
  const isTrip = pageId !== 'cover' && pageId !== 'index';
  if (isTrip && !state.tripPhotos[pageId]) {
    loadTripPhotos(pageId);
  }
}

/* ──────────────────────────────────────────────────────────
   4. 데이터 로드 함수
   ────────────────────────────────────────────────────────── */
async function loadTripPhotos(tripId) {
  try {
    const photos = await fetchPhotosByTrip(tripId);
    state.tripPhotos[tripId] = photos;
    // 현재 해당 페이지가 열려있으면 사진 섹션만 갱신
    const photoSection = document.getElementById(`photoSection-${tripId}`);
    if (photoSection) {
      photoSection.innerHTML = renderPhotoSection(tripId);
    }
  } catch (err) {
    console.error('[loadTripPhotos]', err);
    // 에러 시 빈 배열로 처리 — 앱을 죽이지 않음 (Rule 2)
    state.tripPhotos[tripId] = [];
  }
}

/* ──────────────────────────────────────────────────────────
   5. 렌더링 함수들
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
      <!-- 테스트용 사진 업로드 버튼 (Task 5) -->
      <div style="position:absolute;bottom:32px;left:50%;transform:translateX(-50%);">
        <label for="coverFileUpload" class="cover-upload-label">📷 사진 업로드 테스트</label>
        <input type="file" id="coverFileUpload" accept="image/*" style="display:none;">
      </div>
    </div>
  `;
}

function renderTOCPage() {
  const groups = {};
  state.trips.forEach((trip, idx) => {
    const year = new Date(trip.created_at).getFullYear() + '년';
    if (!groups[year]) groups[year] = [];
    groups[year].push({ trip, index: idx + 1 });
  });

  const groupKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

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

function renderPhotoSection(tripId) {
  const photos = state.tripPhotos[tripId];
  if (!photos) {
    return `<div class="photo-section-loading">📷 사진 불러오는 중...</div>`;
  }
  if (photos.length === 0) {
    return `<div class="photo-section-empty">아직 사진이 없습니다.</div>`;
  }
  const items = photos.map(p => {
    const src = p.storage_path || '';
    const tag = p.vision_tags
      ? `<span class="photo-tag">${p.vision_tags.time_of_day || ''} ${p.vision_tags.environment || ''}</span>`
      : `<span class="photo-tag unanalyzed">분석 불가</span>`;
    if (src) {
      return `<div class="photo-thumb"><img src="${src}" alt="${p.original_filename}">${tag}</div>`;
    }
    return `<div class="photo-thumb placeholder">${tag}<span class="photo-filename">${p.original_filename}</span></div>`;
  }).join('');
  return `<div class="photo-grid">${items}</div>`;
}

function renderTripPage(trip, indexNumber) {
  const cfg = THEME_CONFIG[trip.theme] || THEME_CONFIG.default;

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
          <!-- 사진 섹션 (API에서 비동기 로드) -->
          <div id="photoSection-${trip.id}">
            ${renderPhotoSection(trip.id)}
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
      if (trip) html = renderTripPage(trip, idx);
    }
    if (html) {
      pagesHTML += html.replace('class="page', `style="z-index:${zIndex};" class="page`);
    }
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
   6. Modals
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
            <div class="form-group"><label class="form-label" for="create-desc">📝 소개</label><textarea class="form-textarea" id="create-desc" placeholder="이번 여행에 대한 짧은 소개를 남겨보세요."></textarea></div>
            <button type="submit" class="form-save-btn" style="margin-top: 8px;" id="createTripSubmitBtn">✍️ 책에 바인딩</button>
          </form>
        </div>
      </div>
    </div>`;
}

/* ──────────────────────────────────────────────────────────
   7. 이벤트 핸들러
   ────────────────────────────────────────────────────────── */
function attachEventListeners() {
  // 표지 클릭 → 목차로
  const coverPage = document.getElementById('page-cover');
  if (coverPage) {
    // 파일 입력 제외 영역만 반응하도록 처리
    coverPage.addEventListener('click', (e) => {
      if (e.target.closest('#coverFileUpload') || e.target.closest('.cover-upload-label')) return;
      flipToPage('index');
    });
  }

  // 표지 파일 업로드 테스트 (Task 5)
  document.getElementById('coverFileUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showToast(`📤 "${file.name}" 업로드 중...`);
    try {
      const result = await uploadPhoto(file);
      console.log('[업로드 성공]', result);
      showToast(`✅ 업로드 성공: ${result.original_filename}`);
    } catch (err) {
      console.error('[업로드 실패]', err);
      showToast(`❌ 업로드 실패: ${err.message}`, true);
    }
    e.target.value = '';
  });

  // 목차 아이템 클릭
  const pageIndex = document.getElementById('page-index');
  if (pageIndex) {
    pageIndex.querySelectorAll('.toc-item').forEach(item => {
      item.addEventListener('click', () => flipToPage(item.dataset.tripId));
    });
    document.getElementById('fabAdd')?.addEventListener('click', () => {
      state.createModalOpen = true; renderApp();
    });
  }

  // 상단 네비게이션 버튼
  document.querySelectorAll('#btnGoCover').forEach(btn => btn.addEventListener('click', () => flipToPage('cover')));
  document.querySelectorAll('#btnGoTOC').forEach(btn => btn.addEventListener('click', () => flipToPage('index')));

  // 모달 닫기
  document.getElementById('uploadModalCloseBtn')?.addEventListener('click', () => {
    state.uploadModalOpen = false; renderApp();
  });
  document.getElementById('createModalCloseBtn')?.addEventListener('click', () => {
    state.createModalOpen = false; renderApp();
  });

  // 테마 카드 선택
  document.querySelectorAll('.theme-select-card').forEach(card => {
    card.addEventListener('click', (e) => {
      document.querySelectorAll('.theme-select-card').forEach(c => c.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
    });
  });

  // 새 여행 생성 폼 제출 → POST /api/trips
  document.getElementById('createTripForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('create-title')?.value?.trim();
    const loc = document.getElementById('create-location')?.value?.trim();
    const desc = document.getElementById('create-desc')?.value?.trim();
    const theme = document.querySelector('.theme-select-card.selected')?.dataset.theme || 'travel';

    if (!title) { showToast('제목을 입력해주세요.', true); return; }

    const submitBtn = document.getElementById('createTripSubmitBtn');
    if (submitBtn) { submitBtn.textContent = '⏳ 저장 중...'; submitBtn.disabled = true; }

    try {
      const newTrip = await createTrip({
        title,
        description: desc || null,
        theme,
        metadata: loc ? { location: loc } : {},
      });
      // 서버에서 받은 실제 데이터를 state에 추가
      state.trips.unshift(newTrip);
      state.createModalOpen = false;
      showToast('✅ 새 챕터가 추가되었습니다!');
      renderApp();
    } catch (err) {
      console.error('[createTrip 실패]', err);
      showToast(`❌ 챕터 생성 실패: ${err.message}`, true);
      if (submitBtn) { submitBtn.textContent = '✍️ 책에 바인딩'; submitBtn.disabled = false; }
    }
  });

  // 저장 버튼 (로컬 토스트만 — 실제 PATCH 연동은 추후)
  document.querySelectorAll('.form-save-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showToast('✍️ 책에 성공적으로 기록했습니다!');
      flipToPage('index');
    });
  });
}

/* ──────────────────────────────────────────────────────────
   8. 초기화
   ────────────────────────────────────────────────────────── */
async function init() {
  try {
    state.trips = await fetchTrips();
  } catch (err) {
    console.error('[init] 여행 목록 불러오기 실패:', err);
    state.trips = [];
    // 앱이 죽지 않도록: 빈 상태로 렌더링 후 사용자에게 에러 알림 (Rule 2)
    renderApp();
    showToast('⚠️ 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', true);
    return;
  }
  renderApp();
}

init();
