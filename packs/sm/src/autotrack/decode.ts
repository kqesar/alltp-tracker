// Decoders: from the bytes of the memory map's ranges to what the pack knows:
// the items held, the seed's objectives and whether each is done, the seed's
// name and settings, whether a game is in play. Pure and total: any bytes
// decode, none throw. What memory cannot tell yet, it says so.

import { SM_ITEMS, type SmItemId } from "../items";
import { type Objective, objectiveByFlag } from "../objectives";
import {
  MAP_PRESETS,
  OBJECTIVE_PRESETS,
  PROGRESSION_PRESETS,
  presetName,
  QOL_PRESETS,
  SETTING_FLAGS,
  SKILL_PRESETS,
} from "../settings";
import { MEMORY_RANGE, type MemoryRangeId } from "./memory";

/** What the decoders read: a range's bytes, once read. */
export interface MemoryView {
  has(id: string): boolean;
  bytes(id: string): Uint8Array;
}

/** Why a value is not known: its range has not been read (yet, or ever). */
export type Unsettled = "not-read";

/** A range's bytes by A-bus address, or undefined when not read in full. */
const reader = (memory: MemoryView, id: MemoryRangeId) => {
  if (!memory.has(id)) return undefined;
  const bytes = memory.bytes(id);
  const { bus, size } = MEMORY_RANGE[id];
  if (bytes.length < size) return undefined;
  const byte = (at: number) => bytes[at - bus] ?? 0;
  return { byte, word: (at: number) => byte(at) | (byte(at + 1) << 8) };
};

/**
 * The bits of the items collected ($09A4) and the beams collected ($09A8),
 * as the patcher sets a seed's starting items (rust/maprando/src/patch.rs:
 * 2300-2324).
 */
const ITEM_BITS: Readonly<Partial<Record<SmItemId, number>>> = {
  blueBooster: 0x0040,
  bombs: 0x1000,
  grapple: 0x4000,
  gravity: 0x0020,
  hiJump: 0x0100,
  morph: 0x0004,
  screwAttack: 0x0008,
  spaceJump: 0x0200,
  sparkBooster: 0x0080,
  speedBooster: 0x2000,
  springBall: 0x0002,
  varia: 0x0001,
  wallJump: 0x0400,
  xRay: 0x8000,
};
const BEAM_BITS: Readonly<Partial<Record<SmItemId, number>>> = {
  charge: 0x1000,
  ice: 0x0002,
  plasma: 0x0008,
  spazer: 0x0004,
  wave: 0x0001,
};

/** The PLM arguments the patcher writes each pack's size into (patch.rs:794-838). */
const SIZE_AT = {
  energyTank: 0x84_e0b8,
  missile: 0x84_e0dd,
  powerBomb: 0x84_e127,
  reserveTank: 0x84_e444,
  superMissile: 0x84_e102,
} as const;

/** The maximum each counted item raises (new_game.asm:102-120). */
const MAX_AT = {
  energyTank: 0x7e_09c4,
  missile: 0x7e_09c8,
  powerBomb: 0x7e_09d0,
  reserveTank: 0x7e_09d4,
  superMissile: 0x7e_09cc,
} as const;

/** Energy tanks the player disabled from the pause menu (constants.asm). */
const DISABLED_TANKS = 0x7e_09ec;

const MAX = new Map(SM_ITEMS.map((i) => [i.id, i.max]));

/**
 * The items held, by id: 1 or 0 for an item held or not, a count for packs
 * and tanks, capped at the full pool. A count is the maximum it raised over
 * what one gives; energy starts at 99, and an energy tank the player disabled
 * (disableable_etanks.asm:564-569) took 100 off the maximum but is held all
 * the same.
 */
