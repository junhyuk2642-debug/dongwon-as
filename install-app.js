const installSection =
  document.getElementById('installSection');

const installAppButton =
  document.getElementById('installAppButton');

const iosInstallGuide =
  document.getElementById('iosInstallGuide');

let deferredInstallPrompt = null;

function isInstalledApp() {
  return (
    window.matchMedia(
      '(display-mode: standalone)',
    ).matches ||
    window.navigator.standalone === true
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(
    window.navigator.userAgent,
  );
}

function isSafariBrowser() {
  const userAgent =
    window.navigator.userAgent.toLowerCase();

  return (
    userAgent.includes('safari') &&
    !userAgent.includes('crios') &&
    !userAgent.includes('fxios')
  );
}

/*
 * 이미 설치된 상태라면 설치 영역을 숨긴다.
 */
if (isInstalledApp()) {
  installSection?.classList.add('hidden');
}

/*
 * 안드로이드 Chrome 등에서
 * 설치 가능한 상태가 되면 이벤트가 발생한다.
 */
window.addEventListener(
  'beforeinstallprompt',
  function (event) {
    event.preventDefault();

    deferredInstallPrompt = event;

    installSection?.classList.remove('hidden');

    if (installAppButton) {
      installAppButton.disabled = false;
      installAppButton.textContent =
        '앱 설치하기';
    }
  },
);

/*
 * 설치 버튼 클릭
 */
installAppButton?.addEventListener(
  'click',
  async function () {
    /*
     * 안드로이드 설치창 사용 가능
     */
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();

      const choice =
        await deferredInstallPrompt.userChoice;

      deferredInstallPrompt = null;

      if (
        choice.outcome === 'accepted'
      ) {
        installSection.classList.add(
          'hidden',
        );
      }

      return;
    }

    /*
     * 아이폰 Safari 안내
     */
    if (
      isIosDevice() &&
      isSafariBrowser()
    ) {
      iosInstallGuide.classList.remove(
        'hidden',
      );

      return;
    }

    alert(
      '브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해 주세요.',
    );
  },
);

/*
 * 설치 완료 시 영역 숨기기
 */
window.addEventListener(
  'appinstalled',
  function () {
    deferredInstallPrompt = null;

    installSection?.classList.add(
      'hidden',
    );
  },
);