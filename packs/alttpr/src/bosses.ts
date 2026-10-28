// The bosses: each one's canBeat as a named rule, and the boss each dungeon
// fights.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31),
// app/Boss.php:68-129 for the rules, and each region's constructor for its
// boss (`$this->boss = Boss::get(...)`). A region's rule reads its boss
// through its slot: `@canBeatEasternPalaceBoss` is `$this->boss->canBeat`
// in EasternPalace.php. Boss shuffle (enemizer.bossShuffle, Randomizer.php:
// 361-452) rebinds the slots: the `bossShuffle` setting and the facts of
// what the player knows of each slot's boss (BOSS_FACTS) pick the rule.
//
// `!setting(basicPlacement)` is upstream's `itemPlacement !== 'basic'`,
// true in the advanced placement and in the upstream tests, which set no
// placement. Swordless needs no setting where upstream reads none: a
// swordless world holds no sword, so `@hasSword` is simply false there.

import type { Rule } from "./helpers";
import type { LocationFill, Source } from "./location";

const at = (line: number): Source => `app/Boss.php:${line}`;

export const BOSSES = {
  canBeatAgahnim: {
    req: "@hasSword | hammer | bugCatchingNet",
    source: at(83),
  },
  canBeatAgahnim2: {
    req: "@hasSword | hammer | bugCatchingNet",
    source: at(126),
  },
  canBeatArmosKnights: {
    req: "@hasSword | hammer | @canShootArrows | boomerang | redBoomerang | @canExtendMagic4 & (fireRod | iceRod) | @canExtendMagic & (caneOfByrna | caneOfSomaria)",
    source: at(69),
  },
  canBeatArrghus: {
    req: "(!setting(basicPlacement) | setting(swordless) | @hasSword2) & hookshot & (hammer | @hasSword | (@canExtendMagic | @canShootArrows) & (fireRod | iceRod))",
    source: at(91),
  },
  canBeatBlind: {
    req: "(!setting(basicPlacement) | setting(swordless) | @hasSword & (cape | caneOfByrna)) & (@hasSword | hammer | caneOfSomaria | caneOfByrna)",
    source: at(103),
  },
  canBeatHelmasaurKing: {
    req: "(@canBombThings | hammer) & (@hasSword2 | @canShootArrows | !setting(basicPlacement) & @hasSword)",
    source: at(86),
  },
  canBeatKholdstare: {
    req: "(!setting(basicPlacement) | @hasSword2 | @canExtendMagic3 & fireRod | bombos & (setting(swordless) | @hasSword) & @canExtendMagic & fireRod) & @canMeltThings & (hammer | @hasSword | @canExtendMagic3 & fireRod | @canExtendMagic & fireRod & bombos & setting(swordless))",
    source: at(108),
  },
  canBeatLanmolas: {
    req: "@hasSword | hammer | @canShootArrows | fireRod | iceRod | caneOfByrna | caneOfSomaria",
    source: at(75),
  },
  canBeatMoldorm: { req: "@hasSword | hammer", source: at(80) },
  canBeatMothula: {
    req: "(!setting(basicPlacement) | @hasSword2 | @canExtendMagic & fireRod) & (@hasSword | hammer | @canExtendMagic & (fireRod | caneOfSomaria | caneOfByrna) | @canGetGoodBee)",
    source: at(96),
  },
  canBeatTrinexx: {
    req: "fireRod & iceRod & (!setting(basicPlacement) | setting(swordless) | @hasSword3 | @canExtendMagic & @hasSword2) & (@hasSword3 | hammer | @canExtendMagic & @hasSword2 | @canExtendMagic4 & @hasSword)",
    source: at(119),
  },
  canBeatVitreous: {
    req: "(!setting(basicPlacement) | @hasSword2 | @canShootArrows) & (hammer | @hasSword | @canShootArrows)",
    source: at(115),
  },
} as const satisfies Readonly<Record<string, Rule>>;

const region = (file: string, line: number): Source =>
  `app/Region/Standard/${file}.php:${line}`;

