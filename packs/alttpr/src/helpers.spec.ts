import {
  compileWorld,
  evaluate,
  loadRules,
  parse,
  type Tri,
} from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { GROUPS, HELPERS } from "./helpers";
import { ITEM_IDS, stateFromUpstream } from "./items";
import {
  type AlttprSettings,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "./settings";

const rules = loadRules({
  groups: GROUPS,
  helpers: Object.fromEntries(
    Object.entries(HELPERS).map(([name, { req }]) => [name, req]),
  ),
});

/** A helper's value for upstream items, in the upstream tests' world. */
function helper(
  name: keyof typeof HELPERS,
  items: readonly string[],
  settings: Partial<AlttprSettings> = {},
): Tri {
  return evaluate(parse(`@${name}`), stateFromUpstream(items), rules, {
    settings: { ...UPSTREAM_TEST, ...settings },
  });
}

type Row = readonly [
  items: readonly string[],
  expected: Tri,
  settings?: Partial<AlttprSettings>,
];

// Each table reads the PHP: the items a branch asks for give yes, and the
// ones it lacks give no. Items are upstream's names, so the tables also
// hold the item mapping of items.ts to what the PHP tests with has().
const TABLES: Readonly<Partial<Record<keyof typeof HELPERS, readonly Row[]>>> =
  {
    canAcquireFairy: [
      [[], "yes"],
      [[], "no", { catchableFairies: false }],
    ],
    canActivateOcarina: [
      [[], "yes"],
      [[], "no", { invertedMode: true }],
      [["MoonPearl"], "no", { invertedMode: true }],
      [["DefeatAgahnim"], "no", { invertedMode: true }],
      [["MoonPearl", "DefeatAgahnim"], "yes", { invertedMode: true }],
      [["MoonPearl", "Hammer"], "no", { invertedMode: true }],
      [
        ["MoonPearl", "Hammer", "ProgressiveGlove"],
        "yes",
        { invertedMode: true },
      ],
      [["MoonPearl", "ProgressiveGlove"], "no", { invertedMode: true }],
      [["MoonPearl", "TitansMitt"], "yes", { invertedMode: true }],
    ],
    canBlockLasers: [
      [["ProgressiveShield", "ProgressiveShield"], "no"],
      [["ProgressiveShield", "ProgressiveShield", "ProgressiveShield"], "yes"],
      [["MirrorShield"], "yes"],
      [["RedShield"], "no"],
    ],
    canBombThings: [[[], "yes"]],
    canBunnyRevive: [
      [["Bottle", "BugCatchingNet"], "yes"],
      [["BottleWithFairy", "BugCatchingNet"], "yes"],
      [["Bottle"], "no"],
      [["BugCatchingNet"], "no"],
      [["Bottle", "BugCatchingNet"], "no", { catchableFairies: false }],
    ],
    canExtendMagic: [
      [[], "no"],
      [["HalfMagic"], "yes"],
      [["QuarterMagic"], "yes"],
      [["Bottle"], "yes"],
    ],
    canExtendMagic1: [[[], "yes"]],
    canExtendMagic3: [
      [["HalfMagic"], "no"],
      [["Bottle"], "no"],
      [["Bottle", "BottleWithBee"], "yes"],
      [["HalfMagic", "Bottle"], "yes"],
      [["QuarterMagic"], "yes"],
    ],
    canExtendMagic4: [
      [["HalfMagic"], "no"],
      [["Bottle", "Bottle"], "no"],
      [["Bottle", "Bottle", "Bottle"], "yes"],
      [["HalfMagic", "Bottle"], "yes"],
      [["QuarterMagic"], "yes"],
    ],
    canFly: [
      [[], "no"],
      [["OcarinaInactive"], "yes"],
      [["OcarinaActive"], "yes"],
      [["Flute"], "yes"],
    ],
    canGetGoodBee: [
      [["BugCatchingNet", "Bottle", "PegasusBoots"], "yes"],
      [["BugCatchingNet", "Bottle", "ProgressiveSword", "Quake"], "yes"],
      [["BugCatchingNet", "Bottle", "Quake"], "no"],
      [["BugCatchingNet", "Bottle"], "no"],
      [["Bottle", "PegasusBoots"], "no"],
      [["BugCatchingNet", "PegasusBoots"], "no"],
    ],
    canKillEscapeThings: [
      [[], "no"],
      [["UncleSword"], "yes"],
      [["CaneOfSomaria"], "yes"],
      [["TenBombs"], "yes"],
      [["TenBombs"], "no", { defaultEnemyHealth: false }],
      [["CaneOfByrna"], "yes"],
      [["CaneOfByrna"], "no", { defaultEnemyHealth: false }],
      [["Bow"], "yes"],
      [["Hammer"], "yes"],
      [["FireRod"], "yes"],
      [["IceRod"], "no"],
      [[], "yes", { ignoreCanKillEscapeThings: true }],
    ],
    canKillMostThings: [
      // canBombThings() is always true, and 5 enemies is below 6
      [[], "yes"],
      [[], "no", { defaultEnemyHealth: false }],
      [["CaneOfByrna"], "no", { defaultEnemyHealth: false }],
      [["CaneOfSomaria"], "yes", { defaultEnemyHealth: false }],
      [["ProgressiveSword"], "yes", { defaultEnemyHealth: false }],
      [["Bow"], "yes", { defaultEnemyHealth: false }],
      [["Hammer"], "yes", { defaultEnemyHealth: false }],
      [["FireRod"], "yes", { defaultEnemyHealth: false }],
      [["IceRod"], "no", { defaultEnemyHealth: false }],
    ],
    canKillMostThings8: [
      [[], "no"],
      [["CaneOfByrna"], "no"],
      [["CaneOfByrna", "HalfMagic"], "yes"],
      [["CaneOfByrna", "Bottle"], "yes"],
      [["CaneOfByrna", "HalfMagic"], "no", { defaultEnemyHealth: false }],
      [["L1Sword"], "yes"],
      [["CaneOfSomaria"], "yes"],
      [["BowAndArrows"], "yes"],
      [["Hammer"], "yes"],
      [["FireRod"], "yes"],
    ],
    canLiftDarkRocks: [
      [["PowerGlove"], "no"],
      [["ProgressiveGlove"], "no"],
      [["ProgressiveGlove", "ProgressiveGlove"], "yes"],
      [["TitansMitt"], "yes"],
    ],
    canLiftRocks: [
      [[], "no"],
      [["PowerGlove"], "yes"],
      [["ProgressiveGlove"], "yes"],
      [["TitansMitt"], "yes"],
    ],
    canLightTorches: [
      [[], "no"],
      [["Lamp"], "yes"],
      [["FireRod"], "yes"],
      [["IceRod"], "no"],
    ],
    canMeltThings: [
      [[], "no"],
      [["FireRod"], "yes"],
      [["Bombos"], "no"],
      [["Bombos", "ProgressiveSword"], "yes"],
      [["Bombos"], "yes", { swordless: true }],
      [["ProgressiveSword"], "no", { swordless: true }],
    ],
    canShootArrows: [
      [[], "no"],
      [["Bow"], "yes"],
      [["BowAndArrows"], "yes"],
      [["BowAndSilverArrows"], "yes"],
      [["ProgressiveBow"], "yes"],
      [["SilverArrowUpgrade"], "no"],
    ],
    canShootArrows2: [
      [["Bow"], "no"],
      [["ProgressiveBow"], "no"],
      [["ProgressiveBow", "ProgressiveBow"], "yes"],
      [["BowAndSilverArrows"], "yes"],
      [["Bow", "SilverArrowUpgrade"], "yes"],
      [["BowAndArrows", "SilverArrowUpgrade"], "yes"],
      [["ProgressiveBow", "SilverArrowUpgrade"], "yes"],
      [["SilverArrowUpgrade"], "no"],
    ],
    canSpinSpeed: [
      [["PegasusBoots"], "no"],
      [["PegasusBoots", "ProgressiveSword"], "yes"],
      [["PegasusBoots", "Hookshot"], "yes"],
      [["ProgressiveSword", "Hookshot"], "no"],
    ],
    hasABottle: [
      [[], "no"],
      [["Bottle"], "yes"],
      [["BottleWithGoldBee"], "yes"],
    ],
    hasArmor: [
      [[], "no"],
      [["ProgressiveArmor"], "yes"],
      [["BlueMail"], "yes"],
      [["RedMail"], "yes"],
    ],
    hasBottle2: [
      [["Bottle"], "no"],
      [["Bottle", "BottleWithBee"], "yes"],
    ],
    hasHealth7: [
      [[], "no"],
      [
        [...Array(6).fill("HeartContainer"), ...Array(3).fill("PieceOfHeart")],
        "no",
      ],
      [
        [
          ...Array(6).fill("BossHeartContainer"),
          ...Array(4).fill("PieceOfHeart"),
        ],
        "yes",
      ],
      [Array(7).fill("HeartContainerNoAnimation"), "yes"],
      [["HeartContainer", ...Array(24).fill("PieceOfHeart")], "yes"],
      [Array(24).fill("PieceOfHeart"), "no"],
    ],
    hasHealth12: [
      [
        [...Array(11).fill("HeartContainer"), ...Array(3).fill("PieceOfHeart")],
        "no",
      ],
      [
        [...Array(11).fill("HeartContainer"), ...Array(4).fill("PieceOfHeart")],
        "yes",
      ],
      [
        [...Array(6).fill("HeartContainer"), ...Array(24).fill("PieceOfHeart")],
        "yes",
      ],
      [
        [...Array(5).fill("HeartContainer"), ...Array(24).fill("PieceOfHeart")],
        "no",
      ],
    ],
    hasSword: [
      [[], "no"],
      [["ProgressiveSword"], "yes"],
      [["UncleSword"], "yes"],
      [["L1Sword"], "yes"],
      [["L1SwordAndShield"], "yes"],
    ],
    hasSword2: [
      [["ProgressiveSword"], "no"],
      [["L1Sword"], "no"],
      [["ProgressiveSword", "ProgressiveSword"], "yes"],
      [["UncleSword", "ProgressiveSword"], "yes"],
      [["MasterSword"], "yes"],
      [["L2Sword"], "yes"],
    ],
    hasSword3: [
      [["MasterSword"], "no"],
      [["ProgressiveSword", "ProgressiveSword"], "no"],
      [["ProgressiveSword", "ProgressiveSword", "ProgressiveSword"], "yes"],
      [["UncleSword", "ProgressiveSword", "ProgressiveSword"], "yes"],
      [["L3Sword"], "yes"],
      [["L4Sword"], "yes"],
    ],
  };

/** "6 HeartContainer, 3 PieceOfHeart (catchableFairies: false)" */
function label(
  items: readonly string[],
  settings: Partial<AlttprSettings> = {},
): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  const held = [...counts]
    .map(([item, n]) => (n > 1 ? `${n} ${item}` : item))
    .join(", ");
  const options = Object.entries(settings)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
  return `${held || "nothing"}${options ? ` (${options})` : ""}`;
}

