// Decoders: from the bytes of the memory map's ranges to what the pack knows:
// which game runs and whether it is in play, the items held in both games,
// the locations checked, the seed's settings and, outside races, its
// requirements. Pure and total: any bytes decode, none throw. What memory
// cannot tell yet, it says so.
//
// Each game's save is decoded from one view, whichever game runs: Zelda's
// 0x500 bytes from WRAM, or from SRAM with the buffers its items found in
// Super Metroid go to laid over; Super Metroid's save offsets from WRAM, or
// from its buffer and SRAM save (memory.ts).

import { ITEMS, KEYCARDS } from "../items";
import { MEDALLIONS, type Medallion } from "../medallions";
import { SM_ITEM_BITS, ZELDA_FLAGS } from "./flags";
import { MEMORY_RANGE, type MemoryRangeId, type Smz3Mode } from "./memory";

/** What the decoders read: a range's bytes once read, and the mode. */
export interface MemoryView {
  has(id: string): boolean;
  bytes(id: string): Uint8Array;
  readonly mode: string | null;
}

/**
 * Why a value is not known: not read (yet, or in this mode), a race forbids
 * it, or the bridge does not serve that part of the ROM.
 */
export type Unsettled = "not-read" | "race-mode" | "unreadable";

/** A range's bytes, or undefined when not read in full. */
const bytesOf = (memory: MemoryView, id: MemoryRangeId) => {
  if (!memory.has(id)) return undefined;
  const bytes = memory.bytes(id);
  return bytes.length < MEMORY_RANGE[id].size ? undefined : bytes;
};

/** A save, by offset: its bytes and little-endian words. */
interface Save {
  byte(offset: number): number;
  word(offset: number): number;
}

const saveOf = (byte: (offset: number) => number): Save => ({
  byte,
  word: (offset) => byte(offset) | (byte(offset + 1) << 8),
});

/** Zelda's save offsets the buffers hold while Super Metroid runs. */
const ZELDA_BUFFER = 0x300;
const ZELDA_KEYS_BUFFER = 0x4e0;

/**
 * A save that was never written: Zelda's equipment all $FF, Super Metroid's
 * items collected $FFFF, which no game holds (its unused bits set). Blank
 * SRAM reads so before a new file is made.
 */
const blankZelda = (save: Save) => {
  for (let offset = 0x340; offset < 0x380; offset++) {
    if (save.byte(offset) !== 0xff) return false;
  }
  return true;
};
const blankSm = (save: Save) => save.word(0x02) === 0xffff;

/** Zelda's save data, $7E:F000 on, from wherever the running game keeps it. */
function zeldaSave(memory: MemoryView): Save | Unsettled {
  const save = homeOfZelda(memory);
  return typeof save === "string" || !blankZelda(save) ? save : "not-read";
}

function homeOfZelda(memory: MemoryView): Save | Unsettled {
  if (memory.mode === "zelda") {
    const wram = bytesOf(memory, "zelda-wram");
    return wram ? saveOf((offset) => wram[offset] ?? 0) : "not-read";
  }
  if (memory.mode !== "sm") return "not-read";
  const sram = bytesOf(memory, "zelda-sram");
  const buffer = bytesOf(memory, "zelda-buffer");
  const keys = bytesOf(memory, "zelda-keys-buffer");
  if (!sram || !buffer || !keys) return "not-read";
  return saveOf((offset) => {
    if (offset >= ZELDA_BUFFER && offset < ZELDA_BUFFER + buffer.length) {
      return buffer[offset - ZELDA_BUFFER] ?? 0;
    }
    if (
      offset >= ZELDA_KEYS_BUFFER &&
      offset < ZELDA_KEYS_BUFFER + keys.length
    ) {
      return keys[offset - ZELDA_KEYS_BUFFER] ?? 0;
    }
    return sram[offset] ?? 0;
  });
}

/** Super Metroid's save offsets that WRAM's events hold from $7E:D830. */
const SM_EVENTS = 0x70;
/** Its items collected, a bit per location (flags.ts). */
const SM_COLLECTED = 0xb0;

/** Super Metroid's save, offsets $00-$CF, from wherever the running game keeps it. */
function smSave(memory: MemoryView): Save | Unsettled {
  const save = homeOfSm(memory);
  return typeof save === "string" || !blankSm(save) ? save : "not-read";
}

