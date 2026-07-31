const refreshButton = document.getElementById('refreshButton');
const requestCount = document.getElementById('requestCount');
const summaryText = document.getElementById('summaryText');
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const emptyMessage = document.getElementById('emptyMessage');
const requestList = document.getElementById('requestList');
const filterButtons = document.querySelectorAll('.filter-tab');

const STATUS_OPTIONS = [
  '신규 접수',
  '고객 연락 완료',
  '방문 예정',
  '수리 진행',
  '처리 완료',
];

let allRequests = [];
let currentFilter = 'active';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(dateString) {
  if (!dateString) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(dateString));
}

function getAdminKey() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('key');
}

function normalizeStatus(status) {
  if (!status || status === '접수완료') {
    return '신규 접수';
  }

  return status;
}

function getFilteredRequests() {
  if (currentFilter === 'completed') {
    return allRequests.filter(
      (request) => normalizeStatus(request.status) === '처리 완료',
    );
  }

  if (currentFilter === 'active') {
    return allRequests.filter(
      (request) => normalizeStatus(request.status) !== '처리 완료',
    );
  }

  return allRequests;
}

function getSummaryMessage() {
  if (currentFilter === 'completed') {
    return '처리가 끝난 접수도 삭제되지 않고 계속 보관됩니다.';
  }

  if (currentFilter === 'all') {
    return '진행 중과 처리 완료 접수를 모두 표시합니다.';
  }

  return '현재 확인하거나 방문해야 할 접수입니다.';
}

function createStatusOptions(currentStatus) {
  return STATUS_OPTIONS.map((status) => {
    const selected = status === currentStatus ? 'selected' : '';

    return `
      <option value="${escapeHtml(status)}" ${selected}>
        ${escapeHtml(status)}
      </option>
    `;
  }).join('');
}

function createRequestCard(request) {
  const status = normalizeStatus(request.status);

  const safePhone = String(request.phone ?? '').replace(/[^0-9+]/g, '');

  const mapAddress = encodeURIComponent(request.address ?? '');
  const isCompleted = status === '처리 완료';

  return `
    <article
      class="request-card ${isCompleted ? 'completed' : ''}"
      data-request-id="${escapeHtml(request.id)}"
    >
      <div class="request-card-top">
        <div>
          <p class="request-number">
            접수번호 #${escapeHtml(request.id)}
          </p>

          <h2 class="request-name">
            ${escapeHtml(request.customer_name || '이름 없음')}
          </h2>
        </div>

        <span
          class="status-badge ${isCompleted ? 'completed' : ''}"
        >
          ${escapeHtml(status)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">접수일시</span>

        <span class="info-value">
          ${escapeHtml(formatDate(request.created_at))}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">연락처</span>

        <span class="info-value">
          ${escapeHtml(request.phone || '-')}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">주소</span>

        <span class="info-value">
          ${escapeHtml(request.address || '-')}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">방문 일정</span>

        <span class="info-value">
          ${escapeHtml(request.visit_time || '-')}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">고장 내용</span>

        <span class="info-value">
          ${escapeHtml(request.problem || '-')}
        </span>
      </div>

      <div class="card-actions">
        <a
          class="action-button call-button"
          href="tel:${safePhone}"
        >
          전화 걸기
        </a>

        <a
          class="action-button map-button"
          href="https://map.kakao.com/link/search/${mapAddress}"
          target="_blank"
          rel="noopener noreferrer"
        >
          주소 보기
        </a>
      </div>

      <div class="status-control">
        <label for="status-${escapeHtml(request.id)}">
          처리 상태
        </label>

        <select
          id="status-${escapeHtml(request.id)}"
          class="status-select"
          data-request-id="${escapeHtml(request.id)}"
          data-previous-status="${escapeHtml(status)}"
        >
          ${createStatusOptions(status)}
        </select>
      </div>
    </article>
  `;
}

function renderRequests() {
  const filteredRequests = getFilteredRequests();

  requestList.innerHTML = '';
  emptyMessage.classList.add('hidden');

  requestCount.textContent = `접수 ${filteredRequests.length}건`;
  summaryText.textContent = getSummaryMessage();

  if (filteredRequests.length === 0) {
    emptyMessage.classList.remove('hidden');
    return;
  }

  requestList.innerHTML = filteredRequests.map(createRequestCard).join('');
}

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

    allRequests = result;
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

filterButtons.forEach((button) => {
  button.addEventListener('click', function () {
    currentFilter = button.dataset.filter;

    filterButtons.forEach((tabButton) => {
      tabButton.classList.toggle('active', tabButton === button);
    });

    renderRequests();
  });
});

requestList.addEventListener('change', function (event) {
  const statusSelect = event.target.closest('.status-select');

  if (!statusSelect) {
    return;
  }

  updateRequestStatus(statusSelect);
});

refreshButton.addEventListener('click', loadRequests);

loadRequests();
