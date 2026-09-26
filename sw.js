/* Omni Oracle service worker — network-first runtime caching for offline support.
   No precache manifest to maintain: every successful same-origin (or jsdelivr)
   GET is cached; when the network is unavailable the cached copy is served.
   The cache name carries the asset version (kept in sync by scripts/bump.sh) so
   a deploy never mixes old JS with new HTML; assets match exactly (?v= included),
   only navigations fall back loosely to the cached shell. */
const CACHE = "omni-oracle-v32";

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
        caches.match(req).then((m) =>
          m || (req.mode === "navigate"
            ? caches.match(req, { ignoreSearch: true })
                .then((n) => n || caches.match("index.html", { ignoreSearch: true }))
            : Response.error())
        )
      )
  );
});
