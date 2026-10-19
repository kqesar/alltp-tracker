import { DEFAULT_SETTINGS } from "@alltp/pack-smz3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportSave,
  freshProgress,
  parseSave,
  SMZ3_STORAGE_KEY,
  useSmz3Store,
} from "@/games/smz3/store";

const store = () => useSmz3Store.getState();

beforeEach(() => {
  localStorage.clear();
  useSmz3Store.setState(useSmz3Store.getInitialState(), true);
});

describe("the SMZ3 run", () => {
  it("steps an item within its pool, wrapping both ways", () => {
    store().step("sword", 1);
    store().step("sword", 1);
    expect(store().items.sword).toBe(2);
    store().step("moonPearl", 1);
    store().step("moonPearl", 1);
    expect(store().items.moonPearl).toBe(0);
    store().step("eTank", -1);
    expect(store().items.eTank).toBe(14);
  });

  it("checks a marker's locations together, or none once all are", () => {
    store().toggleChecks(["links-house"]);
    store().toggleChecks(["links-house", "sanctuary"]);
    expect([...store().checked].sort()).toEqual(["links-house", "sanctuary"]);
    store().toggleChecks(["links-house", "sanctuary"]);
    expect(store().checked).toEqual([]);
  });

  it("changes its settings and pads as steps, only when they change", () => {
    store().setSettings({ smLogic: "hard" });
    store().setSettings({ smLogic: "hard" });
    store().setPad("mire", "ether");
    store().setPad("mire", "ether");
    expect(store().past).toHaveLength(2);
    expect(store().settings.smLogic).toBe("hard");
    expect(store().pads).toEqual({ mire: "ether", turtleRock: "unknown" });
  });

  it("starts a new game with its settings kept and the pads forgotten", () => {
    store().setSettings({ keysanity: true, towerCrystals: 5 });
    store().setPad("turtleRock", "quake");
    store().step("hammer", 1);
    store().toggleChecks(["links-house"]);
    store().reset();
    expect(store()).toMatchObject({
      checked: [],
      pads: { mire: "unknown", turtleRock: "unknown" },
      settings: { ...DEFAULT_SETTINGS, keysanity: true, towerCrystals: 5 },
    });
    expect(store().items.hammer).toBe(0);
  });

  it("undoes and redoes the player's changes", () => {
    store().step("bow", 1);
    store().toggleChecks(["mushroom"]);
    store().undo();
    expect(store().checked).toEqual([]);
    expect(store().items.bow).toBe(1);
    store().redo();
    expect(store().checked).toEqual(["mushroom"]);
    store().undo();
    store().undo();
    store().undo();
    store().redo();
    store().redo();
    store().redo();
    expect(store().future).toEqual([]);
  });

  it("is saved under its own key, and restored as saved", async () => {
    store().step("lamp", 1);
    const saved = JSON.parse(localStorage.getItem(SMZ3_STORAGE_KEY) ?? "{}");
    expect(saved.state.items.lamp).toBe(1);
    // A save from an older pool is completed; a damaged one is dropped
    localStorage.setItem(
      SMZ3_STORAGE_KEY,
      JSON.stringify({
        state: { ...saved.state, items: { lamp: 1 } },
        version: 1,
      }),
    );
    await useSmz3Store.persist.rehydrate();
    expect(store().items).toMatchObject({ lamp: 1, sword: 0 });
    localStorage.setItem(
      SMZ3_STORAGE_KEY,
      JSON.stringify({ state: { items: { lamp: 99 } }, version: 1 }),
    );
    useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    await useSmz3Store.persist.rehydrate();
    expect(store().items.lamp).toBe(0);
  });

  it("restores a saved run as the store is created", async () => {
    const progress = { ...freshProgress(), checked: ["links-house"] };
    localStorage.setItem(
      SMZ3_STORAGE_KEY,
      JSON.stringify({ state: progress, version: 1 }),
    );
    vi.resetModules();
    const fresh = await import("@/games/smz3/store");
    expect(fresh.useSmz3Store.getState().checked).toEqual(["links-house"]);
  });
});

describe("a save file", () => {
  it("round-trips through export and import", () => {
    store().step("flute", 1);
    const parsed = parseSave(exportSave(store()));
    expect(parsed).toMatchObject({ ok: true });
    if (parsed.ok) expect(parsed.progress.items.flute).toBe(1);
  });

  it.each([
    ["not JSON", "{", "not-json"],
    ["not a save", "{}", "not-a-save"],
    [
      "another game's",
      JSON.stringify({
        format: "alltp-tracker-save",
        game: "sm",
        progress: {},
        version: 1,
      }),
      "other-game",
    ],
    [
      "a newer version's",
      JSON.stringify({
        format: "alltp-tracker-save",
        game: "smz3",
        progress: {},
        version: 9,
      }),
      "newer-version",
    ],
    [
      "a count beyond the pool",
      JSON.stringify({
        format: "alltp-tracker-save",
        game: "smz3",
        progress: { ...freshProgress(), items: { sword: 9 } },
        version: 1,
      }),
      "invalid",
    ],
  ])("refuses %s", (_, text, error) => {
    expect(parseSave(text)).toEqual({ error, ok: false });
  });
});
