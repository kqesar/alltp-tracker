import { describe, expect, it } from "vitest";
import { writeSeedSettings } from "../../test/seed-rom";
import type { MemoryView } from "./decode";
import { MEMORY_RANGE, MEMORY_RANGES, type MemoryRangeId } from "./memory";
import { ALTTPR_RACE_PROFILE } from "./race-profile";
import {
  decodeSeedSettings,
  SEED_SETTINGS_RANGES,
  type SeedSetting,
  type SeedSettingsReading,
} from "./seed-settings";

// ROM images built by hand, byte by byte, at the PC offsets vt writes
// (app/Rom.php at 219fcafd): a headerless ROM offset is its FX Pak Pro
// address. Every other byte is $00, so a test sets what it reads.
const OFFSET = {
  ganonCrystals: 0x18_01a6, // Rom.php:2292
  ganonVulnerable: 0x18_01a8, // Rom.php:625
  genericKeys: 0x18_0172, // Rom.php:1321
  goalItems: 0x18_0167, // Rom.php:474
  hammerGanon: 0x18_003f, // Rom.php:2067
  header: 0x00_7fc0, // Rom.php:2320, setSeedString
  initialSram: 0x18_3000, // Rom.php:2389, writeInitialSram
  inverted: 0x18_004a, // Rom.php:1592, snes_to_pc(0x30804A)
  menu: 0x18_0045, // Rom.php:2053
  seedType: 0x18_0210, // Rom.php:850
  swordlessMedallions: 0x18_0041, // Rom.php:2068
  towerCrystals: 0x18_019a, // Rom.php:2278
} as const;

/** The initial save's progress indicator and pyramid (InitialSram.php). */
const PROGRESS = OFFSET.initialSram + 0x3c5;
const PYRAMID = OFFSET.initialSram + 0x280 + 0x5b;

/** A ROM image with `writes` (offset to byte) and an alttpr.com title. */
const image = (writes: Readonly<Record<number, number>> = {}) => {
  const memory = new Uint8Array(0x100_0000);
  const title = "VT eM43RgZ4Gj".padEnd(21, " ");
  for (let i = 0; i < title.length; i++) {
    memory[OFFSET.header + i] = title.charCodeAt(i);
  }
  for (const [at, byte] of Object.entries(writes)) memory[Number(at)] = byte;
  return memory;
};

/** The image as the session's snapshot shows it, `unread` ranges aside. */
const view = (
  memory: Uint8Array,
  unread: readonly MemoryRangeId[] = [],
): MemoryView => ({
  bytes: (id) => {
    const { address, size } = MEMORY_RANGE[id as MemoryRangeId];
    return memory.subarray(address, address + size);
  },
  has: (id) => !unread.includes(id as MemoryRangeId),
});

const decode = (
  memory: Uint8Array,
  { race = false, unread = [] as readonly MemoryRangeId[] } = {},
) => decodeSeedSettings(view(memory, unread), { race });

/** A setting's value, or its reason as `?reason`. */
const shown = <T>(setting: SeedSetting<T>) =>
  setting.known ? setting.value : `?${setting.why}`;

/** Every setting's value, or its reason. */
const settings = (reading: SeedSettingsReading) => ({
  crystalsGanon: shown(reading.crystalsGanon),
  crystalsTower: shown(reading.crystalsTower),
  goal: shown(reading.goal),
  logic: shown(reading.logic),
  mode: shown(reading.mode),
  seed: reading.seed,
  swordless: shown(reading.swordless),
  wildBigKeys: shown(reading.wildBigKeys),
  wildCompasses: shown(reading.wildCompasses),
  wildKeys: shown(reading.wildKeys),
  wildMaps: shown(reading.wildMaps),
});

