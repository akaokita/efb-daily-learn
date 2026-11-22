const CACHE = "efb-learn-v17-offline";
const ASSETS = ["./", "./index.html", "./sop-trainer.html", "./cockpit.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      for (const url of ASSETS) {
        try { await c.add(url); } catch (err) {}
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
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(
      fetch("./index.html", { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  e.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req)));
});
