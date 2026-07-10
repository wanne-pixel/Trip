/* ============================================================
   Trip — 나의 여행 기록
   app.js  v2.0 (다중 사진 기반 워크플로우 및 개별 서랍 UI)
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   1. API 설정 (Rule 3 — API Contract)
   ────────────────────────────────────────────────────────── */
// 로컬 개발(3000)일 때는 4000번 백엔드 호출, 배포 환경에서는 같은 도메인 사용
const API_BASE_URL = window.location.port === '3000' 
  ? 'http://localhost:4000/api' 
  : window.location.origin + '/api';

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

/**
 * POST /api/trips/from-photos → { trip, photos, summary }
 * 다중 사진 업로드 기반 여행 자동 생성
 */
async function createTripFromPhotos(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('photos', file);
  }
  const res = await fetch(`${API_BASE_URL}/trips/from-photos`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`여행 생성 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '여행을 생성하지 못했습니다.');
  return json.data; // { trip, photos, summary }
}

/** PATCH /api/trips/:id → 필드 수정 (title, description 등) */
async function patchTrip(tripId, payload) {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`수정 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '수정에 실패했습니다.');
  return json.data;
}

/** DELETE /api/trips/:id → 여행 삭제 */
async function deleteTrip(tripId) {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`삭제 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '삭제에 실패했습니다.');
  return true;
}

/** POST /api/trips/:id/photos → 사진 추가 업로드 */
async function addPhotosToTrip(tripId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('photos', file);
  }
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/photos`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`사진 추가 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '사진을 추가하지 못했습니다.');
  return json.data;
}

/** DELETE /api/photos/:id → 사진 삭제 */
async function deletePhoto(photoId) {
  const res = await fetch(`${API_BASE_URL}/photos/${photoId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`사진 삭제 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '사진 삭제에 실패했습니다.');
  return true;
}

/* ──────────────────────────────────────────────────────────
   2. 상태 관리
   ────────────────────────────────────────────────────────── */
let state = {
  trips: [],
  currentPage: 'cover',   // 'cover' | 'index' | trip.id
  tripPhotos: {},          // { [trip_id]: Photo[] }
  isLoading: false,
  loadingMsg: '',
  drawerOpen: {},          // { [trip_id]: boolean } — 미분류 서랍 열림 여부
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

const MAX_FILE_SIZE_MB = 20;

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
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoadingOverlay(msg = 'AI가 사진을 분석하고 있습니다...') {
  state.isLoading = true;
  state.loadingMsg = msg;
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="loading-card">
      <div class="loading-spinner"></div>
      <p class="loading-title">잠시만 기다려주세요</p>
      <p class="loading-msg">${msg}</p>
    </div>
  `;
  overlay.classList.add('visible');
}

function hideLoadingOverlay() {
  state.isLoading = false;
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('visible');
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
  const isTrip = pageId !== 'cover' && pageId !== 'index';
  if (isTrip && !state.tripPhotos[pageId]) {
    loadTripPhotos(pageId);
  }
}

/* ──────────────────────────────────────────────────────────
   4. 데이터 로드
   ────────────────────────────────────────────────────────── */
async function loadTripPhotos(tripId) {
  try {
    const photos = await fetchPhotosByTrip(tripId);
    state.tripPhotos[tripId] = photos;
    refreshPhotoSection(tripId);
  } catch (err) {
    console.error('[loadTripPhotos]', err);
    state.tripPhotos[tripId] = []; // Rule 2: 앱을 죽이지 않음
    refreshPhotoSection(tripId);
  }
}

function refreshPhotoSection(tripId) {
  const timelineEl = document.getElementById(`timeline-${tripId}`);
  const drawerEl = document.getElementById(`drawer-${tripId}`);
  if (timelineEl) timelineEl.innerHTML = renderTimeline(tripId);
  if (drawerEl) drawerEl.innerHTML = renderDrawerContent(tripId);
}

/* ──────────────────────────────────────────────────────────
   5. 렌더링 함수들
   ────────────────────────────────────────────────────────── */
function renderHeader(type, tripId) {
  let actionBtn = '';
  let rightBtn = '';
  if (type === 'index') {
    actionBtn = `<button class="header-btn text-btn" id="btnGoCover">표지로</button>`;
  } else if (type === 'trip') {
    actionBtn = `<button class="header-btn text-btn" id="btnGoTOC">목차로</button>`;
    rightBtn = `<button class="header-btn text-btn delete-trip-btn" id="btnDeleteTrip" data-trip-id="${tripId}" title="여행 삭제">🗑 삭제</button>`;
  }
  return `
    <header class="app-header">
      <div class="header-actions-left">${actionBtn}</div>
      <div class="header-logo">Trip Book</div>
      <div class="header-actions">${rightBtn}</div>
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
    tocHTML += `<div class="toc-group"><div class="toc-year-title">${year}</div><div class="toc-list">`;
    groups[year].forEach(item => {
      const loc = item.trip.metadata?.location || '어딘가';
      let titleDisplay = item.trip.title;
      if (titleDisplay.startsWith(loc)) titleDisplay = titleDisplay.substring(loc.length).trim();
      if (titleDisplay.startsWith('—') || titleDisplay.startsWith('-')) titleDisplay = titleDisplay.substring(1).trim();
      const fullTitle = `${loc} — ${titleDisplay}`;
      tocHTML += `
        <div class="toc-item" data-trip-id="${item.trip.id}">
          <span class="toc-item-title">(${item.index}) ${fullTitle}</span>
          <span class="toc-leader"></span>
          <span class="toc-item-page">p.${item.index}</span>
        </div>`;
    });
    tocHTML += `</div></div>`;
  });

  if (state.trips.length === 0) {
    tocHTML = `
      <div class="toc-empty">
        <div class="toc-empty-icon">📷</div>
        <p class="toc-empty-title">아직 여행 기록이 없습니다</p>
        <p class="toc-empty-sub">아래 버튼을 눌러 사진으로 첫 여행을 시작해보세요</p>
      </div>`;
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
        <!-- v2.0: 다중 사진 업로드 FAB + 드래그앤드롭 -->
        <div class="upload-fab-zone" id="uploadFabZone">
          <div class="upload-fab-dropzone" id="uploadDropZone">
            <input type="file" id="multiPhotoInput" multiple accept="image/*" style="display:none;">
            <label for="multiPhotoInput" class="upload-fab-label">
              <span class="upload-fab-icon">📷</span>
              <span class="upload-fab-text">사진으로 새 여행 시작</span>
              <span class="upload-fab-sub">여러 장을 드래그하거나 클릭하세요</span>
            </label>
          </div>
        </div>
      </div>
      <div class="page-number">TOC.</div>
    </div>
  `;
}

/* ── 타임라인 (taken_at 정렬 + vision_tags 뱃지) ── */
function renderTimeline(tripId) {
  const allPhotos = state.tripPhotos[tripId];
  if (!allPhotos) return `<div class="photo-section-loading">📷 사진 불러오는 중...</div>`;

  const classified = allPhotos
    .filter(p => p.classified !== false)
    .sort((a, b) => {
      if (!a.taken_at && !b.taken_at) return 0;
      if (!a.taken_at) return 1;
      if (!b.taken_at) return -1;
      return new Date(a.taken_at) - new Date(b.taken_at);
    });

  if (classified.length === 0) {
    return `<div class="photo-section-empty">📸 타임라인에 분류된 사진이 없습니다.</div>`;
  }

  let html = '<div class="timeline-list">';
  let currentDay = 0;
  let currentDayString = null;
  let unknownHtml = '';

  // v2.5: 시간 기반(3분 이내) 사진 그룹화
  const groups = [];
  let currentGroup = [];

  classified.forEach(p => {
    if (currentGroup.length === 0) {
      currentGroup.push(p);
      return;
    }
    
    const lastP = currentGroup[currentGroup.length - 1];
    if (p.taken_at && lastP.taken_at) {
      const diffMs = new Date(p.taken_at).getTime() - new Date(lastP.taken_at).getTime();
      if (diffMs <= 3 * 60 * 1000) { // 3분 이내
        currentGroup.push(p);
      } else {
        groups.push([...currentGroup]);
        currentGroup = [p];
      }
    } else {
      groups.push([...currentGroup]);
      currentGroup = [p];
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);

  groups.forEach(group => {
    const firstP = group[0];
    let dateObj = firstP.taken_at ? new Date(firstP.taken_at) : null;
    let tags = '';

    // 태그는 그룹의 첫 번째 사진을 기준으로 표시
    if (firstP.vision_tags) {
      if (firstP.vision_tags.category) {
        tags = `<span class="vtag vtag-category">${categoryLabel(firstP.vision_tags.category)}</span>`;
      } else {
        if (firstP.vision_tags.environment === 'nature' || firstP.vision_tags.environment === 'outdoor') tags = `<span class="vtag vtag-category">🏞 풍경</span>`;
        else if (firstP.vision_tags.environment === 'indoor') tags = `<span class="vtag vtag-category">🏠 실내</span>`;
        else tags = `<span class="vtag vtag-category">📌 기타</span>`;
      }
    } else {
      tags = `<span class="vtag vtag-unknown">분석 불가</span>`;
    }

    const sliderHtml = group.map((gp, i) => `
      <div class="photo-slide" id="photo-item-${gp.id}">
        ${gp.storage_path
          ? `<img class="timeline-photo-img" src="${gp.storage_path}" alt="${gp.original_filename}">`
          : `<div class="timeline-photo-placeholder">🖼️<span>${gp.original_filename}</span></div>`
        }
        ${group.length > 1 ? `<div class="slide-counter">${i + 1} / ${group.length}</div>` : ''}
        <button class="photo-delete-btn slide-delete-btn" data-photo-id="${gp.id}" data-trip-id="${gp.trip_id}" title="사진 삭제">🗑</button>
      </div>
    `).join('');

    let cardHtml = `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="photo-slider">${sliderHtml}</div>
          <div class="timeline-card-footer">
            ${dateObj ? `<span class="timeline-date">🕐 ${dateObj.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
            <div class="timeline-tags">${tags}</div>
          </div>
        </div>
      </div>`;

    if (!dateObj) {
      unknownHtml += cardHtml;
    } else {
      const dateString = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
      if (currentDayString !== dateString) {
        currentDay++;
        currentDayString = dateString;
        const displayDate = dateObj.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        html += `<div class="timeline-day-header"><h3>Day ${currentDay} <span>(${displayDate})</span></h3></div>`;
      }
      html += cardHtml;
    }
  });

  if (unknownHtml) {
    html += `<div class="timeline-day-header"><h3>알 수 없음</h3></div>${unknownHtml}`;
  }

  html += '</div>';
  return html;
}

function categoryLabel(val) {
  const map = { food: '🍔 음식', scenery: '🏞 풍경', accommodation: '🏨 숙소', activity: '🏃‍♂️ 액티비티', people: '👥 인물', other: '📌 기타' };
  return map[val] || (val ? '📌 기타' : '분석 불가');
}
function timeOfDayLabel(val) {
  return { morning: '🌅 아침', afternoon: '☀️ 오후', night: '🌙 야간' }[val] || val;
}
function envLabel(val) {
  return { indoor: '🏠 실내', outdoor: '🌿 야외', urban: '🏙 도심', nature: '🌲 자연' }[val] || val;
}

/* ── 미분류 서랍 ── */
function renderDrawerContent(tripId) {
  const allPhotos = state.tripPhotos[tripId];
  if (!allPhotos) return '';
  const unclassified = allPhotos.filter(p => p.classified === false);
  if (unclassified.length === 0) return `<div class="drawer-empty">미분류 사진이 없습니다 ✨</div>`;

  const cards = unclassified.map(p => {
    const imgHtml = p.storage_path
      ? `<img class="drawer-photo-img" src="${p.storage_path}" alt="${p.original_filename}">`
      : `<div class="drawer-photo-placeholder">🖼️</div>`;
    let tag = '';
    if (p.vision_tags === null) {
      tag = `<span class="vtag vtag-unknown">분석 불가</span>`;
    } else if (p.vision_tags.category) {
      tag = `<span class="vtag vtag-category">${categoryLabel(p.vision_tags.category)}</span>`;
    } else {
      // 구버전 데이터 호환
      if (p.vision_tags.environment === 'nature' || p.vision_tags.environment === 'outdoor') tag = `<span class="vtag vtag-category">🏞 풍경</span>`;
      else if (p.vision_tags.environment === 'indoor') tag = `<span class="vtag vtag-category">🏠 실내</span>`;
      else tag = `<span class="vtag vtag-category">📌 기타</span>`;
    }
    return `
      <div class="drawer-photo-card" id="photo-item-${p.id}">
        ${imgHtml}${tag}
        <p class="drawer-photo-name">${p.original_filename}</p>
        <button class="photo-delete-btn drawer-delete" data-photo-id="${p.id}" data-trip-id="${p.trip_id}" title="사진 삭제">🗑</button>
      </div>`;
  }).join('');

  return `<div class="drawer-grid">${cards}</div>`;
}

/* ── 여행 상세 페이지 ── */
function renderTripPage(trip, indexNumber) {
  const cfg = THEME_CONFIG[trip.theme] || THEME_CONFIG.default;
  const drawerIsOpen = !!state.drawerOpen[trip.id];

  const allPhotos = state.tripPhotos[trip.id];
  const unclassifiedCount = allPhotos ? allPhotos.filter(p => p.classified === false).length : 0;

  const descText = trip.description || '';
  const descPlaceholder = '날짜나 기간을 입력하세요 (예: 6월 15일 ~ 6월 17일)';

  return `
    <div class="page" data-page="${trip.id}" id="page-${trip.id}">
      <div class="page-content">
        ${renderHeader('trip', trip.id)}
        <div class="inner-page-details">

          <!-- 헤더: 제목 + 기간 인라인 편집 + 삭제 버튼 -->
          <div class="details-header">
            <div class="details-cover" style="background: ${cfg.gradient};">${cfg.emoji}</div>
            <div class="details-title-block">
              <span class="details-theme theme-${trip.theme}">${cfg.emoji} ${cfg.label}</span>
              <h2 class="details-title inline-editable"
                  id="tripTitle-${trip.id}"
                  data-field="title"
                  data-trip-id="${trip.id}"
                  title="클릭하여 제목 수정">
                ${trip.title}
                <span class="edit-hint">✏️</span>
              </h2>
              <p class="details-desc inline-editable-desc ${descText ? '' : 'desc-placeholder'}"
                 id="tripDesc-${trip.id}"
                 data-field="description"
                 data-trip-id="${trip.id}"
                 title="클릭하여 날짜/기간 수정">
                ${descText || descPlaceholder}
                <span class="edit-hint" style="font-size:11px;">✏️</span>
              </p>
            </div>
          </div>

          <div class="add-photo-bar">
            <input type="file" id="addPhotos-${trip.id}" multiple accept="image/*" style="display:none;" data-trip-id="${trip.id}">
            <label for="addPhotos-${trip.id}" class="add-photo-btn">
              <span class="icon">➕</span> 이 여행에 사진 추가하기
            </label>
          </div>

          <!-- 타임라인 섹션 -->
          <div class="section-label">📅 타임라인</div>
          <div id="timeline-${trip.id}">
            ${renderTimeline(trip.id)}
          </div>

          <!-- 미분류 사진 서랍 -->
          <div class="drawer-section">
            <button class="drawer-toggle-btn ${drawerIsOpen ? 'open' : ''}"
                    id="drawerToggle-${trip.id}"
                    data-trip-id="${trip.id}">
              <span>🗂 미분류 사진 서랍</span>
              ${unclassifiedCount > 0 ? `<span class="drawer-badge">${unclassifiedCount}</span>` : ''}
              <span class="drawer-arrow">${drawerIsOpen ? '▲' : '▼'}</span>
            </button>
            <div class="drawer-body ${drawerIsOpen ? 'open' : ''}" id="drawer-${trip.id}">
              ${renderDrawerContent(trip.id)}
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
    if (html) pagesHTML += html.replace('class="page', `style="z-index:${zIndex};" class="page`);
  });

  root.innerHTML = `
    <div class="book-container">
      <div class="book">
        <div class="book-spine"></div>
        ${pagesHTML}
      </div>
    </div>
  `;

  updatePageFlips();
  attachEventListeners();
}

/* ──────────────────────────────────────────────────────────
   6. 이벤트 핸들러
   ────────────────────────────────────────────────────────── */
function attachEventListeners() {
  // 표지 클릭
  const coverPage = document.getElementById('page-cover');
  if (coverPage) {
    coverPage.addEventListener('click', () => flipToPage('index'));
  }

  // 목차 아이템 클릭
  const pageIndex = document.getElementById('page-index');
  if (pageIndex) {
    pageIndex.querySelectorAll('.toc-item').forEach(item => {
      item.addEventListener('click', () => flipToPage(item.dataset.tripId));
    });
  }

  // 네비게이션
  document.querySelectorAll('#btnGoCover').forEach(btn => btn.addEventListener('click', () => flipToPage('cover')));
  document.querySelectorAll('#btnGoTOC').forEach(btn => btn.addEventListener('click', () => flipToPage('index')));

  // ── v2.0: 다중 사진 업로드 ────────────────────────────
  setupPhotoUploadZone();

  // ── 사진 추가 (기존 여행에 추가) ──────────────────────
  document.querySelectorAll('[id^="addPhotos-"]').forEach(input => {
    input.addEventListener('change', (e) => handleAddPhotos(e));
  });

  // ── 제목 인라인 편집 ──────────────────────────────────
  document.querySelectorAll('.inline-editable').forEach(el => {
    el.addEventListener('click', handleTitleEditStart);
  });

  // ── 기간/설명 인라인 편집 ─────────────────────────────
  document.querySelectorAll('.inline-editable-desc').forEach(el => {
    el.addEventListener('click', handleDescEditStart);
  });

  // ── 여행 삭제 버튼 ────────────────────────────────────
  document.querySelectorAll('.delete-trip-btn').forEach(btn => {
    btn.addEventListener('click', handleTripDelete);
  });

  // ── 사진 삭제 버튼 ────────────────────────────────────
  document.querySelectorAll('.photo-delete-btn').forEach(btn => {
    btn.addEventListener('click', handlePhotoDelete);
  });

  // ── 미분류 서랍 토글 ──────────────────────────────────
  document.querySelectorAll('[id^="drawerToggle-"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tripId = btn.dataset.tripId;
      state.drawerOpen[tripId] = !state.drawerOpen[tripId];
      const body = document.getElementById(`drawer-${tripId}`);
      if (body) body.classList.toggle('open', state.drawerOpen[tripId]);
      btn.classList.toggle('open', state.drawerOpen[tripId]);
      btn.querySelector('.drawer-arrow').textContent = state.drawerOpen[tripId] ? '▲' : '▼';
    });
  });
}

/* ── 다중 사진 업로드 (v2.0 핵심) ── */
function setupPhotoUploadZone() {
  const input = document.getElementById('multiPhotoInput');
  const dropZone = document.getElementById('uploadDropZone');
  if (!input || !dropZone) return;

  // 파일 선택
  input.addEventListener('change', (e) => handleFilesSelected(Array.from(e.target.files)));

  // 드래그앤드롭
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFilesSelected(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
  });
}

