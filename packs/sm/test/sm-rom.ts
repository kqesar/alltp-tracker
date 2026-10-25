// A Map Rando seed in play, written into a memory image as its ROM and the
// game hold it, for the specs and browser tests of Super Metroid
// autotracking: the header, bank $DF's seed data, the objective table, the
// item sizes, and the game's state, equipment and events, in the FX Pak Pro
// space the bridges serve (ROM from $00_0000, LoROM; SRAM from $E0_0000; WRAM
// from $F5_0000).

import { MEMORY_RANGE, type MemoryRangeId } from "../src/autotrack/memory";
import { MAP_RANDO_TITLE } from "../src/autotrack/probes";
import { OBJECTIVES } from "../src/objectives";
import { SETTING_FLAGS } from "../src/settings";

/** Where an A-bus address of a range lies in a memory image. */
const at = (id: MemoryRangeId, bus: number) =>
  MEMORY_RANGE[id].address + (bus - MEMORY_RANGE[id].bus);

const word = (memory: Uint8Array, address: number, value: number) => {
  memory[address] = value & 0xff;
  memory[address + 1] = (value >> 8) & 0xff;
};

/** A seed in play, by what it holds; anything left out is the game's start. */
export type MapRandoGame = {
  /** The seed's name in bank $DF. */
  readonly name?: string;
  /** The seed's settings flags in bank $DF: the Wall Jump Boots, the split Speed Booster. */
  readonly wallJump?: boolean;
  readonly splitSpeed?: boolean;
  /** Item bits collected ($09A4) and beam bits ($09A8). */
  readonly items?: number;
  readonly beams?: number;
  /** Maximum energy ($09C4), 99 to start. */
  readonly maxEnergy?: number;
  readonly maxReserve?: number;
  readonly maxMissiles?: number;
  readonly maxSupers?: number;
  readonly maxPowerBombs?: number;
  /** Energy tanks disabled from the pause menu ($09EC). */
  readonly disabledTanks?: number;
  /** Each pack's and tank's size, the game's by default. */
  readonly sizes?: Partial<
    Record<"energy" | "missile" | "super" | "powerBomb" | "reserve", number>
  >;
  /** The seed's objectives by id, in order, and those done. */
  readonly objectives?: readonly string[];
  readonly done?: readonly string[];
  /** The game state ($0998): $08 in play. */
  readonly state?: number;
  /** The escape event ($D821 bit 6), set once Mother Brain is dead. */
  readonly escaping?: boolean;
  /**
   * Map Rando's RTA clock: the frames flushed to SRAM ($70:1E10) and the NMI
   * counter ($7E:1F80), 0 to 254. Left out, 0 and 0.
   */
  readonly clock?: { readonly saved: number; readonly pending: number };
};

/**
 * Write a Map Rando seed in play into a memory image.
 * @param memory - A 16 MiB FX Pak Pro image
 */
export const writeMapRando = (
  memory: Uint8Array,
  {
    name = "abcDEF123",
    wallJump = false,
    splitSpeed = false,
    items = 0,
    beams = 0,
    maxEnergy = 99,
    maxReserve = 0,
    maxMissiles = 0,
    maxSupers = 0,
    maxPowerBombs = 0,
    disabledTanks = 0,
    sizes = {},
    objectives = ["kraid", "phantoon", "draygon", "ridley"],
    done = [],
    state = 0x08,
    escaping = false,
    clock = { pending: 0, saved: 0 },
  }: MapRandoGame = {},
): Uint8Array => {
  // The header's title (patch.rs:2111-2112)
  memory.set(
    [...MAP_RANDO_TITLE].map((c) => c.charCodeAt(0)),
    at("rom-header", 0x00_ffc0),
  );
  // The seed's name, null-terminated (Bank DF.txt)
  const seed = at("seed", 0xdf_fef0);
  memory.fill(0, seed, seed + 16);
  memory.set(
    [...name].map((c) => c.charCodeAt(0)),
    seed,
  );
  word(
    memory,
    at("seed", 0xdf_ff05),
    (wallJump ? SETTING_FLAGS.wallJump : 0) |
      (splitSpeed ? SETTING_FLAGS.splitSpeed : 0),
  );
  // The item sizes, the game's 100, 5, 5, 5 and 100 unless set
  word(memory, at("pack-sizes", 0x84_e0b8), sizes.energy ?? 100);
  word(memory, at("pack-sizes", 0x84_e0dd), sizes.missile ?? 5);
  word(memory, at("pack-sizes", 0x84_e102), sizes.super ?? 5);
  word(memory, at("pack-sizes", 0x84_e127), sizes.powerBomb ?? 5);
  word(memory, at("reserve-size", 0x84_e444), sizes.reserve ?? 100);
  // The objective table (patch.rs:3574-3584, 3683-3684)
  word(memory, at("objective-count", 0x82_fffc), objectives.length);
  objectives.forEach((id, i) => {
    const objective = OBJECTIVES.find((o) => o.id === id);
    if (objective === undefined) throw new RangeError(`No objective "${id}"`);
    const { address, mask } = objective.flag;
    word(memory, at("objective-flags", 0x8f_ebc0 + 2 * i), address & 0xffff);
    word(memory, at("objective-flags", 0x8f_ebe8 + 2 * i), mask);
  });
  // The game: its state, equipment and events (new_game.asm:85-134)
  word(memory, at("game-state", 0x7e_0998), state);
  word(memory, at("equipment", 0x7e_09a2), items);
  word(memory, at("equipment", 0x7e_09a4), items);
  word(memory, at("equipment", 0x7e_09a6), beams);
  word(memory, at("equipment", 0x7e_09a8), beams);
  word(memory, at("equipment", 0x7e_09c4), maxEnergy);
  word(memory, at("equipment", 0x7e_09c8), maxMissiles);
  word(memory, at("equipment", 0x7e_09cc), maxSupers);
  word(memory, at("equipment", 0x7e_09d0), maxPowerBombs);
  word(memory, at("equipment", 0x7e_09d4), maxReserve);
  word(memory, at("equipment", 0x7e_09ec), disabledTanks);
  for (const id of done) {
    const objective = OBJECTIVES.find((o) => o.id === id);
    if (objective === undefined) throw new RangeError(`No objective "${id}"`);
    memory[at("events", objective.flag.address)] |= objective.flag.mask & 0xff;
    memory[at("events", objective.flag.address) + 1] |=
      objective.flag.mask >> 8;
  }
  if (escaping) memory[at("events", 0x7e_d821)] |= 0x40;
  // The RTA clock (stats.asm; constants.asm)
  word(memory, at("rta-saved", 0x70_1e10), clock.saved & 0xffff);
  word(memory, at("rta-saved", 0x70_1e12), Math.floor(clock.saved / 0x1_0000));
  memory[at("rta-pending", 0x7e_1f80)] = clock.pending;
  return memory;
};

/** A view of a memory image that serves each range of the map. */
export const viewOf = (
  memory: Uint8Array,
  unread: readonly MemoryRangeId[] = [],
) => ({
  bytes: (id: string) => {
    const { address, size } = MEMORY_RANGE[id as MemoryRangeId];
    return memory.subarray(address, address + size);
  },
  has: (id: string) => !unread.includes(id as MemoryRangeId),
});
