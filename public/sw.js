/* Shoebox service worker: keeps photos you've already seen on the phone, and an offline page. */
const VERSION = "v1";
const SHELL = `shoebox-shell-${VERSION}`;
const PHOTOS = "shoebox-photos"; // not versioned: photo files never change, so they survive app updates
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/apple-touch-icon.png"];
const MAX_PHOTOS = 2500;

// Don't cache app code on localhost so dev builds never serve stale chunks.
const IS_DEV = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("shoebox-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Signed photo URLs carry a token that changes every time we sign, so the
// cache key is just the file's path.
function photoKey(url) {
  return url.origin + url.pathname;
}

let puts = 0;
async function trimPhotos() {
  const c = await caches.open(PHOTOS);
  const keys = await c.keys();
  const extra = keys.length - MAX_PHOTOS;
  // oldest first (insertion order)
  for (let i = 0; i < extra; i++) await c.delete(keys[i]);
}

async function photo(url) {
  const c = await caches.open(PHOTOS);
  const key = photoKey(url);
  const hit = await c.match(key);
  if (hit) return hit;
  const res = await fetch(url.href, { mode: "cors", credentials: "omit" });
  if (res.ok && res.type === "cors") {
    await c.put(key, res.clone());
    if (++puts % 40 === 0) trimPhotos().catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.pathname.startsWith("/storage/v1/object/sign/collage/")) {
    e.respondWith(photo(url).catch(() => fetch(req)));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Pages: always try the network so boards are fresh; offline gets a friendly page.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (IS_DEV) return;

  // Next's build output is content-hashed and never changes, and icons rarely do.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.open(SHELL).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
  }
});
