/* ============================================================
   Trip — 나의 여행 기록
   app.js  v1.1
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   1. MOCK 데이터 (Rule 3 — API Contract)
   나중에 fetchTrips() 안의 주석 처리된 fetch() 코드로만 교체하면 됨
   ────────────────────────────────────────────────────────── */
const MOCK_DATA = [
  {
    id: 'trip-001',
    title: '도쿄 벚꽃 여행',
    description: '2024년 봄, 처음 가본 일본. 우에노 공원의 벚꽃이 정말 아름다웠어요.',
    theme: 'travel',
    cover_photo: null,            // null → 그라데이션 fallback 테스트
    photo_count: 47,
    unclassified_count: 3,
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
    unclassified_count: 0,        // 0 → 미분류 배지 숨김 테스트
    metadata: { location: '오사카', budget_total: 180000 },
    created_at: '2024-04-05'
  },
  {
    id: 'trip-003',
    title: '제주 혼행 일기',
    description: '혼자 떠난 첫 힐링 여행. 성산일출봉에서 맞은 해돋이.',
    theme: 'diary',
    cover_photo: null,
    photo_count: 61,
    unclassified_count: 12,
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
    unclassified_count: 0,
    metadata: { location: '부산', season: '여름' },
    created_at: '2024-07-22'
  }
];

/* ── 미분류 사진 Mock 데이터 ─────────────────────────────── */
const MOCK_PHOTOS = [
  {
    id: 'photo-001',
    trip_id: null,
    storage_path: null,
    original_filename: 'IMG_0023.jpg',
    taken_at: null,
    latitude: null,
    longitude: null,
    classified: false,
    vision_tags: { time_of_day: 'afternoon', environment: 'outdoor' },
    metadata: {},
    created_at: '2024-03-20'
  },
  {
    id: 'photo-002',
    trip_id: null,
    storage_path: null,
    original_filename: 'IMG_0047.jpg',
    taken_at: null,
    latitude: null,
    longitude: null,
    classified: false,
    vision_tags: { time_of_day: 'night', environment: 'indoor' },
    metadata: {},
    created_at: '2024-04-05'
  },
  {
    id: 'photo-003',
    trip_id: null,
    storage_path: null,
    original_filename: 'IMG_0089.jpg',
    taken_at: null,
    latitude: null,
    longitude: null,
    classified: false,
    vision_tags: null,             // Rule 2 — Vision API 실패 → null
    metadata: {},
    created_at: '2024-05-10'
  }
];


/* ──────────────────────────────────────────────────────────
   2. 데이터 레이어 — API 계약 인터페이스 (Rule 3)
   ────────────────────────────────────────────────────────── */
async function fetchTrips() {
  // ✅ 백엔드 완성 후 아래 주석을 해제하고 MOCK_DATA 라인을 지우면 됨
  // const res  = await fetch('/api/trips');
  // const json = await res.json();
  // return json.success ? json.data : [];

  return Promise.resolve(MOCK_DATA);
}


/* ──────────────────────────────────────────────────────────
   3. 상태 관리 (v1.1 — 확장)
   ────────────────────────────────────────────────────────── */
let state = {
  trips: [],
  activeFilter: 'all',
  drawerOpen: false,
  unclassifiedPhotos: [...MOCK_PHOTOS],
  timelinePhotos: {},    // { trip_id: [photo 객체] }
  activeModal: null,     // 현재 열린 여행 ID
};

// 드래그 중인 사진 ID를 임시 저장 (DOM 이벤트 간 전달)
let _dragPhotoId = null;


/* ──────────────────────────────────────────────────────────
   4. 유틸 함수
   ────────────────────────────────────────────────────────── */
