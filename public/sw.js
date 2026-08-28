/*
 * Nobi service worker — makes the app open without a network.
 *
 * The data layer already survives offline: notes are persisted to IndexedDB
 * and writes queue until the connection returns. What did not survive was the
 * app itself — the iOS shell and the browser both fetch the page over HTTPS,
 * so with no signal a student got an error page and none of their notes. That
 * is disqualifying for a notes app: lecture halls and basements are exactly
 * where notes get taken.
 *
 * Strategy, by request type:
 *   navigation  network-first, falling back to the last good shell. The
 *               server-rendered HTML is a generic loading state — the real UI
 *               is hydrated client-side — so a cached copy is not tied to any
 *               one user and is safe to replay.
 *   /assets/*   cache-first. Filenames are content-hashed, so a hit is always
 *               correct and a new deploy simply asks for new names.
 *   everything  passed straight through. Server functions and Supabase must
 *   else        never be served stale; a wrong answer about a student's own
 *               notes is worse than an honest failure.
 */

const VERSION = "nobi-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
// Any same-origin navigation can be answered with this.
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.add(SHELL_URL))
      // A failed precache must not block activation: the worker can still
      // fill its caches from ordinary traffic on the next load.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Cache-first: hashed assets never change under a given name. */
async function assetFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first: fresh page when online, last known shell when not. */
async function shellFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const cached = (await caches.match(SHELL_URL)) || (await caches.match(request));
    if (cached) return cached;
    throw new Error("offline and no cached shell");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Server functions carry live data and must not be answered from a cache.
  if (url.pathname.startsWith("/_serverFn")) return;

  if (request.mode === "navigate") {
    event.respondWith(shellFirst(request));
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/_build/")) {
    event.respondWith(assetFirst(request));
  }
});