function homeOfSm(memory: MemoryView): Save | Unsettled {
  if (memory.mode === "sm") {
    const equipment = bytesOf(memory, "sm-equipment");
    const events = bytesOf(memory, "sm-events");
    if (!equipment || !events) return "not-read";
    return saveOf((offset) =>
      offset < equipment.length
        ? (equipment[offset] ?? 0)
        : (events[offset - SM_EVENTS] ?? 0),
    );
  }
  if (memory.mode !== "zelda") return "not-read";
  const buffer = bytesOf(memory, "sm-buffer");
  const collected = bytesOf(memory, "sm-sram-items");
  if (!buffer || !collected) return "not-read";
  return saveOf((offset) =>
    offset < buffer.length
      ? (buffer[offset] ?? 0)
      : (collected[offset - SM_COLLECTED] ?? 0),
  );
}

/** Which game runs, as the session's mode probe read it. */
export function decodeMode(memory: MemoryView): Smz3Mode | Unsettled {
  const mode = memory.mode;
  return mode === "zelda" || mode === "sm" || mode === "credits"
    ? mode
    : "not-read";
}

/** Zelda's game modes in play: dungeon, overworld, special overworld (z3 ram.asm:41). */
const ZELDA_PLAYING = [0x07, 0x09, 0x0b];
/** Super Metroid's game states in play (packs/sm, fast_reload.asm:134-136). */
const SM_PLAYING = [0x07, 0x08];

/**
 * Whether the running game is in play: what the saves hold is the run's,
 * not a title screen's. Never in the credits.
 */
export function decodeInPlay(memory: MemoryView): boolean | Unsettled {
  const mode = decodeMode(memory);
  if (mode === "credits") return false;
  if (mode === "zelda") {
    const state = bytesOf(memory, "zelda-mode");
    return state ? ZELDA_PLAYING.includes(state[0] ?? 0) : "not-read";
  }
  if (mode === "sm") {
    const state = bytesOf(memory, "sm-state");
    if (!state) return "not-read";
    return SM_PLAYING.includes((state[0] ?? 0) | ((state[1] ?? 0) << 8));
  }
  return mode;
}

/**
 * Zelda's game modes ($7E:0010, z3 ram.asm:41) before play: the title ($00),
 * the file select and its copy, erase and name screens ($01-$04), the game
 * loading ($05) and the randomizer's spawn select ($1B). The list is the
 * ALttPR pack's `GAME_MODES.beforePlay` (packs/alttpr/src/autotrack/memory.ts,
 * read against ram.asm:41 and seen on a real game on 2026-10-17), kept here as
 * data since packs import nothing of each other. $06 (pre-dungeon) is no
 * before-play mode: every dungeon entry passes it.
 */
const ZELDA_BEFORE_PLAY: readonly number[] = [
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x1b,
];
/** Super Metroid's game states before play: the title and menus, loading a game ($06), and $1F, where a new game is set up. */
const SM_BEFORE_PLAY = (state: number) => state <= 0x06 || state === 0x1f;

/**
 * Whether the running game is before play: its title, its menus, its file
 * select or the loading of a game. A reading in play after one that was is a
 * game starting, in whichever game the file starts in; after a pause, a door,
 * a portal or a death it is not. Never in the credits.
 */
export function decodeBeforePlay(memory: MemoryView): boolean | Unsettled {
  const mode = decodeMode(memory);
  if (mode === "credits") return false;
  if (mode === "zelda") {
    const state = bytesOf(memory, "zelda-mode");
    return state ? ZELDA_BEFORE_PLAY.includes(state[0] ?? 0) : "not-read";
  }
  if (mode === "sm") {
    const state = bytesOf(memory, "sm-state");
    if (!state) return "not-read";
    return SM_BEFORE_PLAY((state[0] ?? 0) | ((state[1] ?? 0) << 8));
  }
  return mode;
}

/** The game byte's value once the credits run (credits.asm:62-64). */
const CREDITS_BYTE = 0x11;

/**
 * Whether the run reached its goal: the credits run. The game byte's low
 * byte is exactly $11, which `credits_init` alone writes, and only once both
 * games' endings were reached (sm/ending.asm:22-30, 84-95; z3/ending.asm:
 * 12-33, 43-56): so no completion flag is read besides. Read in a race too.
 */
