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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3분 타임아웃
  try {
    const res = await fetch(`${API_BASE_URL}/trips/from-photos`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`여행 생성 오류: ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '여행을 생성하지 못했습니다.');
    return json.data; // { trip, photos, summary }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('서버 응답 시간 초과 (3분)');
    throw err;
  }
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3분 타임아웃
  try {
    const res = await fetch(`${API_BASE_URL}/trips/${tripId}/photos`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`사진 추가 오류: ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '사진을 추가하지 못했습니다.');
    // 서버 응답: { trip_id, photos: [...], summary: {...} }
    return json.data?.photos || json.data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('서버 응답 시간 초과 (3분)');
    throw err;
  }
}

/** DELETE /api/photos/:id → 사진 삭제 */
async function deletePhoto(photoId) {
  const res = await fetch(`${API_BASE_URL}/photos/${photoId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`사진 삭제 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '사진 삭제에 실패했습니다.');
  return true;
}

/** PATCH /api/photos/:id/metadata → 메타데이터 수정 */
async function patchPhotoMetadata(photoId, payload) {
  const res = await fetch(`${API_BASE_URL}/photos/${photoId}/metadata`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`사진 메타데이터 수정 오류: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '사진 메타데이터 수정에 실패했습니다.');
  return json.data;
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

/* ── v2.16 자동 재시도 로직 ── */
async function executeWithRetry(fn, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) throw err;
      console.warn(`[Retry] ${attempt}/${maxRetries} 재시도 중...`, err);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
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
  const isTrip = pageId !== 'cover' && pageId !== 'index';

  if (!isTrip && state.isEditMode) {
    state.isEditMode = false;
    renderApp();
    return;
  }

  updatePageFlips();
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
      <button class="header-btn text-btn map-view-btn" data-trip-id="${tripId}" title="지도 보기">🗺️ 지도 보기</button>
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
      
      const photoCount = item.trip.metadata?.photo_count || 0;
      const countDisplay = photoCount > 0 ? `<span style="font-size:12px; color:#888; margin-left:4px;">(${photoCount}장)</span>` : '';

      const fullTitle = `
        <span class="inline-editable-toc-dest" data-trip-id="${item.trip.id}" title="클릭하여 장소 수정" style="color:var(--color-primary); font-weight:600; cursor:pointer;">${loc}</span>
        <span style="opacity:0.5; margin:0 4px;">—</span>
        ${titleDisplay} ${countDisplay}`;
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

  const trip = state.trips.find(t => t.id === tripId);
  const customOrder = trip?.metadata?.custom_order || [];
  const classified = allPhotos
    .filter(p => p.classified !== false)
    .sort((a, b) => {
      const idxA = customOrder.indexOf(a.id);
      const idxB = customOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
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

  // 대표 사진(is_cover)이 그룹의 맨 앞으로 오도록 정렬
  groups.forEach(g => {
    g.sort((a, b) => (b.metadata?.is_cover ? 1 : 0) - (a.metadata?.is_cover ? 1 : 0));
  });

  const isEdit = state.isEditMode;

  groups.forEach((group, groupIndex) => {
    const firstP = group[0];
    let dateObj = firstP.taken_at ? new Date(firstP.taken_at) : null;
    let tags = '';

    const sliderHtml = group.map((gp, i) => `
      <div class="photo-slide ${isEdit ? 'is-edit' : ''}" id="photo-item-${gp.id}">
        ${gp.storage_path
          ? `<img class="timeline-photo-img" src="${gp.storage_path}" alt="${gp.original_filename}" onclick="${!isEdit ? `openLightbox('${gp.storage_path}')` : ''}" ${!isEdit ? 'style="cursor:pointer;" title="전체화면 보기"' : ''}>`
          : `<div class="timeline-photo-placeholder">🖼️<span>${gp.original_filename}</span></div>`
        }
        ${group.length > 1 ? `<div class="slide-counter">${i + 1} / ${group.length}</div>` : ''}
        ${isEdit ? `<button class="photo-action-btn slide-delete-btn" data-photo-id="${gp.id}" data-trip-id="${gp.trip_id}" title="사진 삭제">🗑</button>
                    <button class="photo-action-btn move-up-btn" data-photo-id="${gp.id}" data-trip-id="${gp.trip_id}" title="앞으로 이동" style="font-size:16px;">⬆️</button>
                    <button class="photo-action-btn move-down-btn" data-photo-id="${gp.id}" data-trip-id="${gp.trip_id}" title="뒤로 이동" style="font-size:16px;">⬇️</button>` : ''}
        ${(isEdit && group.length > 1) ? `<button class="photo-action-btn slide-split-btn" data-photo-id="${gp.id}" data-trip-id="${gp.trip_id}" title="따로 분리">✂️</button>` : ''}
        ${(isEdit && group.length > 1 && !gp.metadata?.is_cover) ? `<button class="photo-action-btn make-cover-btn" data-photo-id="${gp.id}" data-trip-id="${gp.trip_id}" title="대표 사진으로 지정">🌟</button>` : ''}
      </div>
    `).join('');

    const prevGroup = groupIndex > 0 ? groups[groupIndex - 1] : null;
    const mergeUpBtn = (isEdit && prevGroup) 
      ? `<button class="timeline-merge-up-btn" data-current-ids="${group.map(p=>p.id).join(',')}" data-prev-ids="${prevGroup.map(p=>p.id).join(',')}" data-trip-id="${tripId}" title="위 그룹과 묶기" style="margin-top:8px;">🔗 이전 사진들과 묶기</button>` 
      : '';

    const pMeta = firstP.metadata || {};
    const manualCategory = pMeta.manual_category || '';
    const locationName = pMeta.location_name || '';
    const rating = pMeta.rating || 0;
    const memo = pMeta.memo || '';

    const displayCategory = manualCategory ? `<span class="meta-badge meta-cat meta-cat-val">#${manualCategory}</span>` : `<span class="meta-badge meta-cat-empty">카테고리 없음</span>`;
    const displayLoc = locationName ? `<span class="meta-loc">📍 ${locationName}</span>` : '';
    const displayRating = rating > 0 ? `<span class="meta-rating">` + '⭐'.repeat(rating) + `</span>` : '';
    const displayMemo = memo ? `<div class="meta-memo">${memo}</div>` : '';

    html += `
      <div class="timeline-item ${isEdit ? 'is-edit' : ''}">
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="photo-slider">${sliderHtml}</div>
          <div class="timeline-card-footer" id="footer-view-${firstP.id}">
            <div class="meta-row">
              ${displayCategory}
              ${displayLoc}
              ${displayRating}
              <div class="meta-spacer"></div>
              <button class="meta-edit-toggle" onclick="toggleMetaEdit('${firstP.id}')" title="메타데이터 편집">✏️</button>
            </div>
            ${displayMemo}
            ${mergeUpBtn}
          </div>
          <div class="timeline-card-footer meta-edit-form" id="footer-edit-${firstP.id}" style="display: none;">
             <div class="meta-edit-row">
                <select id="meta-cat-${firstP.id}" class="meta-input-select">
                  <option value="" ${!manualCategory ? 'selected' : ''}>카테고리 선택</option>
                  <option value="맛집" ${manualCategory === '맛집' ? 'selected' : ''}>맛집</option>
                  <option value="숙소" ${manualCategory === '숙소' ? 'selected' : ''}>숙소</option>
                  <option value="풍경" ${manualCategory === '풍경' ? 'selected' : ''}>풍경</option>
                  <option value="액티비티" ${manualCategory === '액티비티' ? 'selected' : ''}>액티비티</option>
                  <option value="카페" ${manualCategory === '카페' ? 'selected' : ''}>카페</option>
                  <option value="기타" ${manualCategory === '기타' ? 'selected' : ''}>기타</option>
                </select>
                <input type="text" id="meta-loc-${firstP.id}" class="meta-input-text" placeholder="장소 이름" value="${locationName}">
                <button class="meta-edit-toggle meta-save-btn" onclick="saveMetaEdit('${firstP.id}', '${tripId}')" title="저장">✔️</button>
             </div>
             <div class="meta-edit-row" style="margin-top: 8px;">
                <div class="meta-rating-edit" id="meta-rating-edit-${firstP.id}" data-rating="${rating}" style="display: flex; gap: 4px;">
                  ${[1,2,3,4,5].map(i => `<span class="star-btn ${i <= rating ? 'active' : ''}" onclick="setRating('${firstP.id}', ${i})" style="cursor:pointer; font-size: 16px; opacity: ${i <= rating ? 1 : 0.3}; transition: opacity 0.2s;">⭐</span>`).join('')}
                </div>
             </div>
             <div class="meta-edit-row" style="margin-top: 8px;">
                <input type="text" id="meta-memo-${firstP.id}" class="meta-input-text meta-input-memo" placeholder="메모를 남겨보세요..." value="${memo}" style="width: 100%;">
             </div>
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

          <div class="trip-metadata-badges">
            <span class="badge inline-editable-comp" data-trip-id="${trip.id}" title="클릭하여 동행인 수정">
              👥 <span class="badge-text">${trip.metadata?.companions || '동행인 추가'}</span> <span class="edit-hint">✏️</span>
            </span>
            <span class="badge inline-editable-quote" data-trip-id="${trip.id}" title="클릭하여 한줄 평 수정">
              💬 <span class="badge-text">${trip.metadata?.quote || '한줄 평을 남겨보세요'}</span> <span class="edit-hint">✏️</span>
            </span>
            <span class="badge inline-editable-rating" data-trip-id="${trip.id}" title="클릭하여 별점 수정">
              ⭐ <span class="badge-text">${trip.metadata?.rating ? '★'.repeat(trip.metadata.rating) + '☆'.repeat(5 - trip.metadata.rating) : '평가하기'}</span> <span class="edit-hint">✏️</span>
            </span>
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
              ${state.isEditMode ? '편집 종료' : '편집'}
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

window.toggleMetaEdit = function(photoId) {
  const viewEl = document.getElementById(`footer-view-${photoId}`);
  const editEl = document.getElementById(`footer-edit-${photoId}`);
  if (viewEl && editEl) {
    viewEl.style.display = 'none';
    editEl.style.display = 'block';
  }
};

window.setRating = function(photoId, rating) {
  const container = document.getElementById(`meta-rating-edit-${photoId}`);
  if (container) {
    container.dataset.rating = rating;
    container.innerHTML = [1,2,3,4,5].map(i => `<span class="star-btn ${i <= rating ? 'active' : ''}" onclick="setRating('${photoId}', ${i})" style="cursor:pointer; font-size: 16px; opacity: ${i <= rating ? 1 : 0.3}; transition: opacity 0.2s;">⭐</span>`).join('');
  }
};

window.saveMetaEdit = async function(photoId, tripId) {
  const catEl = document.getElementById(`meta-cat-${photoId}`);
  const locEl = document.getElementById(`meta-loc-${photoId}`);
  const memoEl = document.getElementById(`meta-memo-${photoId}`);
  const ratingEl = document.getElementById(`meta-rating-edit-${photoId}`);

  const manual_category = catEl ? catEl.value : '';
  const location_name = locEl ? locEl.value.trim() : '';
  const memo = memoEl ? memoEl.value.trim() : '';
  const rating = ratingEl ? parseInt(ratingEl.dataset.rating, 10) : 0;

  try {
    const updated = await patchPhotoMetadata(photoId, { metadata: { manual_category, location_name, rating, memo } });
    
    // update local state
    const photos = state.tripPhotos[tripId];
    if (photos) {
      const p = photos.find(x => x.id === photoId);
      if (p) {
        p.metadata = Object.assign({}, p.metadata || {}, updated.metadata || { manual_category, location_name, rating, memo });
      }
    }
    refreshPhotoSection(tripId);
    showToast('✅ 메타데이터가 저장되었습니다.');
  } catch(err) {
    showToast(`❌ 저장 실패: ${err.message}`, true);
  }
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

  // ── 메타데이터 인라인 편집 ─────────────────────────────
  document.querySelectorAll('.inline-editable-comp').forEach(el => el.addEventListener('click', handleCompEditStart));
  document.querySelectorAll('.inline-editable-quote').forEach(el => el.addEventListener('click', handleQuoteEditStart));
  document.querySelectorAll('.inline-editable-rating').forEach(el => el.addEventListener('click', handleRatingEditStart));

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

  // ── v2.10 위치 이동 버튼 ──────────────────────────────────
  document.querySelectorAll('.move-up-btn').forEach(btn => {
    btn.addEventListener('click', handleMoveUp);
  });
  document.querySelectorAll('.move-down-btn').forEach(btn => {
    btn.addEventListener('click', handleMoveDown);
  });

  // ── v2.14 대표 사진 지정 버튼 ────────────────────────────────
  document.querySelectorAll('.make-cover-btn').forEach(btn => {
    btn.addEventListener('click', handleMakeCover);
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

  // 파일 개수 제한 (한 번에 최대 150장)
  if (files.length > 150) {
    showToast(`❌ 한 번에 최대 150장까지만 업로드할 수 있습니다.`, true);
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
        try {
          options.useWebWorker = false; // 모바일 메모리 부족 대비
          compressedBlob = await imageCompression(file, options);
        } catch (mainErr) {
          console.warn('[압축 완전 실패] 브라우저 지원 문제로 원본 파일을 그대로 사용합니다:', mainErr);
          compressedBlob = file; // 원본 파일로 폴백
        }
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

  try {
    let trip = null;
    let photos = [];
    let uploadedCount = 0;
    const totalCount = files.length;
    let hasError = false;
    
    for (let i = 0; i < totalCount; i += 5) {
      const chunkCompressed = compressedFiles.slice(i, i + 5);
      const chunkOriginal = files.slice(i, i + 5);
      
      showLoadingOverlay(`사진을 서버에 전송 중입니다...\n(업로드 완료: ${uploadedCount} / ${totalCount})`);
      
      try {
        if (i === 0) {
          const result = await executeWithRetry(() => createTripFromPhotos(chunkCompressed, chunkOriginal));
          trip = result.trip;
          photos.push(...(result.photos || []));
          
          // state 업데이트
          state.trips.unshift(trip);
          state.tripPhotos[trip.id] = photos;
        } else {
          const newPhotos = await executeWithRetry(() => addPhotosToTrip(trip.id, chunkCompressed, chunkOriginal));
          photos.push(...newPhotos);
          state.tripPhotos[trip.id] = photos;
        }
        uploadedCount += chunkCompressed.length;
      } catch (chunkErr) {
        console.error(`[업로드 청크 실패] ${i} ~ ${i + 10}번째 사진:`, chunkErr);
        hasError = true;
        break; // 루프 중단, 하지만 성공한 곳까지만 반영
      }
    }

    hideLoadingOverlay();

    if (trip) { 
      // 여행이 생성되었다면 (즉 i=0 청크는 성공)
      if (hasError) {
        showToast(`❌ 네트워크 오류로 업로드가 중단되었습니다.\n(총 ${totalCount}장 중 ${uploadedCount}장 완료)`, true);
      } else {
        showToast(`✅ "${trip.title}" 여행이 자동 생성되었습니다!`);
      }
      // 성공한 부분까지 앱 다시 렌더링 후 이동
      renderApp();
      requestAnimationFrame(() => flipToPage(trip.id));
    } else {
      // 아예 처음부터 실패
      showToast(`❌ 여행 생성 실패: 네트워크 오류로 업로드를 시작하지 못했습니다.`, true);
    }

  } catch (err) {
    console.error('[from-photos 시스템 에러]', err);
    hideLoadingOverlay();
    showToast(`❌ 시스템 오류: ${err.message}`, true);
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

  if (files.length > 150) {
    showToast(`❌ 한 번에 최대 150장까지만 업로드할 수 있습니다.`, true);
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
        try {
          options.useWebWorker = false;
          compressedBlob = await imageCompression(file, options);
        } catch (mainErr) {
          console.warn('[압축 완전 실패] 브라우저 지원 문제로 원본 파일을 그대로 사용합니다:', mainErr);
          compressedBlob = file; // 원본 파일로 폴백
        }
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

  try {
    const totalCount = files.length;
    let uploadedCount = 0;
    const allNewPhotos = [];
    let hasError = false;
    
    for (let i = 0; i < totalCount; i += 5) {
      const chunkCompressed = compressedFiles.slice(i, i + 5);
      const chunkOriginal = files.slice(i, i + 5);
      
      showLoadingOverlay(`사진을 서버에 전송 중입니다...\n(업로드 완료: ${uploadedCount} / ${totalCount})`);
      
      try {
        const newPhotos = await executeWithRetry(() => addPhotosToTrip(tripId, chunkCompressed, chunkOriginal));
        allNewPhotos.push(...newPhotos);
        uploadedCount += chunkCompressed.length;
      } catch (chunkErr) {
        console.error(`[추가 업로드 청크 실패] ${i} ~ ${i + 10}번째 사진:`, chunkErr);
        hasError = true;
        break; // 루프 중단
      }
    }
    
    if (allNewPhotos.length > 0) {
      if (!state.tripPhotos[tripId]) state.tripPhotos[tripId] = [];
      state.tripPhotos[tripId].push(...allNewPhotos);
      refreshPhotoSection(tripId);
    }
    
    hideLoadingOverlay();

    if (hasError) {
      showToast(`❌ 업로드 중단 (총 ${totalCount}장 중 ${uploadedCount}장 추가됨)`, true);
    } else {
      showToast(`✅ ${allNewPhotos.length}장의 사진이 추가되었습니다!`);
    }
  } catch (err) {
    console.error('[addPhotosToTrip 시스템 에러]', err);
    hideLoadingOverlay();
    showToast(`❌ 사진 추가 중 예상치 못한 오류 발생`, true);
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

/* ── 동행인 인라인 편집 ── */
function handleCompEditStart(e) {
  const el = e.currentTarget;
  const tripId = el.dataset.tripId;
  const trip = state.trips.find(t => t.id === tripId);
  const currentComp = trip?.metadata?.companions || '';
  const options = ['나홀로', '가족', '연인', '친구', '반려동물', '기타'];
  
  const select = document.createElement('select');
  select.className = 'badge-inline-select';
  
  const defOpt = document.createElement('option');
  defOpt.value = '';
  defOpt.textContent = '동행인 선택';
  if (!currentComp) defOpt.selected = true;
  select.appendChild(defOpt);
  
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    if (opt === currentComp) option.selected = true;
    select.appendChild(option);
  });

  el.replaceWith(select);
  select.focus();

  const commitEdit = async () => {
    const newComp = select.value;
    if (newComp === currentComp) {
      select.replaceWith(el);
      return;
    }
    try {
      const updated = await patchTripMetadata(tripId, { metadata: { companions: newComp } });
      const tripInState = state.trips.find(t => t.id === tripId);
      if (tripInState) tripInState.metadata = updated.metadata;
      el.innerHTML = `👥 <span class="badge-text">${newComp || '동행인 추가'}</span> <span class="edit-hint">✏️</span>`;
      select.replaceWith(el);
      showToast('✅ 동행인이 수정되었습니다.');
    } catch (err) {
      console.error('[patchTripMetadata comp 실패]', err);
      showToast(`❌ 수정 실패: ${err.message}`, true);
      select.replaceWith(el);
    }
  };

  select.addEventListener('blur', commitEdit);
  select.addEventListener('change', commitEdit);
  select.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { select.replaceWith(el); }
  });
}

/* ── 한줄 평 인라인 편집 ── */
function handleQuoteEditStart(e) {
  const el = e.currentTarget;
  const tripId = el.dataset.tripId;
  const trip = state.trips.find(t => t.id === tripId);
  const currentQuote = trip?.metadata?.quote || '';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentQuote;
  input.placeholder = '한줄 평을 남겨보세요';
  input.className = 'badge-inline-input';

  el.replaceWith(input);
  input.focus();

  const commitEdit = async () => {
    const newQuote = input.value.trim();
    if (newQuote === currentQuote) {
      input.replaceWith(el);
      return;
    }
    try {
      const updated = await patchTripMetadata(tripId, { metadata: { quote: newQuote } });
      const tripInState = state.trips.find(t => t.id === tripId);
      if (tripInState) tripInState.metadata = updated.metadata;
      el.innerHTML = `💬 <span class="badge-text">${newQuote || '한줄 평을 남겨보세요'}</span> <span class="edit-hint">✏️</span>`;
      input.replaceWith(el);
      showToast('✅ 한줄 평이 수정되었습니다.');
    } catch (err) {
      console.error('[patchTripMetadata quote 실패]', err);
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

/* ── 별점 인라인 편집 ── */
function handleRatingEditStart(e) {
  const el = e.currentTarget;
  const tripId = el.dataset.tripId;
  const trip = state.trips.find(t => t.id === tripId);
  const currentRating = trip?.metadata?.rating || 0;

  const container = document.createElement('div');
  container.className = 'badge-inline-rating';
  container.tabIndex = 0;
  container.style.outline = 'none';
  
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.textContent = i <= currentRating ? '★' : '☆';
    star.className = 'rating-star';
    star.style.cursor = 'pointer';
    star.dataset.val = i;
    
    star.addEventListener('mouseenter', () => {
      stars.forEach(s => s.textContent = s.dataset.val <= i ? '★' : '☆');
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.textContent = s.dataset.val <= currentRating ? '★' : '☆');
    });
    star.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const newRating = i;
      if (newRating === currentRating) {
        container.replaceWith(el);
        return;
      }
      try {
        const updated = await patchTripMetadata(tripId, { metadata: { rating: newRating } });
        const tripInState = state.trips.find(t => t.id === tripId);
        if (tripInState) tripInState.metadata = updated.metadata;
        el.innerHTML = `⭐ <span class="badge-text">${'★'.repeat(newRating) + '☆'.repeat(5 - newRating)}</span> <span class="edit-hint">✏️</span>`;
        container.replaceWith(el);
        showToast('✅ 별점이 수정되었습니다.');
      } catch (err) {
        console.error('[patchTripMetadata rating 실패]', err);
        showToast(`❌ 수정 실패: ${err.message}`, true);
        container.replaceWith(el);
      }
    });
    stars.push(star);
    container.appendChild(star);
  }

  const blurHandler = (ev) => {
    if (!container.contains(ev.relatedTarget)) {
      container.replaceWith(el);
    }
  };
  container.addEventListener('blur', blurHandler, true);
  
  el.replaceWith(container);
  container.focus();
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

/* ── v2.10 사진 이동 (Up/Down) 핸들러 ── */
async function handleMoveUp(e) {
  e.stopPropagation();
  const photoId = e.currentTarget.dataset.photoId;
  const tripId = e.currentTarget.dataset.tripId;
  
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  
  const customOrder = trip.metadata?.custom_order || [];
  const allPhotos = state.tripPhotos[tripId] || [];
  const classified = allPhotos
    .filter(p => p.classified !== false)
    .sort((a, b) => {
      const idxA = customOrder.indexOf(a.id);
      const idxB = customOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      if (!a.taken_at && !b.taken_at) return 0;
      if (!a.taken_at) return 1;
      if (!b.taken_at) return -1;
      return new Date(a.taken_at) - new Date(b.taken_at);
    });

  const idx = classified.findIndex(p => p.id === photoId);
  if (idx <= 0) return; // Cannot move up

  const newArray = classified.map(p => p.id);
  const temp = newArray[idx - 1];
  newArray[idx - 1] = newArray[idx];
  newArray[idx] = temp;

  try {
    const updated = await patchTripMetadata(tripId, { metadata: { ...trip.metadata, custom_order: newArray } });
    trip.metadata = updated.metadata;
    renderApp();
    showToast('⬆️ 사진을 앞으로 이동했습니다.');
  } catch (err) {
    showToast(`❌ 이동 실패: ${err.message}`, true);
  }
}

async function handleMoveDown(e) {
  e.stopPropagation();
  const photoId = e.currentTarget.dataset.photoId;
  const tripId = e.currentTarget.dataset.tripId;
  
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  
  const customOrder = trip.metadata?.custom_order || [];
  const allPhotos = state.tripPhotos[tripId] || [];
  const classified = allPhotos
    .filter(p => p.classified !== false)
    .sort((a, b) => {
      const idxA = customOrder.indexOf(a.id);
      const idxB = customOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      if (!a.taken_at && !b.taken_at) return 0;
      if (!a.taken_at) return 1;
      if (!b.taken_at) return -1;
      return new Date(a.taken_at) - new Date(b.taken_at);
    });

  const idx = classified.findIndex(p => p.id === photoId);
  if (idx === -1 || idx === classified.length - 1) return; // Cannot move down

  const newArray = classified.map(p => p.id);
  const temp = newArray[idx + 1];
  newArray[idx + 1] = newArray[idx];
  newArray[idx] = temp;

  try {
    const updated = await patchTripMetadata(tripId, { metadata: { ...trip.metadata, custom_order: newArray } });
    trip.metadata = updated.metadata;
    renderApp();
    showToast('⬇️ 사진을 뒤로 이동했습니다.');
  } catch (err) {
    showToast(`❌ 이동 실패: ${err.message}`, true);
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

  // 묶인 사진 중 첫 번째 사진만 대표로 마커 표시
  const trip = state.trips.find(t => t.id === tripId);
  const overrides = trip?.metadata?.group_overrides || {};
  const representativePhotos = [];
  let currentGroup = [];

  gpsPhotos.forEach(p => {
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
      const t1 = new Date(lastP.taken_at || 0).getTime();
      const t2 = new Date(p.taken_at || 0).getTime();
      const diffMs = Math.abs(t2 - t1);
      if (!isNaN(diffMs)) {
        shouldGroup = (diffMs <= 3 * 60 * 1000); // 3분 이내면 같은 그룹
      } else {
        shouldGroup = false;
      }
    }

    if (shouldGroup) {
      currentGroup.push(p);
    } else {
      representativePhotos.push(currentGroup[0]); // 이전 그룹의 첫 사진만 대표로 추가
      currentGroup = [p];
    }
  });
  if (currentGroup.length > 0) representativePhotos.push(currentGroup[0]);

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

    representativePhotos.forEach((p, idx) => {
      const latlng = [p.latitude, p.longitude];
      latlngs.push(latlng);

      // 마커 추가
      const marker = L.marker(latlng).addTo(map);

      if (idx === 0) {
        marker.bindTooltip("🏁 출발", { permanent: true, direction: 'top', offset: [0, -20] });
      } else if (idx === representativePhotos.length - 1 && representativePhotos.length > 1) {
        marker.bindTooltip("🚩 도착", { permanent: true, direction: 'top', offset: [0, -20] });
      }
      
      // 팝업 컨텐츠 (이미지 클릭 시 구글 지도로 새 창 열기)
      const timeStr = p.taken_at ? new Date(p.taken_at).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'numeric', minute:'numeric' }) : '';
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
      const popupHtml = `
        <a href="${googleMapsUrl}" target="_blank" title="구글 지도에서 열기" style="display:block; text-decoration:none;">
          <img src="${p.storage_path}" style="width:150px; height:100px; object-fit:cover; border-bottom:1px solid #eee; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" />
          <div style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:12px; pointer-events:none;">🗺️</div>
        </a>
        <div style="font-size:12px; font-weight:600; padding:8px; text-align:center; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px;">${p.original_filename}</div>
        <div style="font-size:11px; color:#888; text-align:center; padding-bottom:8px;">${timeStr}</div>
      `;
      marker.bindPopup(popupHtml, { minWidth: 150, closeButton: false });
    });

    // 동선 폴리라인 연결 (시간 순서대로 전체 연결)
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

/* ── v2.14 대표 사진 설정 ────────────────────────────────── */
async function handleMakeCover(e) {
  const btn = e.currentTarget;
  const photoId = btn.dataset.photoId;
  const tripId = btn.dataset.tripId;

  // Optimistic UI update
  const photos = state.tripPhotos[tripId];
  if (!photos) return;
  const p = photos.find(x => x.id === photoId);
  if (p) {
    if (!p.metadata) p.metadata = {};
    p.metadata.is_cover = true;
  }
  renderApp();
  showToast('🌟 대표 사진으로 지정되었습니다.');

  try {
    await fetch(`${API_BASE_URL}/photos/${photoId}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { is_cover: true } })
    });
  } catch (err) {
    console.error(err);
  }
}