async function handleFilesSelected(files) {
  if (!files || files.length === 0) return;

  // 파일 개수 제한 (한 번에 최대 50장)
  if (files.length > 50) {
    showToast(`❌ 한 번에 최대 50장까지만 업로드할 수 있습니다.`, true);
    return;
  }

  showLoadingOverlay(`선택하신 ${files.length}장의 사진을 압축하고 있습니다...\n(모바일 데이터 절약 및 속도 향상)`);

  const compressedFiles = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // 압축 옵션 설정 (EXIF 보존 필수)
      const options = {
        maxSizeMB: 1, // 최대 1MB로 압축
        maxWidthOrHeight: 1920, // 최대 해상도 FHD급
        useWebWorker: true,
        preserveExif: true, // EXIF 메타데이터 보존 (매우 중요)
        fileType: 'image/jpeg' // HEIC 등도 JPEG로 변환하여 호환성 확보
      };
      
      const compressedBlob = await imageCompression(file, options);
      
      // Blob을 다시 File 객체로 변환 (기존 파일명 유지)
      const compressedFile = new File([compressedBlob], file.name, {
        type: compressedBlob.type || 'image/jpeg',
        lastModified: file.lastModified
      });
      
      compressedFiles.push(compressedFile);
    }
  } catch (err) {
    console.error('[이미지 압축 실패]', err);
    hideLoadingOverlay();
    showToast(`❌ 사진 압축 중 오류가 발생했습니다.`, true);
    return;
  }

  showLoadingOverlay(`압축 완료! AI가 ${compressedFiles.length}장의 사진을 분석하여\n여행의 조각들을 맞추고 있습니다...`);

  try {
    const result = await createTripFromPhotos(compressedFiles);
    // result: { trip, photos, summary }
    const { trip, photos } = result;

    // state 업데이트
    state.trips.unshift(trip);
    state.tripPhotos[trip.id] = photos || [];

    hideLoadingOverlay();
    showToast(`✅ "${trip.title}" 여행이 자동 생성되었습니다!`);

    // 앱 다시 렌더링 후 해당 여행 페이지로 이동
    renderApp();
    // 렌더링 완료 후 flip (DOM 갱신 필요)
    requestAnimationFrame(() => flipToPage(trip.id));

  } catch (err) {
    console.error('[from-photos 실패]', err);
    hideLoadingOverlay();
    showToast(`❌ 여행 생성 실패: ${err.message}`, true);
  }

  // input 초기화
  const input = document.getElementById('multiPhotoInput');
  if (input) input.value = '';
}

