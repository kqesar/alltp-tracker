// The SMZ3 memory map for autotracking: every range the tracker reads, in
// the address space @alltp/autotrack takes (FX Pak Pro space), with its
// cadence, category, the modes it is read in and its source.
//
// One ROM holds both games (ExHiROM). The running game's state is in WRAM;
// the other's is in SRAM, where the combo ROM keeps it while that game runs.
// The sources, read, never run:
// - tewtal/alttp_sm_combo_randomizer_rom at 5f9eaf6 (the submodule
//   tewtal/SMZ3Randomizer d53be76 pins; MIT): src/sram.asm, the SRAM map;
//   src/common.asm, which game the byte at $A1:73FE says runs;
//   src/{z3,sm}/teleport.asm and transition.asm, what moves between WRAM and
//   SRAM at a portal; src/z3/items.asm and src/sm/rewards.asm, where a pickup
//   in the other game goes; src/z3/randomizer/sram.asm, Zelda's save layout;
//   src/sm/randomizer/tracking.asm and src/credits.asm, the two games' frame
//   counters and the sum the credits print;
// - tewtal/SMZ3Randomizer at d53be76 (MIT), Randomizer.SMZ3/Patch.cs: what
//   samus.link writes into the ROM (the seed block, the title, the
//   requirements), and Snes() (Patch.cs:842-851), its SNES addresses.

import { bus, type RangeSpec } from "@alltp/autotrack";

/** The games the ROM switches between, and its credits. */
export const MODES = ["zelda", "sm", "credits"] as const;
export type Smz3Mode = (typeof MODES)[number];

/** One range of the map. */
export interface Smz3Range extends RangeSpec {
  /** The SNES A-bus address (ExHiROM), as the sources write it. */
  readonly bus: number;
  readonly source: string;
}

/**
 * Which game runs, whether it is in play, its items and checks: one cadence,
 * so they are read in the same tick and a reading's in-play state and saves
 * come from the same moment. Seen on 2026-10-19 with the game state read
 * every 500 ms and the saves every 1000: the first reading in play carried
 * saves read during the new file's load, Zelda's SRAM still blank ($FF), and
 * the board took every item and check for found.
 */
export const GAME_MS = 1000;
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
  modes?: readonly Smz3Mode[];
  source: string;
}): Smz3Range & { readonly id: Id } => {
  const { at, ...rest } = spec;
  return { ...rest, address: bus(at, "exhirom"), bus: at };
};

/** Zelda's save data in WRAM, $7E:F000-$7E:F4FF (z3 sram.asm:7-13). */
export const ZELDA_SAVE_SIZE = 0x500;

/**
 * Every range. Zelda's save is read whole, the same 0x500 bytes in either
 * mode: WRAM while Zelda runs, its SRAM copy (and the buffers Zelda's items
 * found in Super Metroid go to) while Super Metroid runs. Super Metroid's is
 * read as its save holds it: offset n is $7E:09A2+n below $60, $7E:D7C0+n
 * from there (the offsets z3/items.asm:118-176 writes).
 */
