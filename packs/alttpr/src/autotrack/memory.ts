// The ALttPR memory map for autotracking: every range the tracker reads, in
// the address space @alltp/autotrack takes (FX Pak Pro space, which SNI and
// QUsb2Snes translate for emulators), with its size, cadence, Race Mode
// category and source. Ranges are listed in address order, so the planner
// can coalesce neighbours; Race Mode never bridges into a forbidden range.
//
// Nothing here comes from memory. The sources (MEMORY_SOURCES), read as
// data and never run:
// - z3: z3randomizer, the base patch alttpr.com builds seeds on: its SRAM
//   map (sram.asm), WRAM labels (ram.asm), ROM tables (tables.asm,
//   initsramtable.asm) and item handlers (newitems.asm, events.asm,
//   dungeondrops.asm, heartpieces.asm);
// - vt: the randomizer's front end, for what it writes into the ROM: the
//   seed's name, its race flag and its settings (seed-settings.ts);
// - spec: the ALTTPR Auto-tracker Rules and Guidelines v2.0, for the
//   categories, through ALTTPR_RACE_PROFILE;
// - ap: Archipelago's ALttP client, for the location flags of
//   check-flags.ts, which its spec holds to z3randomizer's own layout;
// - er: the entrance randomizer vt hands shuffled entrances to, for where it
//   writes them into the ROM (entrances.ts).
//
// Save data: the game keeps the save file in WRAM at $7E:F000-$7E:F4FF and
// copies it to SRAM on save (sram.asm:7-9). The tracker reads the WRAM copy,
// which is live and lies in Race Mode's window $7E:F000-$7E:F500.

import { bus, type RangeSpec, type RangeView } from "@alltp/autotrack";
import {
  backgroundWanted,
  darkRoomHeld,
  darkRoomWanted,
} from "./dark-room-gate";
import tables from "./entrance-tables.json" with { type: "json" };
import { SEED_SETTINGS_RANGES, SETTINGS_MS } from "./seed-settings";

/** The sources this map was read from. */
export const MEMORY_SOURCES = {
  ap: {
    commit: "d643307afe0d19dd30c49e766f8cb0f1960135dc",
    file: "worlds/alttp/Client.py",
    license: "MIT",
    repo: "https://github.com/ArchipelagoMW/Archipelago",
  },
  // The Door Randomizer (DR), for what it writes into its ROMs: the title,
  // the race flag, its settings and its pots', drops' and shops' tables
  dr: {
    commit: "5c44da337d6d4ecbc3e7ba8ebc96315896d0bec4",
    license: "MIT",
    repo: "https://github.com/aerinon/ALttPDoorRandomizer",
    version: "1.5.8",
  },
  // The base patch DR 1.5.8 ships, as 1.5.6 did (data/base2current.bps,
  // last changed in 0e43210 with the same change as this commit,
  // 2026-02-11): its SRAM map
  // is vt's for every range below, but for the tables DR adds
  // (`RoomPotData`, `SpriteDropData`, `PurchaseCounts`)
  drz3: {
    branch: "DRUnstable",
    commit: "d0f46511300be05076b7403d71656f3955f3f8fc",
    license: "MIT",
    repo: "https://github.com/aerinon/z3randomizer",
  },
  er: {
    commit: "8a1ac4d451b397ec5fb424e3a24fb7f252773381",
    license: "MIT",
    repo: "https://github.com/cassidoxa/ALttPEntranceRandomizer",
  },
  // DR's Overworld fork (OWR), the last release on DR 1.5.6
  owr: {
    commit: "2297be2f45c6b9710a7dfdbdc11cf166baa6de70",
    license: "MIT",
    repo: "https://github.com/codemann8/ALttPDoorRandomizer",
    version: "0.8.0.0",
  },
  spec: {
    title: "ALTTPR Auto-tracker Rules and Guidelines",
    url: "https://docs.google.com/document/d/e/2PACX-1vTgsj0FMiWyaBOYP97e_ABc4P_0vIGiJxoUJ5Rj-PBr1T7i_zpyLqhLLVkbftPwS_B6nwad5j5zhtMg/pub",
    version: "2.0 (2024)",
  },
  vt: {
    commit: "219fcafd029dab597b8db400efafd8f56f8b4edb",
    repo: "https://github.com/sporchia/alttp_vt_randomizer",
  },
  z3: {
    // The commit vt's composer.json:46-52 pins as z3/randomizer 31.2.2.
    commit: "dcb0a2b42d14445f7994a0e9e4d63cbecf4b98d3",
    repo: "https://github.com/KatDevsGames/z3randomizer",
    version: "31.2.2",
  },
  // The game's decompilation, for the dungeon engine's variables and tables
  // (the dark room map). Cited by file:line, `g_ram + N` being $7E:0000 + N.
  zelda3: {
    commit: "45a149d8b4bb8098f53d1009f76e76e7d8b79bbf",
    license: "MIT",
    repo: "https://github.com/snesrev/zelda3",
  },
} as const;