const THEME_CONFIG = {
  travel: { emoji: '✈️', label: '여행',    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  food:   { emoji: '🍜', label: '맛집',    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  diary:  { emoji: '📔', label: '일기',    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  default:{ emoji: '🗺️', label: '기타',    gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' }
};

const FILTER_TABS = [
  { key: 'all',    label: '전체' },
  { key: 'travel', label: '여행 ✈️' },
  { key: 'food',   label: '맛집 🍜' },
  { key: 'diary',  label: '일기 📔' }
];

const TIME_OF_DAY_LABEL = {
  morning:   { label: '오전', icon: '🌅' },
  afternoon: { label: '오후', icon: '☀️' },
  night:     { label: '야간', icon: '🌙' },
};
const ENVIRONMENT_LABEL = {
  indoor:  { label: '실내', icon: '🏠' },
  outdoor: { label: '야외', icon: '🌳' },
  urban:   { label: '도심', icon: '🏙️' },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function formatMetaKey(key) {
  const map = {
    location: '📍', season: '🌸', emotion: '💭',
    budget_total: '💰', weather: '⛅'
  };
  return map[key] || '·';
}

function formatMetaValue(key, val) {
  if (key === 'budget_total') return `${Number(val).toLocaleString()}원`;
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


/* ──────────────────────────────────────────────────────────
   5. 렌더링 함수들
   ────────────────────────────────────────────────────────── */

/** 헤더 */
function renderHeader() {
  return `
    <header class="app-header" id="appHeader">
      <div class="header-logo">Trip</div>
      <div class="header-actions">
        <button class="header-btn" aria-label="검색" id="btnSearch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <button class="header-btn" aria-label="프로필" id="btnProfile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </button>
      </div>
    </header>`;
}

/** 히어로 섹션 */
function renderHero(trips) {
  const totalPhotos = trips.reduce((sum, t) => sum + (t.photo_count || 0), 0);
  return `
    <section class="hero-section">
      <p class="hero-greeting">안녕하세요 👋</p>
      <h1 class="hero-title">소중한 순간들을<br><em>기록</em>해보세요</h1>
      <div class="hero-stats">
        <div class="stat-chip">
          <span class="stat-icon">🗺️</span>
          <div class="stat-info">
            <span class="stat-value">${trips.length}</span>
            <span class="stat-label">개의 여행</span>
          </div>
        </div>
        <div class="stat-chip">
          <span class="stat-icon">📷</span>
          <div class="stat-info">
            <span class="stat-value">${totalPhotos}</span>
            <span class="stat-label">장의 사진</span>
          </div>
        </div>
      </div>
    </section>`;
}

/** 필터 탭 */
function renderFilterTabs() {
  const tabs = FILTER_TABS.map(tab => `
    <button
      class="filter-tab${state.activeFilter === tab.key ? ' active' : ''}"
      data-filter="${tab.key}"
      id="tab-${tab.key}"
      aria-pressed="${state.activeFilter === tab.key}"
    >${tab.label}</button>
  `).join('');
  return `<section class="filter-section"><div class="filter-scroll">${tabs}</div></section>`;
}

/** 메타데이터 태그 (Rule 1 — 동적 렌더링) */
function renderMetadataTags(metadata) {
  if (!metadata || Object.keys(metadata).length === 0) return '';
  const tags = Object.entries(metadata).map(([key, val]) => `
    <span class="meta-tag">
      <span>${formatMetaKey(key)}</span>
      <span>${formatMetaValue(key, val)}</span>
    </span>
  `).join('');
  return `<div class="card-metadata-tags">${tags}</div>`;
}

/** 개별 여행 카드 */
function renderTripCard(trip) {
  const cfg = THEME_CONFIG[trip.theme] || THEME_CONFIG.default;

  // 커버 영역: cover_photo가 null이면 그라데이션 (Rule 2 — Fallback)
  const coverHTML = trip.cover_photo
    ? `<img src="${trip.cover_photo}" alt="${trip.title}" loading="lazy" />`
    : `<div class="card-cover-gradient" style="background: ${cfg.gradient};">
         <span class="cover-emoji">${cfg.emoji}</span>
         <span class="cover-location">${trip.metadata?.location || ''}</span>
       </div>`;

  // 미분류 배지: unclassified_count가 0이면 숨김 (Rule 2)
  const badgeClass = trip.unclassified_count > 0 ? 'unclassified-badge' : 'unclassified-badge hidden';
  const badgeHTML  = `<span class="${badgeClass}">📁 ${trip.unclassified_count}장 미분류</span>`;

  return `
    <article class="trip-card" data-id="${trip.id}" id="card-${trip.id}" role="button" tabindex="0" aria-label="${trip.title} 여행 카드">
      <div class="card-cover">
        ${coverHTML}
        <span class="card-cover-date">${formatDate(trip.created_at)}</span>
      </div>
      <div class="card-body">
        <span class="card-theme-badge theme-${trip.theme}">${cfg.emoji} ${cfg.label}</span>
        <h2 class="card-title">${trip.title}</h2>
        <p class="card-desc">${trip.description || ''}</p>
        <div class="card-footer">
          <div class="card-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            ${trip.photo_count}장
            <span class="card-meta-dot"></span>
            ${formatDate(trip.created_at)}
          </div>
          ${badgeHTML}
        </div>
        ${renderMetadataTags(trip.metadata)}
      </div>
    </article>`;
}

/** 빈 상태 (Rule 2 — EmptyState) */
function renderEmptyState(filter) {
  const cfg = THEME_CONFIG[filter] || { emoji: '🗺️' };
  const label = FILTER_TABS.find(t => t.key === filter)?.label || '여행';
  return `
    <div class="empty-state">
      <div class="empty-emoji">${cfg.emoji}</div>
      <p class="empty-title">아직 ${label}이 없어요</p>
      <p class="empty-desc">첫 번째 ${label} 기록을 만들어<br>소중한 순간을 간직해보세요.</p>
      <button class="empty-btn" id="emptyAddBtn">+ 새 여행 만들기</button>
    </div>`;
}

/** 카드 목록 */
function renderCards() {
  const filtered = state.activeFilter === 'all'
    ? state.trips
    : state.trips.filter(t => t.theme === state.activeFilter);

  const cardsHTML = filtered.length > 0
    ? filtered.map(renderTripCard).join('')
    : renderEmptyState(state.activeFilter);

  return `<section class="cards-section fade-in" id="cardsSection">${cardsHTML}</section>`;
}

/** FAB */
function renderFAB() {
  return `<button class="fab" id="fabAdd" aria-label="새 여행 추가">+</button>`;
}


/* ──────────────────────────────────────────────────────────
   5-B. PhotoDrawer 렌더링
   ────────────────────────────────────────────────────────── */

/** 서랍 열기 토글 버튼 (오른쪽 세로 탭) */
function renderDrawerToggleBtn() {
  const count = state.unclassifiedPhotos.length;
  return `
    <button class="drawer-toggle-btn" id="drawerToggleBtn" aria-label="미분류 사진 서랍 열기">
      <span class="drawer-toggle-count">${count}</span>
      <span class="drawer-toggle-label">미분류 사진</span>
    </button>`;
}

/** 사진 카드 개별 렌더링 */
function renderDrawerPhotoCard(photo) {
  // Rule 2: vision_tags가 null이면 '분석 불가' 배지 표시
  let tagsHTML = '';
  if (photo.vision_tags === null) {
    tagsHTML = `<div class="vision-tags"><span class="vision-tag unknown">🔍 분석 불가</span></div>`;
  } else {
    const tags = [];
    const tod = photo.vision_tags.time_of_day;
    const env = photo.vision_tags.environment;
    if (tod) {
      const t = TIME_OF_DAY_LABEL[tod] || { label: tod, icon: '🕐' };
      tags.push(`<span class="vision-tag time">${t.icon} ${t.label}</span>`);
    }
    if (env) {
      const e = ENVIRONMENT_LABEL[env] || { label: env, icon: '📍' };
      tags.push(`<span class="vision-tag env">${e.icon} ${e.label}</span>`);
    }
    tagsHTML = `<div class="vision-tags">${tags.join('')}</div>`;
  }

  return `
    <div
      class="drawer-photo-card"
      draggable="true"
      data-photo-id="${photo.id}"
      id="drawer-card-${photo.id}"
      aria-label="${photo.original_filename} 드래그하여 여행에 추가"
    >
      <div class="photo-card-header">
        <div class="photo-card-thumb">📷</div>
        <div class="photo-card-info">
          <div class="photo-card-filename">${photo.original_filename}</div>
          <div class="photo-card-date">${formatDate(photo.created_at)}</div>
        </div>
      </div>
      ${tagsHTML}
      <div class="photo-drag-hint">
        <span class="photo-drag-hint-icon">↕</span>
        드래그해서 여행 타임라인에 추가
      </div>
    </div>`;
}

/** 전체 서랍 HTML */
function renderPhotoDrawer() {
  const photos = state.unclassifiedPhotos;
  const bodyHTML = photos.length === 0
    ? `<div class="drawer-empty">
         <div class="drawer-empty-icon">✨</div>
         <p class="drawer-empty-text">모든 사진이 분류되었어요!<br>새로운 사진을 업로드해보세요.</p>
       </div>`
    : photos.map(renderDrawerPhotoCard).join('');

  return `
    <div class="drawer-overlay" id="drawerOverlay"></div>
    <aside class="photo-drawer${state.drawerOpen ? ' open' : ''}" id="photoDrawer" aria-label="미분류 사진 서랍">
      <div class="drawer-header">
        <div>
          <div class="drawer-title">📁 미분류 서랍</div>
          <div class="drawer-subtitle">${photos.length}장의 사진이 분류를 기다려요</div>
        </div>
        <button class="drawer-close-btn" id="drawerCloseBtn" aria-label="서랍 닫기">✕</button>
      </div>
      <div class="drawer-body" id="drawerBody">
        ${bodyHTML}
      </div>
    </aside>`;
}


/* ──────────────────────────────────────────────────────────
   5-C. Trip 상세 모달 렌더링
   ────────────────────────────────────────────────────────── */

/** 테마별 동적 폼 (Rule 1 — JSONB metadata 필드들을 조건부 렌더링) */
function renderDynamicForm(theme, tripId) {
  let formFields = '';

  if (theme === 'travel') {
    formFields = `
      <!-- 예산 슬라이더 -->
      <div class="form-group">
        <label class="form-label" for="field-budget-${tripId}">💰 예산</label>
        <div class="form-range-wrapper">
          <div class="range-display">
            <span class="range-value" id="rangeDisplay-${tripId}">500,000원</span>
            <span class="range-min-max">0 — 2,000,000원</span>
          </div>
          <input
            type="range" class="form-range" id="field-budget-${tripId}"
            min="0" max="2000000" step="10000" value="500000"
            data-display="rangeDisplay-${tripId}"
            aria-label="여행 예산 슬라이더"
          >
        </div>
      </div>
      <!-- 계절 -->
      <div class="form-group">
        <label class="form-label" for="field-season-${tripId}">🌸 계절</label>
        <select class="form-select" id="field-season-${tripId}" aria-label="계절 선택">
          <option value="">계절을 선택하세요</option>
          <option value="봄">🌸 봄</option>
          <option value="여름">☀️ 여름</option>
          <option value="가을">🍂 가을</option>
          <option value="겨울">❄️ 겨울</option>
        </select>
      </div>
      <!-- 동반자 -->
      <div class="form-group">
        <label class="form-label" for="field-companion-${tripId}">👥 동반자</label>
        <select class="form-select" id="field-companion-${tripId}" aria-label="동반자 선택">
          <option value="">동반자를 선택하세요</option>
          <option value="혼자">🧍 혼자</option>
          <option value="연인">💑 연인</option>
          <option value="가족">👨‍👩‍👧 가족</option>
          <option value="친구">👫 친구</option>
          <option value="단체">🎒 단체</option>
        </select>
      </div>
    `;
  } else if (theme === 'food') {
    formFields = `
      <!-- 예산 -->
      <div class="form-group">
        <label class="form-label" for="field-foodbudget-${tripId}">💰 예산 (1인)</label>
        <div class="form-range-wrapper">
          <div class="range-display">
            <span class="range-value" id="rangeDisplay-${tripId}">35,000원</span>
            <span class="range-min-max">0 — 200,000원</span>
          </div>
          <input
            type="range" class="form-range" id="field-foodbudget-${tripId}"
            min="0" max="200000" step="1000" value="35000"
            data-display="rangeDisplay-${tripId}"
            aria-label="음식 예산 슬라이더"
          >
        </div>
      </div>
      <!-- 식당명 -->
      <div class="form-group">
        <label class="form-label" for="field-restaurant-${tripId}">🏪 식당명</label>
        <input type="text" class="form-input" id="field-restaurant-${tripId}" placeholder="식당 이름을 입력하세요" aria-label="식당명">
      </div>
      <!-- 별점 -->
      <div class="form-group">
        <label class="form-label">⭐ 별점</label>
        <div class="star-rating" id="starRating-${tripId}" data-trip="${tripId}" role="group" aria-label="별점 선택">
          ${[1,2,3,4,5].map(n => `
            <button class="star-btn" data-star="${n}" aria-label="${n}점" id="star-${tripId}-${n}">★</button>
          `).join('')}
          <span class="star-value-label" id="starLabel-${tripId}">선택 없음</span>
        </div>
      </div>
      <!-- 가격대 -->
      <div class="form-group">
        <label class="form-label">💳 가격대</label>
        <div class="price-chip-group" id="priceChips-${tripId}" role="group" aria-label="가격대 선택">
          <button class="price-chip" data-value="저렴" id="price-cheap-${tripId}">💚 저렴</button>
          <button class="price-chip" data-value="보통" id="price-mid-${tripId}">💛 보통</button>
          <button class="price-chip" data-value="고급" id="price-high-${tripId}">🧡 고급</button>
          <button class="price-chip" data-value="파인다이닝" id="price-fine-${tripId}">❤️ 파인다이닝</button>
        </div>
      </div>
    `;
  } else if (theme === 'diary') {
    formFields = `
      <!-- 감정 -->
      <div class="form-group">
        <label class="form-label">💭 감정</label>
        <div class="emotion-chip-group" id="emotionChips-${tripId}" role="group" aria-label="감정 선택">
          <button class="emotion-chip" data-value="행복" id="emotion-happy-${tripId}">😊 행복</button>
          <button class="emotion-chip" data-value="설렘" id="emotion-excited-${tripId}">🥰 설렘</button>
          <button class="emotion-chip" data-value="힐링" id="emotion-healing-${tripId}">😌 힐링</button>
          <button class="emotion-chip" data-value="그리움" id="emotion-miss-${tripId}">🥺 그리움</button>
          <button class="emotion-chip" data-value="뿌듯함" id="emotion-proud-${tripId}">😎 뿌듯함</button>
          <button class="emotion-chip" data-value="피곤" id="emotion-tired-${tripId}">😮‍💨 피곤</button>
        </div>
      </div>
      <!-- 날씨 -->
      <div class="form-group">
        <label class="form-label">⛅ 날씨</label>
        <div class="weather-chip-group" id="weatherChips-${tripId}" role="group" aria-label="날씨 선택">
          <button class="weather-chip" data-value="맑음" id="weather-sun-${tripId}">☀️ 맑음</button>
          <button class="weather-chip" data-value="흐림" id="weather-cloud-${tripId}">⛅ 흐림</button>
          <button class="weather-chip" data-value="비" id="weather-rain-${tripId}">🌧️ 비</button>
          <button class="weather-chip" data-value="눈" id="weather-snow-${tripId}">❄️ 눈</button>
          <button class="weather-chip" data-value="바람" id="weather-wind-${tripId}">💨 바람</button>
        </div>
      </div>
      <!-- 메모 -->
      <div class="form-group">
        <label class="form-label" for="field-memo-${tripId}">📝 메모</label>
        <textarea
          class="form-textarea"
          id="field-memo-${tripId}"
          placeholder="오늘 하루를 기록해보세요..."
          aria-label="일기 메모"
        ></textarea>
      </div>
    `;
  }

  return `
    <div class="dynamic-form" id="dynamicForm-${tripId}">
      ${formFields}
      <button class="form-save-btn" id="formSaveBtn-${tripId}" data-trip="${tripId}">
        ✨ 저장하기
      </button>
    </div>`;
}

/** 타임라인 드롭존 렌더링 */
function renderTimeline(tripId) {
  const photos = state.timelinePhotos[tripId] || [];
  const photosHTML = photos.length > 0
    ? photos.map(p => `
        <div class="timeline-photo-item" data-photo-id="${p.id}" id="timeline-item-${p.id}">
          <div class="timeline-photo-thumb">📸</div>
          <div class="timeline-photo-info">
            <div class="timeline-photo-name">${p.original_filename}</div>
            <div class="timeline-photo-meta">${formatDate(p.created_at)} · 방금 추가됨</div>
          </div>
          <button
            class="timeline-remove-btn"
            data-photo-id="${p.id}"
            data-trip-id="${tripId}"
            aria-label="${p.original_filename} 제거"
            id="remove-${p.id}"
          >✕</button>
        </div>
      `).join('')
    : `<div class="dropzone-placeholder">
         <div class="dropzone-placeholder-icon">📂</div>
         <p class="dropzone-placeholder-text">서랍에서 사진을<br>드래그해서 놓아보세요</p>
       </div>`;

  return `
    <div
      class="timeline-dropzone"
      id="timeline-dropzone-${tripId}"
      data-trip-id="${tripId}"
    >
      ${photosHTML}
    </div>`;
}

/** Trip 상세 모달 */
function renderTripModal(trip) {
  if (!trip) return '';
  const cfg = THEME_CONFIG[trip.theme] || THEME_CONFIG.default;

  return `
    <div class="trip-modal-overlay${state.activeModal === trip.id ? ' open' : ''}" id="tripModalOverlay" data-trip="${trip.id}">
      <div class="trip-modal" id="tripModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-handle"></div>
        <!-- 헤더 -->
        <div class="modal-header">
          <div class="modal-cover-thumb" style="background: ${cfg.gradient};">
            ${cfg.emoji}
          </div>
          <div class="modal-title-block">
            <span class="modal-theme-badge theme-${trip.theme}">${cfg.emoji} ${cfg.label}</span>
            <h2 class="modal-title" id="modalTitle">${trip.title}</h2>
            <p class="modal-desc">${trip.description || ''}</p>
          </div>
          <button class="modal-close-btn" id="modalCloseBtn" aria-label="모달 닫기">✕</button>
        </div>
        <!-- 바디 -->
        <div class="modal-body">
          <!-- 타임라인 드롭존 -->
          <div>
            <p class="modal-section-title">📸 타임라인</p>
            ${renderTimeline(trip.id)}
          </div>
          <!-- 테마별 동적 폼 -->
          <div>
            <p class="modal-section-title">✏️ 여행 기록</p>
            ${renderDynamicForm(trip.theme, trip.id)}
          </div>
        </div>
      </div>
    </div>`;
}

/** 전체 앱 */
function renderApp() {
  const root = document.getElementById('app');
  root.innerHTML =
    renderHeader() +
    renderHero(state.trips) +
    renderFilterTabs() +
    renderCards() +
    renderFAB() +
    renderDrawerToggleBtn() +
    renderPhotoDrawer();

  // 모달 컨테이너 (body에 마운트해서 z-index 관리 편하게)
  let modalMount = document.getElementById('modalMount');
  if (!modalMount) {
    modalMount = document.createElement('div');
    modalMount.id = 'modalMount';
    document.body.appendChild(modalMount);
  }
  modalMount.innerHTML = '';

  attachEventListeners();
}

/** 카드 목록만 교체 (필터 전환 시) */
function rerenderCards() {
  const section = document.getElementById('cardsSection');
  if (!section) return;

  section.classList.remove('fade-in');
  section.classList.add('fade-out');

  setTimeout(() => {
    const wrapper = section.parentNode;
    const newSection = document.createElement('div');
    newSection.innerHTML = renderCards();
    wrapper.replaceChild(newSection.firstElementChild, section);
    attachCardListeners();
    attachEmptyBtnListener();
  }, 150);
}


/* ──────────────────────────────────────────────────────────
   6. 드래그앤드롭 핸들러
   ────────────────────────────────────────────────────────── */
function handleDragStart(e) {
  const card = e.currentTarget;
  _dragPhotoId = card.dataset.photoId;
  card.classList.add('dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', _dragPhotoId);
  }
}

function handleDragEnd(e) {
  const card = e.currentTarget;
  card.classList.remove('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  const zone = e.currentTarget;
  zone.classList.add('drag-over');
}

function handleDragLeave(e) {
  const zone = e.currentTarget;
  // 자식 요소로 이동한 경우 무시
  if (zone.contains(e.relatedTarget)) return;
  zone.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  const zone = e.currentTarget;
  zone.classList.remove('drag-over');

  const photoId = _dragPhotoId || e.dataTransfer?.getData('text/plain');
  _dragPhotoId = null;
  if (!photoId) return;

  const tripId = zone.dataset.tripId;
  if (!tripId) return;

  // 이미 추가된 경우 중복 방지
  const already = (state.timelinePhotos[tripId] || []).find(p => p.id === photoId);
  if (already) {
    showToast('⚠️ 이미 이 타임라인에 추가된 사진이에요');
    return;
  }

  // 미분류 서랍에서 찾기
  const photoIdx = state.unclassifiedPhotos.findIndex(p => p.id === photoId);
  if (photoIdx === -1) return;
  const photo = state.unclassifiedPhotos[photoIdx];

  // state 업데이트
  state.unclassifiedPhotos.splice(photoIdx, 1);
  if (!state.timelinePhotos[tripId]) state.timelinePhotos[tripId] = [];
  state.timelinePhotos[tripId].push({ ...photo, trip_id: tripId, classified: true });

  // 서랍 카드 제거
  const drawerCard = document.getElementById(`drawer-card-${photoId}`);
  if (drawerCard) {
    drawerCard.style.transition = 'opacity 0.2s, transform 0.2s';
    drawerCard.style.opacity = '0';
    drawerCard.style.transform = 'scale(0.9)';
    setTimeout(() => drawerCard.remove(), 220);
  }

  // 서랍 부제목 + 토글 카운트 업데이트
  const subtitle = document.querySelector('.drawer-subtitle');
  if (subtitle) subtitle.textContent = `${state.unclassifiedPhotos.length}장의 사진이 분류를 기다려요`;
  const countEl = document.querySelector('.drawer-toggle-count');
  if (countEl) countEl.textContent = state.unclassifiedPhotos.length;

  // 타임라인 드롭존 리렌더링
  const dropzone = document.getElementById(`timeline-dropzone-${tripId}`);
  if (dropzone) {
    dropzone.innerHTML = '';
    const temp = document.createElement('div');
    temp.innerHTML = renderTimeline(tripId);
    const newZone = temp.querySelector('.timeline-dropzone');
    if (newZone) {
      // 내용만 교체 (이벤트 리스너 다시 부착 필요)
      zone.innerHTML = newZone.innerHTML;
      attachTimelineRemoveListeners(tripId);
    }
  }

  showToast(`📸 "${photo.original_filename}" 타임라인에 추가됨`);
}

/** 타임라인 내 제거 버튼 이벤트 */
function attachTimelineRemoveListeners(tripId) {
  const zone = document.getElementById(`timeline-dropzone-${tripId}`);
  if (!zone) return;
  zone.querySelectorAll('.timeline-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const photoId = btn.dataset.photoId;
      // 타임라인에서 제거
      const idx = (state.timelinePhotos[tripId] || []).findIndex(p => p.id === photoId);
      if (idx === -1) return;
      const photo = state.timelinePhotos[tripId].splice(idx, 1)[0];
      // 서랍으로 복원 (미분류 상태로)
      state.unclassifiedPhotos.push({ ...photo, trip_id: null, classified: false });

      // 타임라인 드롭존 리렌더링
      const temp = document.createElement('div');
      temp.innerHTML = renderTimeline(tripId);
      zone.innerHTML = temp.querySelector('.timeline-dropzone').innerHTML;
      attachTimelineRemoveListeners(tripId);

      // 서랍 업데이트
      refreshDrawer();
      showToast(`↩️ "${photo.original_filename}" 서랍으로 돌아갔어요`);
    });
  });
}

/** 드롭존에 이벤트 부착 */
function attachDropzoneListeners(tripId) {
  const zone = document.getElementById(`timeline-dropzone-${tripId}`);
  if (!zone) return;
  zone.addEventListener('dragover', handleDragOver);
  zone.addEventListener('dragleave', handleDragLeave);
  zone.addEventListener('drop', handleDrop);
  attachTimelineRemoveListeners(tripId);
}

/** 서랍 새로고침 (사진 복원 후 UI 업데이트) */
function refreshDrawer() {
  const body = document.getElementById('drawerBody');
  if (!body) return;
  const photos = state.unclassifiedPhotos;
  if (photos.length === 0) {
    body.innerHTML = `<div class="drawer-empty">
      <div class="drawer-empty-icon">✨</div>
      <p class="drawer-empty-text">모든 사진이 분류되었어요!<br>새로운 사진을 업로드해보세요.</p>
    </div>`;
  } else {
    body.innerHTML = photos.map(renderDrawerPhotoCard).join('');
    // 드래그 이벤트 다시 부착
    body.querySelectorAll('.drawer-photo-card[draggable]').forEach(card => {
      card.addEventListener('dragstart', handleDragStart);
      card.addEventListener('dragend', handleDragEnd);
    });
  }
  const subtitle = document.querySelector('.drawer-subtitle');
  if (subtitle) subtitle.textContent = `${photos.length}장의 사진이 분류를 기다려요`;
  const countEl = document.querySelector('.drawer-toggle-count');
  if (countEl) countEl.textContent = photos.length;
}


/* ──────────────────────────────────────────────────────────
   7. 모달 핸들러
   ────────────────────────────────────────────────────────── */
function openModal(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;

  state.activeModal = tripId;

  const modalMount = document.getElementById('modalMount');
  if (!modalMount) return;
  modalMount.innerHTML = renderTripModal(trip);

  // 한 프레임 후 open 클래스 추가 (트랜지션 트리거)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const overlay = document.getElementById('tripModalOverlay');
      if (overlay) overlay.classList.add('open');
    });
  });

  attachModalListeners(tripId);
}

