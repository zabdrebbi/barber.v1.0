/* Service Worker — إشعارات push + تخزين مؤقت للعمل دون اتصال */
const VERSION = 'v1';
const PRECACHE = `salon-precache-${VERSION}`;
const RUNTIME = `salon-runtime-${VERSION}`;

const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // لا نخزّن مسارات Supabase أو واجهات التتبّع الحيّة
  if (url.origin !== self.location.origin || url.pathname.startsWith('/rest/')) return;

  // التنقل: الشبكة أولاً ثم الكاش (وضع دون اتصال)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html'))),
    );
    return;
  }

  // الأصول: كاش أولاً ثم الشبكة
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        }),
    ),
  );
});

/* إشعارات النظام */
self.addEventListener('push', (event) => {
  let payload = { title: 'صالون الأناقة', body: 'لديك تحديث جديد' };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    /* نص خام */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'صالون الأناقة', {
      body: payload.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: { url: payload.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) if ('focus' in client) return client.focus();
      return clients.openWindow(url);
    }),
  );
});
