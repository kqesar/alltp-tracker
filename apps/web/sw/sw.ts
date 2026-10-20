/**
 * The service worker: keeps the files of the build a device needs in the
 * cache, so the tracker loads and runs offline after its first visit.
 *
 * What a device needs is the shell (the page, the code and styles every game
 * shares, the icons) and each game it tracks. Each game is a chunk of its own
 * with its own art, and a player of one never loads another (see
 * src/games/registry.ts): caching all three would download megabytes nobody
 * uses. A page marks the game it runs in this cache before it registers the
 * worker (src/stores/updateStore.ts, `holdGame`); a game so marked is kept and
 * updated from then on, one never marked is never downloaded.
 *
 * - install: fetch the files of this build that are not cached yet, the
 *   shell's and those of the games marked, and check each one against its
 *   hash. A file whose content did not change since the last version is kept
 *   as it is, so an update downloads only what changed.
 * - sync-games (a page message): the same, for a game just marked, as when
 *   the player switches to a game this device never tracked. Online only: a
 *   game never opened while online does not exist offline.
 * - activate: drop the files no longer needed, then control the pages.
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
 * Every file of the shell as [path, revision], the revision being the start
 * of the file's SHA-256. The Vite plugin (sw/plugin.ts) writes it in once the
 * bundle is final, so a new build changes this script's bytes: that is how
 * the browser knows a new version exists.
 */
declare const __PRECACHE__: [path: string, revision: string][];

/** The files each game adds to the shell, by game id (sw/plugin.ts). */
declare const __GAMES__: Record<string, [path: string, revision: string][]>;

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
const SYNC_GAMES = "sync-games";

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

/** Each file of the shell by its path, with the revision it must have. */
const shell = new Map(__PRECACHE__.map(entryOf));

/** Each game's own files, the same way. */
const games = new Map(
  Object.entries(__GAMES__).map(([id, list]) => [
    id,
    new Map(list.map(entryOf)),
  ]),
);

/** Every file of the build, whichever game needs it, by its path. */
const files = new Map([
  ...shell,
  ...[...games.values()].flatMap((own) => [...own]),
]);

/**
 * The cache key standing for a game this device tracks. The page writes it
 * (`holdGame` in src/stores/updateStore.ts) before it registers this worker,
 * which therefore finds it at install, on the very first visit too. It is no
 * file: nothing ever fetches it.
 */
const GAME_KEY = new URL("__games__/", scope.registration.scope).href;

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

/** The games this device tracks, from the keys the pages left in the cache. */
const heldGames = (keys: readonly Request[]) =>
  keys
    .map((request) => request.url)
    .filter((url) => url.startsWith(GAME_KEY))
    .map((url) => url.slice(GAME_KEY.length))
    .filter((id) => games.has(id));

/** The files this device needs: the shell's, and those of the games it tracks. */
const needed = (keys: readonly Request[]) =>
  new Map([
    ...shell,
    ...heldGames(keys).flatMap((id) => [...(games.get(id) ?? [])]),
  ]);

/**
 * Fetch the files this device needs that are not cached yet.
 * @param mode - How the fetch treats the HTTP cache. An install goes past it,
 * which may still hold the previous build's copy of a file whose name does
 * not change. A game just switched to has had its files fetched by the page a
 * moment ago: revalidating them costs a "not modified", not a second download.
 */
const precache = async (mode: RequestCache) => {
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  const cached = new Set(keys.map((request) => request.url));
  await Promise.all(
    [...needed(keys)]
      .filter(([, { key }]) => !cached.has(key))
      .map(async ([path, { key, revision }]) => {
        const response = await fetch(path, { cache: mode });
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

/** The downloads in progress, one after the other so a file is fetched once. */
let downloading = Promise.resolve();
const download = (mode: RequestCache) => {
  downloading = downloading.catch(() => undefined).then(() => precache(mode));
  return downloading;
};

/**
 * Drop what this device no longer needs: the previous revisions of a file and
 * the games it does not track (the previous version cached every game).
 */
const dropStaleFiles = async () => {
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  const current = new Set(
    [...needed(keys).values(), ...onDemand.values()].map(({ key }) => key),
  );
  const stale = keys.filter(
    (request) => !current.has(request.url) && !request.url.startsWith(GAME_KEY),
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
  event.waitUntil(download("reload"));
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
  // A page just marked its game (a first visit's install has it already, a
  // switch to another game does not), or a version activated before its
  // download of a marked game ended: fetch whatever is missing
  if (event.data === SYNC_GAMES) event.waitUntil(download("no-cache"));
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
