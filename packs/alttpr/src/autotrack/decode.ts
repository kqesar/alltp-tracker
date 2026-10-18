// Decoders: from the bytes of the memory map's ranges to what the pack
// knows: the item counts by pack id, the checked locations, the bosses and
// the events. Pure and total: any bytes decode, none throw.
//
// In Race Mode a decoder never asks for a range whose category the race
// profile forbids, and withholds what the spec forbids tracking even when a
// permitted range holds it (checks inside dungeons). What it cannot tell, it
// leaves unsettled, with the reason, rather than guessing.

import { ITEMS, type ItemId } from "../items";
import { CHECK_FLAGS, type CheckFlag } from "./check-flags";
import {
  CRYSTAL_BITS,
  DUNGEON,
  DUNGEONS,
  type DungeonCode,
  GAME_MODES,
  MEMORY_RANGE,
  type MemoryRangeId,
  PENDANT_BITS,
  SAVE_DATA,
  SEWER_KEYS,
} from "./memory";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

/**
 * What the decoders read: a range's bytes, once read. The session's
 * MemorySnapshot is one.
 */
export interface MemoryView {
  has(id: string): boolean;
  bytes(id: string): Uint8Array;
}

export interface DecodeOptions {
  /** Race Mode is on: forbidden ranges are never asked for. */
  readonly race: boolean;
}

/**
 * Why a value is not known: Race Mode forbids it, or its range has not been
 * read (yet, or ever on this device).
 */
export type Unsettled = "race-mode" | "not-read";

/** Whether Race Mode permits reading a range. */
export function racePermitted(id: MemoryRangeId): boolean {
  const { category } = MEMORY_RANGE[id];
  return ALTTPR_RACE_PROFILE.categories[category]?.permitted === true;
}

/** Bytes of a range, found by A-bus address. */
interface Bytes {
  byte(at?: number): number;
  word(at?: number): number;
}

/** Reads ranges for one decoding, or says why it cannot. */
class Reader {
  constructor(
    private readonly memory: MemoryView,
    private readonly race: boolean,
  ) {}

  /** Range `id`, or why its bytes are unknown. */
  range(id: MemoryRangeId): Bytes | Unsettled {
    if (this.race && !racePermitted(id)) return "race-mode";
    if (!this.memory.has(id)) return "not-read";
    const bytes = this.memory.bytes(id);
    const { bus, size } = MEMORY_RANGE[id];
    if (bytes.length < size) return "not-read";
    const byte = (at = bus) => bytes[at - bus];
    return { byte, word: (at = bus) => byte(at) | (byte(at + 1) << 8) };
  }

  /** Whether a flag is set. */
  flag(flag: CheckFlag): boolean | Unsettled {
    const bytes = this.range(flag.range);
    if (typeof bytes === "string") return bytes;
    const value = flag.size === 2 ? bytes.word(flag.at) : bytes.byte(flag.at);
    return "atLeast" in flag
      ? value >= flag.atLeast
      : (value & flag.mask) !== 0;
  }
}

/** How one item is read: from which range, by which rule. */
interface ItemSource {
  readonly range: MemoryRangeId;
  /** The count, from the range's bytes. decodeItems caps it at its max. */
  readonly read: (bytes: Bytes) => number;
  /**
   * Memory gives a lower bound only: the small keys held, which the keys
   * found can only exceed (DungeonKeys counts down as doors open; the chest
   * key counters of sram.asm:361-375 are unwritten at this commit).
   */
  readonly bound?: true;
}

const SAVE = (offset: number) => SAVE_DATA + offset;
const INVENTORY_TRACKING = SAVE(0x38c);
const BOW_TRACKING = SAVE(0x38e);

const bit = (value: number, mask: number) => ((value & mask) === 0 ? 0 : 1);
/** A level kept as a value from 1 to `max`; anything else is none. */
const level = (value: number, max: number) =>
  value >= 1 && value <= max ? value : 0;
/** Progressive bows found: BowTracking's f and p bits (newitems.asm:851-879). */
const progressiveBows = (tracking: number) =>
  bit(tracking, 0x10) + bit(tracking, 0x20);

