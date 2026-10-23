import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { PERSIST_VERSION } from "@/games/alttpr/stores/persistence";
import { syncAcrossTabs } from "@/games/syncAcrossTabs";

const KEY = "alltp-tracker-state";

/** What another tab does: write its save, then the browser tells this tab. */
const otherTabSaves = (state: object, key = KEY) => {
  const value = JSON.stringify({ state, version: PERSIST_VERSION });
  localStorage.setItem(key, value);
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      newValue: value,
      storageArea: localStorage,
    }),
  );
};

/** Let the rehydration started by the event settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("syncAcrossTabs", () => {
  let stop: () => void;

  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
    stop = syncAcrossTabs(useGameStore);
  });

  afterEach(() => stop());

  it("takes the run another tab saved", async () => {
    otherTabSaves({ items: { hammer: true } });
    await settle();

    expect(useGameStore.getState().items.hammer).toBe(true);
  });

  it("clears this tab's undo history, which no longer matches the run", async () => {
    useGameStore.getState().handleItemClick("bow");

    otherTabSaves({ items: { bow: 3 } });
    await settle();

    expect(useGameStore.getState().past).toEqual([]);
    expect(useGameStore.getState().items.bow).toBe(3);
  });

  it("ignores changes to other storage keys", async () => {
    otherTabSaves({ items: { hammer: true } }, "something-else");
    await settle();

    expect(useGameStore.getState().items.hammer).toBe(false);
  });

  it("stops following once stopped", async () => {
    stop();

    otherTabSaves({ items: { hammer: true } });
    await settle();

    expect(useGameStore.getState().items.hammer).toBe(false);
  });
});
