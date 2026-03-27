const CACHE_NAME = "deetech-static-v15";
const OFFLINE_URL = "offline.html";
const SNAPSHOT_URL = "assets/data/products-snapshot.json";
const PLACEHOLDER_URL = "assets/img/placeholder.svg";

const PRECACHE_URLS = [
  "./",
  "index.html",
  OFFLINE_URL,
  "assets/css/style.css",
  "assets/css/header.css",
  "assets/css/footer.css",
  "assets/js/runtime-config.js",
  "assets/js/config.js",
  "assets/js/utils.js",
  "assets/js/main.js",
  "assets/js/cart.js",
  "assets/js/auth.js",
  "assets/js/account.js",
  "assets/js/affiliates.js",
  "assets/js/account-sidebar-profile.js",
  SNAPSHOT_URL,
  PLACEHOLDER_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        PRECACHE_URLS.map(async (entry) => {
          try {
            await cache.add(new Request(entry, { cache: "reload" }));
          } catch {
            return null;
          }
          return null;
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isProductApiRequest(url) {
  return /^\/api\/products(?:\/[^/]+)?\/?$/.test(url.pathname || "");
}

function isRealtimeCriticalAsset(url) {
  const p = url.pathname || "";
  return (
    p.endsWith("/checkout.html") ||
    p.endsWith("/thankyou.html") ||
    p.endsWith("/assets/js/checkout.js") ||
    p.endsWith("/assets/js/cart.js") ||
    p.endsWith("/assets/js/runtime-config.js") ||
    p.endsWith("/assets/js/config.js") ||
    p.endsWith("/assets/js/auth.js") ||
    p.endsWith("/assets/js/account.js") ||
    p.endsWith("/assets/js/affiliates.js") ||
    p.endsWith("/assets/js/account-sidebar-profile.js") ||
    p.endsWith("/assets/css/header.css") ||
    p.endsWith("/assets/css/footer.css")
  );
}

function isCacheableResponse(response) {
  return Boolean(response) && (response.ok || response.type === "opaque");
}

async function cachePutSafe(request, response) {
  try {
    if (!isCacheableResponse(response)) return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    return;
  }
}

async function loadSnapshotData() {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(new Request(SNAPSHOT_URL, { cache: "no-store" }));
    if (fresh && fresh.ok) {
      await cache.put(SNAPSHOT_URL, fresh.clone());
      return await fresh.json();
    }
  } catch {
    // fall through to cache
  }

  const cached = await cache.match(SNAPSHOT_URL);
  if (!cached) return null;
  try {
    return await cached.json();
  } catch {
    return null;
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function handleProductApiFallback(request, url) {
  try {
    const networkResponse = await fetch(request);
    if (!networkResponse || !networkResponse.ok) throw new Error(`HTTP ${networkResponse?.status || 0}`);
    await cachePutSafe(request, networkResponse.clone());
    return networkResponse;
  } catch {
    const snapshot = await loadSnapshotData();
    const products = Array.isArray(snapshot?.products) ? snapshot.products : [];

    if (url.pathname === "/api/products" || url.pathname === "/api/products/") {
      return jsonResponse(products, 200);
    }

    const id = decodeURIComponent((url.pathname.split("/").pop() || "").trim());
    const product = products.find((item) => String(item?._id || item?.id) === String(id));
    if (product) return jsonResponse(product, 200);

    const cached = await caches.match(request);
    if (cached) return cached;
    return jsonResponse({ message: "Product not found offline" }, 404);
  }
}

async function imageWithFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (isCacheableResponse(networkResponse)) {
      await cachePutSafe(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error("Image request not ok");
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const placeholder = await caches.match(PLACEHOLDER_URL);
    return placeholder || new Response("", { status: 204 });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isProductApiRequest(url)) {
    event.respondWith(handleProductApiFallback(request, url));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(imageWithFallback(request));
    return;
  }

  if (!isSameOrigin(url)) return;

  if (isRealtimeCriticalAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          cachePutSafe(request, networkResponse);
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || new Response("Offline", { status: 503, statusText: "Offline" });
        })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          cachePutSafe(request, networkResponse);
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || new Response("Offline", { status: 503, statusText: "Offline" });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          cachePutSafe(request, networkResponse);
          return networkResponse;
        })
        .catch(() => cached || new Response("Offline", { status: 503, statusText: "Offline" }));

      return cached || fetchPromise;
    })
  );
});






