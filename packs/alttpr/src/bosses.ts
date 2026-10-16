// The bosses: each one's canBeat as a named rule, and the boss each dungeon
// fights.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31),
// app/Boss.php:68-129 for the rules, and each region's constructor for its
// boss (`$this->boss = Boss::get(...)`). A region's rule reads its boss
// through its slot: `@canBeatEasternPalaceBoss` is `$this->boss->canBeat`
// in EasternPalace.php. Boss shuffle (enemizer.bossShuffle) would rebind the
// slots; the pack does not model it, so each dungeon keeps its vanilla boss.
//
// `!setting(basicPlacement)` is upstream's `itemPlacement !== 'basic'`,
// true in the advanced placement and in the upstream tests, which set no
// placement. Swordless needs no setting where upstream reads none: a
// swordless world holds no sword, so `@hasSword` is simply false there.

import type { Rule } from "./helpers";
import type { Source } from "./location";

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
 * The boss each region fights, `Region::$boss` as its constructor sets it.
 * Ganon's Tower has four: Agahnim 2 and the three it meets on the way up
 * (`boss_bottom`, `boss_middle`, `boss_top`). Agahnim in Hyrule Castle Tower
 * and Ganon are not fought through Boss::canBeat: their regions' rules say
 * what beats them.
 */
export const BOSS_SLOTS = {
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
