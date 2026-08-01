const refreshButton = document.getElementById('refreshButton');

const requestCount = document.getElementById('requestCount');

const summaryText = document.getElementById('summaryText');

const loadingMessage = document.getElementById('loadingMessage');

const errorMessage = document.getElementById('errorMessage');

const emptyMessage = document.getElementById('emptyMessage');

const requestList = document.getElementById('requestList');

const filterButtons = document.querySelectorAll('.filter-tab');

/* 접수 검색 요소 */
const requestSearch = document.getElementById('requestSearch');

const clearSearchButton = document.getElementById('clearSearchButton');

const searchResultText = document.getElementById('searchResultText');

const STATUS_OPTIONS = [
  '신규 접수',
  '고객 연락 완료',
  '방문 예정',
  '수리 진행',
  '처리 완료',
];

let allRequests = [];
let currentFilter = 'active';
let currentSearchText = '';

/* 사진 확대창 스와이프 시작 위치 */
let imageTouchStartX = null;
let imageTouchStartY = null;

/* 글 전체보기 스와이프 시작 위치 */
let textTouchStartX = null;
let textTouchStartY = null;

/* HTML 특수문자 처리 */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* 접수 날짜 표시 */
function formatDate(dateString) {
  if (!dateString) {
    return '-';
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(date);
}

/* 관리자가 지정한 방문 예정 일정 표시 */
function formatAdminVisitDate(dateString) {
  if (!dateString) {
    return '아직 정하지 않음';
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '아직 정하지 않음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Seoul',
  }).format(date);
}

/* DB의 방문 일정을 날짜 입력칸 형식으로 변환 */
function toDatetimeLocalValue(dateString) {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const koreaTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return koreaTime.toISOString().slice(0, 16);
}

/* 관리자 주소에서 key 가져오기 */
function getAdminKey() {
  const urlParams = new URLSearchParams(window.location.search);

  return urlParams.get('key');
}

/* 기존 상태값 정리 */
function normalizeStatus(status) {
  if (!status || status === '접수완료') {
    return '신규 접수';
  }

  return status;
}

/* 상태별 CSS 클래스 */
function getStatusClass(status) {
  const statusClasses = {
    '신규 접수': 'status-new',
    '고객 연락 완료': 'status-contacted',
    '방문 예정': 'status-visit',
    '수리 진행': 'status-repair',
    '처리 완료': 'status-completed',
  };

  return statusClasses[normalizeStatus(status)] || 'status-new';
}

/*
 * DB의 problem 값에서 정보를 분리한다.
 * 여러 줄 고장 증상과 추가 요청사항도 전부 유지한다.
 */
function parseProblemText(problemText) {
  const result = {
    siteName: '',
    equipmentType: '',
    urgent: '',
    symptom: '',
    requestNote: '',
  };

  const lines = String(problemText ?? '').split('\n');

  let currentSection = '';

  lines.forEach((line) => {
    const text = line.trim();

    if (text.startsWith('현장명:')) {
      result.siteName = text.replace('현장명:', '').trim();

      currentSection = 'siteName';
      return;
    }

    if (text.startsWith('설비 종류:')) {
      result.equipmentType = text.replace('설비 종류:', '').trim();

      currentSection = 'equipmentType';
      return;
    }

    if (text.startsWith('긴급 여부:')) {
      result.urgent = text.replace('긴급 여부:', '').trim();

      currentSection = 'urgent';
      return;
    }

    if (text.startsWith('고장 증상:')) {
      result.symptom = text.replace('고장 증상:', '').trim();

      currentSection = 'symptom';
      return;
    }

    if (text.startsWith('추가 요청사항:')) {
      result.requestNote = text.replace('추가 요청사항:', '').trim();

      currentSection = 'requestNote';
      return;
    }

    /*
     * 빈 줄도 고장 내용이나 추가 요청사항의
     * 줄바꿈으로 유지한다.
     */
    if (!text) {
      if (currentSection === 'symptom' && result.symptom) {
        result.symptom += '\n';
      }

      if (currentSection === 'requestNote' && result.requestNote) {
        result.requestNote += '\n';
      }

      return;
    }

    /*
     * 고장 증상의 다음 줄을 이어 붙인다.
     */
    if (currentSection === 'symptom') {
      result.symptom += result.symptom ? `\n${text}` : text;

      return;
    }

    /*
     * 추가 요청사항의 다음 줄을 이어 붙인다.
     */
    if (currentSection === 'requestNote') {
      result.requestNote += result.requestNote ? `\n${text}` : text;
    }
  });

  /*
   * 예전 접수처럼 항목 구분 없이
   * 저장된 데이터도 표시한다.
   */
  if (!result.symptom && problemText) {
    result.symptom = String(problemText);
  }

  return result;
}

