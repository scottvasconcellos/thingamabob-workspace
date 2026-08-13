/*
 * Minimal service worker: enough to make the app open offline, nothing more.
 *
 * It precaches only this app's own files. It deliberately never caches the
 * sync backend — stale checklist data served from a cache would be worse than
 * an honest "offline" status.
 *
 * THIS FILE MUST SIT NEXT TO index.html, not inside sync/. A service worker's
 * default scope is its own directory, so one served from sync/ could only ever
 * control sync/ and would never handle the page itself.
 */
var CACHE = 'tmb-v1';

var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './modules.config.json',
  './sync/tmb-sync.js',
  './sync/config.js',
  './sync/manifest.webmanifest',
  './sync/icons/icon-192.png',
  './sync/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // addAll is all-or-nothing; add individually so one missing optional
      // file can't stop the whole worker from installing.
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(url).catch(function (err) {
          console.warn('[sw] could not cache ' + url, err);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        return name === CACHE ? null : caches.delete(name);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // Only handle our own origin. Backend calls go straight to the network.
  if (url.origin !== self.location.origin) return;

  // Network-first, falling back to cache. That way an updated app is picked up
  // as soon as it is online, and it still opens on a plane.
  event.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
