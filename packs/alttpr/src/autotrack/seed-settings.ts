// A seed's settings, read from its ROM: the world, the swords, the goal, the
// crystals Ganon's Tower and Ganon ask for, which dungeon items leave their
// dungeon, and the logic. alttpr.com writes each one into the base patch's
// tables (vt app/World.php:1110-1345, writeToRom), where the game reads it
// as it plays; the tracker reads the same bytes.
//
// Race Mode reads none of them. The race rules (v2.0) let a tracker set
// itself up from the ROM's settings only "if it can ensure it does not do so
// on Mystery seeds", and a race seed's ROM does not say whether it is one
// (only its file on alttpr.com does, which Race Mode never asks for): so a
// race seed's settings, the logic included, are never read, and stay the
// player's to choose. The memory map (memory.ts) lists these ranges beside
// the rest, and the race guard holds them to the same rules.
//
// Sources, read as data and never run (MEMORY_SOURCES in memory.ts):
// - z3: z3randomizer at dcb0a2b4, tables.asm and initsramtable.asm, for
//   where each table lies and what its values mean;
// - vt: alttp_vt_randomizer at 219fcafd, app/Rom.php, app/World.php and
//   app/Support/InitialSram.php, for what alttpr.com writes for each setting.
//
// The decoder never guesses: a byte outside the values vt writes, or two
// bytes that disagree, leave the setting "unrecognized".

import { bus } from "@alltp/autotrack";
import type { MemoryView, Unsettled } from "./decode";
import type { AlttprRange, SourceRef } from "./memory";
import { type SeedRom, seedRomOf } from "./probes";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

/**
 * How often the settings are read again. ROM does not change while a seed
 * runs: the first poll reads them, and a slow cadence keeps them current if
 * another ROM is loaded without reconnecting, for a few bytes now and then.
 */
export const SETTINGS_MS = 10_000;

function rom<const Id extends string>(
  id: Id,
  at: number,
  size: number,
  category: "other" | "prizes",
  source: SourceRef,
): AlttprRange & { readonly id: Id } {
  return {
    address: bus(at),
    bus: at,
    category,
    everyMs: SETTINGS_MS,
    id,
    size,
    source,
  };
}

/**
 * The ROM ranges that hold a seed's settings, in address order. All lie
 * outside the memory Race Mode reads: their category is the race profile's
 * `other`, which Race Mode never reads. The seed type sits beside the race
 * flag and its complement ($30:8213-$30:8214), which Race Mode reads alone. Two of bank $30's tables
 * among them are the prizes' (prizes.ts), under the profile's `prizes`,
 * which no race permits.
 */
