import {
  dungeon,
  dungeonPool,
  LEGACY_DUNGEONS,
  OPEN,
  STANDARD,
} from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { getPreset, presets, type RunSettings } from "@/data/presets";
import {
  counterMax,
  dungeonAt,
  packSettings,
  SMALL_KEYS_MAX,
  smallKeysMax,
  worldOf,
} from "@/logic/settings";

const run = (overrides: Partial<RunSettings> = {}): RunSettings => ({
  accessibility: "items",
  crystalsGanon: 7,
  crystalsTower: 7,
  dungeonItems: "standard",
  entranceShuffle: "none",
  goal: "ganon",
  itemFunctionality: "normal",
  itemPlacement: "advanced",
  itemPool: "normal",
  mode: "open",
  swordless: false,
  ...overrides,
});

describe("packSettings", () => {
  it("reads the Open and Standard presets as the site's default preset", () => {
    expect(packSettings(getPreset("open").settings)).toEqual(OPEN);
    expect(packSettings(getPreset("standard").settings)).toEqual(STANDARD);
  });

  it("turns every dungeon item wild for keysanity", () => {
    const settings = packSettings(getPreset("keysanity").settings);

    expect(settings).toMatchObject({
      wildBigKeys: true,
      wildCompasses: true,
      wildKeys: true,
      wildMaps: true,
    });
    expect(packSettings(run())).toMatchObject({
      wildBigKeys: false,
      wildCompasses: false,
      wildKeys: false,
      wildMaps: false,
    });
  });

  it.each([
    ["ganon", { fastGanonGoal: false, ganonGoal: true }],
    ["fast-ganon", { fastGanonGoal: true, ganonGoal: false }],
    ["all-dungeons", { dungeonsGoal: true, ganonGoal: false }],
    ["pedestal", { ganonGoal: false, pedestalGoal: true }],
    ["triforce-hunt", { ganonGoal: true }],
  ] as const)("gives the %s goal its pack goal", (goal, expected) => {
    expect(packSettings(run({ goal }))).toMatchObject(expected);
  });

  it("gives the pack a seed's crystal counts and its swords", () => {
    expect(
      packSettings(run({ crystalsGanon: 6, crystalsTower: 5 })),
    ).toMatchObject({ crystalsGanon: 6, crystalsTower: 5, swordless: false });
    // Swordless asks for the better bow (World.php:261-273)
    expect(packSettings(getPreset("swordless").settings)).toMatchObject({
      requireBetterBow: true,
      swordless: true,
    });
    expect(packSettings(run({ crystalsGanon: 6 }))).not.toBe(
      packSettings(run({ crystalsTower: 6 })),
    );
  });

  it("gives the pack a seed's item placement, accessibility, pool and functionality", () => {
    const hard = packSettings(
      run({
        accessibility: "locations",
        itemFunctionality: "hard",
        itemPlacement: "basic",
        itemPool: "hard",
      }),
    );

    expect(hard).toMatchObject({
      // Basic placement asks for the better bow and sword (World.php:261-277)
      basicPlacement: true,
      catchableFairies: false,
      forceSkullWoodsKey: true,
      fullBottleMagic: false,
      halfBottleMagic: true,
      locationsAccessibility: true,
      mirrorShieldInPool: false,
      requireBetterBow: true,
      requireBetterSword: true,
    });
    expect(packSettings(run())).toMatchObject({
      advancedPlacement: true,
      catchableFairies: true,
      fullBottleMagic: true,
      locationsAccessibility: false,
      mirrorShieldInPool: true,
    });
    for (const change of [
      { itemPlacement: "basic" },
      { accessibility: "none" },
      { itemPool: "expert" },
      { itemFunctionality: "expert" },
    ] as const) {
      expect(packSettings(run(change))).not.toBe(packSettings(run()));
    }
  });

  it("reads each world the pack models, and retro, which it does not, as Open", () => {
    expect(worldOf(packSettings(run({ mode: "inverted" })))).toBe("inverted");
    expect(worldOf(packSettings(run({ mode: "retro" })))).toBe("open");
    expect(worldOf(packSettings(run({ mode: "standard" })))).toBe("standard");
    expect(worldOf(packSettings(run()))).toBe("open");
  });

  it("gives equal run settings the same object, so its world is kept", () => {
    expect(packSettings(run({ dungeonItems: "full" }))).toBe(
      packSettings(getPreset("keysanity").settings),
    );
    expect(packSettings(run())).not.toBe(
      packSettings(run({ mode: "standard" })),
    );
  });

  it("maps every preset without throwing", () => {
    for (const preset of presets) {
      expect(packSettings(preset.settings).crystalsTower, preset.id).toBe(7);
    }
  });
});

describe("counterMax", () => {
  it("counts a dungeon's items but the map, compass and keys it keeps", () => {
    expect(
      Array.from({ length: 10 }, (_, index) => counterMax(index, run())),
    ).toEqual([3, 2, 2, 5, 6, 2, 4, 3, 2, 5]);
  });

  it("counts every location with keysanity (config/item.php:94-147)", () => {
    expect(
      Array.from({ length: 10 }, (_, index) =>
        counterMax(index, run({ dungeonItems: "full" })),
      ),
    ).toEqual([6, 6, 6, 14, 10, 8, 8, 8, 8, 12]);
  });

  it("counts the maps and compasses from MC Shuffle, the small keys from MCS", () => {
    const counters = (dungeonItems: "mc" | "mcs") =>
      Array.from({ length: 10 }, (_, index) =>
        counterMax(index, run({ dungeonItems })),
      );
    // Standard's, and each dungeon's map and compass
    expect(counters("mc")).toEqual([5, 4, 4, 7, 8, 4, 6, 5, 4, 7]);
    // Full Shuffle's, but the big key
    expect(counters("mcs")).toEqual([5, 5, 5, 13, 9, 7, 7, 7, 7, 11]);
  });

  it("refuses an index past the ten dungeons", () => {
    expect(() => counterMax(10, run())).toThrow(RangeError);
    expect(() => dungeonAt(-1)).toThrow(RangeError);
    expect(dungeonAt(9)).toBe("turtle-rock");
  });
});

describe("smallKeysMax", () => {
  it("gives each dungeon the small keys its pool holds (config/item.php:108-120)", () => {
    // Eastern Palace has none in v31; the others kept the tracker's old count
    expect(SMALL_KEYS_MAX).toEqual([0, 1, 1, 6, 1, 3, 1, 2, 3, 4]);
    expect(
      LEGACY_DUNGEONS.map((id) => dungeonPool(dungeon(id)).smallKeys),
    ).toEqual(SMALL_KEYS_MAX);
    expect(smallKeysMax(0)).toBe(0);
    expect(smallKeysMax(3)).toBe(6);
  });

  it("refuses an index past the ten dungeons", () => {
    expect(() => smallKeysMax(10)).toThrow(RangeError);
  });
});