/** Held when its byte in the equipment is not zero (sram.asm:80-110). */
function equipment(
  range: "equipment-a" | "equipment-b" | "equipment-c",
  offset: number,
): ItemSource {
  return { range, read: ({ byte }) => (byte(SAVE(offset)) === 0 ? 0 : 1) };
}

/** A value from 1 to `max` in the equipment (sram.asm:103-110). */
function equipmentLevel(offset: number, max: number): ItemSource {
  return {
    range: "equipment-c",
    read: ({ byte }) => level(byte(SAVE(offset)), max),
  };
}

/** A bit of InventoryTracking (sram.asm:175-179, newitems.asm:146-174). */
function tracked(mask: number, offset = 0): ItemSource {
  return {
    range: "item-tracking",
    read: ({ byte }) => bit(byte(INVENTORY_TRACKING + offset), mask),
  };
}

function dungeonItem(
  range: "big-keys" | "compasses" | "maps",
  code: DungeonCode,
): ItemSource {
  return { range, read: ({ word }) => bit(word(), DUNGEON[code].bit) };
}

function smallKeys(code: DungeonCode): ItemSource {
  const at = MEMORY_RANGE["small-keys"].bus;
  return {
    bound: true,
    range: "small-keys",
    // Hyrule Castle's keys and the sewers' rise together (sram.asm:155-156).
    read: ({ byte }) =>
      code === "H2"
        ? Math.max(byte(at + DUNGEON.H2.keys), byte(at + SEWER_KEYS))
        : byte(at + DUNGEON[code].keys),
  };
}

function prize(range: "crystals" | "pendants", mask: number): ItemSource {
  return { range, read: ({ byte }) => bit(byte(), mask) };
}

/** A count capped by decodeItems at the item's max. */
function count(range: "heart-containers" | "heart-pieces"): ItemSource {
  return { range, read: ({ byte }) => byte() };
}

/**
 * Every pack item and where memory keeps it, counted as upstream counts it
 * (items.ts): the progressive items found, or the level reached.
 */
