// Supabase 프로젝트 정보
const SUPABASE_URL = 'https://fuskbopnxkeqjerslygm.supabase.co';

// 아래 따옴표 안에 복사한 Publishable Key를 붙여 넣으세요.
const SUPABASE_KEY = 'sb_publishable_eKuZ-Jn5cThnZhWFdxYCSQ_9Tn3GKD9';

// Supabase 연결
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 고객 접수 양식
const requestForm = document.getElementById('requestForm');

// 방문 일정 입력 요소
const visitDateInput = document.getElementById('visitDate');
const visitTimeInput = document.getElementById('visitTime');
const scheduleAnytimeInput = document.getElementById('scheduleAnytime');

// 접수 버튼
const submitButton = document.querySelector('.submit-button');

// 오늘 이전 날짜 선택 방지
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');

visitDateInput.min = `${year}-${month}-${day}`;

// 상시 방문 가능 체크
scheduleAnytimeInput.addEventListener('change', function () {
  if (scheduleAnytimeInput.checked) {
    visitDateInput.value = '';
    visitTimeInput.value = '';

    visitDateInput.disabled = true;
    visitTimeInput.disabled = true;

    visitDateInput.required = false;
    visitTimeInput.required = false;
  } else {
    visitDateInput.disabled = false;
    visitTimeInput.disabled = false;

    visitDateInput.required = true;
    visitTimeInput.required = true;
  }
});

// 접수 버튼을 눌렀을 때
requestForm.addEventListener('submit', async function (event) {
  event.preventDefault();

  // 중복 접수 방지
  submitButton.disabled = true;
  submitButton.textContent = '접수 중...';

  try {
    const siteName = document.getElementById('siteName').value.trim();
    const customerName = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const addressDetail = document.getElementById('addressDetail').value.trim();

    const equipmentType = document.getElementById('equipmentType').value;

    const symptom = document.getElementById('symptom').value.trim();

    const urgent =
      document.querySelector('input[name="urgent"]:checked')?.value || 'normal';

    const requestNote = document.getElementById('requestNote').value.trim();

    // 주소 합치기
    const fullAddress = addressDetail ? `${address} ${addressDetail}` : address;

    // 고장 정보 합치기
    const problemText = [
      `현장명: ${siteName}`,
      `설비 종류: ${equipmentType}`,
      `긴급 여부: ${urgent}`,
      `고장 증상: ${symptom}`,
      requestNote ? `추가 요청사항: ${requestNote}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // 방문 일정 합치기
    const visitSchedule = scheduleAnytimeInput.checked
      ? '업체 일정에 맞춰 상시 방문 가능'
      : `${visitDateInput.value} / ${visitTimeInput.value}`;

    // DB 저장
    const { error } = await supabaseClient.from('service_requests').insert({
      customer_name: customerName,
      phone: phone,
      address: fullAddress,
      visit_time: visitSchedule,
      problem: problemText,
      nameplate_image: null,
      problem_image: null,
      status: '접수완료',
    });

    if (error) {
      throw error;
    }

    alert('AS 접수가 완료되었습니다.\n확인 후 담당자가 연락드리겠습니다.');

    requestForm.reset();

    // 초기 상태 복구
    visitDateInput.disabled = false;
    visitTimeInput.disabled = false;
    visitDateInput.required = true;
    visitTimeInput.required = true;
  } catch (error) {
    console.error('접수 저장 오류:', error);

    alert('접수 저장 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'AS 접수하기';
  }
});