export const SEED_SETTINGS_RANGES = [
  // The Door Randomizer's own table, $A7:8000 (ROM 0x138000): "DR", then
  // DRMode, a word: 0 vanilla doors, 1 basic, 2 partitioned or crossed (DR
  // 1.5.6 Rom.py:629, 656); DRFlags, a word (doorrando.asm:16-37 at the DR
  // base patch, aerinon/z3randomizer d0f4651; DoorShuffle.py:3651-3664:
  // Hide_Total $0100 for a Mystery seed, Rom.py:676-679, EnemyDropIndicator
  // $0800 when the drops of every enemy are shuffled, 588-589); and at
  // $A7:8010 DRVersionInfo, the version as text ("1.5.6-u", Rom.py:1458).
  // An alttpr.com ROM holds something else here: read for a DR title only.
  rom(
    "door-settings",
    0x27_8000,
    0x20,
    "other",
    "drz3:doorrando/doorrando.asm:15-40",
  ),
  // StandingItemsOn, then MultiClientFlagsROM (a word: $01 enemy drops,
  // $02 shopsanity, $04 take-any caves, $08 pots, $10 a Mystery seed),
  // the swamp drains, then StandingItemCounterMask ($01 pots beyond the
  // caves count, $02 drops: Rom.py:728-740) (standing_items.asm:117-126).
  rom(
    "standing-items",
    0x28_aa50,
    6,
    "other",
    "drz3:keydrop/standing_items.asm:116-126",
  ),
  // The Overworld fork's table at ROM 0x150000: owMode, a word (layout in
  // its low byte, $0200 crossed, $0400 mixed), owFlags ($01 whirlpools, $02
  // mixed, $06 grid, $0100 flute spots moved, $0200 bonk drops) and at
  // 0x150010 its version as text (OWR 0.8.0.0 Rom.py:526-616, 665-678,
  // 1854). Read for an "OR" title only.
  rom("overworld-settings", 0x2a_8000, 0x20, "other", "owr:Rom.py:526-678"),
  // MireRequiredMedallion and TRockRequiredMedallion: the medallion each
  // pad wants, $00 Bombos, $01 Ether, $02 Quake (tables.asm:53-62; vt
  // Medallions.php:30-31 writes the item's second byte there). The game
  // shows it only as an emblem on the pad's overworld screen, so it is read
  // outside Race Mode only and kept until the player could see it
  // (medallions.ts). `other`: the rules cover it nowhere.
  rom("medallions", 0x30_8022, 2, "other", "z3:tables.asm:53-62"),
  // MapMode: $00, the world map shows every dungeon's prize; $01, only once
  // its map is held (tables.asm:124-125). vt writes $01 when maps leave
  // their dungeon, dungeonItems mc, mcs or full (Rom.php:1959-1964,
  // World.php:122-124, 1232). Read by the prizes (prizes.ts).
  rom("map-mode", 0x30_803b, 1, "prizes", "z3:tables.asm:124-125"),
  // HammerableGanon, a byte nothing uses, then AllowSwordlessMedallionUse
  // (tables.asm:136-144): setSwordlessMode writes $01 to both, or $00 (vt
  // Rom.php:2065-2069), on every seed (World.php:1249).
  rom("swordless-mode", 0x30_803f, 3, "other", "z3:tables.asm:136-144"),
  // HUDDungeonItems, ---edcba: a small keys, b big keys, c maps, d
  // compasses (tables.asm:160-163). vt calls it the free item menu and
  // sets a bit for each kind of dungeon item its dungeonItems setting lets
  // out of its dungeon (World.php:111-139, Rom.php:2051-2055).
  rom("dungeon-item-menu", 0x30_8045, 1, "other", "z3:tables.asm:160-163"),
  // InvertedMode: $00 normal, $01 inverted (tables.asm:181-183; vt
  // Rom.php:1592).
  rom("inverted-mode", 0x30_804a, 1, "other", "z3:tables.asm:181-183"),
  // CrystalPendantFlags_2 from Eastern Palace to Turtle Rock: $00 a
  // pendant, $40 a crystal (tables.asm:213-233). vt writes each prize's
  // fifth byte there (Prize locations' fifth address, Region/Standard/
  // EasternPalace.php:58 and the nine alike; Item.php:148-150, 254-260).
  // The prizes' own table: read outside Race Mode only (prizes.ts).
  rom("prize-kinds", 0x30_8052, 11, "prizes", "z3:tables.asm:213-233"),
  // GoalItemRequirement, a word: the triforce pieces the goal asks for, $0000
  // when it asks for none (tables.asm:789-791; vt Rom.php:472-476).
  rom("goal-items", 0x30_8167, 2, "other", "z3:tables.asm:789-791"),
  // GenericKeys: $01 in the retro world only, whose small keys open any
  // door (tables.asm:819-821; vt Rom.php:1319-1323, World/Retro.php:18-23).
  rom("generic-keys", 0x30_8172, 1, "other", "z3:tables.asm:819-821"),
  // GanonsTowerOpenTarget's low byte: crystals.tower (tables.asm:926-927;
  // vt Rom.php:2276-2280, World.php:1152).
  rom("tower-crystals", 0x30_819a, 1, "other", "z3:tables.asm:926-927"),
  // GanonVulnerableTarget's low byte: crystals.ganon (tables.asm:938-939;
  // vt Rom.php:2290-2294, World.php:1153).
  rom("ganon-crystals", 0x30_81a6, 1, "other", "z3:tables.asm:938-939"),
  // GanonVulnerableMode's low byte: what makes Ganon vulnerable, set from
  // the goal (tables.asm:940-952; vt Rom.php:584-626, World.php:1193-1219).
  rom("ganon-vulnerable", 0x30_81a8, 1, "other", "z3:tables.asm:940-952"),
  // RandomizerSeedType: $00 no glitches, $01 major glitches, $02 overworld
  // glitches (tables.asm:970-972; vt Rom.php:832-851, World.php:1292-1324).
  rom("seed-type", 0x30_8210, 1, "other", "z3:tables.asm:970-972"),
  // The initial save's overworld byte of screen $5B, the pyramid: $20 once
  // its hole is open from the start (initsramtable.asm:17, 27: the table
  // copies the save's layout from $30:B000, overworld events at +$280). vt
  // opens it for the fast_ganon and ganonhunt goals (World.php:1204-1211,
  // InitialSram.php:93-95) and writes the whole table (Rom.php:2387-2390).
  rom("initial-pyramid", 0x30_b2db, 1, "other", "z3:initsramtable.asm:17-28"),
  // InitProgressIndicator, the run's progress at the start: $00 in a
  // Standard world, which begins with the escape; $02, Zelda rescued, in
  // an Open one, the inverted and retro worlds included (initsramtable.asm:
  // 118; vt Rom.php:1554-1576, 1587-1590). Instant post-Agahnim sets bit 7
  // in Standard, $03 otherwise (InitialSram.php:688-701).
  rom("initial-progress", 0x30_b3c5, 1, "other", "z3:initsramtable.asm:118"),
] as const;