export const MEMORY_RANGES = [
  // The seed block: its world id, its first config word (bit 15 a race,
  // bit 13 keysanity, bits 8-9 Super Metroid's logic, the version below),
  // its seed and its second config word (Patch.cs:590-612)
  range({
    at: 0x80_ff50,
    category: "seed",
    everyMs: ROM_MS,
    id: "seed",
    size: 0x0a,
    source: "Patch.cs:590-612",
  }),
  // The title: "ZSM", the version, the logics' letters and the seed in hex
  // (Patch.cs:625-639)
  range({
    at: 0x80_ffc0,
    category: "rom-header",
    id: "rom-header",
    size: 0x20,
    source: "Patch.cs:625-639",
  }),
  // The medallions opening Misery Mire ($40:0022) and Turtle Rock ($40:0023)
  // (Patch.cs:129-152), and the crystals Ganon's Tower ($40:005E) and Ganon
  // ($40:005F) ask for (Patch.cs:813-815): Zelda's config bank $30, which
  // Snes() sends to bank $40
  range({
    at: 0x40_0022,
    category: "requirements",
    everyMs: ROM_MS,
    id: "requirements",
    size: 0x3e,
    source: "Patch.cs:129-152, 813-815",
  }),
  // The bosses Tourian asks for, a word (Patch.cs:809-811)
  range({
    at: 0xf4_7200,
    category: "requirements",
    everyMs: ROM_MS,
    id: "tourian",
    size: 2,
    source: "Patch.cs:809-811",
  }),
  // Which game runs: $00 Zelda, negative Super Metroid, else the credits
  // (sram.asm:1; common.asm:53-68)
  range({
    at: 0xa1_73fe,
    category: "game-state",
    everyMs: GAME_MS,
    id: "current-game",
    size: 2,
    source: "sram.asm:1, common.asm:53-68",
  }),
  // Zelda's game mode: $07, $09 and $0B in play (z3 ram.asm:41)
  range({
    at: 0x7e_0010,
    category: "game-state",
    everyMs: GAME_MS,
    id: "zelda-mode",
    modes: ["zelda"],
    size: 1,
    source: "z3 ram.asm:41",
  }),
  // Super Metroid's game state: $07 and $08 in play; a portal sets $0B, a
  // door loading (sm/transition.asm:106-107)
  range({
    at: 0x7e_0998,
    category: "game-state",
    everyMs: GAME_MS,
    id: "sm-state",
    modes: ["sm"],
    size: 2,
    source: "sm/transition.asm:106-107",
  }),
  // Zelda's save data while Zelda runs (z3 sram.asm:7-13)
  range({
    at: 0x7e_f000,
    category: "zelda",
    everyMs: GAME_MS,
    id: "zelda-wram",
    modes: ["zelda"],
    size: ZELDA_SAVE_SIZE,
    source: "z3 sram.asm:7-13",
  }),
  // Super Metroid's equipment while it runs: save offsets $00-$5F
  range({
    at: 0x7e_09a2,
    category: "sm",
    everyMs: GAME_MS,
    id: "sm-equipment",
    modes: ["sm"],
    size: 0x60,
    source: "z3/items.asm:118-145",
  }),
  // Its keycards ($D830), boss tokens ($D832), maps ($D834) and items
  // collected ($D870-$D88F, a bit per location): save offsets $70-$CF
  // (z3/items.asm:146-176; sm/rewards.asm:72-78)
  range({
    at: 0x7e_d830,
    category: "sm",
    everyMs: GAME_MS,
    id: "sm-events",
    modes: ["sm"],
    size: 0x60,
    source: "z3/items.asm:146-176",
  }),
  // Zelda's save in SRAM while Super Metroid runs: Zelda saves it before
  // every portal (z3/teleport.asm:48) and loads it back on the way in
  // (z3/transition.asm:269-315)
  range({
    at: 0xa0_6000,
    category: "zelda",
    everyMs: GAME_MS,
    id: "zelda-sram",
    modes: ["sm"],
    size: ZELDA_SAVE_SIZE,
    source: "z3/transition.asm:269-315",
  }),
  // Super Metroid's items collected in its SRAM save while Zelda runs: save
  // offsets $B0-$CF, which no Zelda pickup changes
  range({
    at: 0xa1_60c0,
    category: "sm",
    everyMs: GAME_MS,
    id: "sm-sram-items",
    modes: ["zelda"],
    size: 0x20,
    source: "sram.asm:7",
  }),
  // Super Metroid's save offsets $00-$7F while Zelda runs, which Super
  // Metroid's items found in Zelda go to (sram.asm:11;
  // z3/transition.asm:381-420; z3/items.asm:1-117)
  range({
    at: 0xa1_7900,
    category: "sm",
    everyMs: GAME_MS,
    id: "sm-buffer",
    modes: ["zelda"],
    size: 0x80,
    source: "sram.asm:11",
  }),
  // Zelda's save offsets $300-$3FF while Super Metroid runs, which Zelda's
  // items found in Super Metroid go to (sram.asm:23;
  // sm/transition.asm:230-292)
  range({
    at: 0xa1_7b00,
    category: "zelda",
    everyMs: GAME_MS,
    id: "zelda-buffer",
    modes: ["sm"],
    size: 0x100,
    source: "sram.asm:23",
  }),
  // Zelda's keys found per dungeon, save offsets $4E0-$4EF, likewise
  // (sram.asm:29; sm/items.asm:1150-1158)
  range({
    at: 0xa1_7f50,
    category: "zelda",
    everyMs: GAME_MS,
    id: "zelda-keys-buffer",
    modes: ["sm"],
    size: 0x10,
    source: "sram.asm:29",
  }),
  // The game time: the two games' frame counters, whose sum the credits
  // print as TOTAL TIME (credits.asm:895-901; tracking.asm:97-123). Each
  // lives in its game's memory while that game runs, and in its save (written
  // before every portal) while the other does. They are read in one request
  // with the mode check after it (@alltp/autotrack), so a portal inside the
  // tick never pairs one game's live counter with a stale one. Category
  // `game-time`: the race profile forbids it, so Race Mode reads none of
  // these four.
  //
  // Super Metroid's NMI counter, low word then high word, while it runs
  // (sm/randomizer/tracking.asm:1-3, 62-90)
  range({
    at: 0x7e_05b8,
    category: "game-time",
    everyMs: GAME_MS,
    id: "clock-sm-live",
    modes: ["sm"],
    size: 4,
    source: "sm/randomizer/tracking.asm:1-3, 62-90",
  }),
  // Its saved copy, word 0 and 1 of the first stats slot, while Zelda runs
  // and in the credits (sram.asm:10; tracking.asm:112-119, 464-472)
  range({
    at: 0xa1_7a00,
    category: "game-time",
    everyMs: GAME_MS,
    id: "clock-sm-saved",
    modes: ["zelda", "credits"],
    size: 4,
    source: "sram.asm:10, tracking.asm:112-119, 464-472",
  }),
  // Zelda's NMI counter (`NMIFrames`) while it runs (z3/randomizer/sram.asm:
  // 293, 582; framehook.asm:45-52)
  range({
    at: 0x7e_f43e,
    category: "game-time",
    everyMs: GAME_MS,
    id: "clock-zelda-live",
    modes: ["zelda"],
    size: 4,
    source: "z3/randomizer/sram.asm:293, 582",
  }),
  // Its saved copy, inside the Zelda save, while Super Metroid runs and in
  // the credits (credits.asm:895-901; tracking.asm:105-109)
  range({
    at: 0xa0_643e,
    category: "game-time",
    everyMs: GAME_MS,
    id: "clock-zelda-saved",
    modes: ["sm", "credits"],
    size: 4,
    source: "credits.asm:895-901, tracking.asm:105-109",
  }),
] as const;

export type MemoryRangeId = (typeof MEMORY_RANGES)[number]["id"];

/** Ranges by id. */
export const MEMORY_RANGE = Object.fromEntries(
  MEMORY_RANGES.map((spec) => [spec.id, spec]),
) as Readonly<Record<MemoryRangeId, Smz3Range>>;
