const CACHE = 'finance-tracker-v5';
const ASSETS = ['./index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Network-first: always serve the latest deploy when online; fall back to
// the cache (kept fresh from the last successful fetch) only when offline.
// Only GET http(s) requests are cacheable — the Cache API rejects POST
// requests (e.g. Firestore's streaming channel) and chrome-extension:// URLs,
// so those are passed straight through without touching the cache.
self.addEventListener('fetch', e => {
  const req = e.request;
  const cacheable = req.method === 'GET' && req.url.startsWith('http');
  e.respondWith(
    fetch(req, {cache: 'no-store'}).then(res => {
      if (cacheable) {
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(req, resClone)).catch(() => {});
      }
      return res;
    }).catch(() => cacheable ? caches.match(req) : fetch(req))
  );
});