export type SeedSettingsRangeId = (typeof SEED_SETTINGS_RANGES)[number]["id"];

const RANGE = Object.fromEntries(
  SEED_SETTINGS_RANGES.map((range) => [range.id, range]),
) as Readonly<
  Record<SeedSettingsRangeId, (typeof SEED_SETTINGS_RANGES)[number]>
>;

/** The header's range id and its title's length (probes.ts). */
const HEADER = "rom-header";
const TITLE_LENGTH = 21;

/**
 * Why a setting is not known: unread, a value vt never writes, or a Mystery
 * seed that hides it.
 */
export type SeedUnknown = Unsettled | "unrecognized" | "mystery";

/** A setting the ROM states, or why it is not known. */
export type SeedSetting<T> =
  | { readonly known: true; readonly value: T }
  | { readonly known: false; readonly why: SeedUnknown };

/**
 * The logic the seed was generated for: alttpr.com's five "Glitches
 * Required" (vt RandomizerController.php:110-116, config/alttp.php:174-180).
 * The ROM's seed type folds the last three into one, MajorGlitches
 * (World.php:1292-1304, Rom.php:836-848); the seed's file names each.
 */
export type SeedLogic =
  | "NoGlitches"
  | "OverworldGlitches"
  | "HybridMajorGlitches"
  | "MajorGlitches"
  | "NoLogic";

/** upstream's mode.state: the world (World::factory, World.php:288-305). */
export type SeedMode = "open" | "standard" | "inverted" | "retro";

/** upstream's goal (config/alttp.php:195-205). */
export type SeedGoal =
  | "ganon"
  | "fast_ganon"
  | "dungeons"
  | "pedestal"
  | "triforce-hunt"
  | "ganonhunt"
  | "completionist";

/** upstream's itemPlacement (config/alttp.php:181-184). */
export type SeedItemPlacement = "advanced" | "basic";

/**
 * upstream's entrances (config/alttp.php:233-240): none, or the entrance
 * randomizer's shuffle, which vt hands such seeds to (EntranceRandomizer.php).
 */
export type SeedEntrances =
  | "none"
  | "simple"
  | "restricted"
  | "full"
  | "crossed"
  | "insanity";

/** upstream's accessibility (config/alttp.php:191-195). */
export type SeedAccessibility = "items" | "locations" | "none";

/** upstream's item.pool (World.php:171-214). */
export type SeedItemPool =
  | "normal"
  | "hard"
  | "expert"
  | "superexpert"
  | "crowd_control";

/** upstream's item.functionality (World.php:216-259). */
export type SeedItemFunctionality =
  | "normal"
  | "hard"
  | "expert"
  | "superexpert";

/**
 * What a seed says of its settings: its ROM, or its file on alttpr.com
 * (seed-file.ts), which alone states the last four.
 */