/* 설비 종류 한글 변환 */
function getEquipmentLabel(value) {
  const original = String(value ?? '').trim();

  const normalized = original.toLowerCase();

  const equipmentLabels = {
    pump: '펌프',
    motor: '모터',

    'pump-motor': '모터펌프 세트',

    'motor-pump': '모터펌프 세트',

    pump_motor: '모터펌프 세트',

    motor_pump: '모터펌프 세트',

    pumpmotor: '모터펌프 세트',

    'control-panel': '제어판넬',

    control_panel: '제어판넬',

    controlpanel: '제어판넬',

    unknown: '잘 모르겠음',

    unsure: '잘 모르겠음',

    other: '기타',
  };

  const koreanValues = [
    '펌프',
    '모터',
    '모터펌프 세트',
    '제어판넬',
    '제어반',
    '잘 모르겠음',
    '잘모르겠음',
    '기타',
  ];

  if (koreanValues.includes(original)) {
    if (original === '제어반') {
      return '제어판넬';
    }

    if (original === '잘모르겠음') {
      return '잘 모르겠음';
    }

    return original;
  }

  return equipmentLabels[normalized] || '기타';
}

/* 긴급 여부 한글 및 색상 변환 */
function getUrgencyInfo(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  const urgentValues = [
    'urgent',
    'emergency',
    '긴급',
    '긴급 접수',
    '긴급접수',
    'yes',
    'true',
  ];

  if (urgentValues.includes(normalized)) {
    return {
      label: '긴급',
      className: 'urgency-urgent',
    };
  }

  return {
    label: '보통',
    className: 'urgency-normal',
  };
}

/* 사진 주소를 배열로 변환 */
function parseImageUrls(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  const text = String(value).trim();

  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean);
    }

    if (typeof parsed === 'string') {
      return [parsed];
    }
  } catch (error) {
    /*
     * URL 한 개만 저장된 과거 데이터도
     * 아래에서 처리한다.
     */
  }

  if (text.startsWith('http://') || text.startsWith('https://')) {
    return [text];
  }

  return [];
}

/* 사진 썸네일 목록 만들기 */
function createImageGallery(title, imageUrls, type) {
  if (imageUrls.length === 0) {
    return `
      <div class="photo-section">
        <h3>
          ${escapeHtml(title)}
        </h3>

        <p class="no-photo">
          등록된 사진이 없습니다.
        </p>
      </div>
    `;
  }

  const imagesHtml = imageUrls
    .map(
      (imageUrl, index) => `
          <button
            type="button"
            class="photo-thumbnail-button"
            data-image-url="${escapeHtml(imageUrl)}"
            aria-label="${escapeHtml(title)} ${index + 1}번 사진 확대"
          >
            <img
              class="photo-thumbnail"
              src="${escapeHtml(imageUrl)}"
              alt="${escapeHtml(title)} ${index + 1}"
              loading="lazy"
            />
          </button>
        `,
    )
    .join('');

  return `
    <div
      class="photo-section photo-section-${escapeHtml(type)}"
    >
      <div
        class="photo-section-header"
      >
        <h3>
          ${escapeHtml(title)}
        </h3>

        <span>
          ${imageUrls.length}장
        </span>
      </div>

      <div class="photo-gallery">
        ${imagesHtml}
      </div>
    </div>
  `;
}

/* 검색어를 비교하기 좋은 형태로 변경 */
function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
}