export function decodeGoal(memory: MemoryView): boolean | Unsettled {
  const game = bytesOf(memory, "current-game");
  return game ? (game[0] ?? 0) === CREDITS_BYTE : "not-read";
}

/**
 * The games' frame counters at one reading, summed: the frames since the
 * file began, as the credits' TOTAL TIME counts them. Each game counts its
 * own NMIs while it runs, and keeps what it counted in its save (written
 * before every portal), so the sum is the live counter of the running game
 * plus the saved one of the other. Both revert to the last save on a death
 * or a reload, so the sum falls back with them: it is the game's, not
 * monotonic.
 */
export interface ClockReading {
  /** Both games' frames. */
  readonly frames: number;
  /** The credits run: neither game does, both counters are saved, the sum is final. */
  readonly final: boolean;
}

const u32 = (bytes: Uint8Array) =>
  ((bytes[0] ?? 0) |
    ((bytes[1] ?? 0) << 8) |
    ((bytes[2] ?? 0) << 16) |
    ((bytes[3] ?? 0) << 24)) >>>
  0;

/**
 * The game time, or why it is not known: never in a race (the ranges are
 * not read: race-profile.ts), nor before the mode's two halves were read.
 * @param race - Race Mode is on: the counters stay undecoded
 */
export function decodeGameClock(
  memory: MemoryView,
  race: boolean,
): ClockReading | Unsettled {
  if (race) return "race-mode";
  const mode = decodeMode(memory);
  if (mode !== "zelda" && mode !== "sm" && mode !== "credits") return mode;
  const [smId, zeldaId] =
    mode === "zelda"
      ? (["clock-sm-saved", "clock-zelda-live"] as const)
      : mode === "sm"
        ? (["clock-sm-live", "clock-zelda-saved"] as const)
        : (["clock-sm-saved", "clock-zelda-saved"] as const);
  const sm = bytesOf(memory, smId);
  const zelda = bytesOf(memory, zeldaId);
  if (!sm || !zelda) return "not-read";
  return { final: mode === "credits", frames: u32(sm) + u32(zelda) };
}

/**
 * The credits count a frame as a sixtieth of a second (credits.asm:719,
 * `draw_full_time`), not at the SNES's 60.0988: the timer ends at the time
 * the game prints.
 */
export const SMZ3_FRAMES_PER_SECOND = 60;

/** How long `frames` of the clock last, in milliseconds. */
export const smz3Ms = (frames: number): number =>
  Math.round((frames * 1000) / SMZ3_FRAMES_PER_SECOND);

const bit = (value: number, mask: number) => ((value & mask) === 0 ? 0 : 1);
const bits = (value: number) => {
  let count = 0;
  for (let rest = value; rest !== 0; rest &= rest - 1) count++;
  return count;
};
/** A level kept as a value from 1 to `max`; anything else is none. */
const level = (value: number, max: number) =>
  value >= 1 && value <= max ? value : 0;

/** Each dungeon's byte in the keys found from $4E0 (z3 sram.asm:358-372). */
const KEYS_FOUND = {
  keyCT: 4,
  keyDP: 3,
  keyGT: 13,
  keyIP: 9,
  keyMM: 7,
  keyPD: 6,
  keySP: 5,
  keySW: 8,
  keyTH: 10,
  keyTR: 12,
  keyTT: 11,
} as const;

/** Each dungeon's bit in BigKeyField, $366 (z3 sram.asm:120-127). */
const BIG_KEY_BITS = {
  bigKeyDP: 0x1000,
  bigKeyEP: 0x2000,
  bigKeyGT: 0x0004,
  bigKeyIP: 0x0040,
  bigKeyMM: 0x0100,
  bigKeyPD: 0x0200,
  bigKeySP: 0x0400,
  bigKeySW: 0x0080,
  bigKeyTH: 0x0020,
  bigKeyTR: 0x0008,
  bigKeyTT: 0x0010,
} as const;