export function decodeItems(
  memory: MemoryView,
): Readonly<Record<SmItemId, number>> | Unsettled {
  const equipment = reader(memory, "equipment");
  const packs = reader(memory, "pack-sizes");
  const reserve = reader(memory, "reserve-size");
  if (!equipment || !packs || !reserve) return "not-read";
  const items = equipment.word(0x7e_09a4);
  const beams = equipment.word(0x7e_09a8);
  const counts = {} as Record<SmItemId, number>;
  for (const { id } of SM_ITEMS) {
    const item = ITEM_BITS[id];
    const beam = BEAM_BITS[id];
    if (item !== undefined) counts[id] = items & item ? 1 : 0;
    else if (beam !== undefined) counts[id] = beams & beam ? 1 : 0;
  }
  const size = (id: keyof typeof SIZE_AT) =>
    id === "reserveTank" ? reserve.word(SIZE_AT[id]) : packs.word(SIZE_AT[id]);
  const counted = (id: keyof typeof MAX_AT, raised: number) => {
    const each = size(id);
    const count = each > 0 ? Math.floor(raised / each) : 0;
    counts[id] = Math.max(0, Math.min(count, MAX.get(id) ?? 0));
  };
  const energy =
    Math.floor(equipment.word(MAX_AT.energyTank) / 100) * 100 +
    equipment.word(DISABLED_TANKS) * 100;
  counted("energyTank", energy);
  counted("reserveTank", equipment.word(MAX_AT.reserveTank));
  counted("missile", equipment.word(MAX_AT.missile));
  counted("superMissile", equipment.word(MAX_AT.superMissile));
  counted("powerBomb", equipment.word(MAX_AT.powerBomb));
  return counts;
}

/** One of the seed's objectives, and whether it is done. */
export interface ObjectiveReading {
  readonly objective: Objective;
  readonly done: boolean;
}

/** The most objectives the ROM's table holds (patch.rs:3683-3684). */
const MAX_OBJECTIVES = 20;

/**
 * The seed's objectives, in the pause screen's order, each done once its
 * flag is set: the count the ROM keeps (its high bit the fast pause menu,
 * patch.rs:3574-3584), then each objective's flag address and mask
 * (patch.rs:3683-3684). A flag the pack does not know is left out.
 */
export function decodeObjectives(
  memory: MemoryView,
): readonly ObjectiveReading[] | Unsettled {
  const count = reader(memory, "objective-count");
  const flags = reader(memory, "objective-flags");
  const events = reader(memory, "events");
  if (!count || !flags || !events) return "not-read";
  const n = Math.min(count.word(0x82_fffc) & 0x7fff, MAX_OBJECTIVES);
  const objectives: ObjectiveReading[] = [];
  for (let i = 0; i < n; i++) {
    const address = flags.word(0x8f_ebc0 + 2 * i);
    const mask = flags.word(0x8f_ebe8 + 2 * i);
    const objective = objectiveByFlag(address, mask);
    if (objective === undefined) continue;
    const word = events.word(objective.flag.address);
    objectives.push({ done: (word & objective.flag.mask) !== 0, objective });
  }
  return objectives;
}

/** The seed's identity and settings, from its ROM. */
export interface SeedReading {
  /** Its name, as maprando.com/seed/<name>/ has it; null when blank. */
  readonly name: string | null;
  /** Each setting's preset ("Custom" when the seed customized it). */
  readonly skill: string | null;
  readonly progression: string | null;
  readonly qol: string | null;
  readonly objectives: string | null;
  readonly map: string | null;
  /** Wall jumps need the Wall Jump Boots. */
  readonly wallJump: boolean;
  /** The Speed Booster comes as the Spark and the Blue Booster. */
  readonly splitSpeed: boolean;
}

/** The seed's name: URL-safe ASCII, null-terminated, at $DF:FEF0. */
const SEED_NAME = /^[A-Za-z0-9_-]{1,15}$/;

/** The seed, from bank $DF (patches/rom_map/Bank DF.txt). */
export function decodeSeed(memory: MemoryView): SeedReading | Unsettled {
  const seed = reader(memory, "seed");
  if (!seed) return "not-read";
  let name = "";
  for (let at = 0xdf_fef0; at < 0xdf_ff00; at++) {
    const code = seed.byte(at);
    if (code === 0) break;
    name += String.fromCharCode(code);
  }
  const flags = seed.word(0xdf_ff05);
  return {
    map: presetName(MAP_PRESETS, seed.byte(0xdf_ff0d)),
    name: SEED_NAME.test(name) ? name : null,
    objectives: presetName(OBJECTIVE_PRESETS, seed.byte(0xdf_ff0c)),
    progression: presetName(PROGRESSION_PRESETS, seed.byte(0xdf_ff0a)),
    qol: presetName(QOL_PRESETS, seed.byte(0xdf_ff0b)),
    skill: presetName(SKILL_PRESETS, seed.byte(0xdf_ff09)),
    splitSpeed: (flags & SETTING_FLAGS.splitSpeed) !== 0,
    wallJump: (flags & SETTING_FLAGS.wallJump) !== 0,
  };
}

/**
 * Whether a game is in play: game state $07 or $08 (fast_reload.asm:134-136),
 * the states where the items held are the run's.
 */
export function decodeInPlay(memory: MemoryView): boolean | Unsettled {
  const state = reader(memory, "game-state");
  if (!state) return "not-read";
  const value = state.word(0x7e_0998);
  return value === 0x07 || value === 0x08;
}

