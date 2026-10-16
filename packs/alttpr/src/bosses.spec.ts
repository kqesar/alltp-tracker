import { evaluate, loadRules, parse, type Tri } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { BOSS_SLOTS, BOSSES } from "./bosses";
import { HELPERS } from "./helpers";
import { stateFromUpstream } from "./items";
import { NAMED_RULES, RULES } from "./rules";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "./settings";

const rules = loadRules(RULES);

/** The three placements a rule can see: unset (the tests), advanced, basic. */
const TESTS = UPSTREAM_TEST;
const ADVANCED = OPEN;
const BASIC = settingsFromUpstream("open", { itemPlacement: "basic" });
const SWORDLESS = settingsFromUpstream("open", {
  itemPlacement: "advanced",
  "mode.weapons": "swordless",
});
const BASIC_SWORDLESS = settingsFromUpstream("open", {
  itemPlacement: "basic",
  "mode.weapons": "swordless",
});

const SETTINGS = {
  ADVANCED,
  BASIC,
  BASIC_SWORDLESS,
  SWORDLESS,
  TESTS,
} as const satisfies Record<string, AlttprSettings>;

type Row = readonly [
  settings: keyof typeof SETTINGS,
  items: readonly string[],
  expected: Tri,
];

function beat(
  name: string,
  settings: AlttprSettings,
  items: readonly string[],
): Tri {
  return evaluate(parse(`@${name}`), stateFromUpstream(items), rules, {
    settings,
  });
}

