
const CACHE_NAME = 'linguist-pro-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use silent failure for individual assets if needed to prevent entire install failure
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('PWA: Some assets failed to cache during install', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // STRICT CHECK: Only handle standard HTTP/HTTPS GET requests
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' || 
    !url.protocol.startsWith('http') ||
    url.hostname.includes('chrome-extension') // Avoid extension conflicts
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Only cache successful standard responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // If both network and cache fail, we return the cachedResponse (which might be undefined)
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
