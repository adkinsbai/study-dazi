// Study-DaZi Service Worker
// Network-first for pages + API data, cache-first for static assets

const CACHE_STATIC = 'studydazi-static-v2';
const CACHE_API = 'studydazi-api-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ─── Install ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_API)
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // ═══ API data: network-first, cache fallback ═══
  if (url.pathname.startsWith('/api/')) {
    // Skip auth + write-sensitive endpoints
    const isReadonlyAPI = !url.pathname.includes('/auth/')
      && request.headers.get('Accept')?.includes('application/json');

    if (isReadonlyAPI) {
      event.respondWith(networkFirstAPI(request));
      return;
    }
    return; // auth / POST etc — network only
  }

  // ═══ Next.js internals: network only ═══
  if (url.pathname.startsWith('/_next/')) return;

  // ═══ Navigation (HTML pages): network-first with offline fallback ═══
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((c) => c || caches.match('/'))
      )
    );
    return;
  }

  // ═══ Static assets: cache-first ═══
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ─── Push ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Study-DaZi', body: event.data.text() };
  }

  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    tag: payload.tag || 'default',
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// ─── Notification click ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});

// ─── Helpers ──────────────────────────────────────
async function networkFirstAPI(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_API).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ offline: true, error: '当前离线' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}