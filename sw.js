const CACHE = "efb-learn-v11";
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
  "./js/cockpit-image-part14.js",
  "./js/cockpit-image-part15.js",
  "./js/cockpit-image-part16.js",
  "./js/cockpit-image-part17.js",
  "./js/cockpit-image-part18.js",
  "./js/cockpit-image-part19.js",
  "./js/cockpit-image-part20.js",
  "./js/cockpit-image-part21.js",
  "./js/cockpit-image-part22.js",
  "./js/cockpit-image-part23.js",
  "./js/cockpit-image-part24.js",
  "./js/cockpit-image-part25.js",
  "./js/cockpit-image-part26.js",
  "./js/cockpit-image-part27.js",
  "./js/cockpit-image-part28.js",
  "./js/cockpit-image-part29.js",
  "./js/cockpit-image-part30.js",
  "./js/cockpit-image-part31.js",
  "./js/cockpit-image-part32.js",
  "./js/cockpit-image-part33.js",
  "./js/cockpit-image-part34.js",
  "./js/cockpit-image-part35.js",
  "./js/cockpit-image-part36.js",
  "./js/cockpit-image-part37.js",
  "./js/cockpit-image-part38.js",
  "./js/cockpit-image-part39.js",
  "./js/cockpit-image-part40.js",
  "./js/cockpit-image-part41.js",
  "./js/cockpit-image-part42.js",
  "./js/cockpit-image-part43.js",
  "./js/cockpit-image-part44.js",
  "./js/cockpit-image-part45.js",
  "./js/cockpit-image-part46.js",
  "./js/cockpit-image-part47.js",
  "./js/cockpit-image-part48.js",
  "./js/cockpit-image-part49.js",
  "./js/cockpit-image-part50.js",
  "./js/cockpit-image-part51.js",
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
