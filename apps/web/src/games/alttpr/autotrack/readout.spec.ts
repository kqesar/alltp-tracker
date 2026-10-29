import { MEMORY_RANGE, type MemoryRangeId } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import {
  openEntrance,
  SAVE,
  seedMemory,
  standOn,
  writeMedallions,
  writePrizeTables,
} from "@/games/alttpr/autotrack/fixtures";
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

    // The bottle with what it holds, and the capacities (outside Race Mode)
    expect(readout.items).toEqual([
      "Master Sword",
      "Bottle ×1 (empty)",
      "Hookshot",
      "Bomb capacity 10",
      "Arrow capacity 30",
    ]);
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
    // Eastern and Desert Palace's maps, and Hyrule Castle's: each its cell
    memory[SAVE(0x369)] = 0x20 | 0x10 | 0x40;
    memory[SAVE(0x4e0 + 6)] = 2; // Palace of Darkness keys found
    memory[SAVE(0x470)] = 3; // heart pieces
    const reading = readMemory(viewOf(memory), false, 0);

    expect(describeReading(reading).untracked).toEqual([
      "Piece of Heart ×3",
      "Small keys",
    ]);
    // The grid's dungeons' maps have their cells
    memory[SAVE(0x369)] = 0x20 | 0x10;
    expect(
      describeReading(readMemory(viewOf(memory), false, 0)).untracked,
    ).toEqual(["Piece of Heart ×3", "Small keys"]);
    // With keysanity, the board counts the small keys
    expect(describeReading(reading, true).untracked).not.toContain(
      "Small keys",
    );
    expect(describeSeed(seedMemory({ race: false })).untracked).toEqual([]);
  });

  it("says what Race Mode leaves unread, and shows none of it", () => {
    const memory = seedMemory({ race: true });
    memory[SAVE(0x37a)] = 0x04 | 0x01; // crystals 5 and 6
    const readout = describeSeed(memory, true);

    // The bottles (bottle contents), the pendants by name and the crystals
    // counted (prizes upon collection), the checks inside dungeons
    expect(readout.items).toEqual([
      "Master Sword",
      "Bottle ×1 (empty)",
      "Hookshot",
    ]);
    expect(readout.prizes).toEqual(["Pendant of Courage", "Crystals ×2"]);
    expect(readout.prizesUnread).toBeNull();
    expect(readout.checked).toEqual([
      { area: "Outside dungeons", locations: ["Link's House"] },
      {
        area: "Eastern Palace",
        locations: expect.arrayContaining(["Compass Chest"]),
      },
    ]);
    expect(readout.withheld.map(({ label }) => label)).toEqual([
      "Bomb and arrow capacity",
      "Which crystals are 5 and 6",
      "Heart containers and pieces",
      "Zelda's rescue",
    ]);
    expect(readout.withheld.every(({ why }) => why === "race-mode")).toBe(true);
    // Race Mode still reads the bosses
    expect(readout.bosses).toEqual(["Eastern Palace"]);
  });

  it("lists the dungeon prizes the game shows, and why, none other", () => {
    const memory = writePrizeTables(seedMemory({ race: false }));
    const or = (offset: number, bits: number) => {
      memory[SAVE(offset)] |= bits & 0xff;
      memory[SAVE(offset) + 1] |= bits >> 8;
    };
    or(0x472, 0x0400); // Swamp Palace finished
    or(0x368, 0x2000); // Eastern Palace's map
    or(0x414, 0x0020); // Sahasrahla's mark: Tower of Hera
    // In the Light World: Swamp Palace's (finished) and the Light World's
    // two shown; Desert Palace's (no map) and the Dark World's are not
    expect(describeSeed(memory).shownPrizes).toEqual([
      {
        dungeon: "Eastern Palace",
        prize: "The Pendant of Power or Wisdom",
        why: "its map held",
      },
      {
        dungeon: "Tower of Hera",
        prize: "The Pendant of Courage",
        why: "marked by Sahasrahla",
      },
      {
        dungeon: "Swamp Palace",
        prize: "Crystal 5 or 6",
        why: "dungeon finished",
      },
    ]);
    // The Bomb Merchant's mark on Ice Palace, read in the Dark World
    or(0x414, 0x0040);
    memory[SAVE(0x3ca)] = 0x40;
    expect(describeSeed(memory).shownPrizes).toEqual([
      {
        dungeon: "Swamp Palace",
        prize: "Crystal 5 or 6",
        why: "dungeon finished",
      },
      {
        dungeon: "Ice Palace",
        prize: "Crystal 5 or 6",
        why: "marked by the Bomb Merchant",
      },
    ]);
    // A map mode that always shows them
    const always = writePrizeTables(seedMemory({ race: false }), 0x00);
    expect(
      describeSeed(always).shownPrizes.map(({ dungeon, why }) => [
        dungeon,
        why,
      ]),
    ).toEqual([
      ["Eastern Palace", "on the world map"],
      ["Desert Palace", "on the world map"],
      ["Tower of Hera", "on the world map"],
    ]);
    expect(describeSeed(always).shownPrizesUnread).toBeNull();
  });

  it("lists the pad medallions the game shows, and why", () => {
    // The Mire asks Ether, Turtle Rock Quake
    const memory = writeMedallions(seedMemory({ race: false }), 1, 2);
    expect(describeSeed(memory).shownMedallions).toEqual([]);
    expect(describeSeed(memory).shownMedallionsUnread).toBeNull();

    standOn(memory, 0x70);
    expect(describeSeed(memory).shownMedallions).toEqual([
      {
        medallion: "Ether",
        pad: "Misery Mire",
        why: "its entrance's screen in view",
      },
    ]);
    openEntrance(memory, 0x47);
    expect(describeSeed(memory).shownMedallions).toEqual([
      {
        medallion: "Ether",
        pad: "Misery Mire",
        why: "its entrance's screen in view",
      },
      { medallion: "Quake", pad: "Turtle Rock", why: "entrance opened" },
    ]);
  });

  it("says no pad medallion is read in Race Mode, or before the ROM is", () => {
    const memory = standOn(
      writeMedallions(seedMemory({ race: true }), 1, 2),
      0x70,
    );
    const raced = describeSeed(memory, true);
    expect(raced.shownMedallions).toEqual([]);
    expect(raced.shownMedallionsUnread).toBe("race-mode");
    const unread = describeSeed(memory, false, ["medallions"]);
    expect(unread.shownMedallions).toEqual([]);
    expect(unread.shownMedallionsUnread).toBe("not-read");
  });

  it("says no dungeon prize is read in Race Mode, or before the ROM is", () => {
    const memory = writePrizeTables(seedMemory({ race: true }));
    memory[SAVE(0x473)] = 0xff; // every dungeon finished
    const raced = describeSeed(memory, true);
    expect(raced.shownPrizes).toEqual([]);
    expect(raced.shownPrizesUnread).toBe("race-mode");
    const unread = describeSeed(memory, false, ["prize-bits"]);
    expect(unread.shownPrizes).toEqual([]);
    expect(unread.shownPrizesUnread).toBe("not-read");
  });

  it("never says in Race Mode whether Zelda was rescued", () => {
    const memory = seedMemory({ race: true });
    memory[SAVE(0x3c5)] = 0x02; // Zelda rescued

    expect(describeSeed(memory, true).progress).toEqual([
      { label: "Game started", value: true },
      { label: "Triforce reached", value: false },
    ]);
    // The same memory read outside Race Mode says it
    expect(describeSeed(memory).progress).toContainEqual({
      label: "Zelda rescued",
      value: true,
    });
  });

  it("names levels, counts, dungeon items and the Agahnims", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x359)] = 0x04; // Golden Sword
    memory[SAVE(0x354)] = 0x02; // Titan's Mitt
    memory[SAVE(0x35d)] = 0x03; // a second bottle
    memory[SAVE(0x448)] = 0x03; // three heart containers
    memory[SAVE(0x367)] = 0x02; // Palace of Darkness's big key ($0200)
    memory[SAVE(0x369)] = 0x02; // ...and its map
    memory[SAVE(0x4e0 + 6)] = 0x02; // two of its small keys found
    memory[SAVE(0x4e0 + 7)] = 0x01; // one of Misery Mire's
    memory[SAVE(0x473)] = 0x20; // Eastern Palace's prize taken
    memory[SAVE(0x3c5)] = 0x03; // Agahnim defeated
    memory[SAVE(0x40f)] = 0x01; // Agahnim 2 too

    const readout = describeSeed(memory);

    expect(readout.items).toEqual(
      expect.arrayContaining([
        "Golden Sword",
        "Titan's Mitt",
        "Bottle ×2 (empty, red potion)",
        "Heart Container ×3",
      ]),
    );
    expect(readout.dungeons).toEqual([
      {
        dungeon: "Palace of Darkness",
        items: ["2 small keys found", "Big Key", "Map"],
      },
      { dungeon: "Misery Mire", items: ["1 small key found"] },
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

describe("describeReading's key counts", () => {
  it("names a key count beyond the dungeon's keys", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x4e0 + 9)] = 3; // Ice Palace holds two keys
    const readout = describeReading(readMemory(viewOf(memory), false, 0));

    expect(readout.dungeons).toEqual([
      {
        dungeon: "Ice Palace",
        items: [
          "2 small keys found (the game counts 3, more than the dungeon holds)",
        ],
      },
    ]);
  });

  it("names the count read for Tower of Hera, its double count taken back", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x4e0 + 10)] = 2; // its one key, counted twice
    const once = describeReading(readMemory(viewOf(memory), false, 0));
    expect(once.dungeons).toEqual([
      { dungeon: "Tower of Hera", items: ["1 small key found"] },
    ]);
    memory[SAVE(0x4e0 + 10)] = 3;
    const more = describeReading(readMemory(viewOf(memory), false, 0));
    expect(more.dungeons).toEqual([
      {
        dungeon: "Tower of Hera",
        items: [
          "1 small key found (the game counts 3, more than the dungeon holds)",
        ],
      },
    ]);
  });

  it("lists no key count with generic keys, in a race or not", () => {
    // Retro: the base patch counts Tower of Hera's basement cage whatever
    // generic key it holds; a dungeon's count would say where it was taken
    const memory = seedMemory({ race: false });
    memory[SAVE(0x4e0 + 10)] = 2;
    for (const race of [false, true]) {
      for (const wildKeys of [false, true]) {
        const readout = describeReading(
          readMemory(viewOf(memory), race, 0),
          wildKeys,
          true,
        );
        expect(readout.dungeons, `race ${race}`).toEqual([]);
        expect(readout.untracked).not.toContain("Small keys");
      }
    }
  });
});