/** Held when its byte in the equipment, from $340, is not zero (z3 sram.asm:82-110). */
const EQUIPMENT = {
  bombos: 0x347,
  book: 0x34e,
  boots: 0x355,
  byrna: 0x351,
  cape: 0x352,
  ether: 0x348,
  firerod: 0x345,
  flippers: 0x356,
  hammer: 0x34b,
  hookshot: 0x342,
  icerod: 0x346,
  lamp: 0x34a,
  moonPearl: 0x357,
  quake: 0x349,
  somaria: 0x350,
} as const;

/** InventoryTracking, $38C: m and n the mushroom, p the powder, s the shovel, k and f the flute (z3 sram.asm:175-179). */
const INVENTORY_TRACKING = 0x38c;
const TRACKED = { flute: 0x03, mushroom: 0x28, powder: 0x10, shovel: 0x04 };

/** Zelda's items, from its save. */
function zeldaItems(save: Save): Record<string, number> {
  const counts: Record<string, number> = {
    // Slots not $00 (z3 sram.asm:111-115)
    bottle: [0, 1, 2, 3].filter((slot) => save.byte(0x35c + slot) !== 0).length,
    // The b bit of BowTracking, $38E, or a bow equipped (z3 sram.asm:82-83, 180)
    bow: save.byte(0x340) !== 0 || bit(save.byte(0x38e), 0x80) ? 1 : 0,
    glove: level(save.byte(0x354), 2),
    // MagicConsumption $01 is half magic (z3 sram.asm:151)
    halfMagic: save.byte(0x37b) >= 1 ? 1 : 0,
    // Hyrule Castle's keys and the sewers' rise together (sm/items.asm:1158)
    keyHC: Math.max(save.byte(0x4e0), save.byte(0x4e1)),
    // $02 is the mirror; $01, the scroll, a picture only (z3 sram.asm:102)
    mirror: save.byte(0x353) >= 2 ? 1 : 0,
    shield: level(save.byte(0x35a), 3),
    sword: level(save.byte(0x359), 4),
  };
  for (const [id, offset] of Object.entries(EQUIPMENT)) {
    counts[id] = save.byte(offset) === 0 ? 0 : 1;
  }
  const tracking = save.byte(INVENTORY_TRACKING);
  for (const [id, mask] of Object.entries(TRACKED)) {
    counts[id] = bit(tracking, mask);
  }
  for (const [id, index] of Object.entries(KEYS_FOUND)) {
    counts[id] = save.byte(0x4e0 + index);
  }
  const bigKeys = save.word(0x366);
  for (const [id, mask] of Object.entries(BIG_KEY_BITS)) {
    counts[id] = bit(bigKeys, mask);
  }
  // A reward's bit, as Patch.cs writes them (CrystalValues, PendantValues,
  // Patch.cs:208-228): the green pendant $04; crystals 5 and 6, the red
  // ones, $04 and $01 (z3 sram.asm:139-148; sm/rewards.asm:60-70)
  const pendants = save.byte(0x374);
  const crystals = save.byte(0x37a);
  counts.pendantGreen = bit(pendants, 0x04);
  counts.pendantNonGreen = bits(pendants & 0x03);
  counts.crystalRed = bits(crystals & 0x05);
  counts.crystalBlue = bits(crystals & 0x7a);
  return counts;
}

/** Super Metroid's items collected, save offset $02 (z3/items.asm:120-130). */
const SM_ITEM_FLAGS = {
  bombs: 0x1000,
  grapple: 0x4000,
  gravity: 0x0020,
  hiJump: 0x0100,
  morph: 0x0004,
  screwAttack: 0x0008,
  spaceJump: 0x0200,
  speedBooster: 0x2000,
  springBall: 0x0002,
  varia: 0x0001,
} as const;

/** Its beams collected, save offset $06 (z3/items.asm:132-136). */
const SM_BEAM_FLAGS = {
  charge: 0x1000,
  ice: 0x0002,
  plasma: 0x0008,
  wave: 0x0001,
} as const;

/**
 * Its counted items: each pack's or tank's maximum, save offset, over what
 * one gives (z3/items.asm:139-144). Energy starts at 99.
 */
const SM_COUNTED = {
  eTank: { each: 100, offset: 0x22 },
  missile: { each: 5, offset: 0x26 },
  powerBomb: { each: 5, offset: 0x2e },
  reserveTank: { each: 100, offset: 0x32 },
  super: { each: 5, offset: 0x2a },
} as const;