export const ITEM_SOURCES: Readonly<Record<ItemId, ItemSource | null>> = {
  armor: equipmentLevel(0x35b, 2),
  bigKeyA2: dungeonItem("big-keys", "A2"),
  bigKeyD1: dungeonItem("big-keys", "D1"),
  bigKeyD2: dungeonItem("big-keys", "D2"),
  bigKeyD3: dungeonItem("big-keys", "D3"),
  bigKeyD4: dungeonItem("big-keys", "D4"),
  bigKeyD5: dungeonItem("big-keys", "D5"),
  bigKeyD6: dungeonItem("big-keys", "D6"),
  bigKeyD7: dungeonItem("big-keys", "D7"),
  bigKeyP1: dungeonItem("big-keys", "P1"),
  bigKeyP2: dungeonItem("big-keys", "P2"),
  bigKeyP3: dungeonItem("big-keys", "P3"),
  // Bought from Inverted's Bomb Merchant. sram.asm:281-283 documents a "Big
  // Bomb Acquired" bit in PreGTBKLocations ($7EF42A), but no code sets it at
  // this commit (inventory.asm:228 only counts Ganon's Tower's checks), and
  // FollowerIndicator $0D (sram.asm:211) holds only while Link carries it:
  // memory does not tell, so the board keeps what the player says.
  bigRedBomb: null,
  bombos: equipment("equipment-b", 0x347),
  bookOfMudora: equipment("equipment-b", 0x34e),
  boomerang: tracked(0x80),
  // Slots not $00 (sram.asm:111-115): the count needs the contents.
  bottle: {
    range: "bottles",
    read: ({ byte }) =>
      [0, 1, 2, 3].filter((slot) => byte(SAVE(0x35c + slot)) !== 0).length,
  },
  // The second progressive bow resolves to the silver bow (newitems.asm:
  // 786-802), so two progressive bows are bow 2, as upstream counts them. A
  // bow found otherwise sets the b bit only: bow 1.
  bow: {
    range: "item-tracking",
    read: ({ byte }) => {
      const tracking = byte(BOW_TRACKING);
      return Math.max(progressiveBows(tracking), bit(tracking, 0x80));
    },
  },
  bugCatchingNet: equipment("equipment-b", 0x34d),
  caneOfByrna: equipment("equipment-c", 0x351),
  caneOfSomaria: equipment("equipment-c", 0x350),
  cape: equipment("equipment-c", 0x352),
  compassA2: dungeonItem("compasses", "A2"),
  compassD1: dungeonItem("compasses", "D1"),
  compassD2: dungeonItem("compasses", "D2"),
  compassD3: dungeonItem("compasses", "D3"),
  compassD4: dungeonItem("compasses", "D4"),
  compassD5: dungeonItem("compasses", "D5"),
  compassD6: dungeonItem("compasses", "D6"),
  compassD7: dungeonItem("compasses", "D7"),
  compassP1: dungeonItem("compasses", "P1"),
  compassP2: dungeonItem("compasses", "P2"),
  compassP3: dungeonItem("compasses", "P3"),
  crystal1: prize("crystals", CRYSTAL_BITS.crystal1),
  crystal2: prize("crystals", CRYSTAL_BITS.crystal2),
  crystal3: prize("crystals", CRYSTAL_BITS.crystal3),
  crystal4: prize("crystals", CRYSTAL_BITS.crystal4),
  crystal5: prize("crystals", CRYSTAL_BITS.crystal5),
  crystal6: prize("crystals", CRYSTAL_BITS.crystal6),
  crystal7: prize("crystals", CRYSTAL_BITS.crystal7),
  // ProgressIndicator $03 (sram.asm:191-193, events.asm:89-90).
  defeatAgahnim: {
    range: "progress",
    read: ({ byte }) => (byte() >= 3 ? 1 : 0),
  },
  // Aga2Duck, set when Agahnim 2 falls (events.asm:104-106).
  defeatAgahnim2: { range: "agahnim-2", read: ({ byte }) => bit(byte(), 1) },
  ether: equipment("equipment-b", 0x348),
  fireRod: equipment("equipment-b", 0x345),
  flippers: equipment("equipment-c", 0x356),
  // f: the active flute, k: the inactive one, which activating clears
  // (inventory.asm:450-453).
  flute: {
    range: "item-tracking",
    read: ({ byte }) => {
      const tracking = byte(INVENTORY_TRACKING);
      return tracking & 0x01 ? 2 : tracking & 0x02 ? 1 : 0;
    },
  },
  glove: equipmentLevel(0x354, 2),
  hammer: equipment("equipment-b", 0x34b),
  // Boss and Sanctuary hearts (itemdatatables.asm:756-757).
  heartContainer: count("heart-containers"),
  hookshot: equipment("equipment-a", 0x342),
  iceRod: equipment("equipment-b", 0x346),
  keyA1: smallKeys("A1"),
  keyA2: smallKeys("A2"),
  keyD1: smallKeys("D1"),
  keyD2: smallKeys("D2"),
  keyD3: smallKeys("D3"),
  keyD4: smallKeys("D4"),
  keyD5: smallKeys("D5"),
  keyD6: smallKeys("D6"),
  keyD7: smallKeys("D7"),
  keyH2: smallKeys("H2"),
  keyP2: smallKeys("P2"),
  keyP3: smallKeys("P3"),
  lamp: equipment("equipment-b", 0x34a),
  // MagicConsumption: $01 half, $02 quarter (sram.asm:151).
  magic: { range: "magic-upgrade", read: ({ byte }) => level(byte(), 2) },
  // $02 is the mirror; $01, the scroll, a picture only (sram.asm:102).
  magicMirror: {
    range: "equipment-c",
    read: ({ byte }) => (byte(SAVE(0x353)) >= 2 ? 1 : 0),
  },
  mapA2: dungeonItem("maps", "A2"),
  mapD1: dungeonItem("maps", "D1"),
  mapD2: dungeonItem("maps", "D2"),
  mapD3: dungeonItem("maps", "D3"),
  mapD4: dungeonItem("maps", "D4"),
  mapD5: dungeonItem("maps", "D5"),
  mapD6: dungeonItem("maps", "D6"),
  mapD7: dungeonItem("maps", "D7"),
  mapH2: dungeonItem("maps", "H2"),
  mapP1: dungeonItem("maps", "P1"),
  mapP2: dungeonItem("maps", "P2"),
  mapP3: dungeonItem("maps", "P3"),
  moonPearl: equipment("equipment-c", 0x357),
  // m while held, n once traded to the witch: found either way.
  mushroom: tracked(0x28),
  pegasusBoots: equipment("equipment-c", 0x355),
  pendantOfCourage: prize("pendants", PENDANT_BITS.pendantOfCourage),
  pendantOfPower: prize("pendants", PENDANT_BITS.pendantOfPower),
  pendantOfWisdom: prize("pendants", PENDANT_BITS.pendantOfWisdom),
  pieceOfHeart: count("heart-pieces"),
  powder: tracked(0x10),
  quake: equipment("equipment-b", 0x349),
  redBoomerang: tracked(0x40),
  // ProgressIndicator $02 (zelda.asm:11-13), where Open starts.
  rescueZelda: { range: "progress", read: ({ byte }) => (byte() >= 2 ? 1 : 0) },
  shield: equipmentLevel(0x35a, 3),
  // The retro world's shops: a key for sale is a place the player found, no
  // memory says it; an arrow bought is CurrentArrows in the rupee bow mode
  // alone (z3 newitems.asm:428-433), which the decoder does not know
  shopArrow: null,
  shopKey: null,
  shovel: tracked(0x04),
  // s, with fewer than two progressive bows: the second sets s itself.
  silverArrowUpgrade: {
    range: "item-tracking",
    read: ({ byte }) => {
      const tracking = byte(BOW_TRACKING);
      return progressiveBows(tracking) < 2 ? bit(tracking, 0x40) : 0;
    },
  },
  // $FF is no sword, as in swordless (inventory.asm:299, dialog.asm:320).
  sword: equipmentLevel(0x359, 4),
  // o: any bomb item acquired (inventory.asm:276-278). No flag keeps
  // TenBombs itself; upstream reads it only in canKillEscapeThings, which
  // any bomb serves.
  tenBombs: tracked(0x02, 1),
};

