const CACHE_NAME = 'xianxia-mobile-v41';
const STATIC_ASSETS = [
  './',
  './manifest.json',
  './static/css/mobile.css',
  './static/js/db.js',
  './static/js/api.js',
  './static/js/mobile-app.js',
  './static/icons/icon.svg',
  './static/icons/icon-192.png',
  './static/icons/icon-512.png',
  './static/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // External APIs (Supabase) bypass the service worker completely
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Cache chapter illustration images on-demand for offline reading
  const isImageFile = /\.(jpe?g|png|gif|webp|svg)($|\?)/i.test(url.pathname);
  if (url.pathname.includes('/images/') && isImageFile) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          return new Response('', { status: 404, statusText: 'Image Not Found' });
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for static assets and shell
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