/* 접수 한 건의 검색 대상 글자 만들기 */
function getRequestSearchText(request) {
  const problemInfo = parseProblemText(request.problem);

  const equipmentLabel = getEquipmentLabel(problemInfo.equipmentType);

  const status = normalizeStatus(request.status);

  const urgencyInfo = getUrgencyInfo(problemInfo.urgent);

  return normalizeSearchText(
    [
      request.id,
      problemInfo.siteName,
      request.site_name,
      request.company_name,
      request.customer_name,
      request.phone,
      request.address,
      equipmentLabel,
      problemInfo.symptom,
      problemInfo.requestNote,
      urgencyInfo.label,
      request.visit_time,
      formatAdminVisitDate(request.admin_visit_at),
      status,
    ].join(' '),
  );
}

/* 현재 검색어와 접수가 일치하는지 확인 */
function matchesSearch(request) {
  const searchText = normalizeSearchText(currentSearchText);

  if (!searchText) {
    return true;
  }

  return getRequestSearchText(request).includes(searchText);
}

/* 상태 필터와 검색어를 함께 적용 */
function getFilteredRequests() {
  let filteredRequests = allRequests;

  if (currentFilter === 'completed') {
    filteredRequests = filteredRequests.filter(
      (request) => normalizeStatus(request.status) === '처리 완료',
    );
  } else if (currentFilter === 'active') {
    filteredRequests = filteredRequests.filter(
      (request) => normalizeStatus(request.status) !== '처리 완료',
    );
  }

  return filteredRequests.filter(matchesSearch);
}

/* 상단 요약 설명 */
function getSummaryMessage() {
  if (currentFilter === 'completed') {
    return '처리 완료된 접수입니다. 필요한 접수만 직접 삭제할 수 있습니다.';
  }

  if (currentFilter === 'all') {
    return '진행 중인 접수와 처리 완료 접수를 모두 표시합니다.';
  }

  return '현재 확인하거나 방문해야 할 접수입니다.';
}