async function handleAddPhotos(e) {
  const input = e.target;
  const tripId = input.dataset.tripId;
  const files = Array.from(input.files);
  if (!files || files.length === 0) return;

  if (files.length > 50) {
    showToast(`❌ 한 번에 최대 50장까지만 업로드할 수 있습니다.`, true);
    input.value = '';
    return;
  }

  showLoadingOverlay(`선택하신 ${files.length}장의 사진을 압축하고 있습니다...`);

  const compressedFiles = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const options = {
        maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true,
        preserveExif: true, fileType: 'image/jpeg'
      };
      const compressedBlob = await imageCompression(file, options);
      compressedFiles.push(new File([compressedBlob], file.name, {
        type: compressedBlob.type || 'image/jpeg',
        lastModified: file.lastModified
      }));
    }
  } catch (err) {
    console.error('[이미지 압축 실패]', err);
    hideLoadingOverlay();
    showToast(`❌ 사진 압축 중 오류가 발생했습니다.`, true);
    input.value = '';
    return;
  }

  showLoadingOverlay(`사진을 업로드하고 AI가 분석 중입니다...`);
  try {
    const newPhotos = await addPhotosToTrip(tripId, compressedFiles);
    if (!state.tripPhotos[tripId]) state.tripPhotos[tripId] = [];
    state.tripPhotos[tripId].push(...newPhotos);
    refreshPhotoSection(tripId);
    hideLoadingOverlay();
    showToast(`✅ ${newPhotos.length}장의 사진이 추가되었습니다!`);
  } catch (err) {
    console.error('[addPhotosToTrip 실패]', err);
    hideLoadingOverlay();
    showToast(`❌ 사진 추가 실패: ${err.message}`, true);
  }
  input.value = '';
}