describe("decodeSeedSettings", () => {
  it("names the seed from the header title, after VT", () => {
    expect(decode(image()).seed).toBe("eM43RgZ4Gj");
    const vanilla = image();
    vanilla.set(
      [..."THE LEGEND OF ZELDA  "].map((c) => c.charCodeAt(0)),
      OFFSET.header,
    );
    expect(decode(vanilla).seed).toBeNull();
    expect(decode(image(), { unread: ["rom-header"] }).seed).toBeNull();
  });

  describe("the world", () => {
    it.each([
      [{ [PROGRESS]: 0x02 }, "open"],
      [{ [PROGRESS]: 0x03 }, "open"], // instant post-Agahnim
      [{ [PROGRESS]: 0x00 }, "standard"],
      [{ [PROGRESS]: 0x80 }, "standard"], // instant post-Agahnim
      [{ [OFFSET.inverted]: 0x01, [PROGRESS]: 0x02 }, "inverted"],
      [{ [OFFSET.genericKeys]: 0x01, [PROGRESS]: 0x02 }, "retro"],
    ])("reads %j as %s", (writes, mode) => {
      expect(shown(decode(image(writes)).mode)).toBe(mode);
    });

    it.each([
      [{ [PROGRESS]: 0x01 }],
      [{ [OFFSET.inverted]: 0x01, [PROGRESS]: 0x00 }],
      [{ [OFFSET.inverted]: 0x02, [PROGRESS]: 0x02 }],
      [{ [OFFSET.genericKeys]: 0x01, [PROGRESS]: 0x00 }],
      [{ [OFFSET.genericKeys]: 0x01, [OFFSET.inverted]: 0x01 }],
    ])("never guesses one from %j", (writes) => {
      expect(shown(decode(image(writes)).mode)).toBe("?unrecognized");
    });
  });

  it("reads swordless when both of its flags say so, and only then", () => {
    const both = { [OFFSET.hammerGanon]: 1, [OFFSET.swordlessMedallions]: 1 };
    expect(shown(decode(image(both)).swordless)).toBe(true);
    expect(shown(decode(image()).swordless)).toBe(false);
    expect(shown(decode(image({ [OFFSET.hammerGanon]: 1 })).swordless)).toBe(
      "?unrecognized",
    );
    expect(
      shown(decode(image({ [OFFSET.swordlessMedallions]: 2 })).swordless),
    ).toBe("?unrecognized");
  });

  describe("the goal", () => {
    it.each([
      [{ [OFFSET.ganonVulnerable]: 0x04 }, "ganon"],
      [{ [OFFSET.ganonVulnerable]: 0x04, [PYRAMID]: 0x20 }, "fast_ganon"],
      [{ [OFFSET.ganonVulnerable]: 0x02 }, "dungeons"],
      [{ [OFFSET.ganonVulnerable]: 0x01 }, "pedestal"],
      [
        { [OFFSET.ganonVulnerable]: 0x01, [OFFSET.goalItems]: 20 },
        "triforce-hunt",
      ],
      [
        { [OFFSET.ganonVulnerable]: 0x01, [OFFSET.goalItems + 1]: 0x01 },
        "triforce-hunt",
      ],
      [{ [OFFSET.ganonVulnerable]: 0x05 }, "ganonhunt"],
      [{ [OFFSET.ganonVulnerable]: 0x0b }, "completionist"],
      [{ [OFFSET.ganonVulnerable]: 0x00 }, "?unrecognized"],
      [{ [OFFSET.ganonVulnerable]: 0x03 }, "?unrecognized"],
    ])("reads %j as %s", (writes, goal) => {
      expect(shown(decode(image(writes)).goal)).toBe(goal);
    });

    it("needs the pyramid or the pieces only where they tell goals apart", () => {
      const ganon = image({ [OFFSET.ganonVulnerable]: 0x04 });
      expect(shown(decode(ganon, { unread: ["initial-pyramid"] }).goal)).toBe(
        "?not-read",
      );
      const dungeons = image({ [OFFSET.ganonVulnerable]: 0x02 });
      expect(
        shown(
          decode(dungeons, { unread: ["initial-pyramid", "goal-items"] }).goal,
        ),
      ).toBe("dungeons");
    });
  });

  it("reads the pieces a triforce hunt asks for, 1 to 50, from the goal items word", () => {
    const pieces = (low: number, high = 0) =>
      shown(
        decode(image({ [OFFSET.goalItems]: low, [OFFSET.goalItems + 1]: high }))
          .goalPieces ?? { known: false, why: "unrecognized" },
      );
    expect(pieces(20)).toBe(20);
    expect(pieces(30)).toBe(30);
    expect(pieces(50)).toBe(50);
    // None asked for (pedestal), more than any goal asks, counter-only $FFFF
    expect(pieces(0)).toBe("?unrecognized");
    expect(pieces(51)).toBe("?unrecognized");
    expect(pieces(0xff, 0xff)).toBe("?unrecognized");
  });

  it("reads the crystal counts from 0 to 7", () => {
    for (let count = 0; count <= 7; count++) {
      const reading = decode(
        image({
          [OFFSET.ganonCrystals]: count,
          [OFFSET.towerCrystals]: 7 - count,
        }),
      );
      expect(shown(reading.crystalsGanon)).toBe(count);
      expect(shown(reading.crystalsTower)).toBe(7 - count);
    }
    expect(
      shown(decode(image({ [OFFSET.towerCrystals]: 8 })).crystalsTower),
    ).toBe("?unrecognized");
  });

  it.each([
    [0x01, "wildKeys"],
    [0x02, "wildBigKeys"],
    [0x04, "wildMaps"],
    [0x08, "wildCompasses"],
  ] as const)("reads menu bit %i as %s, and no other", (bit, setting) => {
    const reading = settings(decode(image({ [OFFSET.menu]: bit })));
    const wild = Object.entries(reading).filter(([, value]) => value === true);
    expect(wild).toEqual([[setting, true]]);
  });

  it.each([
    [0x00, "NoGlitches"],
    [0x01, "MajorGlitches"],
    [0x02, "OverworldGlitches"],
    [0xff, "?unrecognized"],
  ])("reads the seed type %i as %s", (type, logic) => {
    expect(shown(decode(image({ [OFFSET.seedType]: type })).logic)).toBe(logic);
  });

  it("reads only the seed's name in Race Mode, no setting, the logic included", () => {
    // v2.0 lets a tracker set itself up from the ROM only if it can ensure
    // the seed is no Mystery one, which a race seed's ROM does not say
    const memory = writeSeedSettings(image(), {
      dungeonItems: "full",
      logic: "OverworldGlitches",
      mode: "standard",
    });
    expect(settings(decode(memory, { race: true }))).toEqual({
      crystalsGanon: "?race-mode",
      crystalsTower: "?race-mode",
      goal: "?race-mode",
      logic: "?race-mode",
      mode: "?race-mode",
      seed: "eM43RgZ4Gj",
      swordless: "?race-mode",
      wildBigKeys: "?race-mode",
      wildCompasses: "?race-mode",
      wildKeys: "?race-mode",
      wildMaps: "?race-mode",
    });
  });

  it("says what was not read yet, and that Race Mode forbids before that", () => {
    const memory = writeSeedSettings(image());
    const unread = SEED_SETTINGS_RANGES.map((range) => range.id);
    expect(settings(decode(memory, { unread }))).toEqual({
      crystalsGanon: "?not-read",
      crystalsTower: "?not-read",
      goal: "?not-read",
      logic: "?not-read",
      mode: "?not-read",
      seed: "eM43RgZ4Gj",
      swordless: "?not-read",
      wildBigKeys: "?not-read",
      wildCompasses: "?not-read",
      wildKeys: "?not-read",
      wildMaps: "?not-read",
    });
    expect(
      shown(decode(memory, { race: true, unread: ["seed-type"] }).logic),
    ).toBe("?race-mode");
    expect(
      shown(decode(memory, { race: true, unread: ["initial-progress"] }).mode),
    ).toBe("?race-mode");
  });

  it("reads back what alttpr.com writes for its presets", () => {
    // config/alttp.php:57-173, the settings the tracker models
    expect(
      settings(
        decode(
          writeSeedSettings(image(), {
            dungeonItems: "full",
            goal: "fast_ganon",
          }),
        ),
      ),
    ).toEqual({
      crystalsGanon: 7,
      crystalsTower: 7,
      goal: "fast_ganon",
      logic: "NoGlitches",
      mode: "open",
      seed: "eM43RgZ4Gj",
      swordless: false,
      wildBigKeys: true,
      wildCompasses: true,
      wildKeys: true,
      wildMaps: true,
    });
    expect(
      settings(
        decode(
          writeSeedSettings(image(), {
            crystalsGanon: 6,
            crystalsTower: 5,
            dungeonItems: "mc",
            goal: "triforce-hunt",
            logic: "OverworldGlitches",
            mode: "inverted",
            swordless: true,
          }),
        ),
      ),
    ).toEqual({
      crystalsGanon: 6,
      crystalsTower: 5,
      goal: "triforce-hunt",
      logic: "OverworldGlitches",
      mode: "inverted",
      seed: "eM43RgZ4Gj",
      swordless: true,
      wildBigKeys: false,
      wildCompasses: true,
      wildKeys: false,
      wildMaps: true,
    });
  });
});