/** What memory says of the items. Each pack item is in one of the three. */
export interface ItemReading {
  /** Counts memory settles, by pack item id. */
  readonly counts: Partial<Record<ItemId, number>>;
  /** Lower bounds where memory holds no count: the small keys held. */
  readonly atLeast: Partial<Record<ItemId, number>>;
  readonly unsettled: Partial<Record<ItemId, Unsettled>>;
}

/** The pack's items, from memory. */
export function decodeItems(
  memory: MemoryView,
  options: DecodeOptions,
): ItemReading {
  const reader = new Reader(memory, options.race);
  const counts: Partial<Record<ItemId, number>> = {};
  const atLeast: Partial<Record<ItemId, number>> = {};
  const unsettled: Partial<Record<ItemId, Unsettled>> = {};
  for (const { id, max } of ITEMS) {
    const source = ITEM_SOURCES[id];
    if (source === null) continue;
    const bytes = reader.range(source.range);
    if (typeof bytes === "string") {
      unsettled[id] = bytes;
      continue;
    }
    const value = Math.min(max, source.read(bytes));
    if (source.bound) atLeast[id] = value;
    else counts[id] = value;
  }
  return { atLeast, counts, unsettled };
}

/** What memory says of the locations CHECK_FLAGS maps. */
export interface CheckReading {
  /** Locations checked, by the pack's location id. */
  readonly checked: ReadonlySet<string>;
  /** Locations memory cannot settle now, with why. */
  readonly unsettled: ReadonlyMap<string, Unsettled>;
}

/**
 * The checked locations. In Race Mode the spec forbids tracking checks
 * inside a dungeon: those stay unsettled, even the boss drops and prizes
 * whose flags permitted ranges hold.
 */
