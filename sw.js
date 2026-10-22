const CACHE = "efb-learn-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./data/lessons.json",
  "./manifest.webmanifest",
  "./icons/icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      for (const url of ASSETS) {
        try { await c.add(url); }
        catch (err) { console.warn("SW cache skip", url, err); }
      }
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const path = url.pathname;
  const networkFirst =
    req.mode === "navigate" ||
    path.endsWith(".html") ||
    path.endsWith(".js") ||
    path.endsWith(".json") ||
    path.endsWith("/") ||
    path.endsWith("efb-daily-learn");

  if (networkFirst) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((r) =>
      r ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
    )
  );
});