export interface SeedSettingsReading {
  /**
   * The seed's name in the header, after "VT " (World.php:1090, 1350):
   * alttpr.com's id for the seed. Null when the header was not read or
   * is not an alttpr.com seed's.
   */
  readonly seed: string | null;
  /** rom.logicMode, as the seed type keeps it (World.php:1292-1324). */
  readonly logic: SeedSetting<SeedLogic>;
  readonly mode: SeedSetting<SeedMode>;
  /** mode.weapons is 'swordless' (World.php:1249). */
  readonly swordless: SeedSetting<boolean>;
  readonly goal: SeedSetting<SeedGoal>;
  /**
   * item.Goal.Required: the Triforce pieces the goal asks for, 1 to 50; the
   * ROM alone states it (GoalItemRequirement), a seed's file does not.
   */
  readonly goalPieces?: SeedSetting<number>;
  /** crystals.tower: the crystals that open Ganon's Tower, 0 to 7. */
  readonly crystalsTower: SeedSetting<number>;
  /** crystals.ganon: the crystals Ganon asks for, 0 to 7. */
  readonly crystalsGanon: SeedSetting<number>;
  /** region.wildMaps: maps leave their dungeon. */
  readonly wildMaps: SeedSetting<boolean>;
  /** region.wildCompasses. */
  readonly wildCompasses: SeedSetting<boolean>;
  /** region.wildKeys: small keys leave their dungeon. */
  readonly wildKeys: SeedSetting<boolean>;
  /** region.wildBigKeys. */
  readonly wildBigKeys: SeedSetting<boolean>;
  /** itemPlacement: no ROM table holds it, so the ROM leaves it out. */
  readonly itemPlacement?: SeedSetting<SeedItemPlacement>;
  /** accessibility, like itemPlacement. */
  readonly accessibility?: SeedSetting<SeedAccessibility>;
  /** item.pool, like itemPlacement. */
  readonly itemPool?: SeedSetting<SeedItemPool>;
  /** item.functionality, like itemPlacement. */
  readonly itemFunctionality?: SeedSetting<SeedItemFunctionality>;
  /** entrances, like itemPlacement. */
  readonly entrances?: SeedSetting<SeedEntrances>;
  /**
   * enemizer.bossShuffle, like itemPlacement: no ROM table holds the
   * setting, only the bosses the enemizer placed, which the player is not
   * to learn before meeting each (so the ROM leaves it out).
   */
  readonly bossShuffle?: SeedSetting<SeedBossShuffle>;
  /**
   * mode.weapons, like itemPlacement: the ROM tells swordless alone
   * (`swordless`), not where the swords are.
   */
  readonly weapons?: SeedSetting<SeedWeapons>;
  /** enemizer.enemyHealth, like itemPlacement. */
  readonly enemyHealth?: SeedSetting<SeedEnemyHealth>;
  /**
   * Which randomizer wrote the seed, from the title (the header, which Race
   * Mode reads): absent for a header not read or not a seed's.
   */
  readonly randomizer?: SeedRandomizer;
  /** A Door Randomizer seed's own settings: absent for alttpr.com's. */
  readonly door?: DoorSeedSettings;
  /**
   * A Door Randomizer seed's settings by DR's own names, as its spoiler's
   * `meta` states them (an avianart permalink, door-rando/seed-import.ts):
   * no ROM holds them so.
   */
  readonly doorExact?: DoorExactSettings;
}

/**
 * A DR seed's settings by the names DR's command line gives them
 * (resources/app/cli/args.json), as its spoiler's `meta` writes them
 * (BaseClasses.py:2556-2620 at 1.5.6): only those the tracker keeps.
 */
export interface DoorExactSettings {
  readonly doorShuffle: "vanilla" | "basic" | "partitioned" | "crossed";
  readonly dropShuffle: SeedDropShuffle;
  readonly pottery: string;
  readonly shopsanity: boolean;
  readonly takeAny: string;
  readonly enemyShuffle: string;
  /**
   * Its key logic (`key_logic_algorithm`, BaseClasses.py:2576), as named:
   * DR 1.5.6's dangerous, partial or strict, an unstable build's static.
   */
  readonly keyLogic?: string;
  /** Its entrance shuffle, when alttpr.com has none of that name. */
  readonly doorEntrances?: string;
  /**
   * The settings its rules read that no ROM table states, each where `meta`
   * names it: `bombbag` (can_use_bombs, BaseClasses.py:1208-1209),
   * `potshuffle` (Mire's spikes' key pot, Rules.py:527-530),
   * `restricted_boss_items` (none, mapcompass or dungeon: Rules.py:806-822)
   * and `open_pyramid` (auto, yes or no: is_pyramid_open, BaseClasses.py:
   * 299-311).
   */
  readonly bombBag?: boolean;
  readonly potShuffle?: boolean;
  readonly restrictBossItems?: string;
  readonly openPyramid?: string;
  readonly overworld?: {
    readonly layout: string;
    readonly crossed: string;
    readonly mixed: boolean;
    readonly whirlpool: boolean;
    readonly fluteShuffle: string;
    readonly bonkDrops: boolean;
  };
}

/** The randomizer a seed's title names (probes.ts, `seedRomOf`). */
export type SeedRandomizer =
  | { readonly kind: "vt" }
  | {
      readonly kind: "door";
      /** The Overworld fork's ("OR"). */
      readonly overworld: boolean;
      /** The version the title's digits say, "1.5.6"; null for a tag. */
      readonly version: string | null;
    };

/**
 * DR's door shuffle as its ROM tells it (DRMode, Rom.py:629, 656): the ROM
 * writes the same 2 for partitioned and crossed.
 */
export type SeedDoorShuffle = "vanilla" | "basic" | "shuffled";

/** DR's dropshuffle (resources/app/cli/args.json): which enemies' drops. */
export type SeedDropShuffle = "none" | "keys" | "underworld";

/**
 * DR's pottery as its ROM tells it: none; the caves' pots only; or more,
 * which the ROM does not name (keys, cavekeys, dungeon, reduced, clustered,
 * nonempty, lottery all count pots beyond the caves: Rom.py:738-740).
 */