/** Where a fact was read: a MEMORY_SOURCES key, then a file and lines. */
export type SourceRef = `${keyof typeof MEMORY_SOURCES}:${string}`;

/** One range of the map: what @alltp/autotrack reads, and why. */
export interface AlttprRange extends RangeSpec {
  /** The SNES A-bus address (LoROM), as the sources write it. */
  readonly bus: number;
  readonly source: SourceRef;
}

/** Start of the save data in WRAM (sram.asm:13). */
export const SAVE_DATA = 0x7e_f000;

/**
 * A room's two bytes. Room data opens the save data: one little-endian word
 * per room, for the 296 rooms (sram.asm:16-52).
 */
export function roomAddress(room: number): number {
  return SAVE_DATA + room * 2;
}

/**
 * The bits of a room's word, `dddd bkut sehc qqqq` from bit 15 down
 * (sram.asm:34-46): doors, boss, key, second key, chests 4 to 0, quadrants.
 */
export const ROOM_BITS = {
  /** b: boss kill or heart container. */
  boss: 0x0800,
  /** c, h, e, s, t: chests 0 to 4. */
  chests: [0x0010, 0x0020, 0x0040, 0x0080, 0x0100],
  /** k: key or heart piece. */
  key: 0x0400,
  /** u: a second key. */
  secondKey: 0x0200,
} as const;

/** A screen's byte: overworld data follows room data (sram.asm:54-69). */
export function screenAddress(screen: number): number {
  return SAVE_DATA + 0x280 + screen;
}

/** i: a free-standing item was collected on the screen (sram.asm:63-65). */
export const SCREEN_ITEM = 0x40;

/**
 * The dungeons, by the codes items.ts uses, with what memory keeps of each:
 * - `bit`: its bit in the compass, big key and map fields (sram.asm:119-126)
 *   and in DungeonsCompleted (sram.asm:320-321), from DungeonItemMasks
 *   (newitems.asm:820-824) indexed by DungeonID (newitems.asm:1141-1157).
 *   Hyrule Castle's items set the sewers' bit too ($C000, newitems.asm:294);
 * - `keys`: its byte in DungeonCollectedKeys, the small keys found
 *   (sram.asm:361-375), laid out as DungeonKeys (sram.asm:154-168);
 * - `bossRoom`: the room whose boss bit says the boss fell, for the ten
 *   dungeons with a heart container (heartpieces.asm:345-378).
 */
export const DUNGEONS = [
  { bit: 0x4000, code: "H2", keys: 1, name: "Hyrule Castle" },
  { bit: 0x2000, bossRoom: 0xc8, code: "P1", keys: 2, name: "Eastern Palace" },
  { bit: 0x1000, bossRoom: 0x33, code: "P2", keys: 3, name: "Desert Palace" },
  { bit: 0x0800, code: "A1", keys: 4, name: "Castle Tower" },
  { bit: 0x0400, bossRoom: 0x06, code: "D2", keys: 5, name: "Swamp Palace" },
  {
    bit: 0x0200,
    bossRoom: 0x5a,
    code: "D1",
    keys: 6,
    name: "Palace of Darkness",
  },
  { bit: 0x0100, bossRoom: 0x90, code: "D6", keys: 7, name: "Misery Mire" },
  { bit: 0x0080, bossRoom: 0x29, code: "D3", keys: 8, name: "Skull Woods" },
  { bit: 0x0040, bossRoom: 0xde, code: "D5", keys: 9, name: "Ice Palace" },
  { bit: 0x0020, bossRoom: 0x07, code: "P3", keys: 10, name: "Tower of Hera" },
  { bit: 0x0010, bossRoom: 0xac, code: "D4", keys: 11, name: "Thieves' Town" },
  { bit: 0x0008, bossRoom: 0xa4, code: "D7", keys: 12, name: "Turtle Rock" },
  { bit: 0x0004, code: "A2", keys: 13, name: "Ganon's Tower" },
] as const;

export type DungeonCode = (typeof DUNGEONS)[number]["code"];

/** DUNGEONS by code. */
export const DUNGEON = Object.fromEntries(
  DUNGEONS.map((dungeon) => [dungeon.code, dungeon]),
) as Readonly<Record<DungeonCode, (typeof DUNGEONS)[number]>>;

/** The sewers' byte in DungeonCollectedKeys, written with Hyrule Castle's. */
export const SEWER_KEYS = 0;

/** PendantsField bits (vt app/Item.php:148-150, sram.asm:139-140). */
export const PENDANT_BITS = {
  pendantOfCourage: 0x04,
  pendantOfPower: 0x02,
  pendantOfWisdom: 0x01,
} as const;

/**
 * CrystalsField bits: the second byte of each Crystal item (vt
 * app/Item.php:254-260). sram.asm:148-150 names the bits after the vanilla
 * dungeons; in a randomized seed, a crystal's number is what counts.
 */
export const CRYSTAL_BITS = {
  crystal1: 0x02,
  crystal2: 0x10,
  crystal3: 0x40,
  crystal4: 0x20,
  crystal5: 0x04,
  crystal6: 0x01,
  crystal7: 0x08,
} as const;

