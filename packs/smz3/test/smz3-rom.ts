// An SMZ3 seed in play, written into a memory image as its ROM and the combo
// ROM's game hold it, for the specs and browser tests of SMZ3 autotracking:
// the seed block, the title, the requirements, the game byte, and each
// game's save where the running game keeps it (memory.ts): the running
// game's in WRAM, the other's in SRAM and the buffers. FX Pak Pro space, as
// the bridges serve it.

import {
  MEMORY_RANGE,
  type MemoryRangeId,
  type Smz3Mode,
  ZELDA_SAVE_SIZE,
} from "../src/autotrack/memory";
import { MEDALLIONS, type Medallion } from "../src/medallions";

/** Where an A-bus address of a range lies in a memory image. */
const at = (id: MemoryRangeId, bus: number) =>
  MEMORY_RANGE[id].address + (bus - MEMORY_RANGE[id].bus);

const word = (memory: Uint8Array, address: number, value: number) => {
  memory[address] = value & 0xff;
  memory[address + 1] = (value >> 8) & 0xff;
};

const long = (memory: Uint8Array, address: number, value: number) => {
  word(memory, address, value & 0xffff);
  word(memory, address + 2, Math.floor(value / 0x1_0000));
};

/** Super Metroid's save offsets the tracker reads, $00-$CF. */
const SM_SAVE_SIZE = 0xd0;

/** The guid of the owner's SMZ3 ROM, a real one (spoiler fixtures' seed). */
export const SAMPLE_GUID = "8506bbef2c2b4432af378b571c6c9133";

/** A seed in play; anything left out is a fresh game's. */
export type Smz3Game = {
  /** Which game runs. */
  readonly mode?: Smz3Mode;
  /** The running game is in play (its mode or state), not on a title screen. */
  readonly inPlay?: boolean;
  /** The running game's mode ($7E:0010) or state ($7E:0998), over `inPlay`. */
  readonly state?: number;
  readonly race?: boolean;
  readonly keysanity?: boolean;
  readonly smLogic?: "normal" | "hard";
  readonly seed?: number;
  /** The seed's guid, 32 hex digits ($80:FF60). */
  readonly guid?: string;
  readonly towerCrystals?: number;
  readonly ganonCrystals?: number;
  readonly tourianBosses?: number;
  readonly mire?: Medallion;
  readonly turtleRock?: Medallion;
  /** Zelda's save data, by offset from $7E:F000. */
  readonly zelda?: Readonly<Record<number, number>>;
  /** Super Metroid's save, by offset: $7E:09A2+n below $60, $7E:D7C0+n on. */
  readonly sm?: Readonly<Record<number, number>>;
  /**
   * The games' frame counters: each game's own, live where its game runs and
   * saved where the other does (memory.ts). Left out, 0 and 0.
   */
  readonly clock?: { readonly sm: number; readonly zelda: number };
};

/** The game byte's value per mode (common.asm:53-76; credits.asm:62-64). */
const GAME_BYTE: Readonly<Record<Smz3Mode, number>> = {
  credits: 0x0011,
  sm: 0xffff,
  zelda: 0x0000,
};

/**
 * Write an SMZ3 seed in play into a memory image.
 * @param memory - A 16 MiB FX Pak Pro image
 */
