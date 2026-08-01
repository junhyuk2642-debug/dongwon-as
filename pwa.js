/*
 * 동원모터펌프 PWA 서비스 워커 등록
 */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        '/service-worker.js',
        {
          scope: '/',
        },
      );

      console.log('앱 기능 등록 완료:', registration.scope);
    } catch (error) {
      console.error('앱 기능 등록 오류:', error);
    }
  });
}