/* 상태 선택 목록 만들기 */
function createStatusOptions(currentStatus) {
  return STATUS_OPTIONS.map((status) => {
    const selected = status === currentStatus ? 'selected' : '';

    return `
        <option
          value="${escapeHtml(status)}"
          ${selected}
        >
          ${escapeHtml(status)}
        </option>
      `;
  }).join('');
}
/* 접수 카드 만들기 */
function createRequestCard(request) {
  const status = normalizeStatus(request.status);

  const statusClass = getStatusClass(status);

  const isCompleted = status === '처리 완료';

  const problemInfo = parseProblemText(request.problem);

  const equipmentLabel = getEquipmentLabel(problemInfo.equipmentType);

  const urgencyInfo = getUrgencyInfo(problemInfo.urgent);

  const mainTitle =
    problemInfo.siteName ||
    request.site_name ||
    request.company_name ||
    request.customer_name ||
    '현장명 없음';

  const customerName = request.customer_name || '담당자 이름 없음';

  const phone = request.phone || '-';

  const safePhone = String(phone).replace(/[^0-9+]/g, '');

  const address = request.address || '-';

  const encodedAddress = encodeURIComponent(address);

  const nameplateImages = parseImageUrls(request.nameplate_image);

  const problemImages = parseImageUrls(request.problem_image);

  const symptomText = problemInfo.symptom || '고장 내용 없음';

  const requestNoteText = problemInfo.requestNote || '';

  const deleteButton = isCompleted
    ? `
        <button
          type="button"
          class="delete-request-button"
          data-request-id="${escapeHtml(request.id)}"
          aria-label="접수 삭제"
          title="접수 삭제"
        >
          ×
        </button>
      `
    : '';

  return `
    <article
      class="request-card ${statusClass} ${isCompleted ? 'completed' : ''}"
      data-request-id="${escapeHtml(request.id)}"
    >
      <div class="request-card-top">
        <div class="request-title-area">
          <p class="request-number">
            접수번호 #${escapeHtml(request.id)}
            · ${escapeHtml(formatDate(request.created_at))}
          </p>

          <h2 class="site-name">
            ${escapeHtml(mainTitle)}
          </h2>

          <div class="customer-contact">
            <span>
              담당자 ${escapeHtml(customerName)}
            </span>

            <span class="contact-divider">
              ·
            </span>

            <a
              href="tel:${escapeHtml(safePhone)}"
            >
              ${escapeHtml(phone)}
            </a>
          </div>
        </div>

        <div class="request-card-controls">
          ${deleteButton}

          <span
            class="status-badge ${statusClass}"
          >
            ${escapeHtml(status)}
          </span>
        </div>
      </div>

      <section class="problem-main-section">
        <div class="equipment-heading">
          <span class="equipment-label">
            설비 종류
          </span>

          <strong class="equipment-type">
            ${escapeHtml(equipmentLabel)}
          </strong>

          <span
            class="urgent-badge ${urgencyInfo.className}"
          >
            ${escapeHtml(urgencyInfo.label)}
          </span>
        </div>

        <button
          type="button"
          class="symptom-box text-preview-button"
          data-text-title="고장 내용"
          data-full-text="${escapeHtml(symptomText)}"
        >
          <span class="symptom-label">
            고장 내용
          </span>

          <span
            class="symptom-text text-preview-content"
          >
            ${escapeHtml(symptomText)}
          </span>

          <span class="view-full-text">
            전체보기
          </span>
        </button>

        ${
          requestNoteText
            ? `
              <button
                type="button"
                class="request-note-box text-preview-button"
                data-text-title="추가 요청사항"
                data-full-text="${escapeHtml(requestNoteText)}"
              >
                <span class="request-note-title">
                  추가 요청사항
                </span>

                <span
                  class="request-note-text text-preview-content"
                >
                  ${escapeHtml(requestNoteText)}
                </span>

                <span class="view-full-text">
                  전체보기
                </span>
              </button>
            `
            : ''
        }
      </section>

      <div class="visit-information">
        <div class="info-row">
          <span class="info-label">
            고객 희망 일정
          </span>

          <span class="info-value">
            ${escapeHtml(request.visit_time || '-')}
          </span>
        </div>

        <div class="info-row">
          <span class="info-label">
            현장 주소
          </span>

          <span class="info-value">
            ${escapeHtml(address)}
          </span>
        </div>
      </div>

      <section class="admin-visit-section">
        <div class="admin-visit-title">
          <strong>
            관리자 방문 예정
          </strong>

          <span class="admin-visit-current">
            ${escapeHtml(formatAdminVisitDate(request.admin_visit_at))}
          </span>
        </div>

        <div class="admin-visit-controls">
          <input
            type="datetime-local"
            class="admin-visit-input"
            data-request-id="${escapeHtml(request.id)}"
            value="${escapeHtml(toDatetimeLocalValue(request.admin_visit_at))}"
          />

          <button
            type="button"
            class="save-visit-button"
            data-request-id="${escapeHtml(request.id)}"
          >
            일정 저장
          </button>
        </div>
      </section>

      <div class="card-actions">
        <a
          class="action-button call-button"
          href="tel:${escapeHtml(safePhone)}"
        >
          전화 걸기
        </a>

        <a
          class="action-button map-button"
          href="tmap://search?name=${encodedAddress}"
          data-address="${escapeHtml(address)}"
        >
          티맵으로 보기
        </a>
      </div>

      <section class="request-photos">
        ${createImageGallery(
          '모터·펌프 명판 사진',
          nameplateImages,
          'nameplate',
        )}

        ${createImageGallery('이상 부위 사진', problemImages, 'problem')}
      </section>

      <div
        class="status-control ${statusClass}"
      >
        <label
          for="status-${escapeHtml(request.id)}"
        >
          처리 상태
        </label>

        <select
          id="status-${escapeHtml(request.id)}"
          class="status-select ${statusClass}"
          data-request-id="${escapeHtml(request.id)}"
          data-previous-status="${escapeHtml(status)}"
        >
          ${createStatusOptions(status)}
        </select>
      </div>
    </article>
  `;
}

