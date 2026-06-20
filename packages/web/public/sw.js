/**
 * Service Worker for offline caching of static assets.
 * Enables the app to work offline after first visit.
 */

const CACHE_NAME = 'faces-of-plants-v3';
const STATIC_ASSETS = [
  '/',
  '/maps',
  '/education',
  '/about',
  '/auth/signin',
  '/auth/signup',
];

/**
 * Install event — cache static assets.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

/**
 * Activate event — clean up old caches.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch event — network-first for API calls, cache-first for static assets.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP(S) requests (chrome-extension://, etc.)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls: network-first (fall back to cache if offline)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('api.gbif.org')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets: cache-first (fall back to network)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Cache new static assets
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

/**
 * Handle messages from the main thread.
 */
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
