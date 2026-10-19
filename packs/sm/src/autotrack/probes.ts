// Whether the running ROM is a Map Rando seed: the patcher names the
// cartridge "SUPERMETROID MAPRANDO" (rust/maprando/src/patch.rs:2111-2112),
// where the original game's header says "Super Metroid".

import type { GameCheck, GameCheckResult } from "@alltp/autotrack";

/** The title Map Rando writes at ROM 0x7FC0 (A-bus $00:FFC0). */
export const MAP_RANDO_TITLE = "SUPERMETROID MAPRANDO";

/** The original game's title, padded to the header's 21 bytes. */
const VANILLA_TITLE = "Super Metroid";

/** Why the game check refused the running ROM. */
export type SmGameCheckCode = "zero-filled" | "vanilla-sm" | "not-map-rando";

/**
 * Whether the header read is a Map Rando seed's. Total: any bytes give an
 * answer, with an English sentence the UI may show.
 */
export function checkGame(header: Uint8Array): GameCheckResult {
  const fail = (code: SmGameCheckCode, message: string): GameCheckResult => ({
    code,
    message,
    ok: false,
  });
  if (header.every((byte) => byte === 0)) {
    return fail(
      "zero-filled",
      "The ROM header read as zeros: the emulator does not let the tracker read the ROM.",
    );
  }
  const title = String.fromCharCode(
    ...header.subarray(0, MAP_RANDO_TITLE.length),
  );
  if (title === MAP_RANDO_TITLE) return { ok: true };
  if (title.startsWith(VANILLA_TITLE)) {
    return fail(
      "vanilla-sm",
      "This Super Metroid ROM is not a Map Rando seed: load a seed from maprando.com.",
    );
  }
  return fail(
    "not-map-rando",
    "The running game is not a Map Rando seed of Super Metroid.",
  );
}

/** The game check @alltp/autotrack runs on attach. */
export const MAP_RANDO_GAME_CHECK: GameCheck = {
  ranges: ["rom-header"],
  verify: (bytes) => checkGame(bytes("rom-header")),
};
