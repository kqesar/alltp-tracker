import { beforeEach, describe, expect, it } from "vitest";
import { itemsMax } from "@/games/alttpr/data/items";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import { IDLE_TIMER, startTimer } from "@/games/alttpr/logic/timer";
import {
  type AlttprRun,
  OVERLAY_ITEMS,
  OVERLAY_OBJECTIVES,
  overlayReadingOf,
  overlaySource,
} from "@/games/alttpr/overlay";
import { createProgress, useGameStore } from "@/games/alttpr/stores/gameStore";

const runOf = (changes: Partial<AlttprRun> = {}): AlttprRun => ({
  ...createProgress(),
  timeline: {},
  timer: IDLE_TIMER,
  ...changes,
});

const withItems = (items: Record<string, number | boolean>): AlttprRun => {
  const run = runOf();
  return { ...run, items: { ...run.items, ...items } };
};

/**
 * Every id the API may show, pinned: changing a list is a decision about what
 * a stream may see, so it has to show up in a diff of this file.
 */
const ITEM_IDS = [
  "flute",
  "hookshot",
  "hammer",
  "firerod",
  "icerod",
  "boomerang",
  "net",
  "bow",
  "lamp",
  "shield",
  "sword",
  "tunic",
  "halfMagic",
  "boots",
  "shovel",
  "book",
  "quake",
  "bombos",
  "ether",
  "powder",
  "glove",
  "bottle",
  "somaria",
  "byrna",
  "mushroom",
  "cape",
  "mirror",
  "moonPearl",
  "flippers",
];

const OBJECTIVE_NAMES = [
  ["boss0", "Eastern Palace"],
  ["boss1", "Desert Palace"],
  ["boss2", "Tower of Hera"],
  ["boss3", "Palace of Darkness"],
  ["boss4", "Swamp Palace"],
  ["boss5", "Skull Woods"],
  ["boss6", "Thieves' Town"],
  ["boss7", "Ice Palace"],
  ["boss8", "Misery Mire"],
  ["boss9", "Turtle Rock"],
  ["agahnim", "Castle Tower"],
  ["agahnim2", "Ganon's Tower"],
];

