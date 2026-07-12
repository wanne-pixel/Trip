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
async function createTripFromPhotos(compressedFiles, originalFiles) {
  const formData = new FormData();
  for (let i = 0; i < compressedFiles.length; i++) {
    formData.append('photos', compressedFiles[i]);
    if (originalFiles && originalFiles[i]) {
      formData.append('exif_chunks', originalFiles[i].slice(0, 128 * 1024), originalFiles[i].name);
    }
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

/** PATCH /api/trips/:id/metadata → 메타데이터 수정 */
async function patchTripMetadata(tripId, payload) {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/metadata`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`메타데이터 수정 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '메타데이터 수정에 실패했습니다.');
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
async function addPhotosToTrip(tripId, compressedFiles, originalFiles) {
  const formData = new FormData();
  for (let i = 0; i < compressedFiles.length; i++) {
    formData.append('photos', compressedFiles[i]);
    if (originalFiles && originalFiles[i]) {
      formData.append('exif_chunks', originalFiles[i].slice(0, 128 * 1024), originalFiles[i].name);
    }
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
const state = {
  trips: [],
  currentPage: 'cover',
  tripPhotos: {}, // { [tripId]: Photo[] } (v2.0 지연 로딩)
  drawerOpen: {}, // { [tripId]: boolean }
  isLoading: false,
  loadingMsg: '',
  mapInstance: null, // v2.8 지도 인스턴스
  isEditMode: false,
  selectedDay: {}
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
    rightBtn = `
      <button class="header-btn text-btn map-view-btn" data-trip-id="${tripId}" title="지도 보기" style="margin-right:8px;">🗺️ 지도 보기</button>
      <button class="header-btn text-btn delete-trip-btn" id="btnDeleteTrip" data-trip-id="${tripId}" title="여행 삭제">🗑 삭제</button>
    `;
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

  // 1. 날짜 기준 오름차순 정렬 (과거 -> 최신)
  const sortedTrips = [...state.trips].sort((a, b) => {
    let dateA = a.created_at;
    let dateB = b.created_at;
    
    if (a.metadata?.start_date) dateA = a.metadata.start_date;
    else if (a.title.match(/(20\\d{2})/)) dateA = a.title.match(/(20\\d{2})/)[1] + "-01-01";
    
    if (b.metadata?.start_date) dateB = b.metadata.start_date;
    else if (b.title.match(/(20\\d{2})/)) dateB = b.title.match(/(20\\d{2})/)[1] + "-01-01";
    
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  // 2. 연도별 그룹화 (start_date 또는 제목 연도 우선)
  sortedTrips.forEach((trip, idx) => {
    let year = new Date(trip.created_at).getFullYear();
    if (trip.metadata?.start_date) {
      year = new Date(trip.metadata.start_date).getFullYear();
    } else {
      const yearMatch = trip.title.match(/(20\\d{2})/);
      if (yearMatch) year = parseInt(yearMatch[1], 10);
    }
    const yearStr = year + '년';

    if (!groups[yearStr]) groups[yearStr] = [];
    groups[yearStr].push({ trip, index: idx + 1 });
  });

  // 3. 그룹 연도 오름차순 정렬 (과거 연도 -> 최신 연도)
  const groupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  let tocHTML = '';

  groupKeys.forEach(year => {
    tocHTML += `<div class="toc-group"><div class="toc-year-title">${year}</div><div class="toc-list">`;
    groups[year].forEach(item => {
      const loc = item.trip.metadata?.destination || item.trip.metadata?.location || '어딘가';
      let titleDisplay = item.trip.title;
      if (titleDisplay.startsWith(loc)) titleDisplay = titleDisplay.substring(loc.length).trim();
      if (titleDisplay.startsWith('—') || titleDisplay.startsWith('-')) titleDisplay = titleDisplay.substring(1).trim();
      
      const fullTitle = `
        <span class="inline-editable-toc-dest" data-trip-id="${item.trip.id}" title="클릭하여 장소 수정" style="color:var(--color-primary); font-weight:600; cursor:pointer;">${loc}</span>
        <span style="opacity:0.5; margin:0 4px;">—</span>
        ${titleDisplay}`;
      tocHTML += `
        <div class="toc-item" data-trip-id="${item.trip.id}">
          <span class="toc-item-title">(${item.index}) ${fullTitle}</span>
          <span class="toc-leader"></span>
          <span class="toc-item-page">
            p.${item.index}
            <button class="delete-trip-btn-toc" data-trip-id="${item.trip.id}" title="여행 삭제" style="margin-left:8px; background:none; border:none; cursor:pointer; font-size:14px; color:var(--color-text-secondary); transition:0.2s;" onmouseover="this.style.color='var(--color-leather)'" onmouseout="this.style.color='var(--color-text-secondary)'">🗑</button>
          </span>
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

  // 일자별 분리
  let dayCounter = 0;
  let lastDateString = null;
  const dayGroups = [];
  const unknownGroup = [];

  classified.forEach(p => {
    if (!p.taken_at) {
      unknownGroup.push(p);
    } else {
      const dateObj = new Date(p.taken_at);
      const dateString = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const displayDate = dateObj.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
      if (dateString !== lastDateString) {
        dayCounter++;
        lastDateString = dateString;
        dayGroups.push({ dayIndex: dayCounter, displayDate, photos: [] });
      }
      dayGroups[dayGroups.length - 1].photos.push(p);
    }
  });

  let tabsHtml = '<div class="day-tabs">';
  dayGroups.forEach(dg => {
    const isActive = (state.selectedDay[tripId] || 1) === dg.dayIndex ? 'active' : '';
    tabsHtml += `<button class="day-tab ${isActive}" onclick="selectDay('${tripId}', ${dg.dayIndex})">Day ${dg.dayIndex}</button>`;
  });
  if (unknownGroup.length > 0) {
    const isActive = (state.selectedDay[tripId] || 1) === 'unknown' ? 'active' : '';
    tabsHtml += `<button class="day-tab ${isActive}" onclick="selectDay('${tripId}', 'unknown')">알 수 없음</button>`;
  }
  tabsHtml += '</div>';

  let activeGroupPhotos = [];
  const selected = state.selectedDay[tripId] || 1;
  if (selected === 'unknown') {
    activeGroupPhotos = unknownGroup;
  } else {
    const targetDay = dayGroups.find(dg => dg.dayIndex === selected);
    if (targetDay) activeGroupPhotos = targetDay.photos;
    else if (dayGroups.length > 0) activeGroupPhotos = dayGroups[0].photos;
  }

  if (activeGroupPhotos.length === 0) {
    return tabsHtml + `<div class="photo-section-empty">이 날짜에 해당하는 사진이 없습니다.</div>`;
  }

  let html = tabsHtml + '<div class="timeline-list">';

  // v2.6: 수동 묶음/분리 메타데이터 가져오기
  const trip = state.trips.find(t => t.id === tripId);
  const overrides = trip?.metadata?.group_overrides || {};

  // v2.5 & v2.6: 사진 그룹화 (3분 이내 or 수동 지정)
  const groups = [];
  let currentGroup = [];

  activeGroupPhotos.forEach(p => {
    if (currentGroup.length === 0) {
      currentGroup.push(p);
      return;
    }
    
    const lastP = currentGroup[currentGroup.length - 1];
    const pGroupId = overrides[p.id];
    const lastPGroupId = overrides[lastP.id];

    let shouldGroup = false;

    if (pGroupId && lastPGroupId && pGroupId === lastPGroupId) {
      shouldGroup = true;
    } else if (pGroupId || lastPGroupId) {
      shouldGroup = false;
    } else {
      if (p.taken_at && lastP.taken_at) {
        const diffMs = new Date(p.taken_at).getTime() - new Date(lastP.taken_at).getTime();
        shouldGroup = (diffMs <= 3 * 60 * 1000);
      } else {
        shouldGroup = false;
      }
    }

    if (shouldGroup) {
      currentGroup.push(p);
    } else {
      groups.push([...currentGroup]);
      currentGroup = [p];
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);

  const isEdit = state.isEditMode;

  groups.forEach((group, groupIndex) => {
    const firstP = group[0];
    let dateObj = firstP.taken_at ? new Date(firstP.taken_at) : null;
    let tags = '';

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
        ${isEdit ? `<button class="photo-action-btn slide-delete-btn" data-photo-id="${gp.id}" data-trip-id="${gp.trip_id}" title="사진 삭제">🗑</button>` : ''}
        ${(isEdit && group.length > 1) ? `<button class="photo-action-btn slide-split-btn" data-photo-id="${gp.id}" data-trip-id="${gp.trip_id}" title="사진 떼어내기">✂️</button>` : ''}
      </div>
    `).join('');

    const prevGroup = groupIndex > 0 ? groups[groupIndex - 1] : null;
    const mergeUpBtn = (isEdit && prevGroup) 
      ? `<button class="timeline-merge-up-btn" data-current-ids="${group.map(p=>p.id).join(',')}" data-prev-ids="${prevGroup.map(p=>p.id).join(',')}" data-trip-id="${tripId}" title="위 그룹과 묶기">🔗 묶기</button>` 
      : '';

    html += `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="photo-slider">${sliderHtml}</div>
          <div class="timeline-card-footer">
            ${dateObj ? `<span class="timeline-date">🕐 ${dateObj.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
            <div class="timeline-tags">${tags}</div>
            ${mergeUpBtn}
          </div>
        </div>
      </div>`;
  });

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
  const destText = trip.metadata?.destination || '';
  const destPlaceholder = '목적지를 입력하세요 (예: 제주도, 파리)';

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
              <p class="details-dest inline-editable-dest ${destText ? '' : 'desc-placeholder'}"
                 id="tripDest-${trip.id}"
                 data-field="destination"
                 data-trip-id="${trip.id}"
                 title="클릭하여 목적지 수정">
                📍 ${destText || destPlaceholder}
                <span class="edit-hint" style="font-size:11px;">✏️</span>
              </p>
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

          ${state.isEditMode ? `
          <div class="add-photo-bar">
            <input type="file" id="addPhotos-${trip.id}" multiple accept="image/*" style="display:none;" data-trip-id="${trip.id}">
            <label for="addPhotos-${trip.id}" class="add-photo-btn">
              <span class="icon">➕</span> 이 여행에 사진 추가하기
            </label>
          </div>
          ` : ''}

          <!-- 타임라인 섹션 -->
          <div class="section-label" style="display:flex; justify-content:space-between; align-items:center;">
            <span>📅 타임라인</span>
            <button class="header-btn text-btn edit-mode-toggle-btn" onclick="toggleEditMode()" style="background:var(--color-surface-alt);">
              ${state.isEditMode ? '편집 모드 종료' : '편집 모드 켜기'}
            </button>
          </div>
          <div id="timeline-${trip.id}">
            ${renderTimeline(trip.id)}
          </div>

          <!-- AI 일기 섹션 -->
          ${!trip.metadata?.diary ? `
            <div style="text-align:center; margin: 24px 0;">
              <button class="btn-write-diary" data-trip-id="${trip.id}">✍️ AI 일기 쓰기</button>
            </div>
          ` : `
            <div class="diary-section">
              ${trip.metadata.diary.replace(/\n/g, '<br>')}
            </div>
          `}

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

  // v2.8 지도 모달 구조 추가
  const mapModalHTML = `
    <div class="map-modal-overlay" id="mapModalOverlay">
      <div class="map-modal-content">
        <div class="map-header">
          <div class="map-title">📍 여행 경로</div>
          <button class="map-close-btn" id="mapCloseBtn">✖</button>
        </div>
        <div id="tripMapContainer"></div>
      </div>
    </div>
  `;

  root.innerHTML = `
    <div class="book-container">
      <div class="book">
        <div class="book-spine"></div>
        ${pagesHTML}
      </div>
    </div>
    ${mapModalHTML}
  `;

  updatePageFlips();
  attachEventListeners();
}

/* ──────────────────────────────────────────────────────────
   6. 이벤트 핸들러
   ────────────────────────────────────────────────────────── */
window.selectDay = function(tripId, dayIndex) {
  state.selectedDay[tripId] = dayIndex;
  renderApp();
};

window.toggleEditMode = function() {
  state.isEditMode = !state.isEditMode;
  renderApp();
};

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
    
    // 목차 내 목적지 인라인 편집
    pageIndex.querySelectorAll('.inline-editable-toc-dest').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tripId = el.dataset.tripId;
        const trip = state.trips.find(t => t.id === tripId);
        const currentLoc = trip.metadata?.destination || trip.metadata?.location || '';
        const newLoc = window.prompt('장소를 입력하세요 (예: 제주도, 파리):', currentLoc);
        if (newLoc !== null && newLoc.trim() !== currentLoc) {
          try {
            const updated = await patchTripMetadata(tripId, { metadata: { ...trip.metadata, destination: newLoc.trim() } });
            trip.metadata = updated.metadata;
            renderApp();
            showToast('✅ 장소가 수정되었습니다.');
          } catch(err) {
            showToast(`❌ 수정 실패: ${err.message}`, true);
          }
        }
      });
    });
  }

  // 네비게이션
  document.querySelectorAll('#btnGoCover').forEach(btn => btn.addEventListener('click', () => flipToPage('cover')));
  document.querySelectorAll('#btnGoTOC').forEach(btn => btn.addEventListener('click', () => flipToPage('index')));

  // 지도 보기 (v2.8)
  document.querySelectorAll('.map-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showTripMap(btn.dataset.tripId);
    });
  });
  const mapCloseBtn = document.getElementById('mapCloseBtn');
  if (mapCloseBtn) {
    mapCloseBtn.addEventListener('click', closeTripMap);
  }
  const mapModalOverlay = document.getElementById('mapModalOverlay');
  if (mapModalOverlay) {
    mapModalOverlay.addEventListener('click', (e) => {
      if (e.target === mapModalOverlay) closeTripMap();
    });
  }

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

  // ── 목적지 인라인 편집 ─────────────────────────────
  document.querySelectorAll('.inline-editable-dest').forEach(el => {
    el.addEventListener('click', handleDestEditStart);
  });

  // ── 기간/설명 인라인 편집 ─────────────────────────────
  document.querySelectorAll('.inline-editable-desc').forEach(el => {
    el.addEventListener('click', handleDescEditStart);
  });

  // ── 여행 삭제 버튼 (Trip Page) ──────────────────────
  document.querySelectorAll('.delete-trip-btn').forEach(btn => {
    btn.addEventListener('click', handleTripDelete);
  });

  // ── 여행 삭제 버튼 (TOC Page) ───────────────────────
  document.querySelectorAll('.delete-trip-btn-toc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleTripDelete({ currentTarget: btn });
    });
  });

  // ── 사진 삭제 버튼 ────────────────────────────────────
  document.querySelectorAll('.photo-delete-btn, .slide-delete-btn').forEach(btn => {
    btn.addEventListener('click', handlePhotoDelete);
  });

  // ── v2.6 수동 묶음/분리 버튼 ──────────────────────────────
  document.querySelectorAll('.slide-split-btn').forEach(btn => {
    btn.addEventListener('click', handlePhotoSplit);
  });
  document.querySelectorAll('.timeline-merge-up-btn').forEach(btn => {
    btn.addEventListener('click', handleMergeUp);
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

  // ── AI 일기 쓰기 ────────────────────────────────────────
  document.querySelectorAll('.btn-write-diary').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tripId = e.currentTarget.dataset.tripId;
      const trip = state.trips.find(t => t.id === tripId);
      if (!trip) return;

      showLoadingOverlay('AI가 추억을 글로 엮어내는 중입니다...');
      try {
        const res = await fetch(`${API_BASE_URL}/trips/${tripId}/diary`, {
          method: 'POST'
        });
        if (!res.ok) throw new Error(`일기 생성 오류: ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || '일기를 생성하지 못했습니다.');

        // 응답에 따라 trip.metadata.diary 업데이트
        if (!trip.metadata) trip.metadata = {};
        if (json.data && json.data.metadata && json.data.metadata.diary) {
          trip.metadata.diary = json.data.metadata.diary;
        } else if (json.data && json.data.diary) {
          trip.metadata.diary = json.data.diary;
        } else if (typeof json.data === 'string') {
          trip.metadata.diary = json.data;
        }

        hideLoadingOverlay();
        showToast('✅ AI 일기가 작성되었습니다.');
        renderApp();
      } catch (err) {
        console.error('[AI Diary Error]', err);
        hideLoadingOverlay();
        showToast(`❌ 일기 쓰기 실패: ${err.message}`, true);
      }
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
      let options = {
        maxSizeMB: 1, // 최대 1MB로 압축
        maxWidthOrHeight: 1920, // 최대 해상도 FHD급
        useWebWorker: true,
        preserveExif: true, // EXIF 메타데이터 보존 (매우 중요)
        fileType: 'image/jpeg' // HEIC 등도 JPEG로 변환하여 호환성 확보
      };
      
      let compressedBlob;
      try {
        compressedBlob = await imageCompression(file, options);
      } catch (workerErr) {
        console.warn('[압축 재시도] WebWorker 모드 실패, 메인 스레드에서 시도합니다:', workerErr);
        options.useWebWorker = false; // 모바일 메모리 부족 대비
        compressedBlob = await imageCompression(file, options);
      }
      
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
    const result = await createTripFromPhotos(compressedFiles, files);
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
      let options = {
        maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true,
        preserveExif: true, fileType: 'image/jpeg'
      };
      let compressedBlob;
      try {
        compressedBlob = await imageCompression(file, options);
      } catch (workerErr) {
        console.warn('[압축 재시도] WebWorker 모드 실패, 메인 스레드에서 시도합니다:', workerErr);
        options.useWebWorker = false;
        compressedBlob = await imageCompression(file, options);
      }
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
    const newPhotos = await addPhotosToTrip(tripId, compressedFiles, files);
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

/* ── 목적지 인라인 편집 ── */
function handleDestEditStart(e) {
  const el = e.currentTarget;
  const tripId = el.dataset.tripId;
  const trip = state.trips.find(t => t.id === tripId);
  const currentDest = trip?.metadata?.destination || '';
  const placeholder = '목적지를 입력하세요 (예: 제주도, 파리)';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentDest;
  input.placeholder = placeholder;
  input.className = 'title-inline-input desc-inline-input';

  el.replaceWith(input);
  input.focus();
  input.select();

  const commitEdit = async () => {
    const newDest = input.value.trim();
    if (newDest === currentDest) {
      input.replaceWith(el);
      return;
    }
    try {
      const updated = await patchTripMetadata(tripId, { metadata: { destination: newDest } });
      const tripInState = state.trips.find(t => t.id === tripId);
      if (tripInState) tripInState.metadata = updated.metadata;
      el.innerHTML = `📍 ${newDest || placeholder} <span class="edit-hint" style="font-size:11px;">✏️</span>`;
      el.classList.toggle('desc-placeholder', !newDest);
      input.replaceWith(el);
      showToast('✅ 목적지가 수정되었습니다.');
    } catch (err) {
      console.error('[patchTripMetadata dest 실패]', err);
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

/* ── v2.6 사진 떼어내기 (Split) 핸들러 ── */
async function handlePhotoSplit(e) {
  e.stopPropagation();
  const photoId = e.currentTarget.dataset.photoId;
  const tripId = e.currentTarget.dataset.tripId;
  
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  
  const newGroupId = `split-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  
  const currentOverrides = trip.metadata?.group_overrides || {};
  const newOverrides = { ...currentOverrides, [photoId]: newGroupId };
  
  try {
    const updatedTrip = await patchTripMetadata(tripId, {
      metadata: { ...trip.metadata, group_overrides: newOverrides }
    });
    const idx = state.trips.findIndex(t => t.id === tripId);
    if (idx !== -1) state.trips[idx] = updatedTrip;
    
    showToast('✂️ 선택한 사진을 떼어냈습니다.');
    renderApp(); // 전체 렌더 및 이벤트 바인딩
  } catch (err) {
    showToast(`❌ 떼어내기 실패: ${err.message}`, true);
  }
}

/* ── v2.6 위 그룹과 묶기 (Merge Up) 핸들러 ── */
async function handleMergeUp(e) {
  e.stopPropagation();
  const currentIds = e.currentTarget.dataset.currentIds.split(',');
  const prevIds = e.currentTarget.dataset.prevIds.split(',');
  const tripId = e.currentTarget.dataset.tripId;
  
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  
  const newGroupId = `merge-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  
  const currentOverrides = trip.metadata?.group_overrides || {};
  const newOverrides = { ...currentOverrides };
  
  currentIds.forEach(id => newOverrides[id] = newGroupId);
  prevIds.forEach(id => newOverrides[id] = newGroupId);
  
  try {
    const updatedTrip = await patchTripMetadata(tripId, {
      metadata: { ...trip.metadata, group_overrides: newOverrides }
    });
    const idx = state.trips.findIndex(t => t.id === tripId);
    if (idx !== -1) state.trips[idx] = updatedTrip;
    
    showToast('🔗 위 그룹과 하나로 묶었습니다.');
    renderApp(); // 전체 렌더 및 이벤트 바인딩
  } catch (err) {
    showToast(`❌ 묶기 실패: ${err.message}`, true);
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

/* ── v2.8 인터랙티브 지도 뷰 (Leaflet.js) ─────────────────────── */
function showTripMap(tripId) {
  const photos = state.tripPhotos[tripId];
  if (!photos || photos.length === 0) {
    showToast('사진 데이터가 아직 로드되지 않았습니다.');
    return;
  }

  // GPS 좌표가 있는 사진 필터링 및 과거순 정렬
  const gpsPhotos = photos
    .filter(p => p.latitude != null && p.longitude != null)
    .sort((a, b) => new Date(a.taken_at || 0).getTime() - new Date(b.taken_at || 0).getTime());

  if (gpsPhotos.length === 0) {
    showToast('🗺️ 위치 정보(GPS)가 있는 사진이 없습니다.', true);
    return;
  }

  const modal = document.getElementById('mapModalOverlay');
  if (modal) modal.classList.add('open');

  // 모달 애니메이션이 끝난 후 지도를 그려야 크기 계산 오류가 안 남
  setTimeout(() => {
    if (state.mapInstance) {
      state.mapInstance.remove();
      state.mapInstance = null;
    }

    const map = L.map('tripMapContainer', { zoomControl: false });
    state.mapInstance = map;

    // OpenStreetMap 타일
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    const latlngs = [];

    gpsPhotos.forEach((p, idx) => {
      const latlng = [p.latitude, p.longitude];
      latlngs.push(latlng);

      // 마커 추가
      const marker = L.marker(latlng).addTo(map);
      
      // 팝업 컨텐츠
      const timeStr = p.taken_at ? new Date(p.taken_at).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'numeric', minute:'numeric' }) : '';
      const popupHtml = `
        <img src="${p.storage_path}" style="width:150px; height:100px; object-fit:cover; border-bottom:1px solid #eee;" />
        <div style="font-size:12px; font-weight:600; padding:8px; text-align:center; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px;">${p.original_filename}</div>
        <div style="font-size:11px; color:#888; text-align:center; padding-bottom:8px;">${timeStr}</div>
      `;
      marker.bindPopup(popupHtml, { minWidth: 150, closeButton: false });
    });

    // 동선 폴리라인 연결
    if (latlngs.length > 1) {
      const polyline = L.polyline(latlngs, {
        color: 'var(--color-leather)',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 10',
        lineJoin: 'round'
      }).addTo(map);
      
      // 동선 전체가 보이도록 줌 맞춤
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    } else if (latlngs.length === 1) {
      map.setView(latlngs[0], 15);
    }
  }, 300);
}

function closeTripMap() {
  const modal = document.getElementById('mapModalOverlay');
  if (modal) modal.classList.remove('open');
}
