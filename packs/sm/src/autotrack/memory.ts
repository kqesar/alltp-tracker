// The Map Rando memory map for autotracking: every range the tracker reads, in
// the address space @alltp/autotrack takes (FX Pak Pro space), with its
// cadence, category and source. Ranges are listed in address order, so the
// planner can coalesce neighbours.
//
// Nothing here comes from memory. The sources are Map Rando's own, at the
// commit upstream.json pins (blkerby/MapRandomizer):
// - patches/src/new_game.asm, which loads a new game's items into RAM, for
//   the equipment and event addresses;
// - rust/maprando/src/patch.rs, for what the patcher writes into the ROM
//   (the seed's identifiers, settings, objectives and item sizes);
// - patches/rom_map/Bank DF.txt, the map of bank $DF it keeps for autotrackers;
// - patches/src/fast_reload.asm and stats.asm, for the game states.

import { bus, type RangeSpec } from "@alltp/autotrack";

/** One range of the map. */
export interface SmRange extends RangeSpec {
  /** The SNES A-bus address (LoROM), as the sources write it. */
  readonly bus: number;
  readonly source: string;
}

/** How often the game state is read: in play or not, the first news. */
export const STATE_MS = 500;
/** Items and objectives. */
export const ITEMS_MS = 1000;
/**
 * ROM does not change while a seed runs: read once, and slowly after, to
 * notice another ROM loaded without reconnecting.
 */
export const ROM_MS = 10_000;

const range = <const Id extends string>(spec: {
  id: Id;
  at: number;
  size: number;
  category: string;
  everyMs?: number;
  source: string;
}): SmRange & { readonly id: Id } => {
  const { at, ...rest } = spec;
  return { ...rest, address: bus(at), bus: at };
};

/** Every range, in address order. */
export const MEMORY_RANGES = [
  // The header: Map Rando names the cartridge "SUPERMETROID MAPRANDO"
  // (patch.rs:2111-2112, at ROM 0x7FC0, A-bus $00:FFC0).
  range({
    at: 0x00_ffc0,
    category: "rom-header",
    id: "rom-header",
    size: 0x20,
    source: "patch.rs:2111-2112",
  }),
  // How many objectives the seed has, its high bit the fast pause menu
  // (patch.rs:3574-3584).
  range({
    at: 0x82_fffc,
    category: "objectives",
    everyMs: ROM_MS,
    id: "objective-count",
    size: 2,
    source: "patch.rs:3574-3584",
  }),
  // What each item pack and tank gives: the arguments of their PLMs, which
  // the patcher rewrites for a seed of other sizes (patch.rs:794-838). The
  // energy tank's at $84:E0B8, then the missile's ($E0DD), the super's
  // ($E102) and the power bomb's ($E127).
  range({
    at: 0x84_e0b8,
    category: "items",
    everyMs: ROM_MS,
    id: "pack-sizes",
    size: 0x71,
    source: "patch.rs:794-829",
  }),
  // The reserve tank's (patch.rs:831-838).
  range({
    at: 0x84_e444,
    category: "items",
    everyMs: ROM_MS,
    id: "reserve-size",
    size: 2,
    source: "patch.rs:831-838",
  }),
  // The objectives' flags: up to 20 event addresses, then their masks
  // (patch.rs:3683-3684, 20 words each).
  range({
    at: 0x8f_ebc0,
    category: "objectives",
    everyMs: ROM_MS,
    id: "objective-flags",
    size: 0x50,
    source: "patch.rs:3683-3684",
  }),
  // Bank $DF's autotracker data: the seed's name, its display hash, the
  // items its settings add, and its presets (Bank DF.txt; patch.rs:783,
  // 2038-2124).
  range({
    at: 0xdf_fef0,
    category: "seed",
    everyMs: ROM_MS,
    id: "seed",
    size: 0x1e,
    source: "Bank DF.txt",
  }),
  // The game state: $06 loading a game, $07 and $08 in play, $13 dying, $1F
  // before a game loads, $27 the credits (fast_reload.asm:46-47, 134-136,
  // 166-167, 316-318; stats.asm:108-109).
  range({
    at: 0x7e_0998,
    category: "game-state",
    everyMs: STATE_MS,
    id: "game-state",
    size: 2,
    source: "fast_reload.asm:134-136",
  }),
  // Items equipped and collected ($09A2, $09A4), beams ($09A6, $09A8),
  // energy and its maximum ($09C2, $09C4), missiles, supers and power bombs
  // and theirs ($09C6-$09D0), the reserves' maximum and energy ($09D4,
  // $09D6) (new_game.asm:85-120), and the energy tanks the player disabled
  // ($09EC, constants.asm; disableable_etanks.asm:564-569).
  range({
    at: 0x7e_09a2,
    category: "items",
    everyMs: ITEMS_MS,
    id: "equipment",
    size: 0x4c,
    source: "new_game.asm:85-120",
  }),
  // Event flags ($D821-$D823) and boss flags by area ($D828-$D82F), where
  // every objective's flag lies (new_game.asm:93-98, 134; patch.rs:
  // 3596-3681).
  range({
    at: 0x7e_d820,
    category: "objectives",
    everyMs: ITEMS_MS,
    id: "events",
    size: 0x10,
    source: "patch.rs:3596-3681",
  }),
] as const;

export type MemoryRangeId = (typeof MEMORY_RANGES)[number]["id"];

/** Ranges by id. */
export const MEMORY_RANGE = Object.fromEntries(
  MEMORY_RANGES.map((spec) => [spec.id, spec]),
) as Readonly<Record<MemoryRangeId, SmRange>>;