/**
 * The bosses boss shuffle places: Boss::all (Boss.php:68-129) less the two
 * Agahnims, which `canPlaceBoss` refuses everywhere (Region.php:98-111);
 * Ganon is no boss of Boss::all's.
 */
export const SHUFFLED_BOSSES = [
  "armosKnights",
  "lanmolas",
  "moldorm",
  "helmasaurKing",
  "arrghus",
  "mothula",
  "blind",
  "kholdstare",
  "vitreous",
  "trinexx",
] as const;
export type ShuffledBoss = (typeof SHUFFLED_BOSSES)[number];

/** Tower of Hera's and Ganon's Tower's top: no room for these five. */
const NARROW = [
  "armosKnights",
  "arrghus",
  "blind",
  "lanmolas",
  "trinexx",
] as const satisfies readonly ShuffledBoss[];

/**
 * The thirteen slots `placeBosses` fills (Randomizer.php:361-449), under
 * the prefix of their facts: each one's named rule, and the bosses its
 * `canPlaceBoss` refuses beside the Agahnims (TowerOfHera.php:74-92,
 * SkullWoods.php:81-97, GanonsTower.php:148-183 by level, Region.php:98-111
 * for the rest). Agahnim 2 at Ganon's Tower's top (`canBeatGanonsTowerBoss`)
 * and Agahnim in Castle Tower never move (Randomizer.php:451-452).
 */
export const BOSS_PLACES = {
  desertPalace: { refuses: [], rule: "canBeatDesertPalaceBoss" },
  easternPalace: { refuses: [], rule: "canBeatEasternPalaceBoss" },
  ganonsTowerBottom: { refuses: [], rule: "canBeatGanonsTowerBottomBoss" },
  ganonsTowerMiddle: {
    refuses: ["blind"],
    rule: "canBeatGanonsTowerMiddleBoss",
  },
  ganonsTowerTop: { refuses: NARROW, rule: "canBeatGanonsTowerTopBoss" },
  icePalace: { refuses: [], rule: "canBeatIcePalaceBoss" },
  miseryMire: { refuses: [], rule: "canBeatMiseryMireBoss" },
  palaceOfDarkness: { refuses: [], rule: "canBeatPalaceOfDarknessBoss" },
  skullWoods: { refuses: ["trinexx"], rule: "canBeatSkullWoodsBoss" },
  swampPalace: { refuses: [], rule: "canBeatSwampPalaceBoss" },
  thievesTown: { refuses: [], rule: "canBeatThievesTownBoss" },
  towerOfHera: { refuses: NARROW, rule: "canBeatTowerOfHeraBoss" },
  turtleRock: { refuses: [], rule: "canBeatTurtleRockBoss" },
} as const satisfies Readonly<
  Record<
    string,
    { readonly refuses: readonly ShuffledBoss[]; readonly rule: string }
  >
>;
export type BossPlaceId = keyof typeof BOSS_PLACES;

/** What the player knows of each slot's boss; a slot left out is unknown. */
export type BossKnowledge = Partial<
  Readonly<Record<BossPlaceId, ShuffledBoss>>
>;

const capital = (word: string) =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

const PLACE_IDS = Object.keys(BOSS_PLACES) as BossPlaceId[];

/** The bosses a slot may hold under boss shuffle, in Boss::all's order. */
export function bossesAt(place: BossPlaceId): readonly ShuffledBoss[] {
  const refuses: readonly ShuffledBoss[] = BOSS_PLACES[place].refuses;
  return SHUFFLED_BOSSES.filter((boss) => !refuses.includes(boss));
}

const factOf = (place: BossPlaceId, boss: ShuffledBoss) =>
  `${place}BossIs${capital(boss)}`;
const unknownFactOf = (place: BossPlaceId) => `${place}BossUnknown`;

/** Every fact a slot may read: `easternPalaceBossIsBlind` … `…BossUnknown`. */
export const BOSS_FACTS: readonly string[] = PLACE_IDS.flatMap((place) => [
  ...bossesAt(place).map((boss) => factOf(place, boss)),
  unknownFactOf(place),
]);

/**
 * The facts that hold, each at 1, for what the player knows: a slot's boss
 * once known, else its Unknown fact. A boss its slot cannot hold is no
 * knowledge a seed could give: the slot stays unknown.
 */