/** The boss tokens, save offset $72 (z3/items.asm:147-150; sm/rewards.asm:72-78). */
const TOKEN_FLAGS = {
  tokenDraygon: 0x04,
  tokenKraid: 0x01,
  tokenPhantoon: 0x02,
  tokenRidley: 0x08,
} as const;

/** Super Metroid's items, from its save. */
function smItems(save: Save): Record<string, number> {
  const counts: Record<string, number> = {};
  const items = save.word(0x02);
  for (const [id, mask] of Object.entries(SM_ITEM_FLAGS)) {
    counts[id] = bit(items, mask);
  }
  const beams = save.word(0x06);
  for (const [id, mask] of Object.entries(SM_BEAM_FLAGS)) {
    counts[id] = bit(beams, mask);
  }
  for (const [id, { each, offset }] of Object.entries(SM_COUNTED)) {
    counts[id] = Math.floor(save.word(offset) / each);
  }
  // Keycard n is item $D0+n, bit n of save offset $70 (z3/items.asm:159-175;
  // Item.cs:225-255 orders them as KEYCARDS)
  const keycards = save.word(0x70);
  KEYCARDS.forEach((id, n) => {
    counts[id] = bit(keycards, 1 << n);
  });
  const tokens = save.byte(0x72);
  for (const [id, mask] of Object.entries(TOKEN_FLAGS)) {
    counts[id] = bit(tokens, mask);
  }
  return counts;
}

const MAX = new Map(ITEMS.map((item) => [item.id, item.max]));

/**
 * The crystals, whose kind the race rules keep from a tracker: "trackers may
 * not auto-track which crystal is a 5/6-crystal" (ALTTPR Auto-tracker Rules
 * v2.0, which SMZ3's tournaments race under), and the save tells the red ones
 * (5 and 6) from the blue by their bits.
 */
const RACE_HIDDEN_ITEMS: readonly string[] = ["crystalBlue", "crystalRed"];

/**
 * The items held in both games, by the pack's item id, capped at their
 * pools: 1 or 0 for an item held or not, a level or a count for the others.
 * The keys are the keys found (z3 stats.asm:264-276), which no door takes
 * back; the rewards, those found. In Race Mode the crystals are left out
 * (`RACE_HIDDEN_ITEMS`): the board has no cell for a crystal of unknown kind,
 * so they stay the player's to mark.
 */
export function decodeItems(
  memory: MemoryView,
  race = false,
): Readonly<Record<string, number>> | Unsettled {
  const zelda = zeldaSave(memory);
  const sm = smSave(memory);
  if (typeof zelda === "string") return zelda;
  if (typeof sm === "string") return sm;
  const counts = { ...zeldaItems(zelda), ...smItems(sm) };
  for (const [id, count] of Object.entries(counts)) {
    counts[id] = Math.max(0, Math.min(count, MAX.get(id) ?? 0));
  }
  if (race) for (const id of RACE_HIDDEN_ITEMS) delete counts[id];
  return counts;
}

/** The locations checked, by the pack's location id, Zelda's first. */
export function decodeChecks(
  memory: MemoryView,
): readonly string[] | Unsettled {
  const zelda = zeldaSave(memory);
  const sm = smSave(memory);
  if (typeof zelda === "string") return zelda;
  if (typeof sm === "string") return sm;
  const checked: string[] = [];
  for (const { id, mask, offset, size } of ZELDA_FLAGS) {
    const value = size === 2 ? zelda.word(offset) : zelda.byte(offset);
    if ((value & mask) !== 0) checked.push(id);
  }
  for (const [id, n] of SM_ITEM_BITS) {
    if (bit(sm.byte(SM_COLLECTED + (n >> 3)), 1 << (n & 7))) checked.push(id);
  }
  return checked;
}

/** The seed, as its ROM states it. */
export interface SeedReading {
  /** Its title: "ZSM", the version, the logics' letters, the seed. */
  readonly title: string;
  /** A race seed. */
  readonly race: boolean;
  readonly keysanity: boolean;
  /** Super Metroid's logic; null for one the pack does not know. */
  readonly smLogic: "normal" | "hard" | null;
}

