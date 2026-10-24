// The probes: whether the running ROM is an alttpr.com seed (the game check)
// and whether it is a race seed (the race flag), read so that a device that
// fills unreadable memory with zeros cannot pass for an open seed.

import {
  ARCHIPELAGO_ROM,
  bus,
  type GameCheck,
  type GameCheckResult,
  type RaceFlagProbe,
} from "@alltp/autotrack";

/**
 * The seed name alttpr.com writes over the header title: "VT " and the
 * seed's hash, padded to 21 bytes (vt app/World.php:1090, 1350; Rom.php:
 * 2318-2321, at ROM 0x7FC0, which is A-bus $00:FFC0).
 */
export const SEED_TITLE_PREFIX = "VT ";

/**
 * The original game's title, which the base patch leaves alone
 * (LTTP_RND_GeneralBugfixes.asm:14, quoting Bank00.asm:9173).
 */
export const VANILLA_TITLE = "THE LEGEND OF ZELDA  ";

/**
 * The header's ROM size byte, $FFD7: $0A in the original game, $0B (16
 * Mbit) once the base patch has run (LTTP_RND_GeneralBugfixes.asm:23-24).
 */
const ROM_SIZE = { patched: 0x0b, vanilla: 0x0a } as const;

/** Offsets in the rom-header range, which starts at $FFC0. */
const TITLE_LENGTH = 21;
const ROM_SIZE_OFFSET = 0xffd7 - 0xffc0;

/**
 * The title Archipelago's A Link to the Past writes at ROM 0x7FC0: "AP", its
 * world's version's digits, "_", the player, "_", the seed (AP 0.6.8,
 * worlds/alttp/Rom.py:1544-1546, commit 54803be0). Its client, not this
 * tracker, follows such a ROM.
 */
export const ARCHIPELAGO_TITLE = /^AP\d{1,3}_\d+_/;

/** Why the game check refused the running ROM. */
export type GameCheckCode =
  | "zero-filled"
  | "vanilla-alttp"
  | "unnamed-randomizer"
  | typeof ARCHIPELAGO_ROM
  | "not-alttpr";

/**
 * Whether the header read is an alttpr.com seed's. Total: any bytes give an
 * answer, with an English sentence the UI may show.
 */
export function checkGame(header: Uint8Array): GameCheckResult {
  const fail = (
    code: GameCheckCode,
    message: string,
  ): Extract<GameCheckResult, { ok: false }> => ({ code, message, ok: false });
  if (header.every((byte) => byte === 0)) {
    return fail(
      "zero-filled",
      "The ROM header read as zeros: the emulator does not let the tracker read the ROM.",
    );
  }
  const title = String.fromCharCode(...header.subarray(0, TITLE_LENGTH));
  if (title.startsWith(SEED_TITLE_PREFIX)) return { ok: true };
  if (ARCHIPELAGO_TITLE.test(title)) {
    return fail(
      ARCHIPELAGO_ROM,
      "This is an Archipelago seed of A Link to the Past: Archipelago's own client tracks it into its room. Follow your slot on the Archipelago board.",
    );
  }
  if (title === VANILLA_TITLE) {
    return header[ROM_SIZE_OFFSET] === ROM_SIZE.vanilla
      ? fail(
          "vanilla-alttp",
          "This is the original A Link to the Past, not a randomizer seed: load a seed from alttpr.com.",
        )
      : fail(
          "unnamed-randomizer",
          "This A Link to the Past ROM is patched but carries no alttpr.com seed name: load a seed from alttpr.com.",
        );
  }
  return fail(
    "not-alttpr",
    "The running game is not an alttpr.com seed of A Link to the Past.",
  );
}

/** The game check @alltp/autotrack runs on attach. */
export const ALTTPR_GAME_CHECK: GameCheck = {
  ranges: ["rom-header"],
  verify: (bytes) => checkGame(bytes("rom-header")),
};

/**
 * The race flag: TournamentSeed at A-bus $30:8213 (0x308213 on the bus;
 * the base patch writes it at its FastROM mirror $B0:8213, ROM 0x180213,
 * tables.asm:997-999), then TournamentSeedInverse, its complement
 * (tables.asm:1000-1001). The front end writes the pair as $01 $00 for a
 * race seed and $00 $01 otherwise (vt app/Rom.php:908-920); the base
 * patch's default is $00 $01.
 */
export const RACE_FLAG_AT = 0x30_8213;

/** What the race flag pair says. */
export type RaceFlagProbeResult =
  | { readonly state: "race" | "open" }
  | {
      /**
       * `unreadable`: both bytes read zero, as SNI fills a read the
       * emulator refused; `unknown`: any other pair.
       */
      readonly state: "unreadable" | "unknown";
      readonly reason: string;
    };

const hex = (byte: number | undefined) =>
  `$${(byte ?? 0).toString(16).toUpperCase().padStart(2, "0")}`;

/**
 * Reads the race flag pair. The complement is the cross-check against zero
 * fill: on a readable seed, a flag of $00 comes with a complement of $01,
 * so a $00 flag beside a $00 complement means the bytes were never read
 * (SNI's RetroArch driver turns a failed read into zeros), and the ROM may
 * well be a race seed.
 */
export function probeRaceFlag(bytes: Uint8Array): RaceFlagProbeResult {
  const flag = bytes[0];
  const inverse = bytes[1];
  if (flag === 0x01 && inverse === 0x00) return { state: "race" };
  if (flag === 0x00 && inverse === 0x01) return { state: "open" };
  if (flag === 0x00 && inverse === 0x00) {
    return {
      reason:
        "The race flag and its complement both read $00: this memory is not readable on this device, so the seed may be a race seed.",
      state: "unreadable",
    };
  }
  return {
    reason: `The race flag reads ${hex(flag)} with a complement of ${hex(inverse)}, which means neither race nor open.`,
    state: "unknown",
  };
}

/**
 * The race flag probe for @alltp/autotrack: two bytes at FX Pak Pro
 * $18_0213, the headerless ROM offset of LoROM $30:8213, which is the
 * address SNI and QUsb2Snes take. The autotrack contract has no
 * "unreadable" reading: an unreadable flag is "unknown", which keeps Race
 * Mode on in "auto" (race-mode.ts), the fail-closed answer.
 */
export const ALTTPR_RACE_FLAG: RaceFlagProbe = {
  address: bus(RACE_FLAG_AT),
  decode: (bytes) => {
    const { state } = probeRaceFlag(bytes);
    return state === "race" || state === "open" ? state : "unknown";
  },
  size: 2,
};
