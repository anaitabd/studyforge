const CACHE = "studyforge-v1";
const OFFLINE_URLS = ["/dashboard", "/groups", "/offline.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_URLS))
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Cache-first for static assets
  if (e.request.destination === "image" || e.request.destination === "font") {
    e.respondWith(
      caches.match(e.request).then(
        (r) =>
          r ||
          fetch(e.request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
            return res;
          })
      )
    );
    return;
  }

  // Network-first for API — fallback to cached
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(
        () =>
          caches.match(e.request).then(
            (r) =>
              r ||
              new Response(
                JSON.stringify({ error: "offline", cached: false }),
                { headers: { "Content-Type": "application/json" } }
              )
          )
      )
    );
    return;
  }

  // HTML pages — network first, fallback to offline page
  e.respondWith(
    fetch(e.request).catch(
      () => caches.match(e.request) || caches.match("/offline.html")
    )
  );
});