/* 접수 카드 화면에 표시 */
function renderRequests() {
  const filteredRequests = getFilteredRequests();

  requestList.innerHTML = '';

  emptyMessage.classList.add('hidden');

  requestCount.textContent = `접수 ${filteredRequests.length}건`;

  summaryText.textContent = getSummaryMessage();

  const hasSearchText = currentSearchText.trim().length > 0;

  if (clearSearchButton) {
    clearSearchButton.classList.toggle('hidden', !hasSearchText);
  }

  if (searchResultText) {
    searchResultText.classList.toggle('hidden', !hasSearchText);

    if (hasSearchText) {
      searchResultText.textContent = `"${currentSearchText}" 검색 결과 ${filteredRequests.length}건`;
    } else {
      searchResultText.textContent = '';
    }
  }

  if (filteredRequests.length === 0) {
    emptyMessage.textContent = hasSearchText
      ? '검색 조건에 맞는 접수 내역이 없습니다.'
      : '해당하는 접수 내역이 없습니다.';

    emptyMessage.classList.remove('hidden');

    return;
  }

  requestList.innerHTML = filteredRequests.map(createRequestCard).join('');
}

/* 접수 목록 불러오기 */
async function loadRequests() {
  const adminKey = getAdminKey();

  errorMessage.classList.add('hidden');

  emptyMessage.classList.add('hidden');

  loadingMessage.classList.remove('hidden');

  refreshButton.disabled = true;

  refreshButton.textContent = '불러오는 중';

  if (!adminKey) {
    loadingMessage.classList.add('hidden');

    errorMessage.textContent = '올바른 관리자 링크로 접속해 주세요.';

    errorMessage.classList.remove('hidden');

    refreshButton.disabled = false;

    refreshButton.textContent = '새로고침';

    return;
  }

  try {
    const response = await fetch(
      `/api/requests?key=${encodeURIComponent(adminKey)}`,
      {
        method: 'GET',
        cache: 'no-store',
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || '접수 목록을 가져오지 못했습니다.');
    }

    allRequests = Array.isArray(result) ? result : [];

    loadingMessage.classList.add('hidden');

    renderRequests();
  } catch (error) {
    console.error('관리자 목록 오류:', error);

    loadingMessage.classList.add('hidden');

    errorMessage.textContent =
      error.message || '접수 목록을 불러오지 못했습니다.';

    errorMessage.classList.remove('hidden');
  } finally {
    refreshButton.disabled = false;

    refreshButton.textContent = '새로고침';
  }
}

/* 접수 상태 변경 */
async function updateRequestStatus(selectElement) {
  const adminKey = getAdminKey();

  const requestId = Number(selectElement.dataset.requestId);

  const previousStatus = selectElement.dataset.previousStatus;

  const newStatus = selectElement.value;

  if (!adminKey || !requestId) {
    alert('관리자 링크 또는 접수번호를 확인해 주세요.');

    selectElement.value = previousStatus;

    return;
  }

  selectElement.disabled = true;

  try {
    const response = await fetch(
      `/api/requests?key=${encodeURIComponent(adminKey)}`,
      {
        method: 'PATCH',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          id: requestId,
          status: newStatus,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || '처리 상태를 변경하지 못했습니다.');
    }

    const targetRequest = allRequests.find(
      (request) => Number(request.id) === requestId,
    );

    if (targetRequest) {
      targetRequest.status = newStatus;
    }

    renderRequests();
  } catch (error) {
    console.error('처리 상태 변경 오류:', error);

    alert(`${error.message}\n잠시 후 다시 시도해 주세요.`);

    selectElement.value = previousStatus;
  } finally {
    selectElement.disabled = false;
  }
}

