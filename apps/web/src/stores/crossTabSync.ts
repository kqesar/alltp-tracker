import { useGameStore } from "@/stores/gameStore";

/**
 * Follow the run when another tab or window of the tracker changes it — a
 * second screen, an OBS browser source — by reloading the store from
 * localStorage. Browsers fire `storage` only in the other documents, never in
 * the one that wrote, so two tabs cannot ping-pong.
 * @returns A function that stops listening
 */
export const syncAcrossTabs = (): (() => void) => {
  const key = useGameStore.persist.getOptions().name;

  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage || event.key !== key) return;
    void useGameStore.persist.rehydrate();
  };

  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
};