export type SeedPotteryKind = "none" | "cave" | "beyond-caves";

/** The Overworld fork's layout (OWR args.json `ow_layout`). */
export type SeedOverworldLayout = "vanilla" | "grid" | "wild";

/** What a Door Randomizer ROM says of its settings, outside Race Mode. */
export interface DoorSeedSettings {
  /** DRVersionInfo's text, its branch suffix dropped: "1.5.6". */
  readonly version: SeedSetting<string>;
  readonly doorShuffle: SeedSetting<SeedDoorShuffle>;
  readonly dropShuffle: SeedSetting<SeedDropShuffle>;
  readonly pottery: SeedSetting<SeedPotteryKind>;
  readonly shopsanity: SeedSetting<boolean>;
  /** Take-any caves (DR's take_any random or fixed). */
  readonly takeAny: SeedSetting<boolean>;
  /** The Overworld fork's settings, for an "OR" title only. */
  readonly overworld?: {
    readonly version: SeedSetting<string>;
    readonly layout: SeedSetting<SeedOverworldLayout>;
    readonly crossed: SeedSetting<boolean>;
    readonly mixed: SeedSetting<boolean>;
    readonly whirlpool: SeedSetting<boolean>;
    /** The flute's spots moved (ow_fluteshuffle balanced or random). */
    readonly fluteShuffle: SeedSetting<boolean>;
    readonly bonkDrops: SeedSetting<boolean>;
  };
}

/** upstream's mode.weapons (config/alttp.php:260-265). */
export type SeedWeapons = "randomized" | "assured" | "vanilla" | "swordless";

/** upstream's enemizer.enemyHealth (config/alttp.php:282-287). */
export type SeedEnemyHealth = "default" | "easy" | "hard" | "expert";

/** upstream's enemizer.bossShuffle (config/alttp.php:241-246). */
export type SeedBossShuffle = "none" | "simple" | "full" | "random";

/** HUDDungeonItems' bits (tables.asm:161; vt CustomizerController.php:157-162). */
export const DUNGEON_ITEM_BITS = {
  bigKeys: 0x02,
  compasses: 0x08,
  maps: 0x04,
  smallKeys: 0x01,
} as const;

/** GanonVulnerableMode, as vt's goals set it (Rom.php:584-626). */
const VULNERABLE = {
  completionist: 0x0b,
  crystals: 0x04,
  dungeons: 0x02,
  pieces: 0x05,
  yes: 0x01,
} as const;

/** The pyramid's bit in its screen's byte (InitialSram.php:93-95). */
const PYRAMID_OPEN = 0x20;

/** The most Triforce pieces a goal asks for: ganonhunt's pool (config/alttp.php:44-50). */
export const MAX_GOAL_PIECES = 50;

/**
 * RandomizerSeedType's values (Rom.php:832-851): $01 is written for Major
 * Glitches, Hybrid Major Glitches and No Logic alike (World.php:1293-1302).
 */
const LOGICS: Readonly<Record<number, SeedLogic>> = {
  0: "NoGlitches",
  1: "MajorGlitches",
  2: "OverworldGlitches",
};

/** A setting that is known. */
export const known = <T>(value: T): SeedSetting<T> => ({ known: true, value });
const unknown = <T>(why: SeedUnknown): SeedSetting<T> => ({
  known: false,
  why,
});
/** A setting whose value is none vt writes. */
export const UNRECOGNIZED = unknown<never>("unrecognized");
/** A setting a Mystery seed hides until the player finds it in game. */
export const MYSTERY = unknown<never>("mystery");

/** Whether Race Mode reads a range of this decoder's. */
const racePermits = (id: SeedSettingsRangeId) =>
  ALTTPR_RACE_PROFILE.categories[RANGE[id].category]?.permitted === true;

/** The bytes of a range, or why they are not known. */
function bytesOf(
  memory: MemoryView,
  race: boolean,
  id: SeedSettingsRangeId,
): Uint8Array | Unsettled {
  if (race && !racePermits(id)) return "race-mode";
  if (!memory.has(id)) return "not-read";
  const bytes = memory.bytes(id);
  return bytes.length < RANGE[id].size ? "not-read" : bytes;
}

/**
 * A setting from the ranges it needs: unknown, with the first reason, when
 * one of them is; else what `decode` makes of their bytes, or unrecognized
 * when it returns null.
 */