// A Door Randomizer ROM, at the PC offsets DR 1.5.8 writes (Rom.py) and its
// base patch lays out (aerinon/z3randomizer d0f4651): the title, then its
// own table, "DR" and DRMode, DRFlags, DRVersionInfo; the standing items'
// table; the Overworld fork's.
const DR = {
  // The item substitutions' +5 bomb upgrade entry (DR 1.5.8 Rom.py:1063)
  bombUpgrade: 0x18_4004,
  // vt's tables, which the fork writes whole (OWR 0.8.0.2 Rom.py)
  compassMode: 0x18_003c, // :1463
  flags: 0x13_8004, // Rom.py:678-679
  freeItemText: 0x18_016a, // :1432
  magic: 0x13_8000, // doorrando.asm:15
  mode: 0x13_8002, // Rom.py:629, 656
  multiClient: 0x14_2a51, // Rom.py:736
  owFlags: 0x15_0004, // OWR Rom.py:677
  owMode: 0x15_0002, // OWR Rom.py:676
  owVersion: 0x15_0010, // OWR Rom.py:1854
  smith: 0x18_004c, // :1731, :1773
  standingMask: 0x14_2a55, // Rom.py:738
  version: 0x13_8010, // Rom.py:1509
} as const;

/** Text written into an image at a PC offset. */
const write = (memory: Uint8Array, at: number, value: string) => {
  for (let i = 0; i < value.length; i++) memory[at + i] = value.charCodeAt(i);
};