function closeModal() {
  const overlay = document.getElementById('tripModalOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => {
      const modalMount = document.getElementById('modalMount');
      if (modalMount) modalMount.innerHTML = '';
      state.activeModal = null;
    }, 420);
  }
}

function attachModalListeners(tripId) {
  const overlay = document.getElementById('tripModalOverlay');
  const closeBtn = document.getElementById('modalCloseBtn');

  // 배경 클릭 시 닫기
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // 닫기 버튼
  closeBtn?.addEventListener('click', closeModal);

  // 드롭존 이벤트
  attachDropzoneListeners(tripId);

  // 드래그 이벤트 (서랍 카드 — 모달 열린 상태에서도 draggable)
  document.querySelectorAll('.drawer-photo-card[draggable]').forEach(card => {
    card.removeEventListener('dragstart', handleDragStart);
    card.removeEventListener('dragend', handleDragEnd);
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
  });

  // DynamicForm 인터랙션
  attachDynamicFormListeners(tripId);
}

/** DynamicForm 내부 인터랙션 이벤트 */
function attachDynamicFormListeners(tripId) {
  // 예산 슬라이더
  const rangeInput = document.getElementById(`field-budget-${tripId}`) ||
                     document.getElementById(`field-foodbudget-${tripId}`);
  const rangeDisplay = document.getElementById(`rangeDisplay-${tripId}`);
  if (rangeInput && rangeDisplay) {
    const updateRange = () => {
      const val = Number(rangeInput.value);
      rangeDisplay.textContent = `${val.toLocaleString()}원`;
      // CSS custom property로 fill 색상 업데이트
      const pct = ((val - rangeInput.min) / (rangeInput.max - rangeInput.min)) * 100;
      rangeInput.style.setProperty('--val', `${pct}%`);
    };
    rangeInput.addEventListener('input', updateRange);
    updateRange(); // 초기화
  }

  // 별점 인터랙션
  const starGroup = document.getElementById(`starRating-${tripId}`);
  if (starGroup) {
    let selectedStar = 0;
    const starLabel = document.getElementById(`starLabel-${tripId}`);
    const starBtns = starGroup.querySelectorAll('.star-btn');
    const STAR_LABELS = ['', '별로예요', '그저 그래요', '좋아요', '매우 좋아요', '최고예요!'];

    const renderStars = (hoveredOrSelected) => {
      starBtns.forEach(btn => {
        const n = Number(btn.dataset.star);
        btn.classList.toggle('active', n <= hoveredOrSelected);
      });
    };

    starBtns.forEach(btn => {
      btn.addEventListener('mouseenter', () => renderStars(Number(btn.dataset.star)));
      btn.addEventListener('mouseleave', () => renderStars(selectedStar));
      btn.addEventListener('click', () => {
        selectedStar = Number(btn.dataset.star);
        renderStars(selectedStar);
        if (starLabel) starLabel.textContent = `${selectedStar}점 — ${STAR_LABELS[selectedStar]}`;
      });
    });
  }

  // 가격대 칩
  const priceGroup = document.getElementById(`priceChips-${tripId}`);
  if (priceGroup) {
    priceGroup.querySelectorAll('.price-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        priceGroup.querySelectorAll('.price-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });
  }

  // 감정 칩
  const emotionGroup = document.getElementById(`emotionChips-${tripId}`);
  if (emotionGroup) {
    emotionGroup.querySelectorAll('.emotion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        emotionGroup.querySelectorAll('.emotion-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });
  }

  // 날씨 칩
  const weatherGroup = document.getElementById(`weatherChips-${tripId}`);
  if (weatherGroup) {
    weatherGroup.querySelectorAll('.weather-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        weatherGroup.querySelectorAll('.weather-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });
  }

  // 저장 버튼
  const saveBtn = document.getElementById(`formSaveBtn-${tripId}`);
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      // Rule 1: metadata에 저장 (간단한 in-memory 저장 데모)
      showToast('✅ 기록이 저장되었어요!');
    });
  }
}


