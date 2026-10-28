import { evaluate, loadRules, parse, type Tri } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import {
  BOSS_FACTS,
  BOSS_PLACES,
  BOSS_SLOTS,
  BOSSES,
  type BossKnowledge,
  type BossPlaceId,
  bossesAt,
  bossFacts,
  SHUFFLED_BOSSES,
  type ShuffledBoss,
} from "./bosses";
import { HELPERS } from "./helpers";
import { stateFromUpstream } from "./items";
import { MEDALLION_RULES } from "./medallions";
import { NAMED_RULES, RULES } from "./rules";
import {
  type AlttprSettings,
  OPEN,
  settingsFromUpstream,
  UNKNOWN,
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

/** A slot's rule with what the player knows of the bosses. */
function slot(
  name: keyof typeof BOSS_SLOTS,
  settings: AlttprSettings,
  items: readonly string[],
  known: BossKnowledge = {},
): Tri {
  return evaluate(
    parse(`@${name}`),
    { ...stateFromUpstream(items), ...bossFacts(known) },
    rules,
    { settings },
  );
}

/** Every item set of the golden tables, to hold a slot to its boss with. */
const ITEM_SETS = [
  ...new Set(
    Object.values(GOLDEN).flatMap((rows) =>
      rows.map(([, items]) => items.join(",")),
    ),
  ),
].map((items) => (items === "" ? [] : items.split(",")));

const shuffled = (
  bossShuffle: "simple" | "full" | "random" | typeof UNKNOWN,
  config: Record<string, unknown> = {},
) =>
  settingsFromUpstream("standard", {
    "enemizer.bossShuffle": bossShuffle,
    itemPlacement: "advanced",
    ...config,
  });
const FULL = shuffled("full");

/**
 * Beats Moldorm, Helmasaur King, Mothula, Kholdstare and Vitreous in the
 * advanced placement, and Armos, Lanmolas and Blind too: neither Arrghus
 * (no hookshot) nor Trinexx (no ice rod).
 */
const NO_ARRGHUS_NOR_TRINEXX = ["ProgressiveSword", "Hammer", "FireRod"];

/** alttpr.com's bGbbOaDWGP (boss shuffle "full"): its spoiler's bosses. */
const SEED_BOSSES: Readonly<Record<BossPlaceId, ShuffledBoss>> = {
  desertPalace: "helmasaurKing",
  easternPalace: "helmasaurKing",
  ganonsTowerBottom: "trinexx",
  ganonsTowerMiddle: "mothula",
  ganonsTowerTop: "vitreous",
  icePalace: "vitreous",
  miseryMire: "blind",
  palaceOfDarkness: "arrghus",
  skullWoods: "blind",
  swampPalace: "lanmolas",
  thievesTown: "moldorm",
  towerOfHera: "kholdstare",
  turtleRock: "armosKnights",
};

describe("the boss slots", () => {
  const VANILLA = {
    canBeatDesertPalaceBoss: "canBeatLanmolas",
    canBeatEasternPalaceBoss: "canBeatArmosKnights",
    canBeatGanonsTowerBoss: "canBeatAgahnim2",
    canBeatGanonsTowerBottomBoss: "canBeatArmosKnights",
    canBeatGanonsTowerMiddleBoss: "canBeatLanmolas",
    canBeatGanonsTowerTopBoss: "canBeatMoldorm",
    canBeatIcePalaceBoss: "canBeatKholdstare",
    canBeatMiseryMireBoss: "canBeatVitreous",
    canBeatPalaceOfDarknessBoss: "canBeatHelmasaurKing",
    canBeatSkullWoodsBoss: "canBeatMothula",
    canBeatSwampPalaceBoss: "canBeatArrghus",
    canBeatThievesTownBoss: "canBeatBlind",
    canBeatTowerOfHeraBoss: "canBeatMoldorm",
    canBeatTurtleRockBoss: "canBeatTrinexx",
  } as const satisfies Record<keyof typeof BOSS_SLOTS, keyof typeof BOSSES>;

  it.each(Object.entries(SETTINGS))(
    "give every dungeon its vanilla boss without boss shuffle (%s)",
    (_, settings) => {
      expect(Object.keys(BOSS_SLOTS).sort()).toEqual(
        Object.keys(VANILLA).sort(),
      );
      for (const [name, boss] of Object.entries(VANILLA)) {
        for (const items of ITEM_SETS) {
          expect(
            slot(name as keyof typeof VANILLA, settings, items),
            `${name} with ${items.join(", ")}`,
          ).toBe(beat(boss, settings, items));
        }
      }
    },
  );

  it("let each slot hold the bosses its canPlaceBoss takes", () => {
    expect(bossesAt("towerOfHera")).toEqual([
      "moldorm",
      "helmasaurKing",
      "mothula",
      "kholdstare",
      "vitreous",
    ]);
    expect(bossesAt("ganonsTowerTop")).toEqual(bossesAt("towerOfHera"));
    expect(bossesAt("skullWoods")).not.toContain("trinexx");
    expect(bossesAt("ganonsTowerMiddle")).not.toContain("blind");
    expect(bossesAt("turtleRock")).toEqual(SHUFFLED_BOSSES);
    expect(Object.keys(BOSS_PLACES)).toHaveLength(13);
    // A real seed's bosses each sit in a slot that may hold them
    for (const [place, boss] of Object.entries(SEED_BOSSES)) {
      expect(bossesAt(place as BossPlaceId), place).toContain(boss);
    }
  });

  it("are maybe while some boss the slot may hold is not beaten", () => {
    // The defect: bGbbOaDWGP's Misery Mire and Turtle Rock read as their
    // vanilla bosses, Vitreous and Trinexx, whatever the seed placed
    const items = NO_ARRGHUS_NOR_TRINEXX;
    expect(slot("canBeatMiseryMireBoss", OPEN, items)).toBe("yes");
    expect(slot("canBeatMiseryMireBoss", FULL, items)).toBe("maybe");
    expect(slot("canBeatTurtleRockBoss", FULL, items)).toBe("maybe");
    expect(slot("canBeatSkullWoodsBoss", FULL, items)).toBe("maybe");
    // Neither Arrghus nor Trinexx fits at Tower of Hera nor at the top
    expect(slot("canBeatTowerOfHeraBoss", FULL, items)).toBe("yes");
    expect(slot("canBeatGanonsTowerTopBoss", FULL, items)).toBe("yes");
  });

  it("are yes when every boss is beaten, no when none is", () => {
    const everything = [
      ...NO_ARRGHUS_NOR_TRINEXX,
      "Hookshot",
      "IceRod",
      "ProgressiveSword",
      "ProgressiveSword",
    ];
    for (const bossShuffle of ["simple", "full", "random"] as const) {
      const settings = shuffled(bossShuffle);
      for (const name of Object.keys(BOSS_SLOTS)) {
        const rule = name as keyof typeof BOSS_SLOTS;
        expect(slot(rule, settings, everything), name).toBe("yes");
        expect(slot(rule, settings, []), name).toBe("no");
      }
    }
    // Lanmolas falls to the fire rod alone: maybe, never no
    expect(slot("canBeatEasternPalaceBoss", FULL, ["FireRod"])).toBe("maybe");
  });

  it("read the boss the player knows exactly", () => {
    const blind = { miseryMire: "blind" } as const;
    expect(slot("canBeatMiseryMireBoss", FULL, ["Hammer"], blind)).toBe("yes");
    expect(slot("canBeatMiseryMireBoss", FULL, ["FireRod"], blind)).toBe("no");
    const basic = shuffled("full", { itemPlacement: "basic" });
    expect(slot("canBeatMiseryMireBoss", basic, ["Hammer"], blind)).toBe("no");
    expect(
      slot("canBeatMiseryMireBoss", basic, ["ProgressiveSword", "Cape"], blind),
    ).toBe("yes");
    // Another slot's knowledge leaves Misery Mire unknown
    expect(
      slot("canBeatMiseryMireBoss", FULL, ["Hammer"], { turtleRock: "blind" }),
    ).toBe("maybe");
    // A boss its slot cannot hold is no knowledge: the slot stays unknown
    expect(bossFacts({ towerOfHera: "trinexx" })).toMatchObject({
      towerOfHeraBossUnknown: 1,
    });
    expect(BOSS_FACTS).not.toContain("towerOfHeraBossIsTrinexx");
  });

  it("keep Kholdstare in Ice Palace alone when swordless", () => {
    const swordless = shuffled("full", { "mode.weapons": "swordless" });
    const melt = ["FireRod", "Hammer"];
    expect(slot("canBeatIcePalaceBoss", swordless, melt)).toBe(
      beat("canBeatKholdstare", swordless, melt),
    );
    expect(slot("canBeatIcePalaceBoss", swordless, melt)).toBe("yes");
    expect(slot("canBeatIcePalaceBoss", FULL, melt)).toBe("maybe");
    // Elsewhere, Kholdstare is no boss a swordless seed places: the slot
    // asks nothing to melt him
    const noMelt = [
      "Hammer",
      "Hookshot",
      "IceRod",
      "Bow",
      "BottleWithBee",
      "HalfMagic",
    ];
    // Skull Woods never holds Trinexx, the one other boss left unbeaten
    expect(slot("canBeatSkullWoodsBoss", swordless, noMelt)).toBe("yes");
    expect(slot("canBeatSkullWoodsBoss", FULL, noMelt)).toBe("maybe");
  });

  it("are maybe at most while a Mystery run hides boss shuffle", () => {
    const hidden = shuffled(UNKNOWN);
    const items = NO_ARRGHUS_NOR_TRINEXX;
    // Vitreous, the vanilla boss, is beaten; another may not be
    expect(slot("canBeatMiseryMireBoss", hidden, items)).toBe("maybe");
    expect(slot("canBeatTowerOfHeraBoss", hidden, items)).toBe("yes");
    expect(slot("canBeatTurtleRockBoss", hidden, items)).toBe("maybe");
    expect(slot("canBeatTurtleRockBoss", hidden, [])).toBe("no");
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
      ...Object.keys(MEDALLION_RULES),
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
