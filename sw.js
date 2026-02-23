// Cambiá este valor en cada release
const CACHE_VERSION = "stock-ia-v3-2026-02-23";
const CACHE_NAME = CACHE_VERSION;

const ASSETS = [
  "/",
  "/index.html",
  "/styles_v2.css",
  "/app_core_v4.js",
  "/ui_engine_v4.js",
  "/orb_engine_v2.js",
  "/scanner.js",
  "/dashboard_engine.js",
  "/indicators_engine.js",
  "/orb_admin_engine.js",
  "/libs/zxing.js",
  "/icons/icon-192-safe.png",
  "/icons/icon-512-safe.png",
  "/icons/icon-ios.png"
];

// INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH — Stale While Revalidate
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
