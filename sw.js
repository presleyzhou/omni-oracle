/* Omni Oracle service worker — network-first runtime caching for offline support.
   No precache manifest to maintain: every successful GET is cached; when the
   network is unavailable, the last cached copy is served (ignoring ?v= params). */
const CACHE = "omni-oracle-runtime-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const cacheable = url.origin === self.location.origin || url.hostname === "cdn.jsdelivr.net";
  if (!cacheable) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((m) =>
          m || (req.mode === "navigate"
            ? caches.match("index.html", { ignoreSearch: true })
            : Response.error())
        )
      )
  );
});