/**
 * Game modes ($7E:0010, ram.asm:41). In play: dungeon $07, overworld $09,
 * special overworld $0B (ap Client.py:29). Goal: $19, the Triforce room,
 * where the game ends, then $1A (ap Client.py:30). Before play:
 * the title ($00), the file select and its copy, erase and name screens
 * ($01-$04), the game loading ($05) and the randomizer's spawn select ($1B,
 * seen on a real game going from the file select to play, 2026-10-17).
 */
export const GAME_MODES = {
  beforePlay: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x1b],
  goal: [0x19, 0x1a],
  /** The overworld proper, where OverworldIndex is the screen in view. */
  overworld: 0x09,
  playing: [0x07, 0x09, 0x0b],
} as const;

/**
 * The game mode, items, keys, events, room, overworld and NPC flags, and
 * the doors Link went through: one cadence, so a reading's game mode and
 * saves are read in the same tick. With the mode read twice as often, the
 * first reading in play could carry saves read before the file's load (the
 * title's WRAM, another file's), as SMZ3's did on a real game (packs/smz3
 * memory.ts, 2026-10-19). Every 500 ms: the start and the goal show in the
 * game mode first, and the timer stops on it.
 */
export const GAME_MS = 500;

/**
 * The dark room map's cadences. Its gate (mode, indoors, dark) is read with
 * the game's own, `GAME_MS`, in the casual plan that is read anyway. Only
 * while the gate holds, a dark room without the Lamp, are the rest read:
 * Link's place and the room's state four times a second, so the marker follows
 * him, in one more request; the 8 KiB map itself once a second and on a room
 * change.
 */
export const NAV_MS = 250;
export const MAP_MS = 1000;

/** The switch the app turns on for the dark room map (`RangeSpec.optIn`). */
export const DARK_ROOM_SWITCH = "dark-room";

/**
 * The switch for the room drawn in the game's own graphics
 * (`dark-room-art.ts`): on only while the dark room map is on and its style
 * is "Game art". Its ranges are the `dark-room-art-…` ones.
 */
export const DARK_ROOM_ART_SWITCH = "dark-room-art";

/**
 * The switches for the Door Randomizer's pots, enemy drops and shop slots
 * (`door-pots`, `door-drops`, `door-purchases`): the app turns each on
 * while the run's settings shuffle what its table records, in Race Mode
 * too, and only then (v2.0: such things are locations "only ... in modes
 * where they are shuffled").
 */
export const DOOR_POTS_SWITCH = "door-pots";
export const DOOR_DROPS_SWITCH = "door-drops";
export const DOOR_SHOPS_SWITCH = "door-shops";

/**
 * How often the room's tilemaps are read again when nothing said they
 * changed: they are read on entry and whenever the collision map, the objects
 * or the doors change, which is when the game patches them.
 */
export const ART_MS = 5000;

/**
 * A range of the dark room map read while the room is wanted: four times a
 * second, in one request beside the others of its kind, and held over a menu
 * or a text box (`darkRoomHeld`).
 */
function assist<const Id extends string>(spec: {
  readonly id: Id;
  readonly at: number;
  readonly size: number;
  readonly source: SourceRef;
  readonly optIn?: string;
}): AlttprRange & { readonly id: Id } {
  return {
    ...range({
      optIn: DARK_ROOM_SWITCH,
      ...spec,
      category: "navigation",
      everyMs: NAV_MS,
    }),
    keep: darkRoomHeld,
    when: darkRoomWanted,
  };
}

/** A range of the room's picture: read as `assist` does, behind its own switch. */
function art<const Id extends string>(spec: {
  readonly id: Id;
  readonly at: number;
  readonly size: number;
  readonly source: SourceRef;
}): AlttprRange & { readonly id: Id } {
  return assist({ ...spec, optIn: DARK_ROOM_ART_SWITCH });
}

/**
 * A tilemap of the room's picture, 8 KiB read alone: on entry, when the
 * collision map, the objects or the doors change (the game patches the
 * tilemap with them: dungeon.c:5704-5826, misc.c:470-512), and every
 * `ART_MS`.
 */
function tilemap<const Id extends string>(spec: {
  readonly id: Id;
  readonly at: number;
  readonly source: SourceRef;
  readonly when: (view: RangeView) => boolean;
}): AlttprRange & { readonly id: Id } {
  return {
    ...range({
      at: spec.at,
      category: "navigation",
      everyMs: ART_MS,
      id: spec.id,
      optIn: DARK_ROOM_ART_SWITCH,
      size: 0x2000,
      source: spec.source,
    }),
    alone: true,
    keep: darkRoomHeld,
    refreshOn: [
      "dark-room-room",
      "dark-room-map",
      "dark-room-objects",
      "dark-room-doors",
    ],
    when: spec.when,
  };
}

interface RangeSource<Id extends string> {
  readonly id: Id;
  /** A-bus address. */
  readonly at: number;
  readonly size: number;
  readonly category: string;
  /** Omitted: never polled. */
  readonly everyMs?: number;
  readonly source: SourceRef;
  readonly optIn?: string;
}