/** A Door Randomizer image: its title, its table's magic and version. */
const doorImage = (
  title: string,
  writes: Readonly<Record<number, number>> = {},
) => {
  const memory = image(writes);
  memory.fill(0, OFFSET.header, OFFSET.header + 21);
  write(memory, OFFSET.header, title);
  if (memory[DR.magic] === 0) write(memory, DR.magic, "DR");
  if (memory[DR.version] === 0) write(memory, DR.version, "1.5.6-u");
  return memory;
};

/** Every DR setting's value, or its reason. */
const doorShown = (reading: SeedSettingsReading) => {
  const door = reading.door;
  if (door === undefined) return undefined;
  const { overworld, ...rest } = door;
  const each = (group: Readonly<Record<string, SeedSetting<unknown>>>) =>
    Object.fromEntries(
      Object.entries(group).map(([key, setting]) => [key, shown(setting)]),
    );
  return { ...each(rest), ...(overworld && { overworld: each(overworld) }) };
};

describe("decodeSeedSettings, a Door Randomizer seed", () => {
  it("names the seed and the version from the title, in Race Mode too", () => {
    const rom = doorImage("DR156_1_1_367825107");
    for (const race of [false, true]) {
      const reading = decode(rom, { race });
      expect(reading.seed).toBe("1_1_367825107");
      expect(reading.randomizer).toEqual({
        kind: "door",
        overworld: false,
        version: "1.5.6",
      });
    }
    expect(decode(image()).randomizer).toEqual({ kind: "vt" });
  });

  it("reads none of its settings in Race Mode", () => {
    const reading = decode(
      doorImage("DR156_1_1_367825107", {
        [DR.mode]: 2,
        [DR.multiClient]: 0x0b,
      }),
      { race: true },
    );
    expect(doorShown(reading)).toEqual({
      bombBag: "?race-mode",
      doorShuffle: "?race-mode",
      dropShuffle: "?race-mode",
      pottery: "?race-mode",
      shopsanity: "?race-mode",
      takeAny: "?race-mode",
      version: "?race-mode",
    });
    expect(shown(reading.logic)).toBe("?race-mode");
  });

  it("reads Crosskeys' keydrop as Hyrule Town Hall's patch writes it", () => {
    // The study's HTH patch DR156_1_1_367825107: DRMode 0, DRFlags $0213;
    // the keydrop opt-in sets drops and pottery keys (Rom.py:731-740)
    const reading = decode(
      doorImage("DR156_1_1_367825107", {
        [DR.flags]: 0x13,
        [DR.flags + 1]: 0x02,
        [DR.multiClient]: 0x09,
        [DR.standingMask]: 0x03,
      }),
    );
    expect(doorShown(reading)).toEqual({
      // An image of zeros holds neither form of the item substitutions
      bombBag: "?unrecognized",
      doorShuffle: "vanilla",
      dropShuffle: "keys",
      pottery: "beyond-caves",
      shopsanity: false,
      takeAny: false,
      version: "1.5.6",
    });
    // DR writes no seed type (no 0x180210 in its Rom.py): never NoGlitches
    expect(shown(reading.logic)).toBe("?unrecognized");
  });

  it.each([
    [{}, ["vanilla", "none", "none"]],
    [{ [DR.mode]: 1 }, ["basic", "none", "none"]],
    [{ [DR.mode]: 2 }, ["shuffled", "none", "none"]],
    [
      { [DR.flags + 1]: 0x08, [DR.multiClient]: 0x01 },
      ["vanilla", "underworld", "none"],
    ],
    [{ [DR.multiClient]: 0x08 }, ["vanilla", "none", "cave"]],
  ])("reads %j as doors, drops and pots %j", (writes, expected) => {
    const door = decode(doorImage("DR156_1_1_1", writes)).door;
    expect(
      [door?.doorShuffle, door?.dropShuffle, door?.pottery].map((setting) =>
        setting === undefined ? undefined : shown(setting),
      ),
    ).toEqual(expected);
  });

  it("never reads a table the ROM does not hold as vanilla", () => {
    const rom = doorImage("DR156_1_1_1");
    rom.fill(0, DR.magic, DR.magic + 2);
    rom.fill(0, DR.version, DR.version + 16);
    expect(doorShown(decode(rom))).toMatchObject({
      doorShuffle: "?unrecognized",
      pottery: "?unrecognized",
      version: "?unrecognized",
    });
    expect(
      doorShown(
        decode(doorImage("DR156_1_1_1"), { unread: ["door-settings"] }),
      ),
    ).toMatchObject({ doorShuffle: "?not-read" });
  });

  it("reads DR's goals, its own Ganon goal included", () => {
    const goal = (writes: Readonly<Record<number, number>>) =>
      shown(decode(doorImage("DR156_1_1_1", writes)).goal);
    // Rom.py:1207-1218
    expect(goal({ [OFFSET.ganonVulnerable]: 0x03 })).toBe("ganon");
    expect(goal({ [OFFSET.ganonVulnerable]: 0x04 })).toBe("ganon");
    expect(goal({ [OFFSET.ganonVulnerable]: 0x04, [PYRAMID]: 0x20 })).toBe(
      "fast_ganon",
    );
    // Trinity: crystals, and pieces besides (1109-1110)
    expect(
      goal({ [OFFSET.ganonVulnerable]: 0x04, [OFFSET.goalItems]: 20 }),
    ).toBe("?unrecognized");
    expect(goal({ [OFFSET.ganonVulnerable]: 0x02 })).toBe("dungeons");
    expect(goal({ [OFFSET.ganonVulnerable]: 0x05 })).toBe("ganonhunt");
    // An alttpr.com seed's $03 is none vt writes
    expect(shown(decode(image({ [OFFSET.ganonVulnerable]: 0x03 })).goal)).toBe(
      "?unrecognized",
    );
  });

  it("hides the settings of a seed DR marks as Mystery, but the world", () => {
    for (const writes of [
      { [DR.multiClient]: 0x10 },
      { [DR.flags + 1]: 0x01 },
    ]) {
      const reading = decode(
        doorImage("DR156_1_1_1", { ...writes, [PROGRESS]: 0x02 }),
      );
      expect(settings(reading)).toMatchObject({
        crystalsGanon: "?mystery",
        goal: "?mystery",
        mode: "open",
        wildKeys: "?mystery",
      });
      expect(doorShown(reading)).toMatchObject({
        doorShuffle: "?mystery",
        pottery: "?mystery",
        version: "1.5.6",
      });
    }
  });

  it("reads the Overworld fork's settings for an OR title only", () => {
    const rom = doorImage("OR156_1_1_1", {
      [DR.owFlags]: 0x01,
      [DR.owFlags + 1]: 0x03,
      [DR.owMode + 1]: 0x06,
    });
    write(rom, DR.owVersion, "0.8.0.0-u");
    expect(doorShown(decode(rom))?.overworld).toEqual({
      bonkDrops: true,
      crossed: true,
      fluteShuffle: true,
      followers: false,
      layout: "vanilla",
      mixed: true,
      prizeShuffle: "inside",
      version: "0.8.0.0",
      whirlpool: true,
    });
    const grid = doorImage("OR156_1_1_1", {
      [DR.owFlags]: 0x06,
      [DR.owMode]: 0x01,
    });
    write(grid, DR.owVersion, "0.8.0.0");
    expect(doorShown(decode(grid))?.overworld?.layout).toBe("grid");
    expect(decode(doorImage("DR156_1_1_1")).door?.overworld).toBeUndefined();
    // No OWR version, no OWR table
    expect(doorShown(decode(doorImage("OR156_1_1_1")))?.overworld?.layout).toBe(
      "?unrecognized",
    );
  });
});