/* ──────────────────────────────────────────────────────────
   8. 이벤트 핸들러
   ────────────────────────────────────────────────────────── */
function handleFilterChange(filter) {
  if (state.activeFilter === filter) return;
  state.activeFilter = filter;

  // 탭 UI 업데이트
  document.querySelectorAll('.filter-tab').forEach(btn => {
    const isActive = btn.dataset.filter === filter;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });

  rerenderCards();
}

function handleCardClick(tripId) {
  // v1.1: alert() 대신 진짜 모달 열기
  openModal(tripId);
}

function toggleDrawer() {
  state.drawerOpen = !state.drawerOpen;
  const drawer = document.getElementById('photoDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (drawer) drawer.classList.toggle('open', state.drawerOpen);
  if (overlay) overlay.classList.toggle('visible', state.drawerOpen);
}

function attachCardListeners() {
  document.querySelectorAll('.trip-card').forEach(card => {
    card.addEventListener('click', () => handleCardClick(card.dataset.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') handleCardClick(card.dataset.id);
    });
  });
}

function attachEmptyBtnListener() {
  const btn = document.getElementById('emptyAddBtn');
  if (btn) btn.addEventListener('click', () => {
    showToast('새 여행 추가 기능은 v1.3에서 추가됩니다!');
  });
}

function attachDrawerListeners() {
  // 서랍 토글 버튼
  document.getElementById('drawerToggleBtn')?.addEventListener('click', toggleDrawer);

  // 서랍 닫기 버튼
  document.getElementById('drawerCloseBtn')?.addEventListener('click', toggleDrawer);

  // 서랍 오버레이 클릭 시 닫기
  document.getElementById('drawerOverlay')?.addEventListener('click', () => {
    if (state.drawerOpen) toggleDrawer();
  });

  // 드래그 이벤트 (서랍 안 사진 카드)
  document.querySelectorAll('.drawer-photo-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
  });
}

