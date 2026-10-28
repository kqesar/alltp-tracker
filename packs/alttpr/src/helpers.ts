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

import { STATE_MAX } from "./items";
import type { Source } from "./location";

/** A named rule: what `@name` stands for, and where upstream says it. */
export interface Rule {
  readonly req: string;
  readonly source: Source;
}

const at = (line: number): Source => `app/Support/ItemCollection.php:${line}`;

/** The most heart containers and pieces a state holds. */
const HEART_CONTAINERS = STATE_MAX.get("heartContainer") ?? 0;
const PIECES_OF_HEART = STATE_MAX.get("pieceOfHeart") ?? 0;

/**
 * hasHealth($minimum) sums the power of the health items collected: 1 for
 * a heart container, a quarter for a piece of heart (Item.php:116, 131,
 * 155-156). The collection holds the three boss heart containers every
 * world is given (Randomizer.php:46-56), Link's 3 starting hearts, so
 * `@hasHealth7` is 7 hearts on screen; toState puts them in the state. The
 * engine has no fractions, so this lists every way to reach `minimum`
 * within the state's 14 containers and the pool's 24 pieces.
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
  /**
   * Waking the bird (420-428): anywhere but in Inverted, where it needs Link
   * in the Light World's north east, with the pearl.
   */
  canActivateOcarina: {
    req: "!setting(invertedMode) | moonPearl & (defeatAgahnim | hammer & @canLiftRocks | @canLiftDarkRocks)",
    source: at(420),
  },
  canBlockLasers: { req: "shield >= 3", source: at(500) },
  canBombThings: { req: "true", source: at(602) },
  canBunnyRevive: {
    req: "@hasABottle & bugCatchingNet & @canAcquireFairy",
    source: at(457),
  },
  /**
   * canExtendMagic($world, $bars) (513-526): a base of 4 with quarter
   * magic, 2 with half magic, else 1, and the base again per bottle times
   * what a bottle refills (all of it, half, a quarter or none, by the item
   * functionality), at least `bars`. One bar is always there. Each branch
   * is the fewest bottles that reach `bars` from a base, of the 4 a pool
   * holds: from a base of 1 a half refill never reaches 4 bars.
   */
  canExtendMagic: {
    req: "magic | setting(fullBottleMagic) & bottle | setting(halfBottleMagic) & bottle >= 2 | setting(quarterBottleMagic) & bottle >= 4",
    source: at(513),
  },
  canExtendMagic1: { req: "true", source: at(513) },
  canExtendMagic3: {
    req: "magic >= 2 | magic & (setting(fullBottleMagic) & bottle | setting(halfBottleMagic) & bottle | setting(quarterBottleMagic) & bottle >= 2) | setting(fullBottleMagic) & bottle >= 2 | setting(halfBottleMagic) & bottle >= 4",
    source: at(513),
  },
  canExtendMagic4: {
    req: "magic >= 2 | magic & (setting(fullBottleMagic) & bottle | setting(halfBottleMagic) & bottle >= 2 | setting(quarterBottleMagic) & bottle >= 4) | setting(fullBottleMagic) & bottle >= 3",
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
   * Level 1: any bow, which the retro world's rupee bow (rom.rupeeBow) lets
   * shoot once an arrow is bought or with the silver arrows.
   */
  canShootArrows: {
    req: "bow & (!setting(rupeeBow) | shopArrow | silverArrowUpgrade)",
    source: at(486),
  },
  /**
   * Silver arrows: the bow that has them (the rupee bow, once an arrow is
   * bought), or the upgrade with any bow.
   */
  canShootArrows2: {
    req: "bow >= 2 & (!setting(rupeeBow) | shopArrow) | silverArrowUpgrade & bow",
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
