import {
  dungeon,
  dungeonPool,
  LEGACY_DUNGEONS,
  OPEN,
  STANDARD,
  UNKNOWN,
} from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import {
  getPreset,
  presets,
  type RunSettings,
} from "@/games/alttpr/data/presets";
import {
  COUNTER_INDICES,
  counterMax,
  dungeonAt,
  dungeonName,
  glitchBounds,
  KEY_DUNGEONS,
  ownItems,
  packSettings,
  SMALL_KEYS_MAX,
  smallKeysMax,
  worldOf,
} from "@/games/alttpr/logic/settings";

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
  it("reads alttpr.com's goals, weapons and enemy health as the pack's", () => {
    expect(packSettings(run({ goal: "ganonhunt" })).ganonhuntGoal).toBe(true);
    // Completionist fills for every location (Randomizer.php:99-101)
    expect(packSettings(run({ goal: "completionist" }))).toMatchObject({
      completionistGoal: true,
      locationsAccessibility: true,
    });
    expect(packSettings(run({ swords: "assured" })).swordAtStart).toBe(true);
    expect(packSettings(run({ swords: "vanilla" }))).toEqual(
      packSettings(run()),
    );
    expect(packSettings(run()).defaultEnemyHealth).toBe(true);
    expect(packSettings(run({ enemyHealth: "hard" })).defaultEnemyHealth).toBe(
      false,
    );
    expect(packSettings(run({ enemyHealth: "easy" })).defaultEnemyHealth).toBe(
      false,
    );
  });

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
    // ... but behind shuffled entrances the seed is the entrance randomizer's
    // NoGlitches, without the boots, whatever it names
    // (EntranceRandomizer.php:84-91, Randomizer.php:122-131)
    const shuffled = run({ entranceShuffle: "full" });
    for (const glitches of [
      "overworld_glitches",
      "major_glitches",
      "no_logic",
    ] as const) {
      const settings = packSettings({ ...shuffled, glitches });
      expect(settings, glitches).toBe(packSettings(shuffled));
      expect(settings, glitches).toMatchObject({
        bootsAtStart: false,
        noLogic: false,
      });
    }
    expect(
      packSettings({
        ...shuffled,
        glitches: "no_logic",
        playGlitches: "major_glitches",
      }),
    ).toBe(packSettings(shuffled));
    // ... hidden glitches too: no bounds to read between
    expect(glitchBounds({ ...shuffled, hidden: ["glitches"] })).toBeUndefined();
    expect(packSettings({ ...shuffled, hidden: ["glitches"] })).toBe(
      packSettings(shuffled),
    );
    expect(glitchBounds({ ...run(), hidden: ["glitches"] })).toBeDefined();
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

  it("gives the pack a seed's logic, No Logic read with NoGlitches' rules", () => {
    const glitched = packSettings(run({ glitches: "overworld_glitches" }));
    // Randomizer.php:122-131: a glitched world starts with the boots
    expect(glitched).toMatchObject({ bootsAtStart: true, noLogic: false });
    expect(glitched).not.toBe(packSettings(run()));
    expect(packSettings(run({ glitches: "no_logic" }))).toEqual({
      ...OPEN,
      bootsAtStart: true,
      noLogic: true,
    });
    expect(packSettings(run())).toMatchObject({
      bootsAtStart: false,
      noLogic: false,
    });
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
      // A Mystery run's crystals are not known yet: 0 to 7
      expect(packSettings(preset.settings).crystalsTower, preset.id).toEqual(
        preset.id === "mystery" ? { between: [0, 7] } : 7,
      );
    }
  });

  it("passes a hidden setting to the pack as unknown, whatever stands in", () => {
    const hidden = packSettings({ ...run(), hidden: ["swordless", "goal"] });
    expect(hidden).toMatchObject({
      ganonGoal: UNKNOWN,
      swordless: UNKNOWN,
    });
    // Hiding gives another object: a world compiled for each is kept apart
    expect(hidden).not.toBe(packSettings(run()));
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

  it("counts Ganon's Tower's items: 20 in v31, its 27 locations in Full Shuffle", () => {
    expect(COUNTER_INDICES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12]);
    expect(counterMax(12, run())).toBe(20);
    expect(counterMax(12, run({ dungeonItems: "full" }))).toBe(27);
  });

  it("refuses an index past the thirteen key dungeons", () => {
    expect(() => counterMax(13, run())).toThrow(RangeError);
    expect(() => dungeonAt(-1)).toThrow(RangeError);
    expect(dungeonAt(9)).toBe("turtle-rock");
    expect(dungeonAt(12)).toBe("ganons-tower");
  });
});

describe("smallKeysMax", () => {
  it("gives each dungeon the small keys its pool holds (config/item.php:108-120)", () => {
    // Eastern Palace has none in v31; the others kept the tracker's old
    // count; then Hyrule Castle, Castle Tower and Ganon's Tower
    expect(SMALL_KEYS_MAX).toEqual([0, 1, 1, 6, 1, 3, 1, 2, 3, 4, 1, 2, 4]);
    expect(
      KEY_DUNGEONS.map((id) => dungeonPool(dungeon(id)).smallKeys),
    ).toEqual(SMALL_KEYS_MAX);
    expect(KEY_DUNGEONS.slice(0, 10)).toEqual(LEGACY_DUNGEONS);
    expect(smallKeysMax(0)).toBe(0);
    expect(smallKeysMax(3)).toBe(6);
    expect(smallKeysMax(12)).toBe(4);
  });

  it("refuses an index past the thirteen key dungeons", () => {
    expect(() => smallKeysMax(13)).toThrow(RangeError);
    expect(() => dungeonName(13)).toThrow(RangeError);
  });
});

describe("ownItems", () => {
  it("says which of its big key, map and compass each pool holds", () => {
    const all = { bigKey: true, compass: true, map: true };
    for (let index = 0; index < 10; index++)
      expect(ownItems(index)).toEqual(all);
    expect(ownItems(10)).toEqual({ bigKey: false, compass: false, map: true });
    expect(ownItems(11)).toEqual({ bigKey: false, compass: false, map: false });
    expect(ownItems(12)).toEqual(all);
    expect(dungeonName(11)).toBe("Castle Tower");
  });
});