export function decodeChecks(
  memory: MemoryView,
  options: DecodeOptions,
): CheckReading {
  const reader = new Reader(memory, options.race);
  const checked = new Set<string>();
  const unsettled = new Map<string, Unsettled>();
  for (const { dungeon, flag, id } of CHECK_FLAGS) {
    const set =
      options.race && dungeon !== null ? "race-mode" : reader.flag(flag);
    if (typeof set === "string") unsettled.set(id, set);
    else if (set) checked.add(id);
  }
  return { checked, unsettled };
}

/** The dungeons whose boss the tracker follows: all but Hyrule Castle. */
export type BossDungeon = Exclude<DungeonCode, "H2">;

/** A fact memory settles, or why it cannot. */
export type Fact = boolean | Unsettled;

/** What memory says of the bosses and the events of the run. */
export interface ProgressReading {
  /**
   * Bosses beaten: the boss bit of the boss room for the ten with a heart
   * container, ProgressIndicator for Agahnim (A1), Aga2Duck for Agahnim 2.
   */
  readonly bosses: Readonly<Record<BossDungeon, Fact>>;
  /** Dungeon prizes collected (DungeonsCompleted). */
  readonly completed: Readonly<Record<BossDungeon, Fact>>;
  /** In play: the game mode is a dungeon, the overworld or the goal. */
  readonly started: Fact;
  /**
   * Before play: the title, the file select or the spawn select. A game
   * starts when a reading in play follows one before play; `started` alone
   * also turns false in menus and text boxes.
   */
  readonly beforePlay: Fact;
  /** The ROM's own stats, outside Race Mode only: no race permits them. */
  readonly romStats: RomStats | Unsettled;
  /** The Triforce room reached: game mode $19 or $1A, or StatsLocked. */
  readonly goal: Fact;
  /** Zelda rescued: ProgressIndicator $02, where Open starts. */
  readonly rescueZelda: Fact;
}

/**
 * The ROM's own stats, those its end credits show (stats/statConfig.asm:
 * 50-68), which the game stops counting at the goal (StatsLocked). Frames
 * are frames played: playTimeMs turns them into time. They read 0 before a
 * file is loaded: the title and the file select clear the save data in
 * WRAM (seen on a real game after a save and quit).
 */
export interface RomStats {
  /** Frames played (NMIFrames): the game's play time. */
  readonly playFrames: number;
  /** Frames the item menu was open (MenuFrames). */
  readonly menuFrames: number;
  /**
   * Frames the game lagged: NMI frames its main loop missed, NMIFrames less
   * LoopFrames, as StatsFinalPrep works it out (stats.asm:334-337).
   */
  readonly lagFrames: number;
  /**
   * When the first sword, the boots, the flute and the mirror were found,
   * in frames played; 0 until then.
   */
  readonly found: Readonly<
    Record<"boots" | "flute" | "mirror" | "sword", number>
  >;
  /** Bosses killed without a sword, and with each sword. */
  readonly bossKills: Readonly<
    Record<"fighter" | "gold" | "master" | "swordless" | "tempered", number>
  >;
  readonly bonks: number;
  readonly damageTaken: number;
  readonly deaths: number;
  readonly faerieRevivals: number;
  /** Items collected, the credits' collection rate (TotalItemCounter). */
  readonly itemsCollected: number;
  readonly magicUsed: number;
  readonly saveAndQuits: number;
}

/** A 32-bit little-endian count at save data `offset`. */
const long = (bytes: Bytes, offset: number): number =>
  (bytes.word(SAVE(offset)) | (bytes.word(SAVE(offset + 2)) << 16)) >>> 0;

/**
 * The ROM's stats, at the addresses sram.asm asserts (sram.asm:560-596).
 * Unsettled when any of their three ranges is.
 */
