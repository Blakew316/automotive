// Service worker: keeps the app shell and code cached so WPI Driveline Shop Management System opens
// instantly, works offline, and installs to the home screen. VERSION and PRECACHE are filled in at
// build time (vite.config.js).
const VERSION = 'dev';
const PRECACHE = [];

const SHELL = `app-shell-${VERSION}`;
const RUNTIME = 'app-runtime-v1';
const scope = self.registration.scope;
const INDEX = new URL('index.html', scope).href;
const precached = new Set(PRECACHE.map((f) => new URL(f, scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([INDEX, ...precached]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('app-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only this app's own files; shop cloud, NHTSA and payment sites go straight to the network.
  if (url.origin !== self.location.origin || !url.href.startsWith(scope)) return;

  if (req.mode === 'navigate') {
    // Network first, past the browser's HTTP cache (GitHub Pages lets it keep a page for 10 minutes),
    // so a new version shows on the next open; the cached shell when offline.
    event.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).catch(() => caches.match(INDEX)));
    return;
  }

  // The app asks for index.html to see whether a new version is out: always the server's copy.
  if (url.href === INDEX) {
    event.respondWith(fetch(req, { cache: 'no-cache' }).catch(() => caches.match(INDEX)));
    return;
  }

  if (precached.has(url.href)) {
    event.respondWith(caches.match(url.href).then((hit) => hit || fetch(req)));
    return;
  }

  // Vehicle database files, icons and anything else: serve from cache, refresh in the background.
  event.respondWith(
    caches.open(RUNTIME).then(async (cache) => {
      const hit = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || network;
    }),
  );
});