describe("decodeSeedSettings, the bomb bag of a DR or OWR seed", () => {
  /** The +5 bomb upgrade's entry: item, limit, replacement, filler. */
  const entry = (...bytes: number[]) =>
    Object.fromEntries(bytes.map((byte, i) => [DR.bombUpgrade + i, byte]));
  /** The bomb bag as a reading shows it. */
  const bagOf = (reading: SeedSettingsReading) =>
    (doorShown(reading) as Record<string, unknown> | undefined)?.bombBag;

  it("reads the bomb bag from the item substitutions DR writes", () => {
    const bag = (
      writes: Readonly<Record<number, number>>,
      title = "DR156_1_1_1",
    ) => bagOf(decode(doorImage(title, writes)));
    // Rom.py:1063: $00 and Bombs (10) with the bag, $06 and +10 without
    expect(bag(entry(0x51, 0x00, 0x31, 0xff))).toBe(true);
    expect(bag(entry(0x51, 0x06, 0x52, 0xff))).toBe(false);
    expect(bag(entry(0x51, 0x06, 0x52, 0xff), "OR157_1_1_1")).toBe(false);
    // Any other bytes, a table moved: never assumed off
    expect(bag(entry(0x51, 0x06, 0x31, 0xff))).toBe("?unrecognized");
    expect(bag(entry(0x53, 0x06, 0x52, 0xff))).toBe("?unrecognized");
    expect(bag({})).toBe("?unrecognized");
    // Without DR's own table, nothing of DR's is read
    const rom = doorImage("DR156_1_1_1", entry(0x51, 0x06, 0x52, 0xff));
    rom.fill(0, DR.magic, DR.magic + 2);
    expect(bagOf(decode(rom))).toBe("?unrecognized");
    expect(
      bagOf(
        decode(doorImage("DR156_1_1_1", entry(0x51, 0x00, 0x31, 0xff)), {
          race: true,
        }),
      ),
    ).toBe("?race-mode");
  });
});