function range<const Id extends string>(
  spec: RangeSource<Id>,
): AlttprRange & { readonly id: Id } {
  const { at, ...rest } = spec;
  return { ...rest, address: bus(at), bus: at };
}

/** Rooms `first` to `last`, two bytes each. */
function rooms<const Id extends string>(
  id: Id,
  [first, last]: readonly [first: number, last: number],
  category: string,
  source: SourceRef,
): AlttprRange & { readonly id: Id } {
  return range({
    at: roomAddress(first),
    category,
    everyMs: GAME_MS,
    id,
    size: (last - first + 1) * 2,
    source,
  });
}

/** A boss room (heartpieces.asm:345-378, CheckIfBossRoom). */
function bossRoom<const Id extends string>(
  id: Id,
  room: number,
): AlttprRange & { readonly id: Id } {
  return rooms(id, [room, room], "boss-kills", "z3:heartpieces.asm:345-378");
}

/** Save data at `offset`, polled as items are unless `everyMs` says. */
function save<const Id extends string>(
  id: Id,
  offset: number,
  size: number,
  category: string,
  source: SourceRef,
  everyMs: number | null = GAME_MS,
): AlttprRange & { readonly id: Id } {
  return range({
    at: SAVE_DATA + offset,
    category,
    ...(everyMs === null ? {} : { everyMs }),
    id,
    size,
    source,
  });
}

/**
 * Every range, in address order. Categories are ALTTPR_RACE_PROFILE's: the
 * seed's settings outside the race windows are `other`, which no race
 * permits. A range without `everyMs` is never polled: the game check reads
 * the header, and the two HUD bytes inside the equipment are declared so
 * that Race Mode never reads them while it merges their neighbours.
 */