describe("A Link to the Past's overlay reading", () => {
  it("names exactly the items the API may show, in the grid's order", () => {
    expect(OVERLAY_ITEMS.map(([id]) => id)).toEqual(ITEM_IDS);
    const { state } = overlayReadingOf(runOf());
    expect(state.items.map((item) => item.id)).toEqual(ITEM_IDS);
    expect(new Set(ITEM_IDS).size).toBe(ITEM_IDS.length);
  });

  it("names the goals by their dungeons, twelve of them", () => {
    const { state } = overlayReadingOf(runOf());
    expect(state.objectives.map(({ id, name }) => [id, name])).toEqual(
      OBJECTIVE_NAMES,
    );
    expect(OVERLAY_OBJECTIVES).toHaveLength(12);
  });

  it("reads each item's level and range as the tracker keeps them", () => {
    const run = withItems({
      boomerang: 3,
      bottle: 3,
      bow: 2,
      flute: true,
      glove: 2,
      magic: 2,
      sword: 4,
    });
    const { state } = overlayReadingOf(run);
    const item = (id: string) => state.items.find((i) => i.id === id);

    expect(item("flute")).toMatchObject({ level: 1, max: 1, name: "Flute" });
    expect(item("hookshot")).toMatchObject({ level: 0, max: 1 });
    expect(item("bottle")).toMatchObject({ level: 3, max: 4 });
    // A mask: 2 is the bow, 1 the silver arrows
    expect(item("bow")).toMatchObject({ level: 2, max: 3 });
    expect(item("boomerang")).toMatchObject({ level: 3, max: 3 });
    expect(item("sword")).toMatchObject({ level: 4, max: 4 });
    expect(item("glove")).toMatchObject({ level: 2, max: 2 });
    // The tunic starts as the green mail
    expect(item("tunic")).toMatchObject({ level: 1, max: 3 });
    // A quarter magic reads as the half, as the board draws it
    expect(item("halfMagic")).toMatchObject({
      level: 1,
      max: 1,
      name: "Half Magic",
    });
    expect(item("lamp")?.name).toBe("Lantern");
  });

  it("keeps every level within its max", () => {
    const full = Object.fromEntries(
      OVERLAY_ITEMS.map(([, key]) => [key, itemsMax[key] ?? true]),
    );
    const { state } = overlayReadingOf(withItems(full));
    for (const item of state.items) {
      expect(item.level, item.id).toBeLessThanOrEqual(item.max);
      expect(item.level, item.id).toBe(item.max);
    }
  });

  it("reads a boss as done once beaten, with the time the timeline gave it", () => {
    const run = {
      ...withItems({ agahnim: 1, boss3: 2, boss4: 1 }),
      timeline: {
        "item:agahnim:1": { at: 5, ms: 61_000 },
        "item:boss3:2": { at: 9, ms: null },
      },
    };
    const { state } = overlayReadingOf(run);
    const goal = (id: string) => state.objectives.find((o) => o.id === id);

    expect(goal("boss3")).toMatchObject({ done: true, ms: null });
    expect(goal("agahnim")).toMatchObject({ done: true, ms: 61_000 });
    // 1 is a boss alive, as a fresh run has it
    expect(goal("boss4")).toMatchObject({ done: false, ms: null });
    expect(goal("agahnim2")).toMatchObject({ done: false });
  });

  it("hands the timer over as data a client counts itself", () => {
    expect(overlayReadingOf(runOf()).state.timer).toEqual({
      elapsedMs: 0,
      startedAt: null,
      state: "idle",
    });
    const running = startTimer(IDLE_TIMER, 1_000);
    expect(overlayReadingOf(runOf({ timer: running })).state.timer).toEqual({
      elapsedMs: 0,
      startedAt: 1_000,
      state: "running",
    });
    expect(
      overlayReadingOf(
        runOf({ timer: { elapsedMs: 9_000, finished: true, startedAt: null } }),
      ).state.timer,
    ).toEqual({ elapsedMs: 9_000, startedAt: null, state: "finished" });
  });

  describe("fresh", () => {
    it("is a run as it starts, the timer idle", () => {
      expect(overlayReadingOf(runOf()).fresh).toBe(true);
    });

    it("is not once anything is found, done or timed", () => {
      expect(overlayReadingOf(withItems({ hookshot: true })).fresh).toBe(false);
      expect(overlayReadingOf(withItems({ tunic: 2 })).fresh).toBe(false);
      expect(overlayReadingOf(withItems({ boss0: 2 })).fresh).toBe(false);
      expect(
        overlayReadingOf(runOf({ timer: startTimer(IDLE_TIMER, 1) })).fresh,
      ).toBe(false);
    });

    it("ignores what the whitelist does not read", () => {
      const run = withItems({ bigkey0: 1, chest0: 0, map0: 1, reward1: 3 });
      expect(overlayReadingOf({ ...run, smallKeys: [1, 2, 3] }).fresh).toBe(
        true,
      );
    });
  });

  describe("go mode", () => {
    const settingsOf = (changes: Partial<RunSettings>): RunSettings => ({
      ...getPreset("open").settings,
      ...changes,
    });

    it("says where the run stands against it", () => {
      expect(overlayReadingOf(runOf()).state.goMode).toBe("no");
    });

    it("is null for a goal that has none", () => {
      for (const goal of ["all-dungeons", "triforce-hunt"] as const) {
        const run = runOf({ settings: settingsOf({ goal }) });
        expect(overlayReadingOf(run).state.goMode, goal).toBeNull();
      }
    });

    it("is null while a Mystery run's goal is not known yet", () => {
      const run = runOf({ settings: getPreset("mystery").settings });
      expect(overlayReadingOf(run).state.goMode).toBeNull();
    });

    it("is null for a run whose logic the pack does not model", () => {
      const run = runOf({ settings: getPreset("crosskeys").settings });
      expect(overlayReadingOf(run).state.goMode).toBeNull();
    });
  });

  describe("the store", () => {
    beforeEach(() => {
      localStorage.clear();
      useGameStore.setState(useGameStore.getInitialState(), true);
    });

    it("reads the run the store holds, and tells of a change", () => {
      let changes = 0;
      const stop = overlaySource.subscribe(() => {
        changes++;
      });
      expect(overlaySource.read().state.items[1]).toMatchObject({
        id: "hookshot",
        level: 0,
      });

      useGameStore.getState().handleItemClick("hookshot");

      expect(changes).toBeGreaterThan(0);
      expect(overlaySource.read().state.items[1]).toMatchObject({
        id: "hookshot",
        level: 1,
      });
      stop();
    });
  });
});