export function bossFacts(
  known: BossKnowledge,
): Readonly<Record<string, number>> {
  const facts: Record<string, number> = {};
  for (const place of PLACE_IDS) {
    const boss = known[place];
    const fact =
      boss !== undefined && bossesAt(place).includes(boss)
        ? factOf(place, boss)
        : unknownFactOf(place);
    facts[fact] = 1;
  }
  return facts;
}

/** A boss's canBeat, as BOSSES names it. */
const canBeat = (boss: ShuffledBoss) => `@canBeat${capital(boss)}`;

/**
 * A slot's boss under boss shuffle, as far as the player knows it: the boss
 * known, or, while unknown, every boss the slot may hold beaten (yes), some
 * (maybe), none (no). Swordless keeps Kholdstare in Ice Palace alone
 * (Randomizer.php:380-394, Region.php:100-105): elsewhere it counts only
 * with swords.
 */
function shuffledRule(place: BossPlaceId): string {
  const bosses = bossesAt(place);
  const all = bosses.map((boss) =>
    boss === "kholdstare"
      ? `(setting(swordless) | ${canBeat(boss)})`
      : canBeat(boss),
  );
  const any = bosses.map((boss) =>
    boss === "kholdstare"
      ? `!setting(swordless) & ${canBeat(boss)}`
      : canBeat(boss),
  );
  return [
    ...bosses.map((boss) => `${factOf(place, boss)} & ${canBeat(boss)}`),
    `${unknownFactOf(place)} & (${all.join(" & ")} | maybe & (${any.join(" | ")}))`,
  ].join(" | ");
}

/**
 * The boss each region fights without boss shuffle: `Region::$boss` as its
 * constructor sets it, as `placeBosses` does for 'none' (Randomizer.php:
 * 434-447). Ganon's Tower has four: Agahnim 2 and the three it meets on the
 * way up (`boss_bottom`, `boss_middle`, `boss_top`). Agahnim in Hyrule
 * Castle Tower and Ganon are not fought through Boss::canBeat: their
 * regions' rules say what beats them.
 */
const VANILLA_SLOTS = {
  canBeatDesertPalaceBoss: {
    req: "@canBeatLanmolas",
    source: region("DesertPalace", 52),
  },
  canBeatEasternPalaceBoss: {
    req: "@canBeatArmosKnights",
    source: region("EasternPalace", 48),
  },
  canBeatGanonsTowerBoss: {
    req: "@canBeatAgahnim2",
    source: region("GanonsTower", 47),
  },
  canBeatGanonsTowerBottomBoss: {
    req: "@canBeatArmosKnights",
    source: region("GanonsTower", 50),
  },
  canBeatGanonsTowerMiddleBoss: {
    req: "@canBeatLanmolas",
    source: region("GanonsTower", 49),
  },
  canBeatGanonsTowerTopBoss: {
    req: "@canBeatMoldorm",
    source: region("GanonsTower", 48),
  },
  canBeatIcePalaceBoss: {
    req: "@canBeatKholdstare",
    source: region("IcePalace", 47),
  },
  canBeatMiseryMireBoss: {
    req: "@canBeatVitreous",
    source: region("MiseryMire", 47),
  },
  canBeatPalaceOfDarknessBoss: {
    req: "@canBeatHelmasaurKing",
    source: region("PalaceOfDarkness", 47),
  },
  canBeatSkullWoodsBoss: {
    req: "@canBeatMothula",
    source: region("SkullWoods", 54),
  },
  canBeatSwampPalaceBoss: {
    req: "@canBeatArrghus",
    source: region("SwampPalace", 47),
  },
  canBeatThievesTownBoss: {
    req: "@canBeatBlind",
    source: region("ThievesTown", 47),
  },
  canBeatTowerOfHeraBoss: {
    req: "@canBeatMoldorm",
    source: region("TowerOfHera", 50),
  },
  canBeatTurtleRockBoss: {
    req: "@canBeatTrinexx",
    source: region("TurtleRock", 57),
  },
} as const satisfies Readonly<Record<string, Rule>>;
type SlotName = keyof typeof VANILLA_SLOTS;

