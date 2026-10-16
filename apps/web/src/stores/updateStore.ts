import { create } from "zustand";

/** The message that activates the waiting worker (sw/sw.ts). */
const SKIP_WAITING = "skip-waiting";

type UpdateState = {
  /** Set while a new version is ready: switches to it and reloads the page. */
  apply: (() => void) | null;
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
}));

const offer = (apply: () => void) => useUpdateStore.setState({ apply });

/**
 * Register the service worker, which keeps the tracker working offline, and
 * offer each new version it finds without ever reloading on its own: a run
 * in progress is never interrupted, the player picks the moment.
 *
 * A version is new only for a page some worker already controls. On a first
 * visit the worker installs, takes control (a `controllerchange`) and that is
 * all. Once the player accepts, the waiting worker activates, and the page
 * that asked reloads; another tab of the tracker that changes worker at that
 * moment keeps running and offers its own reload.
 *
 * @param container - `navigator.serviceWorker`
 * @param url - The worker script, at the root of the app so it controls it
 * @param reload - Reloads the page
 */
export const registerServiceWorker = async (
  container: ServiceWorkerContainer,
  url: string,
  reload: () => void,
) => {
  let controlled = container.controller !== null;
  let accepted = false;

  container.addEventListener("controllerchange", () => {
    const updated = controlled;
    controlled = true;
    if (accepted) reload();
    else if (updated) offer(reload);
  });

  /** Offer a worker once it is installed and waiting, now or later. */
  const watch = (worker: ServiceWorker | null) => {
    if (!worker) return;
    const offerIfWaiting = () => {
      if (worker.state !== "installed" || !controlled) return;
      offer(() => {
        accepted = true;
        worker.postMessage(SKIP_WAITING);
      });
    };
    offerIfWaiting();
    worker.addEventListener("statechange", offerIfWaiting);
  };

  const registration = await container.register(url);
  // The browser checks for an update on every visit, maybe before the page
  // registers: a new version can already be waiting, or still installing
  watch(registration.waiting);
  watch(registration.installing);
  registration.addEventListener("updatefound", () =>
    watch(registration.installing),
  );
};
