import { create } from "zustand";

/** What the page asks of a worker (sw/sw.ts). */
const SKIP_WAITING = "skip-waiting";
const GET_BUILD = "get-build";
const SYNC_GAMES = "sync-games";

/** The cache the worker keeps the build in (sw/sw.ts). */
const CACHE = "alltp-tracker-precache";

/**
 * Mark a game as the one this device tracks, in the worker's cache: the
 * worker caches the shared shell and only the games so marked, so a player
 * of one game never downloads the others'. Done before the worker is
 * registered, so its first install already knows the game.
 * @param game - A game id (`games/registry.ts`)
 * @param base - The app's base path, where the worker's scope starts
 */
export const holdGame = async (game: string, base: string) => {
  const cache = await caches.open(CACHE);
  const key = new URL(`${base}__games__/${game}`, window.location.origin).href;
  if (!(await cache.match(key))) await cache.put(key, new Response(null));
};

/** How long a worker gets to say which build it serves. */
export const BUILD_REPLY_TIMEOUT_MS = 2000;

/** How often an open tracker checks for a new version. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

type UpdateState = {
  /** Set while a new version is ready: switches to it and reloads the page. */
  apply: (() => void) | null;
  /** What applying it does, on its button: the site reloads, the app restarts. */
  label: "Reload" | "Restart";
  /** Hide the notice. The new version still waits, for the next visit. */
  dismiss: () => void;
};

/**
 * Whether a new version of the tracker is ready. Kept apart from the game
 * store: nothing here is saved or undone.
 */
export const useUpdateStore = create<UpdateState>()((set) => ({
  apply: null,
  dismiss: () => set({ apply: null }),
  label: "Reload",
}));

const offer = (apply: () => void) => useUpdateStore.setState({ apply });

/** The build a worker serves, or null if it does not answer in time. */
const buildOf = (worker: ServiceWorker) =>
  new Promise<string | null>((resolve) => {
    const channel = new MessageChannel();
    const settle = (build: string | null) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(build);
    };
    const timer = setTimeout(() => settle(null), BUILD_REPLY_TIMEOUT_MS);
    channel.port1.onmessage = (event) => settle(String(event.data));
    worker.postMessage(GET_BUILD, [channel.port2]);
  });

type Options = {
  /** The build this page runs, from its index.html (sw/plugin.ts) */
  build: string;
  /** Marks the game this page runs for the worker (`holdGame`) */
  hold: () => Promise<void>;
  /** Reloads the page */
  reload: () => void;
  /** The worker script, at the root of the app so it controls all of it */
  url: string;
};

/**
 * Register the service worker, which keeps the tracker working offline, and
 * offer each version newer than the page without ever reloading on its own:
 * a run in progress is never interrupted, the player picks the moment.
 *
 * Which build a waiting worker serves decides. A page loaded from the network
 * (any reload while online, see sw/sw.ts) already runs the latest release:
 * the worker holding that same build takes over in silence, nothing to offer.
 * A page behind it, a tab left open or a copy started offline, is offered it.
 * On a first visit the worker installs and takes control, and that is all.
 *
 * The worker caches the games this page marks, one per device in practice
 * (see `holdGame`): the page marks its own before registering, then asks the
 * running worker to fetch what is missing, which is what happens when the
 * player has just switched to a game this device never tracked.
 *
 * Once the player accepts, the worker activates and the page that asked
 * reloads. Any other tab of the tracker then changes worker too: it keeps
 * running, and offers a reload only if it shows another build.
 */
export const registerServiceWorker = async (
  container: ServiceWorkerContainer,
  { build, hold, reload, url }: Options,
) => {
  let controlled = container.controller !== null;
  let accepted = false;

  const runsThisBuild = async (worker: ServiceWorker) =>
    (await buildOf(worker)) === build;

  container.addEventListener("controllerchange", () => {
    const switched = controlled;
    controlled = true;
    if (accepted) {
      reload();
      return;
    }
    const controller = container.controller;
    if (!switched || !controller) return;
    void runsThisBuild(controller).then((same) => {
      if (!same) offer(reload);
    });
  });

  const consider = async (worker: ServiceWorker) => {
    if (!controlled) return;
    if (await runsThisBuild(worker)) {
      worker.postMessage(SKIP_WAITING);
      return;
    }
    offer(() => {
      accepted = true;
      worker.postMessage(SKIP_WAITING);
    });
  };

  /** Consider a worker once it is installed and waiting, now or later. */
  const watch = (worker: ServiceWorker | null) => {
    if (!worker) return;
    const onState = () => {
      if (worker.state === "installed") void consider(worker);
    };
    onState();
    worker.addEventListener("statechange", onState);
  };

  // Storage that refuses leaves the worker with the shell alone: the tracker
  // then needs the network for its game, but still runs
  await hold().catch(() => undefined);
  const registration = await container.register(url);
  void container.ready
    .then((ready) => ready.active?.postMessage(SYNC_GAMES))
    .catch(() => undefined);
  // The browser checks for an update on every visit, maybe before the page
  // registers: a new version can already be waiting, or still installing
  watch(registration.waiting);
  watch(registration.installing);
  registration.addEventListener("updatefound", () =>
    watch(registration.installing),
  );
  return registration;
};

/**
 * Keep checking for a new version while the tracker stays open: every hour,
 * when its tab comes back into view, and when the network returns. A check
 * that fails, offline, waits for the next one.
 * @returns A function that stops checking
 */
export const checkForUpdates = (registration: ServiceWorkerRegistration) => {
  const check = () => {
    registration.update().catch(() => undefined);
  };
  const checkIfVisible = () => {
    if (document.visibilityState === "visible") check();
  };

  const timer = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", checkIfVisible);
  window.addEventListener("online", check);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", checkIfVisible);
    window.removeEventListener("online", check);
  };
};