/* ── 제목 인라인 편집 ── */
function handleTitleEditStart(e) {
  const el = e.currentTarget;
  const tripId = el.dataset.tripId;
  const currentTitle = el.textContent.trim().replace('✏️', '').trim();

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentTitle;
  input.className = 'title-inline-input';
  input.setAttribute('data-trip-id', tripId);

  el.replaceWith(input);
  input.focus();
  input.select();

  const commitEdit = async () => {
    const newTitle = input.value.trim();
    if (!newTitle || newTitle === currentTitle) {
      // 변경 없음 — 원래 요소 복구
      input.replaceWith(el);
      return;
    }
    try {
      const updated = await patchTrip(tripId, { title: newTitle });
      // state.trips에서 해당 trip의 title 업데이트
      const tripInState = state.trips.find(t => t.id === tripId);
      if (tripInState) tripInState.title = updated.title || newTitle;
      el.innerHTML = `${updated.title || newTitle} <span class="edit-hint">✏️</span>`;
      input.replaceWith(el);
      showToast('✅ 제목이 수정되었습니다.');
    } catch (err) {
      console.error('[patchTrip 실패]', err);
      showToast(`❌ 제목 수정 실패: ${err.message}`, true);
      input.replaceWith(el); // 원래대로 복구
    }
  };

  input.addEventListener('blur', commitEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.replaceWith(el); }
  });
}

