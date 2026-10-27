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
import { SEED_TITLE_PREFIX } from "./probes";
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

/** The logic the seed was generated for (vt RandomizerController.php:110). */
export type SeedLogic = "NoGlitches" | "OverworldGlitches" | "MajorGlitches";

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
}

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

/** RandomizerSeedType's values (Rom.php:832-851). */
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
function seedName(memory: MemoryView): string | null {
  if (!memory.has(HEADER)) return null;
  const header = memory.bytes(HEADER);
  const title = String.fromCharCode(...header.subarray(0, TITLE_LENGTH));
  if (!title.startsWith(SEED_TITLE_PREFIX)) return null;
  const name = title.slice(SEED_TITLE_PREFIX.length).trim();
  return name === "" ? null : name;
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
  return {
    crystalsGanon: from(["ganon-crystals"], crystals),
    crystalsTower: from(["tower-crystals"], crystals),
    goal:
      typeof vulnerable === "string"
        ? unknown(vulnerable)
        : goalOf(memory, race, vulnerable),
    logic: from(["seed-type"], (type) => LOGICS[type[0]] ?? null),
    mode: from(["inverted-mode", "generic-keys", "initial-progress"], modeOf),
    seed: seedName(memory),
    swordless: from(["swordless-mode"], (bytes) => {
      const hammer = flag(bytes[0]);
      return hammer !== null && flag(bytes[2]) === hammer ? hammer : null;
    }),
    wildBigKeys: wild(DUNGEON_ITEM_BITS.bigKeys),
    wildCompasses: wild(DUNGEON_ITEM_BITS.compasses),
    wildKeys: wild(DUNGEON_ITEM_BITS.smallKeys),
    wildMaps: wild(DUNGEON_ITEM_BITS.maps),
  };
}
