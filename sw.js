// ============================================================
// IA PRO ULTRA — SERVICE WORKER V4
// Cache estático + runtime, sin errores de clone()
// ============================================================

const CACHE_VERSION = "v4-20260228";
const STATIC_CACHE = `ia-pro-ultra-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ia-pro-ultra-runtime-${CACHE_VERSION}`;

// Ajustá esta lista según tus assets reales
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/styles_v2.css",
  "/img/bg-quantum-blur.png",
  "/img/bg-quantum-foreground.png",
  "/img/icon-192.png",
  "/img/icon-512.png",
];

// ============================================================
// INSTALL — Precarga de assets estáticos
// ============================================================

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — Limpieza de caches viejos
// ============================================================

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// FETCH — Estrategia:
//  - HTML: network-first con fallback a cache
//  - Otros: cache-first con fallback a network
// ============================================================

self.addEventListener("fetch", event => {
  const { request } = event;

  // Ignorar requests de otros protocolos
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // HTML / navegación → network-first
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(handleHTMLRequest(request));
    return;
  }

  // Otros recursos → cache-first
  event.respondWith(handleAssetRequest(request));
});

// ============================================================
// HANDLERS
// ============================================================

async function handleHTMLRequest(request) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const networkResponse = await fetch(request);
    // Clonamos ANTES de usar
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Fallback a index.html si no hay cache específico
    const fallback = await cache.match("/index.html");
    return fallback || Response.error();
  }
}

async function handleAssetRequest(request) {
  const staticCache = await caches.open(STATIC_CACHE);
  const runtimeCache = await caches.open(RUNTIME_CACHE);

  // 1) Intentar cache estático
  const cachedStatic = await staticCache.match(request);
  if (cachedStatic) return cachedStatic;

  // 2) Intentar cache runtime
  const cachedRuntime = await runtimeCache.match(request);
  if (cachedRuntime) return cachedRuntime;

  // 3) Network + guardar en runtime
  try {
    const networkResponse = await fetch(request);
    // Clonamos ANTES de usar
    runtimeCache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    return Response.error();
  }
}
