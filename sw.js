// Cambiá este valor en cada release
const CACHE_VERSION = "stock-ia-v6-2026-02-23";
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

// FETCH — Stale While Revalidate (pero excluyendo video/cámara)
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 🚫 NO CACHEAR STREAM DE CÁMARA NI BLOB NI VIDEO
  if (
    req.url.startsWith("blob:") ||
    req.destination === "video" ||
    req.destination === "media" ||
    req.headers.get("accept")?.includes("video")
  ) {
    return; // dejar pasar directo
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
