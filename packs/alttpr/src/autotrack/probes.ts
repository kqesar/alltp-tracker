// The probes: whether the running ROM is an ALttPR seed, alttpr.com's or the
// Door Randomizer's (the game check), and whether it is a race seed (the
// race flag), read so that a device that fills unreadable memory with zeros
// cannot pass for an open seed.

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
 * The title the Door Randomizer writes at ROM 0x7FC0: "DR", the first three
 * digits of its version ("156" for 1.5.6), "_", the team, "_", the player,
 * "_", the seed, cut to 21 bytes (DR 1.5.8 Rom.py:1503-1507). Its Overworld
 * fork writes "OR" and the same digits of the Door Randomizer version it is
 * built on (OWR 0.8.0.0 Rom.py:1843, 1848), or a generation tag of up to
 * three characters a site names (1836-1840).
 */
export const DOOR_RANDOMIZER_TITLE =
  /^(DR|OR)([^_\0]{1,3})_(\d+)_(\d+)_([^\0]*)/;

/**
 * The Door Randomizer version the tracker's DR data is read from (the pack's
 * upstream.json, `doorRandomizer`): the release after the 1.5.7 builds most
 * of the recorded races of 2026 ran (`test/dr-spoilers/index.json`). A seed
 * of another version is still tracked; "What I read" says when its
 * locations may differ (`DOOR_RANDOMIZER_SAME_LOCATIONS`).
 */
export const DOOR_RANDOMIZER_VERSION = "1.5.8";

/**
 * The Door Randomizer versions whose locations and flags are the tracker's
 * DR data's: from 1.5.6 to 1.5.8, the files they are read from
 * (`Regions.py`, `PotShuffle.py`, `source/dungeon/EnemyList.py`,
 * `Dungeons.py`, `ItemList.py`) and the base patch (`data/base2current.bps`)
 * do not change.
 */
export const DOOR_RANDOMIZER_SAME_LOCATIONS: ReadonlySet<string> = new Set([
  "1.5.6",
  "1.5.7",
  "1.5.8",
]);

/** Which randomizer wrote a seed, by its title. */
export type SeedRom =
  | {
      /** alttpr.com: "VT " and the seed's hash. */
      readonly randomizer: "vt";
      readonly seed: string;
    }
  | {
      /** The Door Randomizer ("DR") or its Overworld fork ("OR"). */
      readonly randomizer: "door";
      readonly overworld: boolean;
      /**
       * Its version, from the title's three digits ("1.5.6"); null when
       * the title carries a site's tag in their place.
       */
      readonly version: string | null;
      /** The rest of the title: team, player and seed ("1_1_367825107"). */
      readonly seed: string;
    };

/**
 * The text without its trailing NULs, by a scan: `/\0+$/` retries from each
 * NUL of a run that does not end the text, quadratic in its length.
 */
const withoutTrailingNuls = (text: string): string => {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 0) end--;
  return text.slice(0, end);
};

/** The randomizer and seed a 21-byte title names, or null. */
export function seedRomOf(title: string): SeedRom | null {
  if (title.startsWith(SEED_TITLE_PREFIX)) {
    const seed = withoutTrailingNuls(title.slice(SEED_TITLE_PREFIX.length));
    return { randomizer: "vt", seed: seed.trim() };
  }
  const door = DOOR_RANDOMIZER_TITLE.exec(title);
  if (door === null) return null;
  const [, kind, digits, team, player, seed] = door;
  return {
    overworld: kind === "OR",
    randomizer: "door",
    seed: `${team}_${player}_${seed.trim()}`,
    version: /^\d{3}$/.test(digits) ? [...digits].join(".") : null,
  };
}

/** A Door Randomizer title's id: team, player and seed (`seedRomOf`). */
const TITLE_ID = /^\d+_\d+_(.+)$/;

/**
 * The shortest id a 21-byte Door Randomizer title may have cut: after "DR",
 * three digits (or a site's tag of three characters) and "_", 15 bytes are
 * left (DR 1.5.8 Rom.py:1503-1507; OWR 0.8.0.2 Rom.py:1841-1856).
 */
const CUT_ID_LENGTH = 15;

/**
 * The seed the Overworld fork writes of a site's hash: its first 9
 * characters (OWR 0.8.0.2 Rom.py:1847, `seedstring[:9]`).
 */
const SITE_SEED_LENGTH = 9;

/**
 * Whether two seed ids of A Link to the Past name the same seed: true or
 * false when their forms prove it, null when they cannot be held to each
 * other. alttpr.com's hash is the same everywhere; a Door Randomizer seed's
 * id is its title's ("1_1_840319254": team, player, then the seed), and a
 * site may name it otherwise (avianart's permalink hash, which a run saved
 * or shared before the tracker took the ROM's form may hold).
 * - The seeds after team and player are held against each other: another
 *   player's ROM of the seed is the same seed.
 * - A title's id long enough to have been cut to the title's 21 bytes
 *   matches any seed it begins, and the Overworld fork's 9 characters of a
 *   site's hash match that hash.
 * - A site's hash against a title's number cannot be compared: DR's own
 *   branch names the seed by its number, which the hash does not tell
 *   (DR 1.5.8 Rom.py:1503-1504), so null, which the app takes as no
 *   mismatch: the tracker never says a ROM is another seed's on a guess.
 * @param a - A seed id, as the run or a ROM holds it
 * @param b - Another
 */
export function sameSeedId(a: string, b: string): boolean | null {
  if (a === b) return true;
  const [one, two] = [idOf(a), idOf(b)];
  if (one.seed === two.seed) return true;
  if (begins(one, two) || begins(two, one)) return true;
  // A title's number against a site's hash: nothing holds them together
  const [title, site] = one.titled ? [one, two] : [two, one];
  return title.titled &&
    !site.titled &&
    DIGITS.test(title.seed) &&
    !DIGITS.test(site.seed)
    ? null
    : false;
}

/** A seed id's seed, and whether it is a title's (`TITLE_ID`). */
type IdOf = {
  readonly seed: string;
  readonly titled: boolean;
  readonly id: string;
};

const DIGITS = /^\d+$/;

/** An id's seed: after team and player for a title's, else the whole id. */
const idOf = (id: string): IdOf => {
  const seed = TITLE_ID.exec(id)?.[1];
  return seed === undefined
    ? { id, seed: id, titled: false }
    : { id, seed, titled: true };
};

/**
 * Whether a title's seed is a cut of the other id's: the title cut to its
 * 21 bytes, or the Overworld fork's 9 characters of a site's hash.
 */
const begins = (title: IdOf, other: IdOf): boolean =>
  title.titled &&
  other.seed.startsWith(title.seed) &&
  (title.id.length >= CUT_ID_LENGTH ||
    (title.seed.length === SITE_SEED_LENGTH && !other.titled));

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
  if (seedRomOf(title) !== null) return { ok: true };
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
    "The running game is not a seed of A Link to the Past from alttpr.com or the Door Randomizer.",
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
 * patch's default is $00 $01. The Door Randomizer writes the same pair at
 * the same place: $00 $01 for every seed (DR 1.5.8 Rom.py:1156), $01 $00
 * for a race (patch_race_rom, 1552-1553), which its Mystery.py always asks
 * for (Mystery.py:70); its Overworld fork too (OWR 0.8.0.0 Rom.py:1231,
 * 1879-1880). Its base patch keeps the flag where vt's does
 * (aerinon/z3randomizer d0f4651, tables.asm: TournamentSeed at $B0:8213).
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
