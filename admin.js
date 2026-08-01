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

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(dateString));
}

/* 관리자 키 가져오기 */
function getAdminKey() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('key');
}

/* 기존 접수완료 값을 신규 접수로 통일 */
function normalizeStatus(status) {
  if (!status || status === '접수완료') {
    return '신규 접수';
  }

  return status;
}

/* 상태별 CSS 클래스 */
function getStatusClass(status) {
  const normalizedStatus = normalizeStatus(status);

  const statusClasses = {
    '신규 접수': 'status-new',
    '고객 연락 완료': 'status-contacted',
    '방문 예정': 'status-visit',
    '수리 진행': 'status-repair',
    '처리 완료': 'status-completed',
  };

  return statusClasses[normalizedStatus] || 'status-new';
}

/* DB에 합쳐서 저장된 고장 정보 분리 */
function parseProblemText(problemText) {
  const result = {
    siteName: '',
    equipmentType: '',
    urgent: '',
    symptom: '',
    requestNote: '',
  };

  const lines = String(problemText ?? '').split('\n');

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('현장명:')) {
      result.siteName = trimmedLine.replace('현장명:', '').trim();
    } else if (trimmedLine.startsWith('설비 종류:')) {
      result.equipmentType = trimmedLine.replace('설비 종류:', '').trim();
    } else if (trimmedLine.startsWith('긴급 여부:')) {
      result.urgent = trimmedLine.replace('긴급 여부:', '').trim();
    } else if (trimmedLine.startsWith('고장 증상:')) {
      result.symptom = trimmedLine.replace('고장 증상:', '').trim();
    } else if (trimmedLine.startsWith('추가 요청사항:')) {
      result.requestNote = trimmedLine.replace('추가 요청사항:', '').trim();
    }
  });

  /*
   * 예전 형식이라 구분 문구가 없을 경우
   * 전체 내용을 고장 증상으로 표시
   */
  if (!result.symptom && problemText) {
    result.symptom = String(problemText);
  }

  return result;
}

/* 사진 주소를 항상 배열로 변환 */
function parseImageUrls(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(stringValue);

    if (Array.isArray(parsedValue)) {
      return parsedValue.filter(Boolean);
    }

    if (typeof parsedValue === 'string') {
      return [parsedValue];
    }
  } catch (error) {
    /*
     * 과거 접수처럼 URL 한 개만 저장된 경우
     * 그대로 배열로 반환
     */
  }

  if (stringValue.startsWith('http://') || stringValue.startsWith('https://')) {
    return [stringValue];
  }

  return [];
}

