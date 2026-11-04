/* Modo sin conexión: guarda la aplicación la primera vez que se abre y la sirve desde caché después. */
const CACHE = 'motioncomic-v2';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'src/styles.css', 'src/vendor/mp4-muxer.js', 'src/vendor/ag-psd.js', 'src/js/util.js', 'src/js/audio.js', 'src/js/psd.js', 'src/js/export.js', 'src/js/formats.js', 'src/js/db.js', 'src/js/render.js', 'src/js/sample.js', 'src/js/home.js', 'src/js/studio.js', 'src/js/main.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const u = new URL(e.request.url);
    if (res.ok && (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com/.test(u.host))) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match('index.html'))));
});
