// Cambiá este valor en cada release
const CACHE_VERSION = "stock-ia-v7-2026-02-23";
const CACHE_NAME = CACHE_VERSION;

// Archivos estáticos REALES que sí existen
const ASSETS = [
  "/styles_v2.css",
  "/scanner.css",
  "/app_core_v4.js",
  "/ui_engine_v4.js",
  "/orb_engine_v2.js",
  "/dashboard_engine.js",
  "/indicators_engine.js",
  "/orb_admin_engine.js",
  "/icons/icon-192-safe.png",
  "/icons/icon-512-safe.png",
  "/icons/icon-ios.png"
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH — Cache First para assets, Network First para HTML y JS dinámicos
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Nunca cachear cámara/video
  if (
    req.url.startsWith("blob:") ||
    req.destination === "video" ||
    req.destination === "media"
  ) {
    return;
  }

  // HTML SIEMPRE desde la red (para evitar versiones viejas)
  if (req.destination === "document") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // JS dinámico SIEMPRE desde la red
  if (req.destination === "script") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Assets estáticos → Cache First
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, networkResponse.clone());
            });
          }
          return networkResponse;
        })
      );
    })
  );
});