describe("decodeSeedSettings, the Overworld fork's prizes and followers", () => {
  /** An OWR 0.8.0.2 image with these bytes, at a version. */
  const owr = (
    writes: Readonly<Record<number, number>>,
    version = "0.8.0.2-u",
  ) => {
    const rom = doorImage("OR157_1_1_1", writes);
    write(rom, DR.owVersion, version);
    return doorShown(decode(rom))?.overworld;
  };

  it.each([
    // FreeItemText keeps $10 and the dungeon items' bits (Rom.py:1432-1436)
    [{ [DR.freeItemText]: 0x10 }, "inside"],
    [{ [DR.freeItemText]: 0x5f }, "inside"],
    [{ [DR.freeItemText]: 0x30 }, "nearby"],
    // The compass mode's $40 only with $20: wild (Rom.py:1461-1462)
    [{ [DR.compassMode]: 0x41, [DR.freeItemText]: 0x30 }, "wild"],
    [{ [DR.compassMode]: 0x40, [DR.freeItemText]: 0x10 }, "inside"],
  ])("reads %j as the prizes %s", (writes, prizes) => {
    expect(owr(writes)?.prizeShuffle).toBe(prizes);
  });

  it("reads the followers shuffled from $02 alone, the base's byte or $01 not", () => {
    expect(owr({ [DR.smith]: 0x02 })?.followers).toBe(true);
    expect(owr({ [DR.smith]: 0x01 })?.followers).toBe(false);
    expect(owr({})?.followers).toBe(false);
  });

  it("reads neither from a fork before 0.6.0.0, nor without its version", () => {
    const old = owr({ [DR.freeItemText]: 0x30, [DR.smith]: 0x02 }, "0.5.1.5");
    expect(old).toMatchObject({
      followers: "?unrecognized",
      prizeShuffle: "?unrecognized",
    });
    expect(owr({}, "0.6.0.0")).toMatchObject({
      followers: false,
      prizeShuffle: "inside",
    });
    expect(owr({}, "0.10.0.0")?.followers).toBe(false);
    const none = doorImage("OR157_1_1_1", { [DR.smith]: 0x02 });
    expect(doorShown(decode(none))?.overworld).toMatchObject({
      followers: "?unrecognized",
      prizeShuffle: "?unrecognized",
    });
  });

  it("reads neither in Race Mode", () => {
    const rom = doorImage("OR157_1_1_1", { [DR.smith]: 0x02 });
    write(rom, DR.owVersion, "0.8.0.2-u");
    expect(doorShown(decode(rom, { race: true }))?.overworld).toMatchObject({
      followers: "?race-mode",
      prizeShuffle: "?race-mode",
    });
  });
});

