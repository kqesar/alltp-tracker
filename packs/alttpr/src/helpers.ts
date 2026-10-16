// The item helpers every rule calls (`$items->canLiftRocks()`,
// `$items->hasSword(2)`…), as named engine rules: a region writes
// `@canLiftRocks`, `@hasSword2`.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31),
// app/Support/ItemCollection.php, over the items of items.ts. Only the
// helpers the Standard and Open regions and the bosses call are here.
//
// The engine has no parameters, so an argument becomes part of the name:
// the bare name is the call with its default argument, a suffix is any
// other argument. `hasSword()` is `@hasSword`, `hasSword(2)` `@hasSword2`;
// `canExtendMagic()`, whose default is 2 bars, is `@canExtendMagic`, and
// `canExtendMagic($world, 3)` `@canExtendMagic3`; `canKillMostThings($world)`
// (5 enemies) is `@canKillMostThings`, `canKillMostThings($world, 8)`
// `@canKillMostThings8`. A `$world` argument only lets the helper read the
// settings, which `setting()` does here.

import type { Source } from "./location";

/** A named rule: what `@name` stands for, and where upstream says it. */
export interface Rule {
  readonly req: string;
  readonly source: Source;
}

const at = (line: number): Source => `app/Support/ItemCollection.php:${line}`;

/** The upstream item counts, for the helpers that add items up. */
const HEART_CONTAINERS = 11;
const PIECES_OF_HEART = 24;

/**
 * hasHealth($minimum) sums the power of the health items collected: 1 for
 * a heart container, a quarter for a piece of heart (Item.php:116, 131,
 * 155-156). The three hearts Link starts with do not count. The engine has
 * no fractions, so this lists every way to reach `minimum` within the
 * pool's 11 containers and 24 pieces.
 */
function hasHealth(minimum: number): string {
  const ways: string[] = [];
  for (let containers = Math.min(minimum, HEART_CONTAINERS); ; containers--) {
    const pieces = 4 * (minimum - containers);
    if (containers < 0 || pieces > PIECES_OF_HEART) break;
    const terms = [
      ...(containers > 0 ? [`heartContainer >= ${containers}`] : []),
      ...(pieces > 0 ? [`pieceOfHeart >= ${pieces}`] : []),
    ];
    ways.push(terms.join(" & "));
  }
  return ways.join(" | ");
}

export const HELPERS = {
  /**
   * rom.CatchableFairies is read only when a world is passed, which
   * canBunnyRevive always does (444-450, 462).
   */
  canAcquireFairy: { req: "setting(catchableFairies)", source: at(444) },
  /** Inverted's way to wake the bird is not this world's (420-428). */
  canActivateOcarina: { req: "true", source: at(420) },
  canBlockLasers: { req: "shield >= 3", source: at(500) },
  canBombThings: { req: "true", source: at(602) },
  canBunnyRevive: {
    req: "@hasABottle & bugCatchingNet & @canAcquireFairy",
    source: at(457),
  },
  /**
   * canExtendMagic($world, $bars) (513-526): a base of 4 with quarter
   * magic, 2 with half magic, else 1, and as much again per bottle, at
   * least `bars`. One bar is always there.
   */
  canExtendMagic: { req: "magic | bottle", source: at(513) },
  canExtendMagic1: { req: "true", source: at(513) },
  canExtendMagic3: {
    req: "magic >= 2 | magic & bottle | bottle >= 2",
    source: at(513),
  },
  canExtendMagic4: {
    req: "magic >= 2 | magic & bottle | bottle >= 3",
    source: at(513),
  },
  canFly: {
    req: "flute >= 2 | flute & @canActivateOcarina",
    source: at(415),
  },
  canGetGoodBee: {
    req: "bugCatchingNet & @hasABottle & (pegasusBoots | @hasSword & quake)",
    source: at(612),
  },
  /**
   * has('UncleSword') is `sword`: the pack counts the uncle's sword as a
   * progressive sword (items.ts), so any sword passes here.
   */
  canKillEscapeThings: {
    req: "sword | caneOfSomaria | tenBombs & setting(defaultEnemyHealth) | caneOfByrna & setting(defaultEnemyHealth) | @canShootArrows | hammer | fireRod | setting(ignoreCanKillEscapeThings)",
    source: at(562),
  },
  /** 5 enemies: bombs do, and the Cane of Byrna needs no extra magic. */
  canKillMostThings: {
    req: "@hasSword | caneOfSomaria | @canBombThings & setting(defaultEnemyHealth) | caneOfByrna & setting(defaultEnemyHealth) | @canShootArrows | hammer | fireRod",
    source: at(584),
  },
  /** 8 enemies: no bombs, and the Cane of Byrna needs the magic for it. */
  canKillMostThings8: {
    req: "@hasSword | caneOfSomaria | caneOfByrna & @canExtendMagic & setting(defaultEnemyHealth) | @canShootArrows | hammer | fireRod",
    source: at(584),
  },
  canLiftDarkRocks: { req: "glove >= 2", source: at(378) },
  canLiftRocks: { req: "glove", source: at(366) },
  canLightTorches: { req: "fireRod | lamp", source: at(389) },
  canMeltThings: {
    req: "fireRod | bombos & (setting(swordless) | @hasSword)",
    source: at(402),
  },
  /**
   * Level 1. Retro's rupee bow (rom.rupeeBow), which also wants a bought
   * arrow, is not modeled: any bow shoots.
   */
  canShootArrows: { req: "bow", source: at(486) },
  /** Silver arrows: the bow that has them, or the upgrade with any bow. */
  canShootArrows2: {
    req: "bow >= 2 | silverArrowUpgrade & bow",
    source: at(479),
  },
  canSpinSpeed: {
    req: "pegasusBoots & (@hasSword | hookshot)",
    source: at(435),
  },
  hasABottle: { req: "bottle", source: at(709) },
  hasArmor: { req: "armor", source: at(673) },
  hasBottle2: { req: "bottle >= 2", source: at(687) },
  hasHealth7: { req: hasHealth(7), source: at(546) },
  hasHealth12: { req: hasHealth(12), source: at(546) },
  hasSword: { req: "sword", source: at(648) },
  hasSword2: { req: "sword >= 2", source: at(640) },
  hasSword3: { req: "sword >= 3", source: at(635) },
} as const satisfies Readonly<Record<string, Rule>>;

/**
 * Item groups for `count()`. The crystal count is what the tower and Ganon
 * compare with crystals.tower and crystals.ganon (GanonsTower.php:401-407).
 */
export const GROUPS = {
  crystal: [
    "crystal1",
    "crystal2",
    "crystal3",
    "crystal4",
    "crystal5",
    "crystal6",
    "crystal7",
  ],
} as const satisfies Readonly<Record<string, readonly string[]>>;