export const MEMORY_RANGES = [
  // The header's last 32 bytes: the 21-byte title, which alttpr.com sets to
  // "VT <hash>" (vt app/World.php:1090, 1350; Rom.php:2318-2321), and the
  // layout bytes the base patch sets (LTTP_RND_GeneralBugfixes.asm:14-27).
  range({
    at: 0x00_ffc0,
    category: "rom-header",
    id: "rom-header",
    size: 0x20,
    source: "z3:LTTP_RND_GeneralBugfixes.asm:14-27",
  }),
  // CrystalPendantFlags from Eastern Palace to Turtle Rock: the bit each
  // dungeon's prize sets in the pendants' or the crystals' field
  // (tables.asm:611-626). vt writes each prize's second byte there (Prize
  // locations' second address, Region/Standard/EasternPalace.php:58 and the
  // nine alike; Item.php:148-150, 254-260). Outside Race Mode only, and
  // only to name the prizes the game shows (prizes.ts).
  range({
    at: 0x02_a09d,
    category: "prizes",
    everyMs: SETTINGS_MS,
    id: "prize-bits",
    size: 11,
    source: "z3:tables.asm:611-626",
  }),
  // Where each hole and each overworld door leads: the entrance it loads,
  // which the entrance randomizer writes into the game's tables (Rom.py:
  // 533-539). Read as the seed's settings are: ROM does not change while a
  // seed runs. No race permits tracking entrances, and the race rules
  // (v2.0) forbid accessing these ROM addresses before or during a race.
  range({
    at: 0x1b_b84c,
    category: "entrances",
    everyMs: SETTINGS_MS,
    id: "hole-table",
    size: tables.holes,
    source: "er:Rom.py:533-536",
  }),
  range({
    at: 0x1b_bb73,
    category: "entrances",
    everyMs: SETTINGS_MS,
    id: "door-table",
    size: tables.doors,
    source: "z3:doorframefixes.asm:11",
  }),
  // The seed's settings in the base patch's tables, bank $30: read slowly,
  // and outside Race Mode only but for the seed type (seed-settings.ts).
  ...SEED_SETTINGS_RANGES,
  range({
    at: 0x7e_0010,
    category: "game-start",
    everyMs: GAME_MS,
    id: "game-mode",
    size: 1,
    source: "z3:ram.asm:41",
  }),
  // The dark room map (dark-room.ts): never read in Race Mode (category
  // `navigation`, which no race permits), and only while the player turns
  // the assist on (the `dark-room` switch). The gate: main module and
  // submodule ($10 = 07 and $11 = 00 is normal play in a dungeon, $10 = 0E the
  // menu and the text modules over it). Two bytes, not the frame counter $1A
  // beside them, which changes at every read.
  range({
    at: 0x7e_0010,
    category: "navigation",
    everyMs: GAME_MS,
    id: "dark-room-mode",
    optIn: DARK_ROOM_SWITCH,
    size: 2,
    source: "zelda3:src/variables.h:3-4",
  }),
  // Indoors.
  range({
    at: 0x7e_001b,
    category: "navigation",
    everyMs: GAME_MS,
    id: "dark-room-indoors",
    optIn: DARK_ROOM_SWITCH,
    size: 1,
    source: "zelda3:src/variables.h:14",
  }),
  // The main and sub screens' layers (TM_copy, TS_copy): bit 0 of the main
  // screen's says whether BG1 is drawn (dungeon.c:6762-6772).
  art({
    at: 0x7e_001c,
    id: "dark-room-art-screens",
    size: 2,
    source: "zelda3:src/variables.h:15-16",
  }),
  // Link's Y and X, absolute in the dungeon's grid (& $1FF inside the room).
  assist({
    at: 0x7e_0020,
    id: "dark-room-link",
    size: 4,
    source: "zelda3:src/variables.h:19-20",
  }),
  // Link's stance: the way he faces at $2F (0 up, 2 down, 4 left, 6 right),
  // and at $79 his sword's charge while B is held, 48 and up a spin attack
  // ready (player.c:2197-2242). One range from the one to the other, so the
  // 250 ms request keeps one span here rather than two.
  assist({
    at: 0x7e_002f,
    id: "dark-room-stance",
    size: 0x4b,
    source: "zelda3:src/variables.h:31-91",
  }),
  // OverworldIndex: the overworld screen Link is on (a Dark World screen is
  // OR $40), kept in the dungeons too, as the screen he came from. Read
  // outside Race Mode only, to see whether a medallion pad's screen is the
  // one in view (medallions.ts); inside Race Mode's window, but `other`.
  range({
    at: 0x7e_008a,
    category: "other",
    everyMs: GAME_MS,
    id: "overworld-screen",
    size: 1,
    source: "z3:ram.asm:93",
  }),
  // The room Link is in, or last was once outdoors: the one he came out of.
  range({
    at: 0x7e_00a0,
    category: "entrances",
    everyMs: GAME_MS,
    id: "room",
    size: 2,
    source: "z3:ram.asm:107",
  }),
  // The room alone, not the quadrant bytes beside it: they change inside a
  // room, and a change of this range makes the map be read again.
  assist({
    at: 0x7e_00a0,
    id: "dark-room-room",
    size: 2,
    source: "zelda3:src/variables.h:112",
  }),
  // From the room's id to the layer: at $BC the ROM bank Link's body graphics
  // are copied from each frame ($10, or the base patch's own for a custom
  // player sprite: z3 ram.asm:120, spriteswap.asm), at $E2 and $E8 the copies
  // of BG2's scroll registers (zelda3 variables.h:134-139). One range, so the
  // 250 ms request keeps one span from the room to the layer.
  art({
    at: 0x7e_00a2,
    id: "dark-room-art-view",
    size: 0x4a,
    source: "z3:ram.asm:120",
  }),
  // The layer Link is on: 1 selects the second attribute table.
  assist({
    at: 0x7e_00ee,
    id: "dark-room-layer",
    size: 1,
    source: "zelda3:src/variables.h:141",
  }),
  // The entrance the last door or hole loaded.
  range({
    at: 0x7e_010e,
    category: "entrances",
    everyMs: GAME_MS,
    id: "entrance",
    size: 2,
    source: "z3:ram.asm:158",
  }),
  // $0458-$0479: the Lamp's cone, the torches lit, the room header's
  // collision layer ($046C) and where the torches start in the objects'
  // arrays ($0478).
  assist({
    at: 0x7e_0458,
    id: "dark-room-lights",
    size: 0x22,
    source: "zelda3:src/variables.h:444-464",
  }),
  // The objects' arrays: what each replaceable object is ($0500), where each
  // torch sits and whether it is lit, bit $8000 ($0540, misc.c:470-480).
  assist({
    at: 0x7e_0500,
    id: "dark-room-objects",
    size: 0x60,
    source: "zelda3:src/variables.h:512-514",
  }),
  // The chests' words: bit $8000 marks a big key lock, not a chest.
  assist({
    at: 0x7e_06e0,
    id: "dark-room-chests",
    size: 0x20,
    source: "zelda3:src/dungeon.c:4020-4048",
  }),
  // The OAM buffer the NMI copies to the PPU each frame (nmi.c:218): 128
  // sprites of 4 bytes, then their high bits, 2 a sprite; then the room's
  // blocksets ($0AA1 main, $0AA2 aux: variables.h:599-601) and the sources of
  // what the NMI copies to sprite VRAM each frame: Link's body from ROM, his
  // sword, shield and items from WRAM ($0AC0-$0AF9, variables.h:620-645,
  // nmi.c:173-199), with the animated tiles' at $0ADC. One range across the
  // 129 bytes between, so the 250 ms request keeps one span.
  art({
    at: 0x7e_0800,
    id: "dark-room-art-sprites",
    size: 0x2fa,
    source: "zelda3:src/nmi.c:218",
  }),
  // The sixteen sprite slots' states (0 an empty slot) at $0DD0 and types at
  // $0E20 (zelda3 variables.h:724, 729), one range from the one to the
  // other: in a boss room, which boss the game put there (boss-rooms.ts).
  // `navigation`: it says which room Link is in, so no race reads it.
  range({
    at: 0x7e_0dd0,
    category: "navigation",
    everyMs: GAME_MS,
    id: "boss-sprites",
    size: 0x60,
    source: "zelda3:src/variables.h:724-729",
  }),
  // What each closed door is: its type in the low byte of the slot's word.
  assist({
    at: 0x7e_1980,
    id: "dark-room-doors",
    size: 0x20,
    source: "zelda3:src/variables.h:798",
  }),
  // The room's tilemaps, the source the game uploads VRAM from: BG2, and
  // BG1 only while the main screen draws it (variables.h:926-927,
  // dungeon.c:2393-2427).
  tilemap({
    at: 0x7e_2000,
    id: "dark-room-art-bg2",
    source: "zelda3:src/variables.h:926",
    when: darkRoomWanted,
  }),
  tilemap({
    at: 0x7e_4000,
    id: "dark-room-art-bg1",
    source: "zelda3:src/variables.h:927",
    when: backgroundWanted,
  }),
  // Whether the room is dark by its header (dung_want_lights_out).
  range({
    at: 0x7e_c005,
    category: "navigation",
    everyMs: GAME_MS,
    id: "dark-room-dark",
    optIn: DARK_ROOM_SWITCH,
    size: 1,
    source: "zelda3:src/dungeon.c:3699",
  }),
  // The palettes the NMI copies to CGRAM (nmi.c:212): the backgrounds' 128
  // colours, then the sprites'. A dark room keeps its colours: the darkness
  // is colour math (load_gfx.c:1658-1697).
  art({
    at: 0x7e_c500,
    id: "dark-room-art-palette",
    size: 0x200,
    source: "zelda3:src/variables.h:1055",
  }),
  // Dungeon rooms $00-$E0: every dungeon location's room lies there, the
  // last being Castle Tower's Room 03 ($E0). Race Mode reads them (v2.0's
  // dungeon-locations), the chest, key and boss bits alone (check-flags.ts),
  // never the doors or the quadrants visited. The boss rooms and the three
  // caves among them are ranges of their own too, under their categories.
  rooms("dungeon-rooms", [0x00, 0xe0], "dungeon-checks", "z3:sram.asm:16-52"),
  bossRoom("swamp-palace-boss-room", 0x06),
  bossRoom("tower-of-hera-boss-room", 0x07),
  bossRoom("skull-woods-boss-room", 0x29),
  rooms(
    "kakariko-well-room",
    [0x2f, 0x2f],
    "outside-checks",
    "ap:Client.py:69-73",
  ),
  bossRoom("desert-palace-boss-room", 0x33),
  rooms(
    "hookshot-cave-room",
    [0x3c, 0x3c],
    "outside-checks",
    "ap:Client.py:150-153",
  ),
  rooms(
    "secret-passage-room",
    [0x55, 0x55],
    "outside-checks",
    "ap:Client.py:57",
  ),
  bossRoom("palace-of-darkness-boss-room", 0x5a),
  bossRoom("misery-mire-boss-room", 0x90),
  bossRoom("turtle-rock-boss-room", 0xa4),
  bossRoom("thieves-town-boss-room", 0xac),
  bossRoom("eastern-palace-boss-room", 0xc8),
  bossRoom("ice-palace-boss-room", 0xde),
  // Caves, houses and the like: rooms $E1 to $127, the last (sram.asm:18).
  rooms("cave-rooms", [0xe1, 0x127], "outside-checks", "z3:sram.asm:16-52"),
  // Screens $00-$81: both worlds, then the pedestal ($80) and Zora's ledge
  // ($81), the last screens with an item (ap Client.py:306-317).
  save(
    "overworld",
    0x280,
    0x82,
    "outside-checks",
    "z3:sram.asm:54-69",
    GAME_MS,
  ),
  // Bow, boomerang, hookshot.
  save("equipment-a", 0x340, 3, "items", "z3:sram.asm:80-85"),
  // Bombs held, a HUD count.
  save("bomb-count", 0x343, 1, "hud", "z3:sram.asm:86", null),
  // Powder or mushroom, through the Book of Mudora.
  save("equipment-b", 0x344, 11, "items", "z3:sram.asm:87-97"),
  // The bottle in the menu: the equipped item.
  save("bottle-index", 0x34f, 1, "hud", "z3:sram.asm:98", null),
  // Somaria through the armor.
  save("equipment-c", 0x350, 12, "items", "z3:sram.asm:99-110"),
  // What each bottle holds, $00 for no bottle: the bottle contents v2.0
  // lets a tracker show ("bottle contents"), which Race Mode reads
  // (`bottles`): how many bottles Link has (decodeItems) and what each holds
  // (decodeBottles) are the same four bytes.
  save("bottles", 0x35c, 4, "bottles", "z3:sram.asm:111-115"),
  save("compasses", 0x364, 2, "items", "z3:sram.asm:119-126"),
  save("big-keys", 0x366, 2, "keys", "z3:sram.asm:119-126"),
  save("maps", 0x368, 2, "items", "z3:sram.asm:119-126"),
  // HeartPieceQuarter, the pieces toward the next heart, 0 to 3, wrapping to
  // $00 as the fourth adds a heart (sram.asm:130); then MaximumHealth, the
  // hearts on screen, $08 a heart, from the 3 Link starts with ($18) to 20
  // ($A0) (sram.asm:131-132). The race rules (v2.0) let a tracker show and
  // react to the heart count and the heart piece count: Race Mode reads both.
  save("health", 0x36b, 2, "health", "z3:sram.asm:130-132"),
  // BombCapacity and ArrowCapacity: "flatly how many can be held", set by
  // each upgrade (newitems.asm:353-400). v2.0 names the bomb and arrow
  // *counts* but no capacity upgrade, and "anything not covered in this
  // document is, by default, considered not permitted": `hud`, which the
  // race profile keeps forbidden like the counts beside it, so Race Mode
  // never reads these two bytes (and the planner never bridges across them).
  save("capacities", 0x370, 2, "hud", "z3:sram.asm:135-136"),
  // The pendants and crystals taken (sram.asm:139-150): Race Mode reads
  // them as `prizes-held`, the crystals as a count alone (decode.ts).
  save("pendants", 0x374, 1, "prizes-held", "z3:sram.asm:139-140"),
  save("crystals", 0x37a, 1, "prizes-held", "z3:sram.asm:148-150"),
  save("magic-upgrade", 0x37b, 1, "items", "z3:sram.asm:151"),
  // InventoryTracking and BowTracking.
  save("item-tracking", 0x38c, 4, "items", "z3:sram.asm:175-185"),
  // $02 Zelda rescued, $03 Agahnim defeated: upstream's RescueZelda and
  // DefeatAgahnim items, the collection of a dungeon prize.
  save("progress", 0x3c5, 1, "items", "z3:sram.asm:191-193"),
  // u: the uncle's item.
  save("progress-flags", 0x3c6, 1, "outside-checks", "z3:sram.asm:194-195"),
  // Purple chest, bottle merchant, hobo.
  save("npc-flags-vanilla", 0x3c9, 1, "outside-checks", "z3:sram.asm:203-205"),
  // CurrentWorld: $00 the Light World, $40 the Dark World. The world map
  // shows the prizes of its own world's dungeons (overworldmap.asm:73-78).
  save("current-world", 0x3ca, 1, "prizes", "z3:sram.asm:206"),
  // FollowerIndicator: who follows Link (sram.asm:208-211). $0D is the big
  // bomb, which only its purchase sets for good (zelda3 sprite_main.c:
  // 24295; its explosion sets it for one frame, ancilla.c:5382): seen once,
  // the Bomb Merchant sold it. Outside Race Mode only (`other`: the byte
  // also says Zelda follows, which v2.0 forbids telling in a race).
  save("follower", 0x3cc, 1, "other", "z3:sram.asm:208-211"),
  // Set when Agahnim 2 falls.
  save("agahnim-2", 0x40f, 1, "boss-kills", "z3:events.asm:104-106"),
  // The randomizer's NPC item flags.
  save("npc-flags", 0x410, 2, "outside-checks", "z3:sram.asm:240-247"),
  // MapOverlay: the dungeons whose prize the world map shows as if their
  // map were held, which Sahasrahla and the Bomb Merchant reveal (dialog.asm:
  // 490-495; vt World.php:1221-1230). The map reads it as it reads the maps'
  // field (overworldmap.asm:133-135), and vt writes it so (Region
  // map_reveal: Tower of Hera $0020, Eastern Palace $2000).
  save("map-overlay", 0x414, 2, "prizes", "z3:sram.asm:249-256"),
  // GoalCounter, a word: the goal items collected, which a Triforce Hunt
  // counts a piece at a time (newitems.asm:102-105, 470-473) and the HUD
  // shows beside the pieces the goal asks for (newhud.asm:69-80). v2.0 lists
  // "Triforce pieces" among the inventory items a tracker may auto-track, so
  // Race Mode reads it as an item.
  save("goal-counter", 0x418, 2, "items", "z3:sram.asm:265"),
  // The ROM's own stats, which its end credits show (stats/statConfig.asm:
  // 50-68) and the game stops counting once StatsLocked is set. The race
  // rules (v2.0) let a tracker show bonks, deaths, chest turns and save &
  // quits during a race and the rest only after it; Race Mode reads none of
  // them (deliberately strict), so they are `other`, in three ranges around
  // the two bytes races do read. From BonkCounter to NMIFrames, the frames played, which
  // the NMI hook counts (framehook.asm:24-26): the game's play time.
  save("stats", 0x420, 0x22, "other", "z3:sram.asm:269-295"),
  // $01 from the Triforce room on (sram.asm:297): StatsFinalPrep sets it
  // (stats.asm:322-326) where the game enters mode $19 (hooks.asm:551-552).
  save("stats-locked", 0x443, 1, "goal", "z3:stats.asm:322-326"),
  // MenuFrames, counted once a frame while the item menu is open, mode $0E
  // submode $01 (framehook.asm:14-16). Measured on bsnes-mercury: +558 over
  // the ~9.3 s the menu stayed open. The credits' shift of 8 bits
  // (stats/statConfig.asm:65) is not its unit.
  save("menu-frames", 0x444, 4, "other", "z3:sram.asm:298"),
  // Heart containers collected, boss and Sanctuary hearts (sram.asm:299,
  // itemdatatables.asm:756-757). The HUD shows the hearts they add.
  save("heart-containers", 0x448, 1, "hud", "z3:sram.asm:299"),
  // From DeathCounter to MagicCounter: deaths, faerie revivals, boss kills
  // without a sword, when the first sword, the boots, the flute and the
  // mirror were found, damage taken and magic used.
  save("stats-finds", 0x449, 0x25, "other", "z3:sram.asm:300-315"),
  // Heart pieces collected (itemdatatables.asm:717): the HUD's heart piece
  // count, which v2.0 allows and Race Mode still leaves alone (deliberately
  // strict).
  save("heart-pieces", 0x470, 1, "hud", "z3:sram.asm:318"),
  // A dungeon's prize collected: SetCutsceneFlag calls SetDungeonCompleted
  // when the prize is taken (dungeondrops.asm:103-120, 323-329); Agahnim's
  // fall sets Castle Tower's bit, Agahnim 2's Ganon's Tower's (events.asm:
  // 89-109).
  save("dungeons-completed", 0x472, 2, "items", "z3:dungeondrops.asm:323-329"),
  // DungeonCollectedKeys: the small keys received as items, sewers to
  // Ganon's Tower, which no door spends. DungeonIncrement counts each key
  // item (property $40, itemdatatables.asm:730, 854-867) through
  // CountChestKey (inventory.asm:208-213, stats.asm:126-148): a chest's, an
  // NPC's, a standing or a torch's key; never a key an enemy or a pot drops
  // (IncrementSmallKeysNoPrimary, stats.asm:90-117), but in Tower of Hera's
  // basement, room $87, whose standing key it counts once more: twice in
  // all. The keysanity HUD shows it (newhud.asm:326). Seen on a real game
  // (2026-10-28): a chest key +1, a key sprite picked up outside room $87
  // +0, Hera's basement key +2, the Desert torch's +1, a key door -0.
  save("collected-keys", 0x4e0, 14, "keys", "z3:sram.asm:361-375"),
  // The room's collision map: the two attribute tables, 64 x 64 bytes each,
  // contiguous (dung_bg2_attr_table, dung_bg1_attr_table). Read alone, as its
  // own request, and only while the room is dark and Link has no Lamp
  // (darkRoomWanted); again on a room change (`refreshOn`) and once a second,
  // for doors, chests and blocks patch it live.
  {
    ...range({
      at: 0x7f_2000,
      category: "navigation",
      everyMs: MAP_MS,
      id: "dark-room-map",
      optIn: DARK_ROOM_SWITCH,
      size: 0x2000,
      source: "zelda3:src/variables.h:1161-1162",
    }),
    alone: true,
    keep: darkRoomHeld,
    refreshOn: ["dark-room-room"],
    when: darkRoomWanted,
  },
  // The overworld door Link last went in by, its slot of the door table plus
  // one, which the base patch keeps as the game loads its entrance
  // (doorframefixes.asm:8-12, hooks.asm:2081-2082). A respawn keeps it
  // while it loads entrance 0 (seen on a real game after a save and quit,
  // 2026-10-19), so the slot alone says nothing: the door table must agree.
  range({
    at: 0x7f_5099,
    category: "entrances",
    everyMs: GAME_MS,
    id: "overworld-door",
    size: 1,
    source: "z3:ram.asm:554",
  }),
  // The Door Randomizer's tables beside the save, which its base patch
  // saves with it (sram.asm:7-9, 386-393, 644-646 at aerinon/z3randomizer
  // d0f4651): a word per room of the pots taken and of the enemy drops
  // taken, then a byte per shop slot of the purchases. Each is read only
  // while the run's settings shuffle what it records (its switch, which the
  // app sets from them): v2.0 counts a pot, an enemy drop and a shop item
  // as a location "only ... in modes where they are shuffled". An
  // alttpr.com seed never turns them on.
  range({
    at: 0x7f_6018,
    category: "pots",
    everyMs: GAME_MS,
    id: "door-pots",
    optIn: DOOR_POTS_SWITCH,
    size: 0x250,
    source: "drz3:sram.asm:390",
  }),
  range({
    at: 0x7f_6268,
    category: "enemy-drops",
    everyMs: GAME_MS,
    id: "door-drops",
    optIn: DOOR_DROPS_SWITCH,
    size: 0x250,
    source: "drz3:sram.asm:391",
  }),
  range({
    at: 0x7f_64b8,
    category: "shop-items",
    everyMs: GAME_MS,
    id: "door-purchases",
    optIn: DOOR_SHOPS_SWITCH,
    size: 0x60,
    source: "drz3:sram.asm:392",
  }),
] as const;

export type MemoryRangeId = (typeof MEMORY_RANGES)[number]["id"];

/** Ranges by id. */
export const MEMORY_RANGE = Object.fromEntries(
  MEMORY_RANGES.map((spec) => [spec.id, spec]),
) as Readonly<Record<MemoryRangeId, AlttprRange>>;
