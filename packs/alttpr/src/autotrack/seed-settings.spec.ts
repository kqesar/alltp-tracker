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

describe("SEED_SETTINGS_RANGES", () => {
  const permitted = (category: string) =>
    ALTTPR_RACE_PROFILE.categories[category]?.permitted === true;

  it("lies in bank $30 of the ROM, every range in the memory map", () => {
    for (const range of SEED_SETTINGS_RANGES) {
      expect(range.bus >>> 16, range.id).toBe(0x30);
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
