import { compileWorld, isIdentifier, type Settings } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { loadFixtures } from "../test/fixtures";
import {
  type AlttprSettings,
  OPEN,
  STANDARD,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "./settings";

const GLITCHES = [
  "canBootsClip",
  "canBunnyRevive",
  "canBunnySurf",
  "canDungeonRevive",
  "canFakeFlipper",
  "canMirrorClip",
  "canMirrorWrap",
  "canOneFrameClipOW",
  "canOneFrameClipUW",
  "canOWYBA",
  "canSuperBunny",
  "canSuperSpeed",
  "canTransitionWrapped",
  "canWaterWalk",
] as const;

const NUMBERS = ["crystalsGanon", "crystalsTower", "requireLamp"];

const pick = (settings: AlttprSettings, keys: readonly string[]) =>
  Object.fromEntries(
    keys.map((key) => [key, settings[key as keyof AlttprSettings]]),
  );

describe("the settings", () => {
  it("are the engine's flat flags and numbers, under names a rule can use", () => {
    // A type check as much as a runtime one: the settings are engine Settings
    const settings: Settings = UPSTREAM_TEST;
    for (const [key, value] of Object.entries(settings)) {
      expect(isIdentifier(key), key).toBe(true);
      if (NUMBERS.includes(key)) {
        expect(Number.isSafeInteger(value) && Number(value) >= 0, key).toBe(
          true,
        );
      } else {
        expect(typeof value, key).toBe("boolean");
      }
    }
  });

  it("fold into a compiled world, each with the type the engine wants", () => {
    // One location per setting: a flag as a condition, a number as a threshold
    const locations = Object.keys(UPSTREAM_TEST).map((key) => ({
      id: key,
      req: NUMBERS.includes(key) ? `a >= setting(${key})` : `setting(${key})`,
    }));
    const world = compileWorld(
      { regions: [{ id: "r", locations }], start: "r" },
      undefined,
      { items: ["a"], settings: UPSTREAM_TEST },
    );
    expect(world.locationIds).toHaveLength(Object.keys(UPSTREAM_TEST).length);
  });

  it("model NoGlitches only: every glitch flag is off", () => {
    for (const settings of [OPEN, STANDARD, UPSTREAM_TEST]) {
      expect(Object.values(pick(settings, GLITCHES))).toEqual(
        GLITCHES.map(() => false),
      );
    }
    expect(() =>
      settingsFromUpstream("standard", { logic: "OverworldGlitches" }),
    ).toThrow(/"logic" cannot be "OverworldGlitches"/);
  });
});

describe("the presets", () => {
  it("are the site's default, in an Open and a Standard world", () => {
    expect(OPEN).toMatchObject({
      advancedPlacement: true,
      basicPlacement: false,
      crystalsGanon: 7,
      crystalsTower: 7,
      ganonGoal: true,
      locationsAccessibility: false,
      requireBetterBow: false,
      requireBetterSword: false,
      standardMode: false,
      swordless: false,
      wildBigKeys: false,
      wildCompasses: false,
      wildKeys: false,
      wildMaps: false,
    });
    expect({ ...STANDARD, standardMode: false }).toEqual(OPEN);
    expect(STANDARD.standardMode).toBe(true);
  });

  it("include the upstream tests' world, which sets no item placement", () => {
    expect(UPSTREAM_TEST).toMatchObject({
      advancedPlacement: false,
      basicPlacement: false,
      standardMode: true,
    });
    // Everything else is a default, as in the presets
    expect({
      ...UPSTREAM_TEST,
      advancedPlacement: true,
      standardMode: false,
    }).toEqual(OPEN);
  });

  it("are what the fixtures' worlds and cases ask for", () => {
    const configs = loadFixtures().flatMap((fixture) => {
      const world = fixture.worlds.world;
      if (world === undefined) return [];
      return [
        settingsFromUpstream(world.mode, world.config),
        ...fixture.cases.flatMap((c) =>
          c.kind === "regionFill"
            ? [
                settingsFromUpstream(world.mode, {
                  ...world.config,
                  ...c.config,
                }),
              ]
            : [],
        ),
      ];
    });
    expect(configs.length).toBeGreaterThan(23);
    const worlds = new Set(configs.map((settings) => JSON.stringify(settings)));
    // Standard and Open, and the four ways the cases set maps and compasses
    expect(worlds.size).toBe(4);
    expect(configs).toContainEqual(UPSTREAM_TEST);
    expect(configs).toContainEqual({ ...UPSTREAM_TEST, standardMode: false });
    expect(configs).toContainEqual({ ...UPSTREAM_TEST, wildMaps: true });
    expect(configs).toContainEqual({ ...UPSTREAM_TEST, wildCompasses: true });
  });
});

describe("settingsFromUpstream", () => {
  it.each([
    ["standard", false, false, false, false],
    ["mc", false, false, true, true],
    ["mcs", true, false, true, true],
    ["full", true, true, true, true],
  ] as const)(
    "dungeonItems %s: wild keys %s, big keys %s, maps %s, compasses %s",
    (dungeonItems, wildKeys, wildBigKeys, wildMaps, wildCompasses) => {
      expect(
        pick(settingsFromUpstream("open", { dungeonItems }), [
          "wildKeys",
          "wildBigKeys",
          "wildMaps",
          "wildCompasses",
        ]),
      ).toEqual({ wildBigKeys, wildCompasses, wildKeys, wildMaps });
    },
  );

  it("lets dungeonItems win over a flag the config turns off, as World.php does", () => {
    const mixed = settingsFromUpstream("open", {
      dungeonItems: "mc",
      "region.wildKeys": true,
      "region.wildMaps": false,
    });
    expect(pick(mixed, ["wildKeys", "wildMaps", "wildBigKeys"])).toEqual({
      wildBigKeys: false,
      wildKeys: true,
      wildMaps: true,
    });
  });

  it.each([
    ["basic", "randomized", true, true, true],
    ["advanced", "randomized", false, false, false],
    [undefined, "randomized", false, false, false],
    ["advanced", "swordless", true, false, false],
    ["basic", "swordless", true, true, true],
  ] as const)(
    "%s placement, %s: better bow %s, better sword %s, Skull Woods key %s",
    (itemPlacement, weapons, bow, sword, skullWoodsKey) => {
      const settings = settingsFromUpstream("open", {
        "mode.weapons": weapons,
        ...(itemPlacement === undefined ? {} : { itemPlacement }),
      });
      expect(
        pick(settings, [
          "requireBetterBow",
          "requireBetterSword",
          "forceSkullWoodsKey",
          "swordless",
        ]),
      ).toEqual({
        forceSkullWoodsKey: skullWoodsKey,
        requireBetterBow: bow,
        requireBetterSword: sword,
        swordless: weapons === "swordless",
      });
    },
  );

  it.each([
    ["ganon", "ganonGoal"],
    ["fast_ganon", "fastGanonGoal"],
    ["dungeons", "dungeonsGoal"],
    ["pedestal", "pedestalGoal"],
    ["completionist", "completionistGoal"],
  ] as const)("goal %s sets %s and no other goal", (goal, flag) => {
    const goals = pick(settingsFromUpstream("open", { goal }), [
      "ganonGoal",
      "fastGanonGoal",
      "dungeonsGoal",
      "pedestalGoal",
      "completionistGoal",
    ]);
    expect(Object.entries(goals).filter(([, on]) => on)).toEqual([
      [flag, true],
    ]);
  });

  it("reads the numbers and flags the rules compare with", () => {
    expect(
      settingsFromUpstream("standard", {
        accessibility: "locations",
        "crystals.ganon": 5,
        "crystals.tower": 0,
        "enemizer.enemyHealth": "hard",
        ignoreCanKillEscapeThings: true,
        "item.overflow.count.Shield": 2,
        "item.require.Lamp": 0,
        "region.bossNormalLocation": false,
        "region.cantTakeDamage": true,
        "region.swordsInPool": false,
        "rom.CatchableFairies": false,
      }),
    ).toMatchObject({
      bossNormalLocation: false,
      cantTakeDamage: true,
      catchableFairies: false,
      crystalsGanon: 5,
      crystalsTower: 0,
      defaultEnemyHealth: false,
      ignoreCanKillEscapeThings: true,
      locationsAccessibility: true,
      mirrorShieldInPool: false,
      requireLamp: 0,
      swordsInPool: false,
    });
    expect(
      settingsFromUpstream("open", { "item.overflow.count.Shield": 3 })
        .mirrorShieldInPool,
    ).toBe(true);
  });

  it("takes the shields from the item pool, over any count the config gave", () => {
    const shields = (config: Record<string, unknown>) =>
      settingsFromUpstream("open", config).mirrorShieldInPool;

    expect(shields({ "item.pool": "normal" })).toBe(true);
    for (const pool of ["hard", "expert", "superexpert", "crowd_control"]) {
      expect(shields({ "item.pool": pool }), pool).toBe(false);
    }
    expect(
      shields({ "item.overflow.count.Shield": 3, "item.pool": "hard" }),
    ).toBe(false);
  });

  it("takes fairies and a bottle's magic refill from the item functionality", () => {
    const of = (functionality: string) => {
      const settings = settingsFromUpstream("open", {
        "item.functionality": functionality,
        "rom.CatchableFairies": true,
      });
      return [
        settings.catchableFairies,
        settings.fullBottleMagic,
        settings.halfBottleMagic,
        settings.quarterBottleMagic,
      ];
    };

    expect(of("normal")).toEqual([true, true, false, false]);
    expect(of("hard")).toEqual([false, false, true, false]);
    expect(of("expert")).toEqual([false, false, false, true]);
    expect(of("superexpert")).toEqual([false, false, false, false]);
    expect(OPEN.fullBottleMagic).toBe(true);
  });

  it("refuses what the pack does not model, where upstream would read it", () => {
    expect(() => settingsFromUpstream("inverted")).toThrow(
      /mode "inverted" is not modeled/,
    );
    expect(() =>
      settingsFromUpstream("open", { "rom.rupeeBow": true }),
    ).toThrow(/"rom.rupeeBow" is not modeled/);
    expect(() =>
      settingsFromUpstream("open", { goal: "triforce-hunt" }),
    ).toThrow(/"goal" cannot be "triforce-hunt"/);
    expect(() => settingsFromUpstream("open", { "crystals.tower": 8 })).toThrow(
      /"crystals.tower" cannot be 8/,
    );
    expect(() =>
      settingsFromUpstream("open", { "crystals.ganon": -1 }),
    ).toThrow(/"crystals.ganon" cannot be -1/);
    expect(() =>
      settingsFromUpstream("open", { "region.wildMaps": "yes" }),
    ).toThrow(/"region.wildMaps" cannot be "yes"/);
  });
});