/* 관리자 방문 일정 저장 */
async function saveAdminVisit(requestId, buttonElement) {
  const adminKey = getAdminKey();

  const input = requestList.querySelector(
    `.admin-visit-input[data-request-id="${requestId}"]`,
  );

  if (!adminKey || !requestId || !input) {
    alert('관리자 링크 또는 방문 일정 입력란을 확인해 주세요.');

    return;
  }

  if (!input.value) {
    alert('방문 예정 날짜와 시간을 선택해 주세요.');

    return;
  }

  buttonElement.disabled = true;

  buttonElement.textContent = '저장 중';

  try {
    const response = await fetch(
      `/api/requests?key=${encodeURIComponent(adminKey)}`,
      {
        method: 'PATCH',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          id: requestId,

          admin_visit_at: input.value,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || '방문 일정을 저장하지 못했습니다.');
    }

    const targetRequest = allRequests.find(
      (request) => Number(request.id) === Number(requestId),
    );

    if (targetRequest) {
      targetRequest.admin_visit_at = result.admin_visit_at;
    }

    renderRequests();

    alert('관리자 방문 일정이 저장되었습니다.');
  } catch (error) {
    console.error('방문 일정 저장 오류:', error);

    alert(`${error.message}\n잠시 후 다시 시도해 주세요.`);

    buttonElement.disabled = false;

    buttonElement.textContent = '일정 저장';
  }
}
/* 처리 완료 접수 삭제 */
async function deleteRequest(requestId) {
  const adminKey = getAdminKey();

  if (!adminKey || !requestId) {
    alert('관리자 링크 또는 접수번호를 확인해 주세요.');

    return;
  }

  const targetRequest = allRequests.find(
    (request) => Number(request.id) === Number(requestId),
  );

  if (!targetRequest) {
    alert('접수 내역을 찾지 못했습니다.');

    return;
  }

  if (normalizeStatus(targetRequest.status) !== '처리 완료') {
    alert('처리 완료 상태의 접수만 삭제할 수 있습니다.');

    return;
  }

  const problemInfo = parseProblemText(targetRequest.problem);

  const requestName =
    problemInfo.siteName ||
    targetRequest.customer_name ||
    `접수번호 #${requestId}`;

  const confirmed = window.confirm(
    `"${requestName}" 접수를 삭제하시겠습니까?\n\n접수 정보와 사진이 모두 영구 삭제되며 복구할 수 없습니다.`,
  );

  if (!confirmed) {
    return;
  }

  const deleteButton = requestList.querySelector(
    `.delete-request-button[data-request-id="${requestId}"]`,
  );

  if (deleteButton) {
    deleteButton.disabled = true;
    deleteButton.textContent = '…';
  }

  try {
    const response = await fetch(
      `/api/requests?key=${encodeURIComponent(
        adminKey,
      )}&id=${encodeURIComponent(requestId)}`,
      {
        method: 'DELETE',
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || '접수 내역을 삭제하지 못했습니다.');
    }

    allRequests = allRequests.filter(
      (request) => Number(request.id) !== Number(requestId),
    );

    renderRequests();

    alert(result.message || '접수 정보와 사진이 삭제되었습니다.');
  } catch (error) {
    console.error('접수 삭제 오류:', error);

    alert(`${error.message}\n잠시 후 다시 시도해 주세요.`);

    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.textContent = '×';
    }
  }
}

/* 사진 확대창 준비 */
function ensureImageModal() {
  let imageModal = document.getElementById('imageModal');

  /*
   * admin.html에 사진 확대창이 없는 경우
   * 자바스크립트에서 자동으로 생성한다.
   */
  if (!imageModal) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `
        <div
          id="imageModal"
          class="image-modal hidden"
          role="dialog"
          aria-modal="true"
          aria-label="사진 확대 보기"
        >
          <button
            type="button"
            id="closeImageModal"
            class="image-modal-close"
            aria-label="사진 닫기"
          >
            ×
          </button>

          <img
            id="modalImage"
            class="image-modal-content"
            src=""
            alt="확대된 접수 사진"
          />
        </div>
      `,
    );

    imageModal = document.getElementById('imageModal');
  }

  /*
   * 이벤트가 중복 연결되지 않도록
   * 한 번만 연결한다.
   */
  if (imageModal.dataset.eventsBound !== 'true') {
    const closeButton = imageModal.querySelector('#closeImageModal');

    if (closeButton) {
      closeButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        closeImageModal();
      });
    }

    /*
     * 사진 바깥의 검은 영역을 누르면 닫는다.
     */
    imageModal.addEventListener('click', function (event) {
      if (event.target === imageModal) {
        closeImageModal();
      }
    });

    /*
     * 휴대폰에서 손가락으로 밀기 시작한 위치
     */
    imageModal.addEventListener(
      'touchstart',
      function (event) {
        const touch = event.touches[0];

        imageTouchStartX = touch.clientX;

        imageTouchStartY = touch.clientY;
      },
      {
        passive: true,
      },
    );

    /*
     * 좌우로 70픽셀 이상 밀면 사진창 닫기
     */
    imageModal.addEventListener(
      'touchend',
      function (event) {
        if (imageTouchStartX === null || imageTouchStartY === null) {
          return;
        }

        const touch = event.changedTouches[0];

        const moveX = touch.clientX - imageTouchStartX;

        const moveY = touch.clientY - imageTouchStartY;

        imageTouchStartX = null;
        imageTouchStartY = null;

        if (Math.abs(moveX) >= 70 && Math.abs(moveX) > Math.abs(moveY)) {
          closeImageModal();
        }
      },
      {
        passive: true,
      },
    );

    imageModal.dataset.eventsBound = 'true';
  }

  return imageModal;
}

