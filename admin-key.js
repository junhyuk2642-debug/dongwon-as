const ADMIN_KEY_STORAGE_NAME =
  'dongwonMotorPumpAdminKey';

(function prepareAdminKey() {
  const currentUrl =
    new URL(window.location.href);

  const currentKey =
    currentUrl.searchParams.get('key');

  /*
   * 정상 관리자 링크로 접속하면
   * 이 휴대폰 브라우저에 관리자 키를 저장한다.
   */
  if (currentKey) {
    localStorage.setItem(
      ADMIN_KEY_STORAGE_NAME,
      currentKey,
    );

    return;
  }

  /*
   * 홈 화면 아이콘으로 실행했는데
   * 주소에 키가 없다면 저장된 키를 복원한다.
   */
  const savedKey =
    localStorage.getItem(
      ADMIN_KEY_STORAGE_NAME,
    );

  if (!savedKey) {
    return;
  }

  currentUrl.searchParams.set(
    'key',
    savedKey,
  );

  window.history.replaceState(
    {},
    '',
    currentUrl.toString(),
  );
})();