describe("the item helpers", () => {
  it("have a table each, and every table can fail", () => {
    expect(Object.keys(TABLES).sort()).toEqual(Object.keys(HELPERS).sort());
    for (const [name, rows] of Object.entries(TABLES)) {
      const results = new Set(rows.map(([, expected]) => expected));
      // A helper that is always true has nothing to fail on
      if (HELPERS[name as keyof typeof HELPERS].req === "true") continue;
      expect([...results].sort(), name).toEqual(["no", "yes"]);
    }
  });

  describe.each(Object.entries(TABLES))("%s", (name, rows) => {
    it.each(
      rows.map(([items, expected, settings]) => [
        label(items, settings),
        expected,
        items,
        settings,
      ]),
    )("with %s: %s", (_, expected, items, settings) => {
      expect(
        helper(
          name as keyof typeof HELPERS,
          items as readonly string[],
          settings as Partial<AlttprSettings> | undefined,
        ),
      ).toBe(expected);
    });
  });

  it("load, and name only the pack's items", () => {
    // compileWorld checks helper bodies against the item list
    const world = compileWorld(
      {
        regions: [
          {
            id: "r",
            locations: Object.keys(HELPERS).map((name) => ({
              id: name,
              req: `@${name}`,
            })),
          },
        ],
        start: "r",
      },
      rules,
      { items: ITEM_IDS, settings: UPSTREAM_TEST },
    );
    expect(world.locationIds).toHaveLength(Object.keys(HELPERS).length);
  });

  it("extend magic as upstream reckons it, for every bottle refill", () => {
    // ItemCollection.php:513-526, with rom.BottleFill.Magic per item
    // functionality (World.php:216-259)
    const REFILL = { expert: 0.25, hard: 0.5, normal: 1, superexpert: 0 };
    const MAGIC = [[], ["HalfMagic"], ["QuarterMagic"]];
    const BARS = {
      canExtendMagic: 2,
      canExtendMagic3: 3,
      canExtendMagic4: 4,
    } as const;
    for (const [functionality, refill] of Object.entries(REFILL)) {
      const settings = settingsFromUpstream("standard", {
        "item.functionality": functionality,
      });
      for (const [level, magic] of MAGIC.entries()) {
        for (let bottles = 0; bottles <= 4; bottles++) {
          const items = [...magic, ...Array(bottles).fill("Bottle")];
          const base = [1, 2, 4][level] as number;
          for (const [name, bars] of Object.entries(BARS)) {
            const expected = base + base * bottles * refill >= bars;
            expect(
              helper(name as keyof typeof HELPERS, items, settings),
              `${name}, ${functionality}, ${label(items)}`,
            ).toBe(expected ? "yes" : "no");
          }
        }
      }
    }
  });

  it("list every way to the health a rule asks for", () => {
    expect(HELPERS.hasHealth7.req).toBe(
      "heartContainer >= 7 | heartContainer >= 6 & pieceOfHeart >= 4 | heartContainer >= 5 & pieceOfHeart >= 8 | heartContainer >= 4 & pieceOfHeart >= 12 | heartContainer >= 3 & pieceOfHeart >= 16 | heartContainer >= 2 & pieceOfHeart >= 20 | heartContainer >= 1 & pieceOfHeart >= 24",
    );
    expect(HELPERS.hasHealth12.req.split(" | ")).toHaveLength(6);
  });
});
