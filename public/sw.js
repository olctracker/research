// HEDB service worker: makes the app installable and lets the app shell open without a connection.
// Network first (so updates show up straight away), cached copy as a fallback.
// Only this site's own files are cached; database requests always go to the network.
const CACHE = "hedb-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Pages (index.html) always check the server for a newer version, skipping the phone's HTTP cache,
  // so updates show up as soon as the app is reopened. Hashed assets can use the normal cache.
  const fresh = req.mode === "navigate" || /\/(index\.html)?$/.test(new URL(req.url).pathname) || req.url.endsWith("sw.js");
  e.respondWith(
    fetch(fresh ? new Request(req, { cache: "no-cache" }) : req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
