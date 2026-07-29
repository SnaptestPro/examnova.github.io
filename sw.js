const CACHE_NAME = 'savyasachi-v67-autohardrefresh-20260727';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/upgrade.js',
  '/subject-resolver.js',
  '/icon-192.png',
  '/icon-512.png',
  '/savyasachi-coaching-logo.png',
  '/manifest.webmanifest',
  '/screenshot-wide.jpg',
  '/screenshot-narrow.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// NETWORK-FIRST strategy:
// Always try to fetch the latest file from the server first (when online).
// Only fall back to the cached copy if the network request fails (offline).
// This fixes mobile devices getting permanently stuck on an old cached
// version, since mobile browsers have no "hard refresh" option like desktop
// DevTools does.
self.addEventListener('fetch', (event) => {
  // Only handle GET requests; let everything else (POST etc.) pass through normally.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((networkResponse) => {
        // Save a fresh copy in cache for offline use later.
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResponse;
      })
      .catch(() => {
        // Offline (or network failed) -> fall back to whatever we have cached.
        return caches.match(event.request);
      })
  );
});