function romStats(reader: Reader): RomStats | Unsettled {
  const stats = reader.range("stats");
  if (typeof stats === "string") return stats;
  const menu = reader.range("menu-frames");
  if (typeof menu === "string") return menu;
  const finds = reader.range("stats-finds");
  if (typeof finds === "string") return finds;
  // t t t t g g g g f f f f m m m m: kills with the tempered, gold, fighter
  // and master swords (sram.asm:274-276)
  const kills = stats.word(SAVE(0x425));
  const playFrames = long(stats, 0x43e);
  return {
    bonks: stats.byte(SAVE(0x420)),
    bossKills: {
      fighter: (kills >> 4) & 0xf,
      gold: (kills >> 8) & 0xf,
      master: kills & 0xf,
      swordless: finds.byte(SAVE(0x452)),
      tempered: (kills >> 12) & 0xf,
    },
    damageTaken: finds.word(SAVE(0x46a)),
    deaths: finds.byte(SAVE(0x449)),
    faerieRevivals: finds.byte(SAVE(0x453)),
    found: {
      boots: long(finds, 0x45c),
      flute: long(finds, 0x460),
      mirror: long(finds, 0x464),
      sword: long(finds, 0x458),
    },
    itemsCollected: stats.word(SAVE(0x423)),
    lagFrames: Math.max(0, playFrames - long(stats, 0x42e)),
    magicUsed: finds.word(SAVE(0x46c)),
    menuFrames: long(menu, 0x444),
    playFrames,
    saveAndQuits: stats.byte(SAVE(0x42d)),
  };
}

/** The bosses' flags: CHECK_FLAGS' boss drops and the two Agahnims. */
const BOSS_FLAGS = CHECK_FLAGS.filter(
  ({ id }) => id.endsWith("/boss") || id === "agahnim" || id === "agahnim-2",
);

const IN_PLAY: readonly number[] = [...GAME_MODES.playing, ...GAME_MODES.goal];
const BEFORE_PLAY: readonly number[] = GAME_MODES.beforePlay;
const GOAL: readonly number[] = GAME_MODES.goal;

function byteFlag(
  range: MemoryRangeId,
  test: (value: number) => boolean,
): (reader: Reader) => Fact {
  return (reader) => {
    const bytes = reader.range(range);
    return typeof bytes === "string" ? bytes : test(bytes.byte());
  };
}

const inPlay = byteFlag("game-mode", (mode) => IN_PLAY.includes(mode));
const inGoal = byteFlag("game-mode", (mode) => GOAL.includes(mode));
const preGame = byteFlag("game-mode", (mode) => BEFORE_PLAY.includes(mode));
const statsLocked = byteFlag("stats-locked", (value) => value !== 0);
const zelda = byteFlag("progress", (value) => value >= 2);

/** The bosses and events, from memory. Race Mode permits all of it. */
export function decodeProgress(
  memory: MemoryView,
  options: DecodeOptions,
): ProgressReading {
  const reader = new Reader(memory, options.race);
  const bosses = {} as Record<BossDungeon, Fact>;
  for (const { dungeon, flag } of BOSS_FLAGS) {
    bosses[dungeon as BossDungeon] = reader.flag(flag);
  }
  const completed = {} as Record<BossDungeon, Fact>;
  for (const { bit: mask, code } of DUNGEONS) {
    if (code === "H2") continue;
    completed[code] = reader.flag({
      at: MEMORY_RANGE["dungeons-completed"].bus,
      mask,
      range: "dungeons-completed",
      size: 2,
    });
  }
  // The game mode shows the goal while the Triforce room and the credits
  // last; StatsLocked, set as the mode turns $19, keeps it. A clear
  // StatsLocked says the goal is not reached; a mode outside the goal does
  // not (the credits end).
  const mode = inGoal(reader);
  const locked = statsLocked(reader);
  return {
    beforePlay: preGame(reader),
    bosses,
    completed,
    goal: mode === true || locked === true ? true : locked,
    rescueZelda: zelda(reader),
    romStats: romStats(reader),
    started: inPlay(reader),
  };
}

/**
 * The SNES's NTSC frame rate: its 21.47727 MHz master clock over the 262 ×
 * 1364 − 2 master cycles of a frame (fabiensanglard.net/snes_hearts).
 */
export const FRAMES_PER_SECOND = 21_477_270 / (262 * 1364 - 2);

/** How long `frames` of play last, in milliseconds. */
export const playTimeMs = (frames: number): number =>
  Math.round((frames * 1000) / FRAMES_PER_SECOND);