/** The game state ($0998), or why it is not known. */
export function decodeGameState(memory: MemoryView): number | Unsettled {
  const state = reader(memory, "game-state");
  return state ? state.word(0x7e_0998) : "not-read";
}

/**
 * Whether the game is before play: the title, the menus, the file select and
 * the loading of a game (states $00-$06), and $1F, where a new game's data is
 * set up (fast_reload.asm:46-47, 166-167; new_game.asm:195-212). The reading
 * after one that was, and is in play, is a game starting; after a pause, a
 * door or a death it is not.
 */
export function decodeBeforePlay(memory: MemoryView): boolean | Unsettled {
  const state = decodeGameState(memory);
  if (state === "not-read") return state;
  return state <= 0x06 || state === 0x1f;
}

/** Event $0E, the escape set (stats.asm, hook_samus_enter_ship; `$80:81FA`). */
const ESCAPE_EVENT = { address: 0x7e_d821, mask: 0x40 } as const;

/**
 * Whether the run reached its goal: the escape is set (Mother Brain is dead)
 * and Samus is in the ship, the game state $26 (Samus escapes) or $27 (the
 * ending and credits) (`$82:84BD`, `$82:8503`; stats.asm:38-40, 546-567).
 * Both are read in a race too.
 */
export function decodeGoal(memory: MemoryView): boolean | Unsettled {
  const state = decodeGameState(memory);
  const events = reader(memory, "events");
  if (state === "not-read" || !events) return "not-read";
  const escaped = (events.byte(ESCAPE_EVENT.address) & ESCAPE_EVENT.mask) !== 0;
  return escaped && (state === 0x26 || state === 0x27);
}

/**
 * Map Rando's RTA clock at one reading: the frames flushed to SRAM and the
 * frames the NMI counter holds, whose sum is the frames since the clock was
 * zeroed, every NMI counted (lag, menus, file select and credits too).
 */
export interface ClockReading {
  /** `!stat_timer`, $70:1E10. */
  readonly saved: number;
  /** `!nmi_counter`, $7E:1F80, 0 to 254. */
  readonly pending: number;
  readonly frames: number;
}

/**
 * Map Rando's RTA clock (stats.asm; constants.asm: `!stat_timer` $70:1E10,
 * `!nmi_counter` $7E:1F80), or why it is not known: not in Race Mode, which
 * never reads it (race profile), nor before both parts were read. A count
 * since the SRAM was set up, not since a run began: the run takes a baseline.
 */
export function decodeGameClock(memory: MemoryView): ClockReading | Unsettled {
  const saved = reader(memory, "rta-saved");
  const pending = reader(memory, "rta-pending");
  if (!saved || !pending) return "not-read";
  const flushed = saved.word(0x70_1e10) + saved.word(0x70_1e12) * 0x1_0000;
  const held = pending.byte(0x7e_1f80);
  return { frames: flushed + held, pending: held, saved: flushed };
}

/**
 * Whether `now` straddles a flush: the NMI counter flushes into SRAM by
 * adding what it holds and zeroing, and the two parts are read one after the
 * other (SRAM first). A flush between them leaves the SRAM word before the
 * flush and the counter after it, so the sum falls back by up to 254 frames.
 * That reading is told by the SRAM word standing still while the counter went
 * back, which a flush alone causes (a flush also raises the SRAM word). A
 * straddled reading is not a time: hold the last one.
 * @param before - The reading before, if any
 */
export function clockStraddled(
  before: ClockReading | undefined,
  now: ClockReading,
): boolean {
  return (
    before !== undefined &&
    now.saved === before.saved &&
    now.pending < before.pending
  );
}

/**
 * Map Rando's frame rate, as its end credits convert the clock to time:
 * `100 / 60.09881186` hundredths of a second a frame (credits.asm,
 * adjust_time_fps). The SNES's NTSC rate; kept here because packs import
 * nothing of each other (the ALttPR pack derives the same from the master
 * clock).
 */
export const RTA_FRAMES_PER_SECOND = 60.098_811_86;

/** How long `frames` of the clock last, in milliseconds. */
export const rtaMs = (frames: number): number =>
  Math.round((frames * 1000) / RTA_FRAMES_PER_SECOND);

/** How many frames of the clock `ms` milliseconds are: `rtaMs` the other way. */
export const rtaFrames = (ms: number): number =>
  Math.round((ms * RTA_FRAMES_PER_SECOND) / 1000);
