/**
 * The service worker: keeps every file of the build in the cache, so the
 * tracker loads and runs offline after its first visit.
 *
 * - install: fetch the files of this build that are not cached yet, and check
 *   each one against its hash. A file whose content did not change since the
 *   last version is kept as it is, so an update downloads only what changed.
 * - activate: drop the files no longer in the build, then control the pages.
 * - fetch: the page itself from the network first, so a reload shows the
 *   latest release; the cached copy when the network fails or is slow. Every
 *   other file from the cache, falling back to the network. A file only some
 *   players use (voice commands' engine) is cached the first time a page
 *   asks for it, not at install.
 *
 * A new version waits until a page asks it to take over (see
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

/**
 * The files of the build cached on first use rather than at install, as
 * [path, revision] (sw/plugin.ts).
 */
declare const __ON_DEMAND__: [path: string, revision: string][];

/** This build's id, also in its index.html (sw/plugin.ts). */
declare const __BUILD__: string;

/** What pages ask of a worker (src/stores/updateStore.ts). */
const SKIP_WAITING = "skip-waiting";
const GET_BUILD = "get-build";

/**
 * One cache for every version. Other projects of the same GitHub Pages site
 * share this origin and its caches: this name is the only one touched here.
 */
const CACHE = "alltp-tracker-precache";

/** How long a page load waits for the network before taking the cache. */
const NETWORK_TIMEOUT_MS = 3000;

/** The cache key of a file's revision, and the revision. */
const entryOf = ([path, revision]: [string, string]) =>
  [
    path,
    {
      // The cache key carries the revision: a file is fetched again only when
      // its content changed, and the previous version's copy stays served
      // until this one activates
      key: new URL(`${path}?__rev=${revision}`, scope.location.origin).href,
      revision,
    },
  ] as const;

/** Each file cached on first use, by its path. */
const onDemand = new Map(__ON_DEMAND__.map(entryOf));

/** Each precached file by its path, with the revision it must have. */
const files = new Map(__PRECACHE__.map(entryOf));

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
  const current = new Set(
    [...files.values(), ...onDemand.values()].map(({ key }) => key),
  );
  const stale = (await cache.keys()).filter(
    (request) => !current.has(request.url),
  );
  await Promise.all(stale.map((request) => cache.delete(request)));
};

/**
 * The page: the release on the server whenever it answers in time, so a
 * reload always shows the latest version; this build's copy when offline,
 * on an error, or past the timeout on a poor network.
 */
const loadPage = async (url: string, key: string) => {
  // Revalidated past the HTTP cache, where GitHub Pages keeps it ten minutes
  const network = fetch(url, { cache: "no-cache" }).then(
    // A navigation cannot be answered with a redirected response
    (response) => (response.ok && !response.redirected ? response : null),
    () => null,
  );
  const timeout = new Promise<null>((resolve) =>
    setTimeout(resolve, NETWORK_TIMEOUT_MS, null),
  );
  return (
    (await Promise.race([network, timeout])) ??
    (await caches.match(key, { cacheName: CACHE })) ??
    (await network) ??
    Response.error()
  );
};

/**
 * A file cached on first use: from the cache once there, else from the
 * network, kept for next time. Its name changes with its content (a Vite
 * asset), so a cached copy is never stale.
 */
const cacheOnFirstUse = async (request: Request, key: string) => {
  const cached = await caches.match(key, { cacheName: CACHE });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(key, response.clone());
  }
  return response;
};

scope.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

scope.addEventListener("activate", (event) => {
  // Claiming makes a first visit offline-ready without a reload. An update
  // gets here once a page asks for it, or once no page runs the previous
  // version any more.
  event.waitUntil(dropStaleFiles().then(() => scope.clients.claim()));
});

scope.addEventListener("message", (event) => {
  if (event.data === SKIP_WAITING) void scope.skipWaiting();
  if (event.data === GET_BUILD) event.ports[0]?.postMessage(__BUILD__);
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
  const lazy = onDemand.get(path);
  if (lazy) {
    event.respondWith(cacheOnFirstUse(request, lazy.key));
    return;
  }
  const file = files.get(path);
  if (!file) return;
  if (request.mode === "navigate" && path.endsWith("/index.html")) {
    event.respondWith(loadPage(request.url, file.key));
    return;
  }
  event.respondWith(
    caches
      .match(file.key, { cacheName: CACHE })
      .then((cached) => cached ?? fetch(request)),
  );
});