/* 사진 확대창 열기 */
function openImageModal(imageUrl) {
  const imageModal = ensureImageModal();

  const modalImage = document.getElementById('modalImage');

  if (!modalImage) {
    return;
  }

  modalImage.src = imageUrl;

  imageModal.classList.remove('hidden');

  document.body.classList.add('modal-open');
}

/* 사진 확대창 닫기 */
function closeImageModal() {
  const imageModal = document.getElementById('imageModal');

  const modalImage = document.getElementById('modalImage');

  if (!imageModal || !modalImage) {
    return;
  }

  imageModal.classList.add('hidden');

  modalImage.src = '';

  const textModal = document.getElementById('textModal');

  if (!textModal || textModal.classList.contains('hidden')) {
    document.body.classList.remove('modal-open');
  }
}

/* 고장 내용·추가 요청사항 전체보기 창 준비 */
function ensureTextModal() {
  let textModal = document.getElementById('textModal');

  if (!textModal) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `
        <div
          id="textModal"
          class="text-modal hidden"
          role="dialog"
          aria-modal="true"
          aria-label="내용 전체보기"
        >
          <div class="text-modal-box">
            <button
              type="button"
              id="closeTextModal"
              class="text-modal-close"
              aria-label="전체보기 닫기"
            >
              ×
            </button>

            <h2
              id="textModalTitle"
            ></h2>

            <div
              id="textModalContent"
              class="text-modal-content"
            ></div>
          </div>
        </div>
      `,
    );

    textModal = document.getElementById('textModal');
  }

  if (textModal.dataset.eventsBound !== 'true') {
    const closeButton = textModal.querySelector('#closeTextModal');

    if (closeButton) {
      closeButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        closeTextModal();
      });
    }

    /*
     * 흰색 내용창 바깥의 검은 영역을 누르면 닫기
     */
    textModal.addEventListener('click', function (event) {
      if (event.target === textModal) {
        closeTextModal();
      }
    });

    /*
     * 휴대폰 스와이프 시작 위치
     */
    textModal.addEventListener(
      'touchstart',
      function (event) {
        const touch = event.touches[0];

        textTouchStartX = touch.clientX;

        textTouchStartY = touch.clientY;
      },
      {
        passive: true,
      },
    );

    /*
     * 좌우로 밀면 전체보기 창 닫기
     */
    textModal.addEventListener(
      'touchend',
      function (event) {
        if (textTouchStartX === null || textTouchStartY === null) {
          return;
        }

        const touch = event.changedTouches[0];

        const moveX = touch.clientX - textTouchStartX;

        const moveY = touch.clientY - textTouchStartY;

        textTouchStartX = null;
        textTouchStartY = null;

        if (Math.abs(moveX) >= 70 && Math.abs(moveX) > Math.abs(moveY)) {
          closeTextModal();
        }
      },
      {
        passive: true,
      },
    );

    textModal.dataset.eventsBound = 'true';
  }

  return textModal;
}