/** The seed, from its seed block (Patch.cs:590-612) and title (Patch.cs:625-639). */
export function decodeSeed(memory: MemoryView): SeedReading | Unsettled {
  const seed = bytesOf(memory, "seed");
  const header = bytesOf(memory, "rom-header");
  if (!seed || !header) return "not-read";
  const config = (seed[2] ?? 0) | ((seed[3] ?? 0) << 8);
  const logic = (config >> 8) & 0x03;
  return {
    keysanity: (config & 0x2000) !== 0,
    race: (config & 0x8000) !== 0,
    smLogic: logic === 0 ? "normal" : logic === 1 ? "hard" : null,
    title: String.fromCharCode(...header.subarray(0, 21))
      .replace(/[^\x20-\x7e]/g, "")
      .trim(),
  };
}

/** The seed's guid, as its ROM states it. */
export interface SeedGuidReading {
  /** 32 lowercase hex digits. */
  readonly guid: string;
}

/**
 * The seed's guid, outside races only (race-profile.ts): 32 lowercase hex
 * digits, ASCII, as `Patch.cs:590-612` writes it, the id samus.link names the
 * seed and its spoiler log by. Unreadable when the bytes are not that.
 * @param race - Race Mode is on: the guid stays unread
 */
export function decodeSeedGuid(
  memory: MemoryView,
  race: boolean,
): SeedGuidReading | Unsettled {
  if (race) return "race-mode";
  const bytes = bytesOf(memory, "seed-guid");
  if (!bytes) return "not-read";
  const guid = String.fromCharCode(...bytes.subarray(0, 32));
  return /^[0-9a-f]{32}$/.test(guid) ? { guid } : "unreadable";
}

/** What a seed asks for, which a race may draw at random. */
export interface RequirementsReading {
  /** Crystals Ganon's Tower and Ganon ask for; null past seven. */
  readonly towerCrystals: number | null;
  readonly ganonCrystals: number | null;
  /** Bosses Tourian asks for; null past four. */
  readonly tourianBosses: number | null;
  /** The medallions opening Misery Mire and Turtle Rock. */
  readonly mire: Medallion | null;
  readonly turtleRock: Medallion | null;
}

const upTo = (value: number, max: number) =>
  value >= 0 && value <= max ? value : null;

/**
 * Ganon's vulnerability by the seed's goal (Patch.cs:798-807): defeat both,
 * fast Ganon, all dungeons. With the save-and-quit flag at $40:0042, always
 * $01 (Patch.cs:831-834), two bytes of the requirements' block whose value
 * the seed block foretells: they tell a bridge that serves this part of the
 * ROM (Zelda's half, from $40_0000) from one that serves another in its
 * place, as bsnes-mercury's memory map through RetroArch does (seen on
 * 2026-10-19: plausible bytes, a wrong medallion among them).
 */
const GANON_VULNERABLE = [0x03, 0x04, 0x02];

/**
 * The seed's requirements, outside races only (race-profile.ts): the
 * medallions, $00 Bombos, $01 Ether, $02 Quake (Patch.cs:129-152), the
 * crystals (Patch.cs:813-815) and Tourian's bosses (Patch.cs:809-811);
 * unreadable when the block's foretold bytes are not what the seed says.
 * @param race - Race Mode is on: the requirements stay unread
 */
export function decodeRequirements(
  memory: MemoryView,
  race: boolean,
): RequirementsReading | Unsettled {
  if (race) return "race-mode";
  const requirements = bytesOf(memory, "requirements");
  const tourian = bytesOf(memory, "tourian");
  const seed = bytesOf(memory, "seed");
  if (!requirements || !tourian || !seed) return "not-read";
  const at = (bus: number) =>
    requirements[bus - MEMORY_RANGE.requirements.bus] ?? 0xff;
  const goal = (seed[9] ?? 0) & 0x0f;
  if (at(0x40_003e) !== GANON_VULNERABLE[goal] || at(0x40_0042) !== 0x01) {
    return "unreadable";
  }
  const medallion = (value: number) => MEDALLIONS[value] ?? null;
  return {
    ganonCrystals: upTo(at(0x40_005f), 7),
    mire: medallion(at(0x40_0022)),
    tourianBosses: upTo((tourian[0] ?? 0) | ((tourian[1] ?? 0) << 8), 4),
    towerCrystals: upTo(at(0x40_005e), 7),
    turtleRock: medallion(at(0x40_0023)),
  };
}
