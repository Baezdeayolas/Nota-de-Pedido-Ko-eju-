const CACHE_NAME = 'pedidos-koeju-v83';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './cloud-sync.js',
  './data.js',
  './clientes.js',
  './manifest.json',
  './Icons/icon-192.png',
  './Icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin &&
    (url.pathname.endsWith('/app.js') || url.pathname.endsWith('/cloud-sync.js') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/'));

  if (event.request.method !== 'GET') return;

  if (isAppShell) {
    // Preferir siempre la versión publicada; usar caché solo si no hay conexión.
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).catch(() => caches.match('./index.html'))
    )
  );
});
