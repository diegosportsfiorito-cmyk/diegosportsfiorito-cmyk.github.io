// Cambiá este valor en cada release para forzar actualización
const CACHE_VERSION = "stock-ia-v1-2026-02-23";
const CACHE_NAME = CACHE_VERSION;

const ASSETS = [
  "/",
  "/index.html",
  "/styles_v2.css",
  "/app_core_v4.js",
  "/ui_engine_v4.js",
  "/orb_engine_v2.js",
  "/scanner_v4.js",
  "/dashboard_engine.js",
  "/indicators_engine.js",
  "/orb_admin_engine.js",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://unpkg.com/@zxing/library@latest"
];

// INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