/** A slot's rule: its vanilla boss, or, with boss shuffle, `shuffledRule`. */
function slotRule(name: SlotName): Rule {
  const { req, source } = VANILLA_SLOTS[name];
  const place = PLACE_IDS.find((id) => BOSS_PLACES[id].rule === name);
  if (place === undefined) return { req, source };
  const either = `!setting(bossShuffle) & ${req} | setting(bossShuffle) & (${shuffledRule(place)})`;
  return {
    // Swordless keeps Kholdstare in Ice Palace, shuffled or not
    // (Randomizer.php:380-383)
    req:
      place === "icePalace"
        ? `setting(swordless) & ${req} | !setting(swordless) & (${either})`
        : either,
    source,
  };
}

/**
 * The boss each region fights, `Region::$boss`, which the region rules read
 * through its slot. Without boss shuffle (enemizer.bossShuffle 'none'), the
 * vanilla one. With it ('simple', 'full' or 'random': Randomizer.php:
 * 396-433), any boss its slot's `canPlaceBoss` takes, which the player
 * learns on meeting it (`shuffledRule`). 'simple' places each boss once
 * (and Armos, Lanmolas and Moldorm twice), 'full' and 'random' may repeat
 * them: a slot alone may hold the same bosses in all three. The generator
 * fills the seed with each region's rule calling `$this->boss->canBeat`, so
 * a slot whose boss is known reads as upstream's.
 */
export const BOSS_SLOTS = Object.fromEntries(
  (Object.keys(VANILLA_SLOTS) as SlotName[]).map((name) => [
    name,
    slotRule(name),
  ]),
) as Readonly<Record<SlotName, Rule>>;

/** Where a dungeon file writes the parts of its boss that dungeonBoss ports. */
export interface BossLines {
  /** The region file. */
  readonly file: `app/Region/${string}.php`;
  /** The rule's map and compass clauses (`hasItem` on the boss itself). */
  readonly holding: number;
  /** setFillRules. */
  readonly fill: number;
  /** setAlwaysAllow. */
  readonly always: number;
}

/**
 * A dungeon boss's rule: `base`, plus its dungeon's map and compass with
 * wild maps or compasses, unless it holds that item itself, which `req`
 * reads as `maybe` and `holding` settles. `code` is the dungeon's (`P1`),
 * `source` the line of the rule's map and compass clauses.
 */
export function bossRule(
  base: string,
  code: string,
  source: Source,
): {
  readonly holding: NonNullable<LocationFill["holding"]>;
  readonly req: string;
} {
  const compass = `(!setting(wildCompasses) | compass${code})`;
  const map = `(!setting(wildMaps) | map${code})`;
  return {
    holding: {
      items: {
        [`Compass${code}`]: `${base} & ${map}`,
        [`Map${code}`]: `${base} & ${compass}`,
      },
      otherwise: `${base} & ${compass} & ${map}`,
      source,
    },
    req: `${base} & (!setting(wildCompasses) | compass${code} | maybe) & (!setting(wildMaps) | map${code} | maybe)`,
  };
}

/**
 * A dungeon boss's rule (bossRule) and what Location::canFill reads of it,
 * which every dungeon file writes alike (EasternPalace.php:84-105). With
 * region.bossNormalLocation, the default, the boss always takes its own
 * compass and map; without, it takes no dungeon item at all.
 */
export function dungeonBoss(
  base: string,
  code: string,
  lines: BossLines,
): { readonly req: string; readonly fill: LocationFill } {
  const source = (line: number): Source => `${lines.file}:${line}`;
  const { holding, req } = bossRule(base, code, source(lines.holding));
  return {
    fill: {
      always: {
        items: [`Compass${code}`, `Map${code}`],
        req: "setting(bossNormalLocation)",
        source: source(lines.always),
      },
      holding,
      refuse: [
        {
          refuse: { classes: ["bigKey", "compass", "key", "map"] },
          source: source(lines.fill),
          when: "!setting(bossNormalLocation)",
        },
      ],
    },
    req,
  };
}
