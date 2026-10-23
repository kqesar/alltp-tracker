/** A persisted Zustand store, as far as following other tabs needs it. */
interface PersistedStore {
  persist: {
    getOptions: () => { name?: string };
    rehydrate: () => Promise<void> | void;
  };
}

/**
 * Follow the run when another tab or window of the tracker changes it — a
 * second screen, an OBS browser source — by reloading the store from
 * localStorage. Browsers fire `storage` only in the other documents, never in
 * the one that wrote, so two tabs cannot ping-pong. Every game's module
 * starts it with its own store.
 * @returns A function that stops listening
 */
export const syncAcrossTabs = (store: PersistedStore): (() => void) => {
  const key = store.persist.getOptions().name;

  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage || event.key !== key) return;
    void store.persist.rehydrate();
  };

  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
};