function decodeFrom<T>(
  memory: MemoryView,
  race: boolean,
  ids: readonly SeedSettingsRangeId[],
  decode: (...bytes: Uint8Array[]) => T | null,
): SeedSetting<T> {
  const bytes: Uint8Array[] = [];
  let why: Unsettled | null = null;
  for (const id of ids) {
    const read = bytesOf(memory, race, id);
    if (typeof read === "string") {
      // Race Mode explains more than a range not read yet
      if (why === null || read === "race-mode") why = read;
    } else bytes.push(read);
  }
  if (why !== null) return unknown(why);
  const value = decode(...bytes);
  return value === null ? UNRECOGNIZED : known(value);
}

/** $00 or $01 as a flag; anything else is no flag vt writes. */
const flag = (byte: number): boolean | null =>
  byte === 0x00 ? false : byte === 0x01 ? true : null;

/** The world from InvertedMode, GenericKeys and InitProgressIndicator. */
function modeOf(
  inverted: Uint8Array,
  genericKeys: Uint8Array,
  progress: Uint8Array,
): SeedMode | null {
  const isInverted = flag(inverted[0]);
  const isRetro = flag(genericKeys[0]);
  const start = progress[0];
  const standard = start === 0x00 || start === 0x80;
  const open = start === 0x02 || start === 0x03;
  if (isInverted === null || isRetro === null || (isInverted && isRetro)) {
    return null;
  }
  if (isInverted || isRetro) {
    // Both are built on the Open world (Rom.php:1587-1590, 1531-1538)
    if (!open) return null;
    return isInverted ? "inverted" : "retro";
  }
  return standard ? "standard" : open ? "open" : null;
}

/** The goal from GanonVulnerableMode, read with what tells its goals apart. */
function goalOf(
  memory: MemoryView,
  race: boolean,
  vulnerable: Uint8Array,
): SeedSetting<SeedGoal> {
  switch (vulnerable[0]) {
    case VULNERABLE.crystals:
      // ganon and fast_ganon both ask for crystals; fast_ganon opens the
      // pyramid from the start (World.php:1208-1211, default 1217-1218)
      return decodeFrom(memory, race, ["initial-pyramid"], (pyramid) =>
        (pyramid[0] & PYRAMID_OPEN) !== 0 ? "fast_ganon" : "ganon",
      );
    case VULNERABLE.yes:
      // pedestal and triforce-hunt both leave Ganon invincible; the hunt
      // asks for pieces (World.php:1125, 1195-1201; config/alttp.php:31-41)
      return decodeFrom(memory, race, ["goal-items"], (pieces) =>
        (pieces[0] | (pieces[1] << 8)) !== 0 ? "triforce-hunt" : "pedestal",
      );
    case VULNERABLE.dungeons:
      return known("dungeons");
    case VULNERABLE.pieces:
      return known("ganonhunt");
    case VULNERABLE.completionist:
      return known("completionist");
    default:
      return UNRECOGNIZED;
  }
}

/** A crystal count vt writes: 0 to 7 (Rom.php:2278, 2292). */
const crystals = ([count]: Uint8Array) => (count <= 7 ? count : null);

/** The seed's name from the header title, or null. */
function seedRom(memory: MemoryView): SeedRom | null {
  if (!memory.has(HEADER)) return null;
  const header = memory.bytes(HEADER);
  const rom = seedRomOf(
    String.fromCharCode(...header.subarray(0, TITLE_LENGTH)),
  );
  return rom === null || rom.seed === "" ? null : rom;
}

/**
 * GanonVulnerableMode as the Door Randomizer writes it (Rom.py:1164-1175):
 * its own "ganon" goal asks for the crystals and Agahnim 2 ($03), which the
 * tracker's Ganon goal is; "crystals" and "trinity" write $04, as vt's
 * ganon and fast_ganon do, trinity with Triforce pieces besides (1109-1110),
 * a goal the tracker has no run type for.
 */
function doorGoalOf(
  memory: MemoryView,
  race: boolean,
  vulnerable: Uint8Array,
): SeedSetting<SeedGoal> {
  const pieces = (bytes: Uint8Array) => (bytes[0] | (bytes[1] << 8)) !== 0;
  switch (vulnerable[0]) {
    case 0x03:
      return known("ganon");
    case VULNERABLE.crystals:
      return decodeFrom(
        memory,
        race,
        ["goal-items", "initial-pyramid"],
        (items, pyramid) =>
          pieces(items)
            ? null
            : (pyramid[0] & PYRAMID_OPEN) !== 0
              ? "fast_ganon"
              : "ganon",
      );
    default:
      return goalOf(memory, race, vulnerable);
  }
}

