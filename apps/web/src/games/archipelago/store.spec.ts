import { beforeEach, describe, expect, it } from "vitest";
import { overlayReadingOf } from "@/games/archipelago/overlay";
import {
  AP_SAVE_VERSION,
  AP_STORAGE_KEY,
  type ApRoom,
  freshRun,
  sameRun,
  useArchipelagoStore,
} from "@/games/archipelago/store";

const ROOM: ApRoom = {
  checksum: "abc",
  game: "A Link to the Past",
  generatorVersion: "0.6.8",
  seedName: "4242",
  slot: 1,
  slotName: "Link",
  team: 0,
};

const run = () => useArchipelagoStore.getState();

beforeEach(() => {
  localStorage.clear();
  useArchipelagoStore.setState(useArchipelagoStore.getInitialState(), true);
});

describe("the Archipelago run", () => {
  it("takes the server's word and keeps the player's prefs", () => {
    run().setHideChecked(true);
    run().apply({
      ...freshRun(),
      items: [{ count: 2, flags: 1, name: "Progressive Sword" }],
      room: ROOM,
      updatedAt: 5,
    });
    expect(run().prefs.hideChecked).toBe(true);
    expect(run().items).toHaveLength(1);
    const saved = JSON.parse(localStorage.getItem(AP_STORAGE_KEY) ?? "");
    expect(saved.version).toBe(AP_SAVE_VERSION);
    expect(Object.keys(saved.state).sort()).toEqual(
      Object.keys(freshRun()).sort(),
    );
  });

  it("writes nothing when a pref does not change", () => {
    const before = localStorage.getItem(AP_STORAGE_KEY);
    run().setHideChecked(false);
    expect(localStorage.getItem(AP_STORAGE_KEY)).toBe(before);
  });

  it("restores a saved run, and drops one that does not hold", async () => {
    const saved = { ...freshRun(), room: ROOM, updatedAt: 1 };
    localStorage.setItem(
      AP_STORAGE_KEY,
      JSON.stringify({ state: saved, version: AP_SAVE_VERSION }),
    );
    await useArchipelagoStore.persist.rehydrate();
    expect(run().room).toEqual(ROOM);
    localStorage.setItem(
      AP_STORAGE_KEY,
      JSON.stringify({
        state: { ...saved, items: [{ count: 0, flags: 0, name: "x" }] },
        version: AP_SAVE_VERSION,
      }),
    );
    useArchipelagoStore.setState(useArchipelagoStore.getInitialState(), true);
    await useArchipelagoStore.persist.rehydrate();
    expect(run().room).toBeNull();
  });
});

describe("sameRun", () => {
  it("is the same seed, generator, team, slot and game", () => {
    expect(sameRun(ROOM, { ...ROOM, checksum: null, slotName: "x" })).toBe(
      true,
    );
    for (const change of [
      { seedName: "1" },
      { generatorVersion: "0.6.7" },
      { team: 1 },
      { slot: 2 },
      { game: "SMZ3" },
    ]) {
      expect(sameRun(ROOM, { ...ROOM, ...change })).toBe(false);
    }
  });
});

describe("the overlay's whitelist", () => {
  it("tells the items alone, by name", () => {
    const reading = overlayReadingOf({
      items: [{ count: 2, flags: 1, name: "Progressive Sword" }],
    });
    expect(reading).toEqual({
      fresh: false,
      state: {
        game: "archipelago",
        goMode: null,
        items: [
          {
            id: "Progressive Sword",
            level: 2,
            max: 2,
            name: "Progressive Sword",
          },
        ],
        objectives: [],
        timer: null,
      },
    });
    expect(overlayReadingOf({ items: [] }).fresh).toBe(true);
  });

  it("reads the store and follows it", async () => {
    const { overlaySource } = await import("@/games/archipelago/overlay");
    let calls = 0;
    const stop = overlaySource.subscribe(() => calls++);
    run().apply({
      ...freshRun(),
      items: [{ count: 1, flags: 0, name: "Bombs (3)" }],
      room: ROOM,
      updatedAt: 1,
    });
    stop();
    expect(calls).toBe(1);
    expect(overlaySource.read().state.items[0]?.id).toBe("Bombs (3)");
    // Nothing of the room reaches the API
    expect(JSON.stringify(overlaySource.read())).not.toContain("4242");
  });
});
