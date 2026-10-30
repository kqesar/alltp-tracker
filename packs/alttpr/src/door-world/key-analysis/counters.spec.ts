// DR's key counters on the vanilla world (dungeon.ts, exploration.ts,
// counters.ts): what the walk starts from, what it crosses, and the
// counters it makes in each dungeon.

import { describe, expect, it } from "vitest";
import { DR_DATA } from "../data";
import { keyDropsOf } from "../keys";
import { findMaxCounter, type KeyLayout, keyLayout } from "./counters";
import {
  DR_DUNGEON_ORDER,
  type KeyAnalysisSettings,
  keyWorld,
  rstrip,
} from "./dungeon";

const ALL_DROPS = new Set(keyDropsOf(DR_DATA).map((d) => d.location));
const settingsOf = (
  mode: KeyAnalysisSettings["mode"],
  more: Partial<KeyAnalysisSettings> = {},
): KeyAnalysisSettings => ({
  accessibility: "items",
  bigKeyShuffle: false,
  data: DR_DATA,
  dropShuffleNone: true,
  forcedDrops: ALL_DROPS,
  keyShuffle: "none",
  mode,
  ...more,
});
const layouts = (settings: KeyAnalysisSettings) => {
  const world = keyWorld(settings);
  return new Map(DR_DUNGEON_ORDER.map((d) => [d, keyLayout(world, d)]));
};
const OPEN = layouts(settingsOf("open"));

describe("the regions DR's key walk crosses", () => {
  it("strips a name as Python's rstrip does, a set of characters", () => {
    // _find_portal_for_region finds no portal for these (DoorShuffle.py:352-354)
    expect(rstrip("Hyrule Castle West Portal", " Portal")).toBe(
      "Hyrule Castle Wes",
    );
    expect(rstrip("Hyrule Castle South Portal", " Portal")).toBe(
      "Hyrule Castle South",
    );
  });

  it("finds the overworld only a dungeon reaches, per mode", () => {
    const open = keyWorld(settingsOf("open")).inaccessible;
    // The ledges Turtle Rock's back doors open on, the desert's mouth
    for (const name of [
      "Dark Death Mountain Ledge",
      "Dark Death Mountain Isolated Ledge",
      "Desert Mouth",
      "Skull Woods Forest (West)",
    ])
      expect(open.has(name), name).toBe(true);
    // The mirror reaches the desert ledge from the mire
    expect(open.has("Desert Ledge")).toBe(false);
    expect(open.has("Hyrule Castle Ledge")).toBe(false);
    expect(keyWorld(settingsOf("standard")).inaccessible).toContain(
      "Hyrule Castle Ledge",
    );
    const inverted = keyWorld(settingsOf("inverted")).inaccessible;
    expect(inverted.has("Desert Ledge")).toBe(true);
    expect(inverted.has("Dark Death Mountain Ledge")).toBe(false);
  });

  it("starts each dungeon where Link walks in, per mode", () => {
    const starts = (mode: KeyAnalysisSettings["mode"], dungeon: string) =>
      keyWorld(settingsOf(mode))
        .starts.get(dungeon)
        ?.map((r) => r.name);
    expect(starts("open", "Hyrule Castle")).toEqual([
      "Sewers Rat Path",
      "Hyrule Castle Lobby",
      "Hyrule Castle West Lobby",
      "Hyrule Castle East Lobby",
      "Sanctuary",
    ]);
    // Standard: the escape's front door only (standard_starts)
    expect(starts("standard", "Hyrule Castle")).toEqual([
      "Hyrule Castle Lobby",
    ]);
    expect(starts("open", "Desert Palace")).toEqual([
      "Desert Back Lobby",
      "Desert Main Lobby",
      "Desert West Lobby",
    ]);
    expect(starts("inverted", "Desert Palace")).toEqual(["Desert Main Lobby"]);
    expect(starts("open", "Turtle Rock")).toEqual(["TR Main Lobby"]);
    expect(starts("inverted", "Turtle Rock")).toEqual([
      "TR Main Lobby",
      "TR Lazy Eyes",
      "TR Big Chest Entrance",
      "TR Eye Bridge",
    ]);
    expect(starts("open", "Skull Woods")).toEqual([
      "Skull Pot Circle",
      "Skull Pinball",
      "Skull Left Drop",
      "Skull 1 Lobby",
      "Skull 2 East Lobby",
    ]);
  });
});