/** Text written into the ROM, up to its first zero, or null when none. */
const textOf = (bytes: Uint8Array): string | null => {
  const end = bytes.indexOf(0);
  const text = String.fromCharCode(
    ...bytes.subarray(0, end === -1 ? bytes.length : end),
  );
  return /^[0-9]+(\.[0-9]+)+(-[a-z]+)?$/.test(text)
    ? text.replace(/-[a-z]+$/, "")
    : null;
};

const word = (bytes: Uint8Array, at: number) =>
  bytes[at] | (bytes[at + 1] << 8);

/** DRMode's values (Rom.py:629, 656; doorrando.asm:16-17). */
const DOOR_MODES: Readonly<Record<number, SeedDoorShuffle>> = {
  0: "vanilla",
  1: "basic",
  2: "shuffled",
};

/** DRFlags' bits (DoorShuffle.py:3651-3664). */
const DR_FLAGS = { enemyDrops: 0x0800, hideTotal: 0x0100 } as const;

/** MultiClientFlagsROM's bits (Rom.py:731-736). */
const MULTI_CLIENT = {
  drops: 0x01,
  mystery: 0x10,
  pottery: 0x08,
  shopsanity: 0x02,
  takeAny: 0x04,
} as const;

/** Whether DR's table opens with "DR", as its base patch writes it (doorrando.asm:15). */
const isDoorTable = (table: Uint8Array) =>
  table[0] === 0x44 && table[1] === 0x52;

/**
 * A setting as a Mystery seed shows it: hidden once read, whatever its
 * value; still unknown for the reason it was (Race Mode, not read yet).
 */
const hiddenIf = <T>(mystery: boolean, setting: SeedSetting<T>) =>
  mystery && (setting.known || setting.why === "unrecognized")
    ? (MYSTERY as SeedSetting<T>)
    : setting;

/**
 * A Door Randomizer ROM's own settings. Each needs DR's table to open as
 * the base patch writes it (the Overworld fork's, its version), so a table
 * the ROM does not hold is unrecognized, never read as vanilla.
 */
function doorSettings(
  memory: MemoryView,
  race: boolean,
  overworld: boolean,
  mystery: boolean,
): DoorSeedSettings {
  const hide = <T>(setting: SeedSetting<T>): SeedSetting<T> =>
    hiddenIf(mystery, setting);
  /** A setting from DR's table, and the standing items' beside it. */
  const dr = <T>(
    decode: (table: Uint8Array, client: number, mask: number) => T | null,
  ) =>
    hide(
      decodeFrom(memory, race, ["door-settings", "standing-items"], (t, s) =>
        isDoorTable(t) ? decode(t, word(s, 1), s[5]) : null,
      ),
    );
  /** A setting from the Overworld fork's table. */
  const ow = <T>(decode: (mode: number, flags: number) => T) =>
    hide(
      decodeFrom(memory, race, ["overworld-settings"], (table) =>
        textOf(table.subarray(0x10)) === null
          ? null
          : decode(word(table, 2), word(table, 4)),
      ),
    );
  const settings: DoorSeedSettings = {
    doorShuffle: dr((table) => DOOR_MODES[word(table, 2)] ?? null),
    dropShuffle: dr<SeedDropShuffle>((table, client) =>
      (client & MULTI_CLIENT.drops) === 0
        ? "none"
        : (word(table, 4) & DR_FLAGS.enemyDrops) !== 0
          ? "underworld"
          : "keys",
    ),
    // StandingItemCounterMask $01: pots beyond the caves count
    pottery: dr<SeedPotteryKind>((_, client, mask) =>
      (client & MULTI_CLIENT.pottery) === 0
        ? "none"
        : (mask & 0x01) !== 0
          ? "beyond-caves"
          : "cave",
    ),
    shopsanity: dr((_, client) => (client & MULTI_CLIENT.shopsanity) !== 0),
    takeAny: dr((_, client) => (client & MULTI_CLIENT.takeAny) !== 0),
    // The version is no setting a Mystery seed hides
    version: decodeFrom(memory, race, ["door-settings"], (table) =>
      isDoorTable(table) ? textOf(table.subarray(0x10)) : null,
    ),
  };
  if (!overworld) return settings;
  return {
    ...settings,
    overworld: {
      bonkDrops: ow((_, flags) => (flags & 0x0200) !== 0),
      crossed: ow((mode) => (mode & 0x0200) !== 0),
      fluteShuffle: ow((_, flags) => (flags & 0x0100) !== 0),
      layout: ow<SeedOverworldLayout>((mode, flags) =>
        (flags & 0x06) === 0x06
          ? "grid"
          : (mode & 0xff) !== 0
            ? "wild"
            : "vanilla",
      ),
      mixed: ow((mode) => (mode & 0x0400) !== 0),
      version: decodeFrom(memory, race, ["overworld-settings"], (table) =>
        textOf(table.subarray(0x10)),
      ),
      whirlpool: ow((_, flags) => (flags & 0x01) !== 0),
    },
  };
}

