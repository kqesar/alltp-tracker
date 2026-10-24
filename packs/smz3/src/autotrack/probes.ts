// What the session asks before and while it tracks an SMZ3 seed: whether the
// running ROM is one (its title), whether it is a race seed (its seed
// block's race bit) and which game runs (the combo ROM's game byte).

import {
  ARCHIPELAGO_ROM,
  bus,
  type GameCheck,
  type GameCheckResult,
  type ModeProbe,
  type RaceFlagProbe,
  type RaceFlagReading,
} from "@alltp/autotrack";
import { MODES, type Smz3Mode } from "./memory";

/** How samus.link titles an SMZ3 seed: "ZSM", then its version (Patch.cs:625-639). */
export const SMZ3_TITLE_PREFIX = "ZSM";

/**
 * The title Archipelago's SMZ3 writes: "ZSM", then its patch's version and
 * AP's as digits alone, then the logics' letters (AP 0.6.8,
 * worlds/smz3/TotalSMZ3/Patch.py:620, commit 54803be0). samus.link's carries
 * its version with dots ("ZSM11.3.2…", Patch.cs:625-639). Its client, not
 * this tracker, follows such a ROM.
 */
export const ARCHIPELAGO_TITLE = /^ZSM\d+[NOC][NHX]/;

/** Why the game check refused the running ROM. */
export type Smz3GameCheckCode =
  | "zero-filled"
  | typeof ARCHIPELAGO_ROM
  | "not-smz3";

/**
 * Whether the header read is an SMZ3 seed's. Total: any bytes give an
 * answer, with an English sentence the UI may show.
 */
export function checkGame(header: Uint8Array): GameCheckResult {
  if (header.every((byte) => byte === 0)) {
    return {
      code: "zero-filled",
      message:
        "The ROM header read as zeros: the emulator does not let the tracker read the ROM.",
      ok: false,
    };
  }
  const title = String.fromCharCode(...header.subarray(0, 21));
  if (ARCHIPELAGO_TITLE.test(title)) {
    return {
      code: ARCHIPELAGO_ROM,
      message:
        "This is an Archipelago seed of SMZ3: Archipelago's own client tracks it into its room. Follow your slot on the Archipelago board.",
      ok: false,
    };
  }
  if (title.startsWith(SMZ3_TITLE_PREFIX)) return { ok: true };
  return {
    code: "not-smz3",
    message: "The running game is not an SMZ3 seed: load one from samus.link.",
    ok: false,
  };
}

/** The game check @alltp/autotrack runs on attach. */
export const SMZ3_GAME_CHECK: GameCheck = {
  ranges: ["rom-header"],
  verify: (bytes) => checkGame(bytes("rom-header")),
};

/**
 * The seed block's first config word (Patch.cs:590-604): bit 15 a race seed.
 * Its low byte is the version, never zero: a word whose low byte is zero was
 * not read from a seed, and says nothing.
 */
export function readRaceFlag(bytes: Uint8Array): RaceFlagReading {
  const word = (bytes[0] ?? 0) | ((bytes[1] ?? 0) << 8);
  if ((word & 0xff) === 0) return "unknown";
  return word & 0x8000 ? "race" : "open";
}

/** The race flag @alltp/autotrack reads. */
export const SMZ3_RACE_FLAG: RaceFlagProbe = {
  address: bus(0x80_ff52, "exhirom"),
  decode: readRaceFlag,
  size: 2,
};

/**
 * Which game runs, by the game byte's low byte as the combo ROM's NMI reads
 * it (common.asm:53-68): $00 Zelda, negative Super Metroid (a reset writes
 * $FF, common.asm:70-76), else the credits ($11, credits.asm:62-64).
 */
export function decodeMode(bytes: Uint8Array): Smz3Mode | null {
  if (bytes.length === 0) return null;
  const game = bytes[0] ?? 0;
  if (game === 0) return "zelda";
  return game & 0x80 ? "sm" : "credits";
}

/** The mode probe @alltp/autotrack reads first on every tick. */
export const SMZ3_MODES: ModeProbe = {
  decode: decodeMode,
  names: MODES,
  range: "current-game",
};