describe("describeReading's bottles and capacities", () => {
  it("names what each bottle holds, in the game's order, Race Mode too", () => {
    const memory = seedMemory({ race: true });
    memory.set([0x04, 0x07, 0x06], SAVE(0x35c));
    for (const race of [false, true]) {
      expect(describeSeed(memory, race).items, `race ${race}`).toContain(
        "Bottle ×3 (green potion, a bee, a fairy)",
      );
    }
  });

  it("lists the capacities outside Race Mode, and says Race Mode left them", () => {
    const memory = seedMemory({ race: false });
    memory.set([50, 70], SAVE(0x370));
    const open = describeSeed(memory);
    expect(open.items).toEqual(
      expect.arrayContaining(["Bomb capacity 50", "Arrow capacity 70"]),
    );
    expect(open.withheld.map(({ label }) => label)).not.toContain(
      "Bomb and arrow capacity",
    );
    const race = describeSeed(memory, true);
    expect(race.items.join(" ")).not.toContain("capacity");
    expect(race.withheld).toContainEqual({
      label: "Bomb and arrow capacity",
      why: "race-mode",
    });
  });
});

describe("describeReading's unknowns", () => {
  it("lists an item the panel has no name for by its id", () => {
    const reading = readMemory(viewOf(seedMemory({ race: false })), false, 0);
    const readout = describeReading({
      ...reading,
      items: {
        beyond: {},
        counts: { newItem: 1 } as never,
        unsettled: { otherItem: "race-mode" } as never,
      },
    });

    expect(readout.items).toEqual([
      "newItem",
      "Bomb capacity 10",
      "Arrow capacity 30",
    ]);
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

  it("prices a paid check, and no free one", () => {
    expect(locationName("bottle-merchant")).toBe(
      "Bottle Merchant (100 rupees)",
    );
    expect(locationName("hobo")).toBe("Hobo");
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
      { label: "Boss shuffle", value: "not in the ROM" },
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

  it("says why a race seed's settings are not read, the logic included", () => {
    const memory = writeSeedSettings(seedMemory({ race: true }), {});
    const seed = Object.fromEntries(
      describeSeed(memory, true).seed.map(({ label, value }) => [label, value]),
    );

    expect(seed).toMatchObject({
      Ganon: "not read in Race Mode",
      Goal: "not read in Race Mode",
      Logic: "not read in Race Mode",
      "Outside their dungeons": "not read in Race Mode",
      // v2.0 lets a tracker present only what it lists before the seed is
      // completed: the seed's name is not among it
      Seed: "not shown in Race Mode",
      World: "not read in Race Mode",
    });
  });
});

describe("a Door Randomizer seed's readout", () => {
  /** A DR seed's ROM: its title, its table's magic and its version text. */
  const doorMemory = (title: string, version: string) => {
    const memory = seedMemory({ race: false });
    const write = (at: number, text: string) => {
      memory.fill(0, at, at + 21);
      for (let i = 0; i < text.length; i++) memory[at + i] = text.charCodeAt(i);
    };
    write(0x7fc0, title); // Rom.py:1454-1456
    write(0x13_8000, "DR"); // doorrando.asm:15
    write(0x13_8010, version); // Rom.py:1458
    return memory;
  };
  const rows = (memory: Uint8Array, race = false) =>
    Object.fromEntries(
      describeReading(readMemory(viewOf(memory), race, 0)).seed.map(
        ({ label, value }) => [label, value],
      ),
    );

  it("names the randomizer and its version, and says when DR's data is another version's", () => {
    expect(rows(doorMemory("DR156_1_1_367825107", "1.5.6-u"))).toMatchObject({
      "Door shuffle": "Vanilla",
      Pottery: "None",
      Randomizer: "Door Randomizer 1.5.6",
      Seed: "1_1_367825107",
    });
    expect(rows(doorMemory("DR158_1_1_1", "1.5.8-u")).Randomizer).toBe(
      "Door Randomizer 1.5.8 (the tracker reads DR 1.5.6: this version's locations may differ)",
    );
    // In Race Mode the title alone: the version it names, no setting
    const race = rows(doorMemory("DR157_1_1_1", "1.5.7-u"), true);
    expect(race.Randomizer).toBe(
      "Door Randomizer 1.5.7 (the tracker reads DR 1.5.6: this version's locations may differ)",
    );
    expect(race["Door shuffle"]).toBe("not read in Race Mode");
  });

  it("lists the run's DR locations taken, and no other bit of their tables", () => {
    const memory = doorMemory("DR156_1_1_1", "1.5.6-u");
    // Eastern Palace's dark square pot key, and a pot of no location
    memory[0xf6_6018 + 0xba * 2 + 1] = 0x08;
    memory[0xf6_6018 + 0x09 * 2 + 1] = 0x80;
    const reading = readMemory(viewOf(memory), false, 0);
    const readout = describeReading(
      reading,
      false,
      false,
      new Set(["eastern-palace/dark-square-pot-key"]),
    );
    expect(
      readout.checked.find(({ area }) => area === "Eastern Palace")?.locations,
    ).toContain("Dark Square Pot Key");
    expect(readout.checkedCount).toBe(
      describeReading(reading).checkedCount + 1,
    );
  });
});