/** A dungeon's counters in figures. */
const figures = (layout: KeyLayout) => ({
  bigKeySpecial: layout.bigKeySpecial,
  chests: layout.maxChests,
  counters: layout.counters.size,
  drops: layout.maxDrops,
  maxUsed: Math.max(...[...layout.counters.values()].map((c) => c.usedKeys)),
});

describe("the key counters of each dungeon", () => {
  it("counts each dungeon's chest keys and forced drops as DR does", () => {
    expect(
      Object.fromEntries([...OPEN].map(([d, l]) => [d, figures(l)])),
    ).toEqual({
      "Agahnims Tower": {
        bigKeySpecial: false,
        chests: 2,
        counters: 5,
        drops: 2,
        maxUsed: 4,
      },
      "Desert Palace": {
        bigKeySpecial: false,
        chests: 1,
        counters: 10,
        drops: 3,
        maxUsed: 4,
      },
      "Eastern Palace": {
        bigKeySpecial: false,
        chests: 0,
        counters: 6,
        drops: 2,
        maxUsed: 2,
      },
      "Ganons Tower": {
        bigKeySpecial: false,
        chests: 4,
        counters: 144,
        drops: 4,
        maxUsed: 8,
      },
      // The escape's big key lies with a guard (key_drop_data)
      "Hyrule Castle": {
        bigKeySpecial: true,
        chests: 1,
        counters: 16,
        drops: 3,
        maxUsed: 4,
      },
      "Ice Palace": {
        bigKeySpecial: false,
        chests: 2,
        counters: 18,
        drops: 4,
        maxUsed: 6,
      },
      "Misery Mire": {
        bigKeySpecial: false,
        chests: 3,
        counters: 70,
        drops: 3,
        maxUsed: 6,
      },
      "Palace of Darkness": {
        bigKeySpecial: false,
        chests: 6,
        counters: 60,
        drops: 0,
        maxUsed: 6,
      },
      "Skull Woods": {
        bigKeySpecial: false,
        chests: 3,
        counters: 24,
        drops: 2,
        maxUsed: 5,
      },
      "Swamp Palace": {
        bigKeySpecial: false,
        chests: 1,
        counters: 9,
        drops: 5,
        maxUsed: 6,
      },
      "Thieves Town": {
        bigKeySpecial: false,
        chests: 1,
        counters: 6,
        drops: 2,
        maxUsed: 3,
      },
      "Tower of Hera": {
        bigKeySpecial: false,
        chests: 1,
        counters: 4,
        drops: 0,
        maxUsed: 1,
      },
      "Turtle Rock": {
        bigKeySpecial: false,
        chests: 4,
        counters: 11,
        drops: 2,
        maxUsed: 6,
      },
    });
  });

  it("opens no more key doors than the proposal holds", () => {
    for (const [dungeon, layout] of OPEN)
      for (const counter of layout.counters.values())
        expect(counter.usedKeys, dungeon).toBeLessThanOrEqual(
          layout.proposal.length,
        );
  });

  it("reaches every chest of a dungeon once every door is open", () => {
    for (const [dungeon, layout] of OPEN) {
      const max = findMaxCounter(layout);
      const reached = new Set(
        [
          ...max.freeLocations,
          ...max.keyOnlyLocations,
          ...max.otherLocations,
        ].map((l) => l.name),
      );
      const all = layout.regions.flatMap((r) => r.locations.map((l) => l.name));
      expect(
        all.filter((name) => !reached.has(name)),
        dungeon,
      ).toEqual([]);
    }
  });

  it("starts with no door open, each counter one more door than another", () => {
    for (const [dungeon, layout] of OPEN) {
      const [first, ...rest] = [...layout.counters.values()];
      expect(first?.openDoors.size, dungeon).toBe(0);
      for (const counter of rest)
        expect(
          [...layout.counters.values()].some(
            (parent) =>
              [...parent.openDoors].every((d) => counter.openDoors.has(d)) &&
              counter.openDoors.size > parent.openDoors.size,
          ),
          dungeon,
        ).toBe(true);
    }
  });

  it("makes a shuffled key drop a chest whose key joins the dungeon's", () => {
    const shuffled = layouts(settingsOf("open", { forcedDrops: new Set() }));
    const desert = shuffled.get("Desert Palace");
    expect(desert && figures(desert)).toMatchObject({ chests: 4, drops: 0 });
    // Universal keys leave the dungeons none (make_dungeon, Dungeons.py:8)
    const universal = layouts(settingsOf("open", { keyShuffle: "universal" }));
    expect(universal.get("Desert Palace")?.maxChests).toBe(0);
  });
});