export const writeSmz3 = (
  memory: Uint8Array,
  {
    mode = "zelda",
    inPlay = true,
    state,
    race = false,
    keysanity = false,
    smLogic = "normal",
    seed = 0x1234_abcd,
    guid = SAMPLE_GUID,
    towerCrystals = 7,
    ganonCrystals = 7,
    tourianBosses = 4,
    mire = "ether",
    turtleRock = "quake",
    zelda = {},
    sm = {},
    clock = { sm: 0, zelda: 0 },
  }: Smz3Game = {},
): Uint8Array => {
  // The seed block: config words, version 11.3 in the low byte
  // (Patch.cs:590-612), and the title (Patch.cs:625-639)
  const block = at("seed", 0x80_ff50);
  word(memory, block, 1);
  word(
    memory,
    block + 2,
    (race ? 0x8000 : 0) |
      (keysanity ? 0x2000 : 0) |
      ((smLogic === "hard" ? 1 : 0) << 8) |
      0xb3,
  );
  word(memory, block + 4, race ? 0 : seed & 0xffff);
  word(memory, block + 6, race ? 0 : seed >>> 16);
  const title = `ZSM11.3.2C${smLogic === "hard" ? "H" : "N"}${seed
    .toString(16)
    .toUpperCase()
    .padStart(8, "0")}`;
  memory.set(
    [...title.padEnd(21)].map((c) => c.charCodeAt(0)),
    at("rom-header", 0x80_ffc0),
  );
  // The seed's guid, in ASCII (Patch.cs:590-612)
  memory.set(
    [...guid].map((c) => c.charCodeAt(0)),
    at("seed-guid", 0x80_ff60),
  );
  // The requirements (Patch.cs:129-152, 809-815)
  memory[at("requirements", 0x40_0022)] = MEDALLIONS.indexOf(mire);
  memory[at("requirements", 0x40_0023)] = MEDALLIONS.indexOf(turtleRock);
  memory[at("requirements", 0x40_005e)] = towerCrystals;
  memory[at("requirements", 0x40_005f)] = ganonCrystals;
  // Ganon's vulnerability for the goal "defeat both", and the save-and-quit
  // flag (Patch.cs:798-807, 831-834)
  memory[at("requirements", 0x40_003e)] = 0x03;
  memory[at("requirements", 0x40_0042)] = 0x01;
  word(memory, at("tourian", 0xf4_7200), tourianBosses);
  word(memory, at("current-game", 0xa1_73fe), GAME_BYTE[mode]);

  const zeldaSave = new Uint8Array(ZELDA_SAVE_SIZE);
  for (const [offset, value] of Object.entries(zelda)) {
    zeldaSave[Number(offset)] = value;
  }
  const smSave = new Uint8Array(SM_SAVE_SIZE);
  // Energy starts at 99 (sm/tables.asm, starting_equipment)
  smSave[0x22] = 99;
  for (const [offset, value] of Object.entries(sm)) {
    smSave[Number(offset)] = value;
  }

  if (mode === "zelda") {
    memory[at("zelda-mode", 0x7e_0010)] = state ?? (inPlay ? 0x09 : 0x01);
    memory.set(zeldaSave, at("zelda-wram", 0x7e_f000));
    memory.set(smSave.subarray(0, 0x80), at("sm-buffer", 0xa1_7900));
    memory.set(smSave.subarray(0xb0, 0xd0), at("sm-sram-items", 0xa1_60c0));
  } else if (mode === "sm") {
    word(memory, at("sm-state", 0x7e_0998), state ?? (inPlay ? 0x08 : 0x01));
    memory.set(smSave.subarray(0, 0x60), at("sm-equipment", 0x7e_09a2));
    memory.set(smSave.subarray(0x70, 0xd0), at("sm-events", 0x7e_d830));
    memory.set(zeldaSave, at("zelda-sram", 0xa0_6000));
    memory.set(zeldaSave.subarray(0x300, 0x400), at("zelda-buffer", 0xa1_7b00));
    memory.set(
      zeldaSave.subarray(0x4e0, 0x4f0),
      at("zelda-keys-buffer", 0xa1_7f50),
    );
  }
  // The frame counters, each in the home its game's mode gives it
  const where = {
    credits: ["clock-sm-saved", "clock-zelda-saved"],
    sm: ["clock-sm-live", "clock-zelda-saved"],
    zelda: ["clock-sm-saved", "clock-zelda-live"],
  } as const;
  const [smId, zeldaId] = where[mode];
  long(memory, MEMORY_RANGE[smId].address, clock.sm);
  long(memory, MEMORY_RANGE[zeldaId].address, clock.zelda);
  return memory;
};

/**
 * A memory image's ranges as a session's snapshot shows them: each range
 * read, and the mode given.
 * @param memory - The image
 * @param mode - The mode the probe said
 * @param unread - Ranges the session did not read (Race Mode's)
 */
export const viewOf = (
  memory: Uint8Array,
  mode: Smz3Mode | null,
  unread: readonly MemoryRangeId[] = [],
) => ({
  bytes: (id: string) => {
    const range = MEMORY_RANGE[id as MemoryRangeId];
    return memory.subarray(range.address, range.address + range.size);
  },
  has: (id: string) =>
    id in MEMORY_RANGE && !unread.includes(id as MemoryRangeId),
  mode,
});
