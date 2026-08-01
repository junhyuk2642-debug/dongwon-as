// Supabase 프로젝트 정보
const SUPABASE_URL = 'https://fuskbopnxkeqjerslygm.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_eKuZ-Jn5cThnZhWFdxYCSQ_9Tn3GKD9';

// Supabase 연결
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// 사진이 저장될 Storage 버킷 이름
const STORAGE_BUCKET = 'service-images';

// 고객 접수 양식
const requestForm = document.getElementById('requestForm');

// 방문 일정 입력 요소
const visitDateInput = document.getElementById('visitDate');
const visitTimeInput = document.getElementById('visitTime');
const scheduleAnytimeInput =
  document.getElementById('scheduleAnytime');

// 사진 입력 요소
const nameplatePhotoInput =
  document.getElementById('nameplatePhoto');

const problemPhotoInput =
  document.getElementById('problemPhoto');

// 접수 버튼
const submitButton =
  document.querySelector('.submit-button');

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

// 파일명에 사용할 수 없는 특수문자 정리
function cleanFileName(fileName) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

// 사진 여러 장 업로드 함수
async function uploadImages(files, folderName) {
  const imageUrls = [];

  for (const file of files) {
    // 이미지 파일이 아닌 경우 차단
    if (!file.type.startsWith('image/')) {
      throw new Error('이미지 파일만 업로드할 수 있습니다.');
    }

    // 파일 하나당 최대 10MB
    const maxFileSize = 10 * 1024 * 1024;

    if (file.size > maxFileSize) {
      throw new Error(
        `${file.name} 파일이 10MB를 초과했습니다.`
      );
    }

    const safeFileName = cleanFileName(file.name);

    // 같은 이름의 사진이 겹치지 않도록 고유 이름 생성
    const uniqueFileName =
      `${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;

    const filePath =
      `${folderName}/${uniqueFileName}`;

    // Supabase Storage에 업로드
    const { error: uploadError } =
      await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

    if (uploadError) {
      throw uploadError;
    }

    // 업로드된 사진의 공개 주소 생성
    const { data: publicUrlData } =
      supabaseClient.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    imageUrls.push(publicUrlData.publicUrl);
  }

  return imageUrls;
}

// 접수 버튼을 눌렀을 때
requestForm.addEventListener('submit', async function (event) {
  event.preventDefault();

  // 선택된 사진들
  const nameplateFiles =
    Array.from(nameplatePhotoInput.files);

  const problemFiles =
    Array.from(problemPhotoInput.files);

  // 필수 사진 검사
  if (nameplateFiles.length === 0) {
    alert('모터·펌프 명판 사진을 선택해 주세요.');
    return;
  }

  if (problemFiles.length === 0) {
    alert('이상 부위 사진을 선택해 주세요.');
    return;
  }

  // 중복 접수 방지
  submitButton.disabled = true;
  submitButton.textContent = '사진 업로드 중...';

  try {
    const siteName =
      document.getElementById('siteName').value.trim();

    const customerName =
      document.getElementById('customerName').value.trim();

    const phone =
      document.getElementById('phone').value.trim();

    const address =
      document.getElementById('address').value.trim();

    const addressDetail =
      document.getElementById('addressDetail').value.trim();

    const equipmentType =
      document.getElementById('equipmentType').value;

    const symptom =
      document.getElementById('symptom').value.trim();

    const urgent =
      document.querySelector(
        'input[name="urgent"]:checked'
      )?.value || 'normal';

    const requestNote =
      document.getElementById('requestNote').value.trim();

    // 주소 합치기
    const fullAddress = addressDetail
      ? `${address} ${addressDetail}`
      : address;

    // 고장 정보 합치기
    const problemText = [
      `현장명: ${siteName}`,
      `설비 종류: ${equipmentType}`,
      `긴급 여부: ${urgent}`,
      `고장 증상: ${symptom}`,
      requestNote
        ? `추가 요청사항: ${requestNote}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    // 방문 일정 합치기
    const visitSchedule =
      scheduleAnytimeInput.checked
        ? '업체 일정에 맞춰 상시 방문 가능'
        : `${visitDateInput.value} / ${visitTimeInput.value}`;

    // 각각 별도 폴더에 사진 업로드
    const requestFolder =
      `${Date.now()}-${crypto.randomUUID()}`;

    const nameplateImageUrls =
      await uploadImages(
        nameplateFiles,
        `${requestFolder}/nameplate`
      );

    const problemImageUrls =
      await uploadImages(
        problemFiles,
        `${requestFolder}/problem`
      );

    submitButton.textContent = '접수 내용 저장 중...';

    // DB 저장
    const { error: insertError } =
      await supabaseClient
        .from('service_requests')
        .insert({
          customer_name: customerName,
          phone: phone,
          address: fullAddress,
          visit_time: visitSchedule,
          problem: problemText,

          // 여러 주소를 JSON 문자열로 저장
          nameplate_image:
            JSON.stringify(nameplateImageUrls),

          problem_image:
            JSON.stringify(problemImageUrls),

          status: '접수완료',
        });

    if (insertError) {
      throw insertError;
    }

    alert(
      'AS 접수가 완료되었습니다.\n확인 후 담당자가 연락드리겠습니다.'
    );

    requestForm.reset();

    // 초기 상태 복구
    visitDateInput.disabled = false;
    visitTimeInput.disabled = false;

    visitDateInput.required = true;
    visitTimeInput.required = true;
  } catch (error) {
    console.error('접수 저장 오류:', error);

    alert(
      `접수 저장 중 오류가 발생했습니다.\n\n${error.message}`
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'AS 접수하기';
  }
});