/* 글 전체보기 창 열기 */
function openTextModal(title, content) {
  const textModal = ensureTextModal();

  const titleElement = document.getElementById('textModalTitle');

  const contentElement = document.getElementById('textModalContent');

  if (!titleElement || !contentElement) {
    return;
  }

  titleElement.textContent = title || '전체 내용';

  contentElement.textContent = content || '내용이 없습니다.';

  textModal.classList.remove('hidden');

  document.body.classList.add('modal-open');
}

/* 글 전체보기 창 닫기 */
function closeTextModal() {
  const textModal = document.getElementById('textModal');

  if (!textModal) {
    return;
  }

  textModal.classList.add('hidden');

  const imageModal = document.getElementById('imageModal');

  if (!imageModal || imageModal.classList.contains('hidden')) {
    document.body.classList.remove('modal-open');
  }
}
/* 상단 상태 필터 버튼 */
filterButtons.forEach((button) => {
  button.addEventListener('click', function () {
    currentFilter = button.dataset.filter;

    filterButtons.forEach((tabButton) => {
      tabButton.classList.toggle('active', tabButton === button);
    });

    renderRequests();
  });
});

/* 처리 상태 변경 */
requestList.addEventListener('change', function (event) {
  const statusSelect = event.target.closest('.status-select');

  if (!statusSelect) {
    return;
  }

  updateRequestStatus(statusSelect);
});

/* 카드 안 버튼 클릭 처리 */
requestList.addEventListener('click', function (event) {
  /* 고장 내용·추가 요청사항 전체보기 */
  const textPreviewButton = event.target.closest('.text-preview-button');

  if (textPreviewButton) {
    openTextModal(
      textPreviewButton.dataset.textTitle,
      textPreviewButton.dataset.fullText,
    );

    return;
  }

  /* 사진 확대 */
  const photoButton = event.target.closest('.photo-thumbnail-button');

  if (photoButton) {
    openImageModal(photoButton.dataset.imageUrl);

    return;
  }

  /* 처리 완료 접수 삭제 */
  const deleteButton = event.target.closest('.delete-request-button');

  if (deleteButton) {
    deleteRequest(Number(deleteButton.dataset.requestId));

    return;
  }

  /* 관리자 방문 일정 저장 */
  const saveVisitButton = event.target.closest('.save-visit-button');

  if (saveVisitButton) {
    saveAdminVisit(Number(saveVisitButton.dataset.requestId), saveVisitButton);

    return;
  }

  /* 티맵 열기 */
  const tmapButton = event.target.closest('.map-button');

  if (tmapButton) {
    event.preventDefault();

    const address = tmapButton.dataset.address;

    if (!address || address === '-') {
      alert('등록된 현장 주소가 없습니다.');

      return;
    }

    window.location.href = `tmap://search?name=${encodeURIComponent(address)}`;
  }
});

/* 검색창 입력 시 바로 검색 */
if (requestSearch) {
  requestSearch.addEventListener('input', function () {
    currentSearchText = requestSearch.value;

    renderRequests();
  });
}

/* 검색어 지우기 버튼 */
if (clearSearchButton) {
  clearSearchButton.addEventListener('click', function () {
    if (!requestSearch) {
      return;
    }

    requestSearch.value = '';
    currentSearchText = '';

    renderRequests();

    requestSearch.focus();
  });
}

/*
 * 검색창에서 ESC를 누르면
 * 검색어만 지운다.
 */
if (requestSearch) {
  requestSearch.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && requestSearch.value) {
      event.preventDefault();
      event.stopPropagation();

      requestSearch.value = '';
      currentSearchText = '';

      renderRequests();
    }
  });
}

/*
 * 문서 전체에서 ESC를 누르면
 * 사진창과 글 전체보기 창을 닫는다.
 */
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    closeImageModal();
    closeTextModal();
  }
});

/* 새로고침 버튼 */
refreshButton.addEventListener('click', loadRequests);

/* 팝업 준비 */
ensureImageModal();
ensureTextModal();

/* 최초 접수 목록 불러오기 */
loadRequests();
