/* Modo sin conexión de MotionComic Studio.
   tools/pack.js reemplaza VERSION y CORE al preparar la carpeta de publicación; en desarrollo no guarda nada en caché. */
const VERSION = 'dev';
const CORE = /*CORE*/[];
const CACHE = 'motioncomic-' + VERSION;

self.addEventListener('install', (e) => {
  if (VERSION === 'dev') return;
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.concat(['./']))));
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('motioncomic-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (VERSION === 'dev' || req.method !== 'GET' || new URL(req.url).origin !== location.origin || /\/version\.json$/.test(new URL(req.url).pathname)) return;
  e.respondWith(caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./') : Response.error()))));
});