function attachEventListeners() {
  // 필터 탭
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => handleFilterChange(btn.dataset.filter));
  });

  // 카드 클릭
  attachCardListeners();

  // FAB
  document.getElementById('fabAdd')?.addEventListener('click', () => {
    showToast('새 여행 추가 기능은 v1.3에서 추가됩니다!');
  });

  // 헤더 버튼
  document.getElementById('btnSearch')?.addEventListener('click', () => showToast('🔍 검색 기능은 준비 중입니다!'));
  document.getElementById('btnProfile')?.addEventListener('click', () => showToast('👤 프로필 기능은 준비 중입니다!'));

  // Empty 상태 버튼
  attachEmptyBtnListener();

  // 서랍 관련 이벤트
  attachDrawerListeners();

  // 스크롤 시 헤더 blur 강조
  const header = document.getElementById('appHeader');
  window.addEventListener('scroll', () => {
    header?.classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });
}


/* ──────────────────────────────────────────────────────────
   9. 앱 초기화
   ────────────────────────────────────────────────────────── */
async function init() {
  try {
    state.trips = await fetchTrips();
  } catch (err) {
    console.error('[Trip] fetchTrips 실패 — 빈 배열로 fallback:', err);
    state.trips = [];                             // Rule 2: 앱을 죽이지 않음
  }

  renderApp();

  // 로딩 스크린 숨기기
  const loading = document.querySelector('.loading-screen');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 500);
  }
}

init();