// Golden tables: the boss rules of the sourced research
// (alttpr-v31-rules-research.md, section 1, read from Boss.php:69-128),
// which upstream's tests reach only through the dungeons, at the unset
// placement. Each puts the weapons the research names on both sides of the
// line, and the basic and swordless branches apart from the advanced one.
const GOLDEN: Readonly<Record<keyof typeof BOSSES, readonly Row[]>> = {
  // The boss of Boss.php, which no region calls: Agahnim's own fight is in
  // HyruleCastleTower.php:62-66, where swords mode does not take a hammer
  canBeatAgahnim: [
    ["ADVANCED", [], "no"],
    ["ADVANCED", ["ProgressiveSword"], "yes"],
    ["ADVANCED", ["Hammer"], "yes"],
    ["ADVANCED", ["BugCatchingNet"], "yes"],
    ["ADVANCED", ["Bow", "FireRod"], "no"],
  ],
  canBeatAgahnim2: [
    ["ADVANCED", [], "no"],
    ["ADVANCED", ["ProgressiveSword"], "yes"],
    ["SWORDLESS", ["Hammer"], "yes"],
    ["SWORDLESS", ["BugCatchingNet"], "yes"],
    ["ADVANCED", ["Bow", "FireRod", "IceRod"], "no"],
  ],
  canBeatArmosKnights: [
    ["TESTS", [], "no"],
    ["TESTS", ["ProgressiveSword"], "yes"],
    ["TESTS", ["Hammer"], "yes"],
    ["TESTS", ["Bow"], "yes"],
    ["TESTS", ["Boomerang"], "yes"],
    ["TESTS", ["RedBoomerang"], "yes"],
    // A rod needs four magic bars: quarter magic, or half magic and a bottle
    ["TESTS", ["FireRod"], "no"],
    ["TESTS", ["IceRod", "HalfMagic"], "no"],
    ["TESTS", ["FireRod", "QuarterMagic"], "yes"],
    ["TESTS", ["IceRod", "HalfMagic", "Bottle"], "yes"],
    // A cane needs two: half magic or a bottle
    ["TESTS", ["CaneOfByrna"], "no"],
    ["TESTS", ["CaneOfByrna", "HalfMagic"], "yes"],
    ["TESTS", ["CaneOfSomaria", "Bottle"], "yes"],
    ["SWORDLESS", ["Hammer"], "yes"],
  ],
  canBeatArrghus: [
    ["TESTS", ["Hammer"], "no"],
    ["TESTS", ["Hookshot"], "no"],
    ["TESTS", ["Hookshot", "Hammer"], "yes"],
    ["ADVANCED", ["Hookshot", "ProgressiveSword"], "yes"],
    ["ADVANCED", ["Hookshot", "FireRod"], "no"],
    ["ADVANCED", ["Hookshot", "FireRod", "HalfMagic"], "yes"],
    ["ADVANCED", ["Hookshot", "IceRod", "Bow"], "yes"],
    // Basic wants the Master Sword, unless swordless
    ["BASIC", ["Hookshot", "ProgressiveSword"], "no"],
    ["BASIC", ["Hookshot", "Hammer"], "no"],
    ["BASIC", ["Hookshot", "MasterSword"], "yes"],
    ["BASIC_SWORDLESS", ["Hookshot", "Hammer"], "yes"],
  ],
  canBeatBlind: [
    ["TESTS", [], "no"],
    ["TESTS", ["Bow", "FireRod"], "no"],
    ["TESTS", ["ProgressiveSword"], "yes"],
    ["TESTS", ["Hammer"], "yes"],
    ["TESTS", ["CaneOfSomaria"], "yes"],
    ["TESTS", ["CaneOfByrna"], "yes"],
    // Basic wants a sword with the Cape or the Cane of Byrna, unless swordless
    ["BASIC", ["Hammer"], "no"],
    ["BASIC", ["ProgressiveSword"], "no"],
    ["BASIC", ["ProgressiveSword", "Cape"], "yes"],
    ["BASIC", ["ProgressiveSword", "CaneOfByrna"], "yes"],
    ["BASIC_SWORDLESS", ["Hammer"], "yes"],
  ],
  canBeatHelmasaurKing: [
    // Hammer alone does not do it: it breaks the mask, a sword or a bow kills
    ["ADVANCED", ["Hammer"], "no"],
    ["SWORDLESS", ["Hammer"], "no"],
    ["SWORDLESS", ["Hammer", "Bow"], "yes"],
    ["SWORDLESS", ["Bow"], "yes"],
    ["ADVANCED", ["ProgressiveSword"], "yes"],
    ["TESTS", ["ProgressiveSword"], "yes"],
    // Basic wants the Master Sword or a bow
    ["BASIC", ["ProgressiveSword"], "no"],
    ["BASIC", ["ProgressiveSword", "Hammer"], "no"],
    ["BASIC", ["MasterSword"], "yes"],
    ["BASIC", ["Bow"], "yes"],
  ],
  canBeatKholdstare: [
    // Something to melt the shell first
    ["TESTS", ["Hammer"], "no"],
    ["TESTS", ["FireRod", "Hammer"], "yes"],
    ["TESTS", ["Bombos", "ProgressiveSword"], "yes"],
    ["SWORDLESS", ["Bombos", "Hammer"], "yes"],
    // The Fire Rod alone needs three bars
    ["TESTS", ["FireRod"], "no"],
    ["TESTS", ["FireRod", "HalfMagic"], "no"],
    ["TESTS", ["FireRod", "HalfMagic", "Bottle"], "yes"],
    ["TESTS", ["FireRod", "QuarterMagic"], "yes"],
    // Bombos and the Fire Rod on two bars: swordless only
    ["SWORDLESS", ["FireRod", "Bombos", "HalfMagic"], "yes"],
    ["ADVANCED", ["FireRod", "Bombos", "HalfMagic"], "no"],
    // Basic wants the Master Sword, or the magic for the Fire Rod
    ["BASIC", ["FireRod", "Hammer"], "no"],
    ["BASIC", ["FireRod", "Hammer", "MasterSword"], "yes"],
    ["BASIC", ["FireRod", "QuarterMagic"], "yes"],
    ["BASIC_SWORDLESS", ["FireRod", "Bombos", "HalfMagic"], "yes"],
    ["BASIC_SWORDLESS", ["Bombos", "Hammer"], "no"],
  ],
  canBeatLanmolas: [
    ["TESTS", [], "no"],
    ["TESTS", ["Boomerang"], "no"],
    ["TESTS", ["ProgressiveSword"], "yes"],
    ["TESTS", ["Hammer"], "yes"],
    ["TESTS", ["Bow"], "yes"],
    ["TESTS", ["FireRod"], "yes"],
    ["TESTS", ["IceRod"], "yes"],
    ["TESTS", ["CaneOfByrna"], "yes"],
    ["TESTS", ["CaneOfSomaria"], "yes"],
  ],
  canBeatMoldorm: [
    ["TESTS", [], "no"],
    ["TESTS", ["Bow", "FireRod"], "no"],
    ["TESTS", ["ProgressiveSword"], "yes"],
    ["SWORDLESS", ["Hammer"], "yes"],
  ],
  canBeatMothula: [
    ["TESTS", [], "no"],
    ["TESTS", ["Hammer"], "yes"],
    ["TESTS", ["ProgressiveSword"], "yes"],
    ["TESTS", ["CaneOfSomaria"], "no"],
    ["TESTS", ["CaneOfSomaria", "HalfMagic"], "yes"],
    ["TESTS", ["FireRod", "Bottle"], "yes"],
    // A good bee in a bottle
    ["TESTS", ["BugCatchingNet", "Bottle", "PegasusBoots"], "yes"],
    // Basic wants the Master Sword, or the Fire Rod with two bars
    ["BASIC", ["Hammer"], "no"],
    ["BASIC", ["ProgressiveSword"], "no"],
    ["BASIC", ["MasterSword"], "yes"],
    ["BASIC", ["Hammer", "FireRod", "Bottle"], "yes"],
    ["BASIC", ["CaneOfByrna", "HalfMagic"], "no"],
  ],
  canBeatTrinexx: [
    // Both rods, always
    ["TESTS", ["FireRod", "Hammer"], "no"],
    ["TESTS", ["IceRod", "Hammer"], "no"],
    ["TESTS", ["FireRod", "IceRod"], "no"],
    ["TESTS", ["FireRod", "IceRod", "Hammer"], "yes"],
    ["TESTS", ["FireRod", "IceRod", "L3Sword"], "yes"],
    ["TESTS", ["FireRod", "IceRod", "MasterSword"], "no"],
    ["TESTS", ["FireRod", "IceRod", "MasterSword", "Bottle"], "yes"],
    ["TESTS", ["FireRod", "IceRod", "ProgressiveSword"], "no"],
    ["TESTS", ["FireRod", "IceRod", "ProgressiveSword", "QuarterMagic"], "yes"],
    // Basic wants the tempered sword, or the Master Sword with two bars,
    // unless swordless
    ["BASIC", ["FireRod", "IceRod", "Hammer"], "no"],
    ["BASIC", ["FireRod", "IceRod", "ProgressiveSword", "QuarterMagic"], "no"],
    ["BASIC", ["FireRod", "IceRod", "MasterSword", "HalfMagic"], "yes"],
    ["BASIC_SWORDLESS", ["FireRod", "IceRod", "Hammer"], "yes"],
  ],
  canBeatVitreous: [
    ["TESTS", [], "no"],
    ["TESTS", ["FireRod", "CaneOfSomaria"], "no"],
    ["TESTS", ["Hammer"], "yes"],
    ["TESTS", ["ProgressiveSword"], "yes"],
    ["TESTS", ["Bow"], "yes"],
    // Basic wants the Master Sword or a bow
    ["BASIC", ["Hammer"], "no"],
    ["BASIC", ["ProgressiveSword"], "no"],
    ["BASIC", ["Hammer", "Bow"], "yes"],
    ["BASIC", ["MasterSword"], "yes"],
  ],
};

