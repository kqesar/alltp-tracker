import { MEMORY_RANGE, type MemoryRangeId } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { SAVE, seedMemory } from "@/games/alttpr/autotrack/fixtures";
import { readMemory } from "@/games/alttpr/autotrack/reading";
import {
  describeReading,
  locationName,
} from "@/games/alttpr/autotrack/readout";
import { writeSeedSettings } from "../../../../../../packs/alttpr/test/seed-rom";

/** The pack's ranges over a memory image, as a session's snapshot is. */
const viewOf = (memory: Uint8Array, unread: readonly MemoryRangeId[] = []) => ({
  bytes: (id: string) => {
    const { address, size } = MEMORY_RANGE[id as MemoryRangeId];
    return memory.subarray(address, address + size);
  },
  has: (id: string) => !unread.includes(id as MemoryRangeId),
});

const describeSeed = (
  memory: Uint8Array,
  race = false,
  unread: readonly MemoryRangeId[] = [],
) => describeReading(readMemory(viewOf(memory, unread), race, 0));

describe("describeReading", () => {
  it("lists an open seed's items, prizes, bosses and checks by name", () => {
    const readout = describeSeed(seedMemory({ race: false }));

    expect(readout.items).toEqual(["Master Sword", "Bottle ×1", "Hookshot"]);
    expect(readout.prizes).toEqual(["Pendant of Courage"]);
    expect(readout.prizesUnread).toBeNull();
    expect(readout.bosses).toEqual(["Eastern Palace"]);
    expect(readout.checked).toEqual([
      { area: "Outside dungeons", locations: ["Link's House"] },
      { area: "Hyrule Castle", locations: ["Zelda"] },
      { area: "Eastern Palace", locations: ["Compass Chest", "Boss"] },
    ]);
    expect(readout.checkedCount).toBe(4);
    expect(readout.progress).toEqual([
      { label: "Game started", value: true },
      { label: "Zelda rescued", value: true },
      { label: "Triforce reached", value: false },
    ]);
    expect(readout.withheld).toEqual([]);
  });

  it("names what the board has no cell for, which it leaves alone", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x37b)] = 0x01; // Half Magic
    // Eastern and Desert Palace's maps, and Hyrule Castle's: each its cell
    memory[SAVE(0x369)] = 0x20 | 0x10 | 0x40;
    memory[SAVE(0x37c + 6)] = 2; // Palace of Darkness keys in hand
    memory[SAVE(0x470)] = 3; // heart pieces
    const reading = readMemory(viewOf(memory), false, 0);

    expect(describeReading(reading).untracked).toEqual([
      "Half Magic",
      "Piece of Heart ×3",
      "Small keys",
    ]);
    // The grid's dungeons' maps have their cells
    memory[SAVE(0x369)] = 0x20 | 0x10;
    expect(
      describeReading(readMemory(viewOf(memory), false, 0)).untracked,
    ).toEqual(["Half Magic", "Piece of Heart ×3", "Small keys"]);
    // With keysanity, the board counts the small keys
    expect(describeReading(reading, true).untracked).not.toContain(
      "Small keys",
    );
    expect(describeSeed(seedMemory({ race: false })).untracked).toEqual([]);
  });

  it("says what Race Mode leaves unread, and shows none of it", () => {
    const readout = describeSeed(seedMemory({ race: true }), true);

    expect(readout.items).toEqual(["Master Sword", "Hookshot"]);
    expect(readout.prizes).toEqual([]);
    expect(readout.prizesUnread).toBe("race-mode");
    expect(readout.checked).toEqual([
      { area: "Outside dungeons", locations: ["Link's House"] },
    ]);
    expect(readout.withheld.map(({ label }) => label)).toEqual([
      "Bottles",
      "Heart containers and pieces",
      "Pendants and crystals",
      expect.stringMatching(/^Checks inside dungeons \(\d+\)$/),
    ]);
    expect(readout.withheld.every(({ why }) => why === "race-mode")).toBe(true);
    // Race Mode still reads the bosses
    expect(readout.bosses).toEqual(["Eastern Palace"]);
  });

  it("names levels, counts, dungeon items and the Agahnims", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x359)] = 0x04; // Golden Sword
    memory[SAVE(0x354)] = 0x02; // Titan's Mitt
    memory[SAVE(0x35d)] = 0x03; // a second bottle
    memory[SAVE(0x448)] = 0x03; // three heart containers
    memory[SAVE(0x367)] = 0x02; // Palace of Darkness's big key ($0200)
    memory[SAVE(0x369)] = 0x02; // ...and its map
    memory[SAVE(0x37c + 6)] = 0x02; // two of its small keys in hand
    memory[SAVE(0x37c + 7)] = 0x01; // one of Misery Mire's
    memory[SAVE(0x473)] = 0x20; // Eastern Palace's prize taken
    memory[SAVE(0x3c5)] = 0x03; // Agahnim defeated
    memory[SAVE(0x40f)] = 0x01; // Agahnim 2 too

    const readout = describeSeed(memory);

    expect(readout.items).toEqual(
      expect.arrayContaining([
        "Golden Sword",
        "Titan's Mitt",
        "Bottle ×2",
        "Heart Container ×3",
      ]),
    );
    expect(readout.dungeons).toEqual([
      {
        dungeon: "Palace of Darkness",
        items: ["Big Key", "Map", "2 small keys in hand"],
      },
      { dungeon: "Misery Mire", items: ["1 small key in hand"] },
    ]);
    expect(readout.completed).toEqual(["Eastern Palace"]);
    expect(readout.bosses).toEqual([
      "Eastern Palace",
      "Agahnim (Castle Tower)",
      "Agahnim 2 (Ganon's Tower)",
    ]);
  });

  it("says what memory has not given yet", () => {
    const readout = describeSeed(seedMemory({ race: false }), false, [
      "equipment-c",
      "game-mode",
      "pendants",
      "cave-rooms",
      "progress",
    ]);

    expect(readout.items).not.toContain("Master Sword");
    expect(readout.prizesUnread).toBe("not-read");
    expect(readout.withheld).toEqual(
      expect.arrayContaining([
        { label: "Cane of Somaria", why: "not-read" },
        { label: "Pendants and crystals", why: "not-read" },
        {
          label: expect.stringMatching(/^Checked locations \(\d+\)$/),
          why: "not-read",
        },
      ]),
    );
    expect(readout.progress[0]).toEqual({
      label: "Game started",
      value: "not-read",
    });
  });
});