/* ── v2.14/v2.15 Lightbox 전체화면 (확대/축소 및 이동 기능) ─────────────────────────────── */
let lightboxScale = 1;
let lightboxPanX = 0;
let lightboxPanY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

function openLightbox(imgSrc) {
  let overlay = document.getElementById('lightboxOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lightboxOverlay';
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
      <img class="lightbox-img" id="lightboxImg" src="">
    `;
    document.body.appendChild(overlay);
    
    const img = document.getElementById('lightboxImg');

    // 마우스 휠 확대/축소
    overlay.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 0.1;
      if (e.deltaY < 0) {
        lightboxScale = Math.min(lightboxScale + zoomFactor, 5); // 최대 5배
      } else {
        lightboxScale = Math.max(lightboxScale - zoomFactor, 0.5); // 최소 0.5배
      }
      updateLightboxTransform(img);
    }, { passive: false });

    // 네이티브 이미지 드래그 방지 (데스크탑에서 드래그 안 되는 문제 해결)
    img.ondragstart = () => false;

    let initialDistance = 0;
    let initialScale = 1;

    const handlePointerDown = (e) => {
      if (e.touches && e.touches.length === 2) {
        // Pinch zoom 시작
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = lightboxScale;
      } else {
        // Pan 시작
        isPanning = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startPanX = clientX - lightboxPanX;
        startPanY = clientY - lightboxPanY;
        img.style.cursor = 'grabbing';
      }
    };

    const handlePointerMove = (e) => {
      if (e.touches && e.touches.length === 2) {
        // Pinch zoom 중
        e.preventDefault(); // 스크롤 등 기본 동작 방지
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lightboxScale = Math.min(Math.max(initialScale * (currentDistance / initialDistance), 0.5), 5);
        updateLightboxTransform(img);
      } else if (isPanning) {
        // Pan 중
        e.preventDefault(); // 스크롤 등 기본 동작 방지
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        lightboxPanX = clientX - startPanX;
        lightboxPanY = clientY - startPanY;
        updateLightboxTransform(img);
      }
    };

    const handlePointerUp = () => {
      isPanning = false;
      img.style.cursor = 'grab';
    };

    // 마우스 이벤트 바인딩
    img.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);

    // 모바일 터치 이벤트 바인딩
    img.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('touchcancel', handlePointerUp);
    
    // 더블클릭 (데스크탑) / 더블탭 (모바일에서는 보통 dblclick으로도 트리거됨) 시 초기화
    img.addEventListener('dblclick', () => {
      resetLightboxTransform(img);
    });

    overlay.addEventListener('click', (e) => {
      // 이미지 바깥 영역을 클릭했을 때만 닫기
      if (e.target === overlay) closeLightbox();
    });
    
    img.style.cursor = 'grab';
  }
  
  const img = document.getElementById('lightboxImg');
  img.src = imgSrc;
  resetLightboxTransform(img);
  overlay.classList.add('open');
}

function updateLightboxTransform(img) {
  img.style.transition = 'none';
  img.style.transform = `translate(${lightboxPanX}px, ${lightboxPanY}px) scale(${lightboxScale})`;
}

function resetLightboxTransform(img) {
  lightboxScale = 1;
  lightboxPanX = 0;
  lightboxPanY = 0;
  img.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
  img.style.transform = `translate(0px, 0px) scale(1)`;
}

function closeLightbox() {
  const overlay = document.getElementById('lightboxOverlay');
  if (overlay) overlay.classList.remove('open');
}