/* ── 기간/설명 인라인 편집 ── */
function handleDescEditStart(e) {
  const el = e.currentTarget;
  const tripId = el.dataset.tripId;
  const trip = state.trips.find(t => t.id === tripId);
  const currentDesc = trip?.description || '';
  const placeholder = '날짜나 기간을 입력하세요 (예: 6월 15일 ~ 6월 17일)';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentDesc;
  input.placeholder = placeholder;
  input.className = 'title-inline-input desc-inline-input';

  el.replaceWith(input);
  input.focus();
  input.select();

  const commitEdit = async () => {
    const newDesc = input.value.trim();
    if (newDesc === currentDesc) {
      input.replaceWith(el);
      return;
    }
    try {
      const updated = await patchTrip(tripId, { description: newDesc });
      const tripInState = state.trips.find(t => t.id === tripId);
      if (tripInState) tripInState.description = updated.description ?? newDesc;
      el.innerHTML = `${newDesc || placeholder} <span class="edit-hint" style="font-size:11px;">✏️</span>`;
      el.classList.toggle('desc-placeholder', !newDesc);
      input.replaceWith(el);
      showToast('✅ 날짜/기간이 수정되었습니다.');
    } catch (err) {
      console.error('[patchTrip desc 실패]', err);
      showToast(`❌ 수정 실패: ${err.message}`, true);
      input.replaceWith(el);
    }
  };

  input.addEventListener('blur', commitEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.replaceWith(el); }
  });
}

