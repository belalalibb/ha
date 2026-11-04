/* وسيلة — Service Worker بسيط: تخزين الملفات عشان تفتح من غير نت */
var CACHE = 'wasila-v6';
var FILES = [
  './',
  './index.html',
  './styles.css?v=6',
  './app.js?v=6',
  './data.js?v=6',
  './icons.js?v=6',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(FILES).catch(function () { /* لو ملف ناقص ما نكسرش التثبيت */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* الشبكة الأول (عشان أي تعديل يظهر فورًا)، والكاش بديل لو النت قطع */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