/* 사진 썸네일 HTML 생성 */
function createImageGallery(title, imageUrls, type) {
  if (imageUrls.length === 0) {
    return `
      <div class="photo-section">
        <h3>${escapeHtml(title)}</h3>
        <p class="no-photo">등록된 사진이 없습니다.</p>
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
    <div class="photo-section photo-section-${escapeHtml(type)}">
      <div class="photo-section-header">
        <h3>${escapeHtml(title)}</h3>
        <span>${imageUrls.length}장</span>
      </div>

      <div class="photo-gallery">
        ${imagesHtml}
      </div>
    </div>
  `;
}

/* 현재 필터에 해당하는 접수 */
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
    return '처리 완료된 접수입니다. 필요한 접수만 선택하여 삭제할 수 있습니다.';
  }

  if (currentFilter === 'all') {
    return '진행 중인 접수와 처리 완료 접수를 모두 표시합니다.';
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

/* 접수 카드 생성 */
function createRequestCard(request) {
  const status = normalizeStatus(request.status);
  const statusClass = getStatusClass(status);
  const isCompleted = status === '처리 완료';

  const problemInfo = parseProblemText(request.problem);

  /*
   * 현장명이 있으면 현장명을 크게 표시하고,
   * 과거 접수처럼 현장명이 없으면 고객명을 대신 표시
   */
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
            <span class="customer-name">
              담당자 ${escapeHtml(customerName)}
            </span>

            <span class="contact-divider">·</span>

            <a href="tel:${escapeHtml(safePhone)}">
              ${escapeHtml(phone)}
            </a>
          </div>
        </div>

        <div class="request-card-controls">
          ${deleteButton}

          <span class="status-badge ${statusClass}">
            ${escapeHtml(status)}
          </span>
        </div>
      </div>

      <section class="problem-main-section">
        <div class="equipment-heading">
          <span class="equipment-label">설비 종류</span>

          <strong class="equipment-type">
            ${escapeHtml(problemInfo.equipmentType || '미입력')}
          </strong>

          ${
            problemInfo.urgent
              ? `
                <span class="urgent-badge">
                  ${escapeHtml(problemInfo.urgent)}
                </span>
              `
              : ''
          }
        </div>

        <div class="symptom-box">
          <p class="symptom-label">고장 내용</p>

          <p class="symptom-text">
            ${escapeHtml(problemInfo.symptom || '고장 내용 없음')}
          </p>
        </div>

        ${
          problemInfo.requestNote
            ? `
              <div class="request-note-box">
                <span>추가 요청사항</span>
                <p>${escapeHtml(problemInfo.requestNote)}</p>
              </div>
            `
            : ''
        }
      </section>

      <div class="visit-information">
        <div class="info-row">
          <span class="info-label">방문 일정</span>

          <span class="info-value">
            ${escapeHtml(request.visit_time || '-')}
          </span>
        </div>

        <div class="info-row address-row">
          <span class="info-label">현장 주소</span>

          <span class="info-value">
            ${escapeHtml(address)}
          </span>
        </div>
      </div>

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

      <div class="status-control ${statusClass}">
        <label for="status-${escapeHtml(request.id)}">
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

  const status = normalizeStatus(targetRequest.status);

  if (status !== '처리 완료') {
    alert('처리 완료 상태의 접수만 삭제할 수 있습니다.');
    return;
  }

  const problemInfo = parseProblemText(targetRequest.problem);

  const requestName =
    problemInfo.siteName ||
    targetRequest.customer_name ||
    `접수번호 #${requestId}`;

  const confirmed = window.confirm(
    `"${requestName}" 접수를 삭제하시겠습니까?\n\n삭제한 접수는 복구할 수 없습니다.`,
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
    alert('접수 내역이 삭제되었습니다.');
  } catch (error) {
    console.error('접수 삭제 오류:', error);

    alert(`${error.message}\n잠시 후 다시 시도해 주세요.`);

    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.textContent = '×';
    }
  }
}

/* 사진 확대창 만들기 */
function ensureImageModal() {
  let imageModal = document.getElementById('imageModal');

  if (imageModal) {
    return imageModal;
  }

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

  const closeButton = document.getElementById('closeImageModal');

  closeButton.addEventListener('click', closeImageModal);

  imageModal.addEventListener('click', function (event) {
    if (event.target === imageModal) {
      closeImageModal();
    }
  });

  return imageModal;
}

function openImageModal(imageUrl) {
  const imageModal = ensureImageModal();
  const modalImage = document.getElementById('modalImage');

  modalImage.src = imageUrl;
  imageModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeImageModal() {
  const imageModal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');

  if (!imageModal || !modalImage) {
    return;
  }

  imageModal.classList.add('hidden');
  modalImage.src = '';
  document.body.classList.remove('modal-open');
}

/* 필터 버튼 */
filterButtons.forEach((button) => {
  button.addEventListener('click', function () {
    currentFilter = button.dataset.filter;

    filterButtons.forEach((tabButton) => {
      tabButton.classList.toggle('active', tabButton === button);
    });

    renderRequests();
  });
});

/* 상태 변경 */
requestList.addEventListener('change', function (event) {
  const statusSelect = event.target.closest('.status-select');

  if (!statusSelect) {
    return;
  }

  updateRequestStatus(statusSelect);
});

/* 사진 확대, 접수 삭제, 티맵 실행 */
requestList.addEventListener('click', function (event) {
  const photoButton = event.target.closest('.photo-thumbnail-button');

  if (photoButton) {
    openImageModal(photoButton.dataset.imageUrl);
    return;
  }

  const deleteButton = event.target.closest('.delete-request-button');

  if (deleteButton) {
    deleteRequest(Number(deleteButton.dataset.requestId));
    return;
  }

  const tmapButton = event.target.closest('.map-button');

  if (tmapButton) {
    /*
     * 모바일 브라우저에서 tmap:// 주소를 통해
     * 티맵 앱의 주소 검색을 실행한다.
     */
    event.preventDefault();

    const address = tmapButton.dataset.address;

    if (!address || address === '-') {
      alert('등록된 현장 주소가 없습니다.');
      return;
    }

    window.location.href = `tmap://search?name=${encodeURIComponent(address)}`;
  }
});

/* ESC 키로 사진 닫기 */
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    closeImageModal();
  }
});

refreshButton.addEventListener('click', loadRequests);

ensureImageModal();
loadRequests();
