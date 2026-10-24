// The contract a game pack fulfils to be autotracked: named memory ranges
// with a cadence and a race category, an optional game check, the race
// profile they answer to and, for a combined ROM such as SMZ3, the modes its
// memory layout switches between. Every address and every game fact comes
// from the pack; `definePack` checks it all once, when the pack loads, and
// lays it out for the scheduler.

import { hex, pakRegion } from "./address";
import { DefinitionError } from "./errors";
import type { ByteRange } from "./plan";
import { covers, type RaceProfile } from "./race";
import type { DeviceInfo } from "./transport";

/** One named block of memory a pack reads. */
export interface RangeSpec {
  readonly id: string;
  /** FX Pak Pro address; use `bus()` to write an A-bus address. */
  readonly address: number;
  readonly size: number;
  /** How often to poll it. Omit for a range only the game check reads. */
  readonly everyMs?: number;
  /** A key of the profile's categories: what the bytes are tracked for. */
  readonly category: string;
  /** The modes it is read in (see `ModeProbe`); omit for every mode. */
  readonly modes?: readonly string[];
}

/**
 * How a pack whose layout depends on what is running tells which layout is
 * live. SMZ3 is one ROM holding Super Metroid and ALttP: the running game's
 * state is in WRAM, the other's in SRAM, so the same data has two homes.
 */
export interface ModeProbe {
  /** Id of the range that tells the mode. Read on every tick, first. */
  readonly range: string;
  readonly names: readonly string[];
  /** The mode the probe's bytes mean, or null while it cannot be told. */
  readonly decode: (bytes: Uint8Array) => string | null;
}

/** What the game check concludes. */
export type GameCheckResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      /** Machine code, e.g. "not-alttpr" or "in-menu". */
      readonly code: string;
      /** English sentence the UI may show as is. */
      readonly message: string;
    };

/**
 * The code a game check gives a ROM Archipelago patched: AP's own client
 * (SNIClient) tracks it into the room, and the app's Archipelago board
 * follows the room. Each pack knows its world's ROM title; this is the one
 * word they share with the app, which offers the board on it.
 */
export const ARCHIPELAGO_ROM = "archipelago-rom";

export interface GameCheck {
  /** Ids of the ranges it needs; their categories must be race-permitted. */
  readonly ranges: readonly string[];
  /** Decides from the bytes read whether the running game is this pack's. */
  readonly verify: (
    bytes: (id: string) => Uint8Array,
    device: DeviceInfo,
  ) => GameCheckResult;
}

/** What a race flag read says. */
export type RaceFlagReading = "race" | "open" | "unknown";

/** Reads the ROM's race flag. Defaults to the profile's `raceFlag`. */
export interface RaceFlagProbe {
  readonly address: number;
  readonly size: number;
  readonly decode: (bytes: Uint8Array) => RaceFlagReading;
}

export interface AutotrackPackSource {
  readonly id: string;
  readonly profile: RaceProfile;
  readonly ranges: readonly RangeSpec[];
  readonly gameCheck?: GameCheck;
  /** Overrides the profile's flag; `null` when the game has none. */
  readonly raceFlag?: RaceFlagProbe | null;
  /** Unread bytes a merge may bridge (default 16). */
  readonly gap?: number;
  readonly modes?: ModeProbe;
}

/** Bit per mode a range is read in; ranges for every mode have every bit. */
export const ALL_MODES = 0xffff_ffff;

/** A checked pack, laid out for the scheduler. */
export interface AutotrackPack {
  readonly id: string;
  readonly profile: RaceProfile;
  readonly ranges: readonly RangeSpec[];
  readonly indexOf: ReadonlyMap<string, number>;
  /** For each range: whether its category is race-permitted. */
  readonly racePermitted: readonly boolean[];
  readonly gameCheck?: Omit<GameCheck, "ranges"> & {
    readonly ranges: readonly number[];
  };
  readonly raceFlag: RaceFlagProbe | null;
  readonly gap: number;
  /** Bytes a race-mode merge must not bridge into. */
  readonly raceBarriers: readonly ByteRange[];
  /** Ranges of race-permitted categories and the race flag, as byte ranges. */
  readonly permittedBytes: readonly ByteRange[];
  /** Ranges of forbidden categories, as byte ranges. */
  readonly forbiddenBytes: readonly ByteRange[];
  /** Milliseconds between scheduler ticks: the gcd of the cadences. */
  readonly tickMs: number;
  /**
   * The polling cycle: `cycle[t % cycle.length]` indexes `dueSets`, the
   * distinct sets of range indices due on a tick.
   */
  readonly cycle: Uint16Array;
  readonly dueSets: readonly (readonly number[])[];
  /** The mode probe, with its range index, or null for a one-layout pack. */
  readonly modes: {
    readonly probe: number;
    readonly names: readonly string[];
    readonly decode: (bytes: Uint8Array) => string | null;
  } | null;
  /** For each range, the bits of the modes it is read in (`ALL_MODES`). */
  readonly modeMasks: Uint32Array;
}