describe("the bosses", () => {
  it("each have a golden table that can fail", () => {
    for (const [name, rows] of Object.entries(GOLDEN)) {
      const results = new Set(rows.map(([, , expected]) => expected));
      expect([...results].sort(), name).toEqual(["no", "yes"]);
    }
  });

  describe.each(Object.entries(GOLDEN))("%s", (name, rows) => {
    it.each(
      rows.map(([settings, items, expected]) => [
        `${items.join(", ") || "nothing"} (${settings})`,
        expected,
        settings,
        items,
      ]),
    )("with %s: %s", (_, expected, settings, items) => {
      expect(
        beat(
          name,
          SETTINGS[settings as keyof typeof SETTINGS],
          items as string[],
        ),
      ).toBe(expected);
    });
  });
});

describe("the boss slots", () => {
  it("give every dungeon of the Standard world its vanilla boss", () => {
    expect(
      Object.fromEntries(
        Object.entries(BOSS_SLOTS).map(([slot, { req }]) => [slot, req]),
      ),
    ).toEqual({
      canBeatDesertPalaceBoss: "@canBeatLanmolas",
      canBeatEasternPalaceBoss: "@canBeatArmosKnights",
      canBeatGanonsTowerBoss: "@canBeatAgahnim2",
      canBeatGanonsTowerBottomBoss: "@canBeatArmosKnights",
      canBeatGanonsTowerMiddleBoss: "@canBeatLanmolas",
      canBeatGanonsTowerTopBoss: "@canBeatMoldorm",
      canBeatIcePalaceBoss: "@canBeatKholdstare",
      canBeatMiseryMireBoss: "@canBeatVitreous",
      canBeatPalaceOfDarknessBoss: "@canBeatHelmasaurKing",
      canBeatSkullWoodsBoss: "@canBeatMothula",
      canBeatSwampPalaceBoss: "@canBeatArrghus",
      canBeatThievesTownBoss: "@canBeatBlind",
      canBeatTowerOfHeraBoss: "@canBeatMoldorm",
      canBeatTurtleRockBoss: "@canBeatTrinexx",
    });
  });

  it("read as their boss does", () => {
    const items = ["Hookshot", "Hammer"];
    expect(beat("canBeatSwampPalaceBoss", TESTS, items)).toBe("yes");
    expect(beat("canBeatSwampPalaceBoss", TESTS, ["Hammer"])).toBe("no");
  });
});

describe("the named rules", () => {
  it("never share a name, so none hides another", () => {
    const names = [
      ...Object.keys(HELPERS),
      ...Object.keys(BOSSES),
      ...Object.keys(BOSS_SLOTS),
    ];
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(NAMED_RULES)).toHaveLength(names.length);
    expect(Object.keys(RULES.helpers ?? {})).toHaveLength(names.length);
  });

  it("each cite an upstream line", () => {
    for (const [name, { source }] of Object.entries(NAMED_RULES)) {
      expect(source, name).toMatch(/^app\/[A-Za-z/]+\.php:\d+$/);
    }
  });
});
