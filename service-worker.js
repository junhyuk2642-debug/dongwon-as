const CACHE_NAME = 'dongwon-pwa-v1';

const STATIC_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',

  '/admin.html',
  '/admin.css',
  '/admin.js',

  '/manifest-customer.json',
  '/manifest-admin.json',

  '/customer-icon-192.png',
  '/customer-icon-512.png',
  '/customer-apple-touch-icon.png',

  '/admin-icon-192.png',
  '/admin-icon-512.png',
  '/admin-apple-touch-icon.png',
];

/*
 * 서비스 워커가 처음 설치될 때
 * 화면에 필요한 기본 파일을 저장한다.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES)),
  );

  self.skipWaiting();
});

/*
 * 새 버전이 활성화될 때
 * 이전 캐시를 삭제한다.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  );

  self.clients.claim();
});

/*
 * 네트워크 요청 처리
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  /*
   * GET 요청만 처리한다.
   * 접수 저장·수정·삭제 요청은 절대로 캐시하지 않는다.
   */
  if (request.method !== 'GET') {
    return;
  }

  /*
   * 관리자 API와 외부 서버 요청은
   * 항상 네트워크로 직접 보낸다.
   */
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    return;
  }

  /*
   * HTML 페이지는 네트워크를 먼저 확인한다.
   * 최신 화면을 가져오지 못할 때만 캐시를 사용한다.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseCopy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });

          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);

          if (cachedPage) {
            return cachedPage;
          }

          return caches.match('/index.html');
        }),
    );

    return;
  }

  /*
   * CSS, JS, 이미지 등은 캐시를 먼저 사용하고
   * 없으면 인터넷에서 가져온다.
   */
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseCopy = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseCopy);
        });

        return networkResponse;
      });
    }),
  );
});
