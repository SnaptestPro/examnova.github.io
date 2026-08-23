const CACHE_NAME = 'savyasachi-v71-favicon-20260810';

// App-shell files — sab kuch jo student ko app chalane ke liye chahiye
// (code + question-bank data + icons). Pehli visit par yeh sab download
// ho kar device par (Cache Storage mein) save ho jaate hain.
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/favicon.ico',
  '/styles.css',
  '/theme-picker.css',
  '/creative-dashboard.css',
  '/script.js',
  '/upgrade.js',
  '/whatsapp-poll-export.js',
  '/student-features.js',
  '/omr.js',
  '/push-notifications.js',
  '/back-button-guard.js',
  '/subject-resolver.js',
  '/pdf-import.js',
  '/firebase-config.js',
  '/theme-palette.js',
  '/live-theme-effects.js',
  '/theme-manager.js',
  '/mathematics-question-bank.js',
  '/history-question-bank.js',
  '/History-India-question-bank.js',
  '/history-indochina-question-bank.js',
  '/socialism-question-bank.js',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/savyasachi-coaching-logo.png',
  '/manifest.webmanifest',
  '/screenshot-wide.jpg',
  '/screenshot-narrow.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        // Promise.allSettled use kiya hai (cache.addAll ki jagah) — taaki
        // agar in mein se koi EK file fetch fail ho (jaise koi optional
        // screenshot missing), to poora install fail na ho aur baaki
        // saari files phir bhi cache ho jaayein.
        Promise.allSettled(urlsToCache.map((url) => cache.add(url)))
      )
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

// STALE-WHILE-REVALIDATE strategy:
// ────────────────────────────────
// Pehle: "network-first" tha — matlab HAR file (chahe pehle se bilkul
// same ho) ke liye pehle network wait karna padta tha, tab jaake kuch
// bhi screen par dikhta tha. Isse app "load ho raha hai" jaisa mehsoos
// hota tha, khaaskar dheeme mobile network par.
//
// Ab: agar file device ke local cache mein already save hai, to woh
// TURANT (0ms wait, koi network round-trip nahi) return ho jaati hai —
// student ko app turant khula hua dikhta hai. Usi waqt background mein
// (parallel) ek fresh copy network se mangwa li jaati hai aur cache
// silently update kar di jaati hai — is turant response ka wait karke
// UI ko block nahi kiya jaata.
//
// Result: agli baar app kholne par (ya usi session mein dusri baar
// kisi file ki zaroorat padne par) turant naya/updated version milega,
// kyunki cache already background mein update ho chuka hota hai. Jaise
// hi koi change deploy hota hai aur student app ek baar bhi khol leta
// hai, usi waqt background download shuru ho jaata hai.
//
// Note: agar file cache mein hai hi nahi (bilkul pehli visit, ya koi
// naya URL), to obviously network ka wait karna padega — usse bachne
// ka koi tareeka nahi, lekin uske baad se woh file bhi turant milegi.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return; // POST etc. ko as-is jaane do

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request, { cache: 'no-store' })
          .then((networkResponse) => {
            // Sirf valid (ok) response hi cache mein save karo — 404/500
            // jaisi error-response ko cache karna future loads ko todd
            // sakta hai.
            if (networkResponse && networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline aur cache mein bhi kuch nahi mila — agar yeh ek
            // PAGE-navigation request thi (student ne pehli baar, bina
            // internet ke, app kholne ki koshish ki), to browser ka
            // default "can't connect" error dikhne ki jagah apna
            // friendly offline.html dikhao.
            if (cachedResponse) return cachedResponse;
            if (event.request.mode === 'navigate') return cache.match('/offline.html');
            return undefined;
          });

        // Cache mein already kuch mila -> USE IT INSTANTLY (turant
        // response), background update apni jagah chalta rahega.
        // Cache mein kuch nahi -> pehli baar hai, network ka wait karo.
        return cachedResponse || networkFetch;
      })
    )
  );
});

// ── Push Notifications (Firebase Cloud Messaging) ────────────────
// Handles a push arriving while the app/tab is closed or in the
// background. When the app is OPEN and in the foreground, Firebase's
// own firebase-messaging-compat.js delivers it straight to JS instead
// (no browser popup needed there) — this handler only covers the
// closed/background case, which is the whole point of a service worker.
// NOTE: this fires only once push-notifications.js has actually
// registered a token — see PUSH_NOTIFICATIONS_SETUP.md for the setup
// this depends on (VAPID key + the Cloud Function that sends pushes).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Savyasachi Coaching', body: event.data ? event.data.text() : '' }; }

  const title = data.title || data.notification?.title || 'Savyasachi Coaching';
  const body = data.body || data.notification?.body || 'Naya update aaya hai!';
  const url = data.url || data.data?.url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url }
    })
  );
});

// Clicking the notification focuses an already-open tab if there is
// one, otherwise opens a fresh one at the target URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
