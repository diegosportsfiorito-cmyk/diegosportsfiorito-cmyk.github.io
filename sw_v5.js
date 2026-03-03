// ============================================================
// IA PRO ULTRA — SERVICE WORKER V5 (GitHub Pages compatible)
// ============================================================

const CACHE_VERSION = "v5-20260302";
const STATIC_CACHE = `ia-pro-ultra-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ia-pro-ultra-runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles_v2.css",
  "./scanner.css",
  "./app_core_v5.js",
  "./ui_engine_v4.js",
  "./orb_engine_v2.js",
  "./orb_admin_engine.js",
  "./dashboard_engine.js",
  "./indicators_engine.js",
  "./scanner_v7_barcodeDetector.js",
  "./manifest.json",
];

// INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // No interceptar backend externo
  if (!req.url.startsWith(self.location.origin)) return;

  // HTML → network first
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // Otros → cache first
  event.respondWith(cacheFirst(req));
});

// Estrategias
async function networkFirst(req) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    return cached || cache.match("./index.html");
  }
}

async function cacheFirst(req) {
  const staticCache = await caches.open(STATIC_CACHE);
  const runtimeCache = await caches.open(RUNTIME_CACHE);

  const cached =
    (await staticCache.match(req)) || (await runtimeCache.match(req));

  if (cached) return cached;

  try {
    const res = await fetch(req);
    runtimeCache.put(req, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}
