/**
 * The service worker: keeps every file of the build in the cache, so the
 * tracker loads and runs offline after its first visit.
 *
 * - install: fetch the files of this build that are not cached yet, and check
 *   each one against its hash. A file whose content did not change since the
 *   last version is kept as it is, so an update downloads only what changed.
 * - activate: drop the files no longer in the build, then control the pages.
 * - fetch: answer from the cache, falling back to the network for anything
 *   else on this origin.
 *
 * A new version waits until the page asks it to take over (see
 * src/stores/updateStore.ts): the player picks the moment, never mid-run.
 */
// The worker lib types `self` as any worker; this file runs as a service worker
const scope = self as unknown as ServiceWorkerGlobalScope;

/**
 * Every file of the build as [path, revision], the revision being the start
 * of the file's SHA-256. The Vite plugin (sw/plugin.ts) writes it in once the
 * bundle is final, so a new build changes this script's bytes: that is how
 * the browser knows a new version exists.
 */
declare const __PRECACHE__: [path: string, revision: string][];

/** The page's request to activate the waiting version (updateStore.ts). */
const SKIP_WAITING = "skip-waiting";

/**
 * One cache for every version. Other projects of the same GitHub Pages site
 * share this origin and its caches: this name is the only one touched here.
 */
const CACHE = "alltp-tracker-precache";

/** Each precached file by its path, with the revision it must have. */
const files = new Map(
  __PRECACHE__.map(([path, revision]) => [
    path,
    {
      // The cache key carries the revision: a file is fetched again only when
      // its content changed, and the previous version's copy stays served
      // until this one activates
      key: new URL(`${path}?__rev=${revision}`, scope.location.origin).href,
      revision,
    },
  ]),
);

/** The start of the SHA-256 of a body, as the plugin computed it. */
const revisionOf = async (response: Response, length: number) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await response.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
};

const precache = async () => {
  const cache = await caches.open(CACHE);
  const cached = new Set((await cache.keys()).map((request) => request.url));
  await Promise.all(
    [...files]
      .filter(([, { key }]) => !cached.has(key))
      .map(async ([path, { key, revision }]) => {
        // Past the HTTP cache, which may still hold the previous build's copy
        const response = await fetch(path, { cache: "reload" });
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
        // A CDN can serve a stale copy for a while after a deploy: caching it
        // under this revision would keep it for good. Failing the install
        // instead lets the browser try again at its next update check.
        const actual = await revisionOf(response.clone(), revision.length);
        if (actual !== revision) throw new Error(`${path}: not this build`);
        await cache.put(key, response);
      }),
  );
};

const dropStaleFiles = async () => {
  const cache = await caches.open(CACHE);
  const current = new Set([...files.values()].map(({ key }) => key));
  const stale = (await cache.keys()).filter(
    (request) => !current.has(request.url),
  );
  await Promise.all(stale.map((request) => cache.delete(request)));
};

scope.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

scope.addEventListener("activate", (event) => {
  // Claiming makes a first visit offline-ready without a reload. An update
  // gets here once a page asks for it (and that page reloads), or once no
  // page runs the previous version any more.
  event.waitUntil(dropStaleFiles().then(() => scope.clients.claim()));
});

scope.addEventListener("message", (event) => {
  if (event.data === SKIP_WAITING) void scope.skipWaiting();
});

scope.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.location.origin) return;
  // A directory is its index.html, as the static host serves it
  const path = url.pathname.endsWith("/")
    ? `${url.pathname}index.html`
    : url.pathname;
  const file = files.get(path);
  if (!file) return;
  event.respondWith(
    caches
      .match(file.key, { cacheName: CACHE })
      .then((cached) => cached ?? fetch(request)),
  );
});
