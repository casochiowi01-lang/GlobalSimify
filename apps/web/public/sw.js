/* GlobalSimify service worker — offline shell + web push.
   Hand-written (no build step) for predictability. */
const CACHE = 'entrix-v3-public-only';

self.addEventListener('install', (event) => {
  // No route precaching — pages are cached as they're visited (see fetch
  // handler). Precaching navigations would trigger heavy work up front.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache API responses, authentication, account pages, order tokens or QR codes.
  if (url.origin !== self.location.origin || /^\/(api|account|admin|order|login|checkout)(\/|$)/.test(url.pathname) || url.searchParams.has('access') || req.headers.has('authorization')) return;

  // Navigations: network-first, fall back to cached shell (offline support).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !/no-store|private/i.test(res.headers.get('cache-control') || '')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((r) => r || caches.match('/offline') || caches.match('/')),
        ),
    );
    return;
  }

  // Cache only same-origin static assets; all other reads use the network.
  if (!url.pathname.startsWith('/_next/static/') && !url.pathname.startsWith('/icons/') && !/\.(webp|png|svg|jpg|woff2)$/.test(url.pathname)) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

// Web push: show the notification sent by the backend.
self.addEventListener('push', (event) => {
  let data = { title: 'GlobalSimify', body: '', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* non-JSON payload */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