const MAX_CYCLE = 4096;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function fail(packId: string, message: string): never {
  throw new DefinitionError(`${packId}: ${message}`);
}

function profileFlag(profile: RaceProfile): RaceFlagProbe | null {
  const flag = profile.raceFlag;
  if (flag === undefined) return null;
  return {
    address: flag.address,
    decode: (bytes) =>
      bytes[0] === flag.raceValue
        ? "race"
        : bytes[0] === flag.openValue
          ? "open"
          : "unknown",
    size: 1,
  };
}

/** The bytes of the address space outside `ranges` (sorted, merged). */
function complement(ranges: readonly ByteRange[]): ByteRange[] {
  const sorted = [...ranges].sort((a, b) => a.address - b.address);
  const out: ByteRange[] = [];
  let at = 0;
  for (const range of sorted) {
    if (range.address > at) out.push({ address: at, size: range.address - at });
    at = Math.max(at, range.address + range.size);
  }
  if (at < 0x100_0000) out.push({ address: at, size: 0x100_0000 - at });
  return out;
}

/**
 * Checks and lays out a pack. Throws a DefinitionError for: a bad or
 * duplicate id; a range that is empty, outside FX Pak Pro memory, or across
 * two memory regions; a category the profile does not know; a race-permitted
 * range outside the profile's permitted memory; a cadence that is not a
 * positive integer; cadences whose cycle would exceed 4096 ticks; a game
 * check that names an unknown range or one of a forbidden category; a race
 * flag outside the permitted memory; modes that are empty or repeated, a
 * mode probe that is unknown, forbidden or mode-bound, a range naming an
 * unknown mode, a game check reading a mode-bound range.
 */
