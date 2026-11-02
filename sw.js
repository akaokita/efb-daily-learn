const CACHE = "efb-learn-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./cockpit.html",
  "./sop-trainer.html",
  "./css/app.css",
  "./css/cockpit.css",
  "./css/sop-trainer.css",
  "./js/app.js",
  "./js/cockpit.js",
  "./js/cockpit-boot.js",
  "./js/cockpit-scene.js",
  "./js/sop-trainer.js",
  "./js/cockpit-image-loader.js",
  "./js/cockpit-image-part0.js",
  "./js/cockpit-image-part1.js",
  "./js/cockpit-image-part2.js",
  "./js/cockpit-image-part3.js",
  "./js/cockpit-image-part4.js",
  "./js/cockpit-image-part5.js",
  "./js/cockpit-image-part6.js",
  "./js/cockpit-image-part7.js",
  "./js/cockpit-image-part8.js",
  "./js/cockpit-image-part9.js",
  "./js/cockpit-image-part10.js",
  "./js/cockpit-image-part11.js",
  "./js/cockpit-image-part12.js",
  "./js/cockpit-image-part13.js",
  "./js/vendor/three.module.js",
  "./data/lessons.json",
  "./data/cockpit-scenarios.json",
  "./data/sop-flow.json",
  "./assets/cockpit-company.jpg",
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
  // never cache cross-origin (Three CDN / Wikimedia)
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  const path = url.pathname;
  const networkFirst =
    req.mode === "navigate" ||
    path.endsWith(".html") ||
    path.endsWith(".js") ||
    path.endsWith(".json") ||
    path.endsWith(".css") ||
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