/**
 * Whether a Door Randomizer ROM says it is a Mystery seed: Mystery.py marks
 * it twice, MultiClientFlagsROM's $10 and DRFlags' Hide_Total (Rom.py:
 * 676-677, 736). Null while not known (Race Mode, not read).
 */
function doorMystery(memory: MemoryView, race: boolean): boolean | null {
  const table = bytesOf(memory, race, "door-settings");
  const standing = bytesOf(memory, race, "standing-items");
  if (typeof table === "string" || typeof standing === "string") return null;
  if (!isDoorTable(table)) return null;
  return (
    (word(standing, 1) & MULTI_CLIENT.mystery) !== 0 ||
    (word(table, 4) & DR_FLAGS.hideTotal) !== 0
  );
}

/**
 * A seed's settings, from its ROM. Pure and total: any bytes decode. In
 * Race Mode it never asks for a range Race Mode leaves alone: every setting,
 * the logic included, is then unknown, "race-mode"; the seed's name comes
 * from the header.
 * @param memory - The ranges read, by id: the session's snapshot
 */
export function decodeSeedSettings(
  memory: MemoryView,
  options: { readonly race: boolean },
): SeedSettingsReading {
  const { race } = options;
  const from = <T>(
    ids: readonly SeedSettingsRangeId[],
    decode: (...bytes: Uint8Array[]) => T | null,
  ) => decodeFrom(memory, race, ids, decode);
  const wild = (bit: number) =>
    from(["dungeon-item-menu"], (menu) => (menu[0] & bit) !== 0);
  const vulnerable = bytesOf(memory, race, "ganon-vulnerable");
  const rom = seedRom(memory);
  const door = rom?.randomizer === "door" ? rom : null;
  const reading: SeedSettingsReading = {
    crystalsGanon: from(["ganon-crystals"], crystals),
    crystalsTower: from(["tower-crystals"], crystals),
    goal:
      typeof vulnerable === "string"
        ? unknown(vulnerable)
        : door === null
          ? goalOf(memory, race, vulnerable)
          : doorGoalOf(memory, race, vulnerable),
    goalPieces: from(["goal-items"], ([low, high]) => {
      const pieces = low | (high << 8);
      return pieces >= 1 && pieces <= MAX_GOAL_PIECES ? pieces : null;
    }),
    // The Door Randomizer never writes the seed type (its Rom.py has no
    // 0x180210): its byte is the base patch's, whatever the logic
    logic:
      door === null
        ? from(["seed-type"], (type) => LOGICS[type[0]] ?? null)
        : race
          ? unknown("race-mode")
          : UNRECOGNIZED,
    mode: from(["inverted-mode", "generic-keys", "initial-progress"], modeOf),
    seed: rom?.seed ?? null,
    swordless: from(["swordless-mode"], (bytes) => {
      const hammer = flag(bytes[0]);
      return hammer !== null && flag(bytes[2]) === hammer ? hammer : null;
    }),
    wildBigKeys: wild(DUNGEON_ITEM_BITS.bigKeys),
    wildCompasses: wild(DUNGEON_ITEM_BITS.compasses),
    wildKeys: wild(DUNGEON_ITEM_BITS.smallKeys),
    wildMaps: wild(DUNGEON_ITEM_BITS.maps),
  };
  if (rom === null) return reading;
  if (door === null) return { ...reading, randomizer: { kind: "vt" } };
  // A Door Randomizer Mystery seed says so: its settings stay hidden, as an
  // alttpr.com Mystery seed's file hides them (seed-file.ts)
  const mystery = doorMystery(memory, race) === true;
  const hide = <T>(setting: SeedSetting<T>): SeedSetting<T> =>
    hiddenIf(mystery, setting);
  return {
    crystalsGanon: hide(reading.crystalsGanon),
    crystalsTower: hide(reading.crystalsTower),
    door: doorSettings(memory, race, door.overworld, mystery),
    goal: hide(reading.goal),
    ...(reading.goalPieces && { goalPieces: hide(reading.goalPieces) }),
    logic: reading.logic,
    mode: reading.mode,
    randomizer: {
      kind: "door",
      overworld: door.overworld,
      version: door.version,
    },
    seed: reading.seed,
    swordless: hide(reading.swordless),
    wildBigKeys: hide(reading.wildBigKeys),
    wildCompasses: hide(reading.wildCompasses),
    wildKeys: hide(reading.wildKeys),
    wildMaps: hide(reading.wildMaps),
  };
}