describe("describeReading's unknowns", () => {
  it("lists an item the panel has no name for by its id", () => {
    const reading = readMemory(viewOf(seedMemory({ race: false })), false, 0);
    const readout = describeReading({
      ...reading,
      items: {
        atLeast: {},
        counts: { newItem: 1 } as never,
        unsettled: { otherItem: "race-mode" } as never,
      },
    });

    expect(readout.items).toEqual(["newItem"]);
    expect(readout.withheld).toContainEqual({
      label: "otherItem",
      why: "race-mode",
    });
  });
});

describe("locationName", () => {
  it("rebuilds upstream's names from the pack's ids", () => {
    expect(locationName("links-house")).toBe("Link's House");
    expect(locationName("kings-tomb")).toBe("King's Tomb");
    expect(locationName("c-shaped-house")).toBe("C-Shaped House");
    expect(locationName("mini-moldorm-cave/npc")).toBe(
      "Mini Moldorm Cave - NPC",
    );
    expect(locationName("palace-of-darkness/the-arena-bridge")).toBe(
      "Palace of Darkness - The Arena Bridge",
    );
    expect(locationName("thieves-town/big-chest")).toBe(
      "Thieves' Town - Big Chest",
    );
  });

  it("leaves the dungeon out under its own heading, but not the sewers", () => {
    expect(locationName("ganons-tower/dms-room/top-left", true)).toBe(
      "DMs Room - Top Left",
    );
    expect(locationName("ganons-tower/pre-moldorm-chest", true)).toBe(
      "Pre-Moldorm Chest",
    );
    expect(locationName("sewers/dark-cross", true)).toBe("Sewers - Dark Cross");
    expect(locationName("sanctuary", true)).toBe("Sanctuary");
  });
});

describe("the seed's settings", () => {
  it("names each setting the ROM holds", () => {
    const memory = writeSeedSettings(seedMemory({ race: false }), {
      crystalsGanon: 5,
      dungeonItems: "full",
      goal: "fast_ganon",
    });

    expect(describeSeed(memory).seed).toEqual([
      { label: "Seed", value: "OPEN" },
      { label: "Logic", value: "No Glitches" },
      { label: "World", value: "Open" },
      { label: "Entrances", value: "not in the ROM" },
      { label: "Swordless", value: "no" },
      { label: "Goal", value: "Fast Ganon" },
      { label: "Ganon's Tower", value: "7 crystals" },
      { label: "Ganon", value: "5 crystals" },
      {
        label: "Outside their dungeons",
        value: "maps, compasses, small keys, big keys",
      },
      { label: "Item placement", value: "not in the ROM" },
      { label: "Item pool", value: "not in the ROM" },
      { label: "Item functionality", value: "not in the ROM" },
      { label: "Accessibility", value: "not in the ROM" },
    ]);
  });

  it("names the settings only a seed's file on alttpr.com states, or hides", () => {
    const reading = readMemory(viewOf(seedMemory({ race: false })), false, 0);
    const known = <T>(value: T) => ({ known: true as const, value });
    const seed = Object.fromEntries(
      describeReading({
        ...reading,
        seed: {
          ...reading.seed,
          accessibility: known("locations"),
          entrances: known("crossed"),
          goal: { known: false, why: "mystery" },
          itemFunctionality: known("expert"),
          itemPlacement: known("basic"),
          itemPool: { known: false, why: "unrecognized" },
        },
      }).seed.map(({ label, value }) => [label, value]),
    );

    expect(seed).toMatchObject({
      Accessibility: "100% Locations",
      Entrances: "Crossworld",
      Goal: "hidden: a Mystery seed",
      "Item functionality": "Expert",
      "Item placement": "Basic",
      "Item pool": "not recognized",
    });
  });

  it("says why a race seed's settings are not read, its logic aside", () => {
    const memory = writeSeedSettings(seedMemory({ race: true }), {});
    const seed = Object.fromEntries(
      describeSeed(memory, true).seed.map(({ label, value }) => [label, value]),
    );

    expect(seed).toMatchObject({
      Ganon: "not read in Race Mode",
      Goal: "not read in Race Mode",
      Logic: "No Glitches",
      "Outside their dungeons": "not read in Race Mode",
      Seed: "RACE",
      World: "not read in Race Mode",
    });
  });
});