describe("SEED_SETTINGS_RANGES", () => {
  const permitted = (category: string) =>
    ALTTPR_RACE_PROFILE.categories[category]?.permitted === true;

  it("lies in the base patches' tables of the ROM, every range in the memory map", () => {
    // DR's in banks $27 and $28 (doorrando.asm:15, standing_items.asm:116),
    // its Overworld fork's at ROM 0x150000, bank $2A; vt's all in bank $30
    const banks = SEED_SETTINGS_RANGES.map(
      (range) => `${range.id}:${(range.bus >>> 16).toString(16)}`,
    );
    expect(banks.slice(0, 3)).toEqual([
      "door-settings:27",
      "standing-items:28",
      "overworld-settings:2a",
    ]);
    for (const range of SEED_SETTINGS_RANGES.slice(3)) {
      expect(range.bus >>> 16, range.id).toBe(0x30);
    }
    for (const range of SEED_SETTINGS_RANGES) {
      expect(MEMORY_RANGES, range.id).toContain(range);
    }
  });

  it("is never race-permitted, nor inside Race Mode's memory", () => {
    const legal = SEED_SETTINGS_RANGES.filter((range) =>
      permitted(range.category),
    );
    expect(legal.map((range) => range.id)).toEqual([]);
    for (const { address, id, size } of SEED_SETTINGS_RANGES) {
      const inside = ALTTPR_RACE_PROFILE.permitted.some(
        (window) =>
          address < window.address + window.size &&
          window.address < address + size,
      );
      expect(inside, id).toBe(false);
    }
  });
});