/* ── 여행 삭제 핸들러 ── */
async function handleTripDelete(e) {
  const tripId = e.currentTarget.dataset.tripId;
  const trip = state.trips.find(t => t.id === tripId);
  const confirmed = window.confirm(`정말로 "${trip?.title || '이 여행'}"과 모든 사진을 삭제하시겠습니까? 복구할 수 없습니다.`);
  if (!confirmed) return;

  try {
    await deleteTrip(tripId);
    // state에서 제거
    state.trips = state.trips.filter(t => t.id !== tripId);
    delete state.tripPhotos[tripId];
    delete state.drawerOpen[tripId];
    showToast('🗑 여행이 삭제되었습니다.');
    // 표지 화면으로 이동 후 전체 재렌더링
    state.currentPage = 'cover';
    renderApp();
  } catch (err) {
    console.error('[deleteTrip 실패]', err);
    showToast(`❌ 삭제 실패: ${err.message}`, true);
  }
}

/* ── 사진 삭제 핸들러 ── */
async function handlePhotoDelete(e) {
  e.stopPropagation();
  const photoId = e.currentTarget.dataset.photoId;
  const tripId = e.currentTarget.dataset.tripId;

  try {
    await deletePhoto(photoId);
    // state에서 해당 사진 즉시 제거
    if (state.tripPhotos[tripId]) {
      state.tripPhotos[tripId] = state.tripPhotos[tripId].filter(p => p.id !== photoId);
    }
    // 해당 사진 카드 DOM에서 즉시 제거 (전체 재렌더 없이)
    const item = document.getElementById(`photo-item-${photoId}`);
    if (item) item.remove();
    showToast('🗑 사진이 삭제되었습니다.');
  } catch (err) {
    console.error('[deletePhoto 실패]', err);
    showToast(`❌ 사진 삭제 실패: ${err.message}`, true);
  }
}

/* ──────────────────────────────────────────────────────────
   7. 초기화
   ────────────────────────────────────────────────────────── */
async function init() {
  try {
    state.trips = await fetchTrips();
  } catch (err) {
    console.error('[init] 여행 목록 불러오기 실패:', err);
    state.trips = [];
    renderApp();
    showToast('⚠️ 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', true);
    return;
  }
  renderApp();
}

init();