export function definePack(source: AutotrackPackSource): AutotrackPack {
  const { id, profile, ranges } = source;
  if (!ID.test(id)) fail(id, "a pack id is kebab-case");
  const indexOf = new Map<string, number>();
  const racePermitted: boolean[] = [];
  const permittedBytes: ByteRange[] = [];
  const forbiddenBytes: ByteRange[] = [];
  let tickMs = 0;
  ranges.forEach((range, index) => {
    const where = `range "${range.id}"`;
    if (!ID.test(range.id)) fail(id, `${where}: an id is kebab-case`);
    if (indexOf.has(range.id)) fail(id, `${where} is defined twice`);
    indexOf.set(range.id, index);
    if (!Number.isInteger(range.size) || range.size < 1) {
      fail(id, `${where}: size must be a positive integer`);
    }
    const region = pakRegion(range.address);
    if (
      !Number.isInteger(range.address) ||
      region === undefined ||
      range.address + range.size - 1 > region.end
    ) {
      fail(
        id,
        `${where}: $${hex(range.address, 6)}+${range.size} is not inside one FX Pak Pro memory region`,
      );
    }
    const category = profile.categories[range.category];
    if (category === undefined) {
      fail(
        id,
        `${where}: unknown category "${range.category}" in ${profile.id}`,
      );
    }
    const bytes = { address: range.address, size: range.size };
    if (category.permitted) {
      if (!covers(profile.permitted, range.address, range.size)) {
        fail(
          id,
          `${where}: category "${range.category}" is race-permitted, but $${hex(range.address, 6)}+${range.size} reaches outside the memory ${profile.id} permits`,
        );
      }
      permittedBytes.push(bytes);
    } else {
      forbiddenBytes.push(bytes);
    }
    racePermitted.push(category.permitted);
    if (range.everyMs !== undefined) {
      if (!Number.isInteger(range.everyMs) || range.everyMs < 1) {
        fail(id, `${where}: everyMs must be a positive integer`);
      }
      tickMs = gcd(range.everyMs, tickMs);
    }
  });

  // The polling cycle: the lcm of the periods, in ticks.
  let cycleLength = 1;
  for (const range of ranges) {
    if (range.everyMs === undefined) continue;
    const period = range.everyMs / tickMs;
    cycleLength = (cycleLength / gcd(cycleLength, period)) * period;
    if (cycleLength > MAX_CYCLE) {
      fail(id, `the cadences repeat every ${cycleLength}+ ticks; align them`);
    }
  }
  const cycle = new Uint16Array(cycleLength);
  const dueSets: number[][] = [];
  const setIndex = new Map<string, number>();
  for (let tick = 0; tick < cycleLength; tick++) {
    const due: number[] = [];
    ranges.forEach((range, index) => {
      if (
        range.everyMs !== undefined &&
        tick % (range.everyMs / tickMs) === 0
      ) {
        due.push(index);
      }
    });
    const key = due.join(",");
    let set = setIndex.get(key);
    if (set === undefined) {
      set = dueSets.length;
      setIndex.set(key, set);
      dueSets.push(due);
    }
    cycle[tick] = set;
  }

  let gameCheck: AutotrackPack["gameCheck"];
  if (source.gameCheck !== undefined) {
    const check = source.gameCheck;
    const indices = check.ranges.map((rangeId) => {
      const index = indexOf.get(rangeId);
      if (index === undefined)
        fail(id, `game check: unknown range "${rangeId}"`);
      if (!racePermitted[index]) {
        fail(id, `game check: range "${rangeId}" is not race-permitted`);
      }
      return index;
    });
    gameCheck = { ...check, ranges: indices };
  }

  const raceFlag =
    source.raceFlag === undefined ? profileFlag(profile) : source.raceFlag;
  if (
    raceFlag !== null &&
    !covers(profile.permitted, raceFlag.address, raceFlag.size)
  ) {
    fail(
      id,
      `the race flag at $${hex(raceFlag.address, 6)} is outside the permitted memory`,
    );
  }

  const modeMasks = new Uint32Array(ranges.length).fill(ALL_MODES);
  let modes: AutotrackPack["modes"] = null;
  if (source.modes !== undefined) {
    const { decode, names, range: probeId } = source.modes;
    if (
      names.length === 0 ||
      names.length > 31 ||
      new Set(names).size !== names.length
    ) {
      fail(id, "modes: 1 to 31 distinct names");
    }
    const probe = indexOf.get(probeId);
    if (probe === undefined)
      fail(id, `modes: unknown probe range "${probeId}"`);
    if (!racePermitted[probe])
      fail(id, `modes: probe range "${probeId}" is not race-permitted`);
    if (ranges[probe].modes !== undefined) {
      fail(id, `modes: probe range "${probeId}" must be read in every mode`);
    }
    modes = { decode, names, probe };
  }
  ranges.forEach((range, index) => {
    if (range.modes === undefined) return;
    if (modes === null)
      fail(id, `range "${range.id}" names modes, but the pack has none`);
    let mask = 0;
    for (const name of range.modes) {
      const bit = modes.names.indexOf(name);
      if (bit < 0) fail(id, `range "${range.id}": unknown mode "${name}"`);
      mask |= 1 << bit;
    }
    modeMasks[index] = mask >>> 0;
  });
  if (gameCheck !== undefined) {
    for (const index of gameCheck.ranges) {
      if (modeMasks[index] !== ALL_MODES) {
        fail(
          id,
          `game check: range "${ranges[index].id}" must be read in every mode`,
        );
      }
    }
  }

  const gap = source.gap ?? 16;
  if (!Number.isInteger(gap) || gap < 0)
    fail(id, "gap must be a natural number");

  // The flag is always readable in Race Mode: the profile permits it.
  if (raceFlag !== null) {
    permittedBytes.push({ address: raceFlag.address, size: raceFlag.size });
  }

  return {
    cycle,
    dueSets,
    forbiddenBytes,
    gameCheck,
    gap,
    id,
    indexOf,
    modeMasks,
    modes,
    permittedBytes,
    profile,
    raceBarriers: [...complement(profile.permitted), ...forbiddenBytes],
    raceFlag,
    racePermitted,
    ranges,
    tickMs: tickMs === 0 ? 1000 : tickMs,
  };
}
