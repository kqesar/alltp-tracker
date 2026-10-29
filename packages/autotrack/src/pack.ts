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
  /**
   * The host's switch (`setOptIn`) the range waits for: it is read only
   * while that switch is on, and forgotten when it goes off. Omit for a range
   * that is always read. A switch is for an assist the player chooses.
   */
  readonly optIn?: string;
  /**
   * A gate: the range is read only while this holds over the memory as the
   * tick left it. When it stops holding the range forgets its bytes (`has`
   * turns false), so a decoder never takes an earlier stint's for the current
   * one, unless `keep` says to hold them. Only a range of a forbidden category
   * may have a gate, with a cadence. A gated range is never in the tick's plan:
   * it is read after the tick's other reads, in the casual phase (Race Mode
   * never reaches it), on a tick that read the race flag first (one more
   * request of its own, when the tick would not have). Gated ranges that are
   * not `alone` are read together, as one request.
   */
  readonly when?: (view: RangeView) => boolean;
  /**
   * Holds the bytes of a gated range while this holds, though `when` does not
   * (a menu over the room): nothing is read, nothing forgotten. Needs `when`.
   */
  readonly keep?: (view: RangeView) => boolean;
  /**
   * A gated range sent as a request of its own, never merged with another: a
   * big span planned beside others is cut into small pieces (usb2snes: 255
   * bytes), several times slower than whole. It is read when its cadence is
   * due, when `when` has just turned true, and when a range of `refreshOn`
   * changed on the tick.
   */
  readonly alone?: boolean;
  /** Ids of ranges whose change makes an `alone` range read on that tick. */
  readonly refreshOn?: readonly string[];
}

/** What a range's `when` sees: the snapshot, as a decoder would. */
export interface RangeView {
  has(id: string): boolean;
  bytes(id: string): Uint8Array;
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
  /**
   * The bytes Race Mode may read in each mode, at `mode + 1` (0 while the
   * mode is unknown, and for a pack without modes): those of the
   * race-permitted ranges read in that mode, and the race flag. A race read
   * asks for no other byte, even one it would discard.
   */
  readonly raceBytes: readonly (readonly ByteRange[])[];
  /**
   * Every other byte, at the same index: what a race-mode merge never
   * bridges, however small the gap.
   */
  readonly raceBarriers: readonly (readonly ByteRange[])[];
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
  /** The opt-in switches the ranges name, in first-seen order (at most 8). */
  readonly optIns: readonly string[];
  /** For each range, the index of its switch in `optIns`, or -1. */
  readonly optInOf: Int8Array;
  /** The gated ranges, in order (`refreshOn` resolved), alone or not. */
  readonly gated: readonly {
    readonly index: number;
    readonly alone: boolean;
    readonly refreshOn: readonly number[];
  }[];
  /** For each range: whether it is gated (never in the tick's plans). */
  readonly isGated: readonly boolean[];
  /** For each range: whether it is read alone. */
  readonly isAlone: readonly boolean[];
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
 * unknown mode, a game check reading a mode-bound range; a range with `when`,
 * `keep`, `alone` or `refreshOn` in a race-permitted category, `keep`, `alone`
 * or `refreshOn` without `when`, `when` without a cadence, `refreshOn` without
 * `alone`, an unknown `refreshOn` id, more than 8 switches.
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

  const optIns: string[] = [];
  const optInOf = new Int8Array(ranges.length).fill(-1);
  const gated: { alone: boolean; index: number; refreshOn: number[] }[] = [];
  const isGated: boolean[] = ranges.map(() => false);
  const isAlone: boolean[] = ranges.map(() => false);
  ranges.forEach((range, index) => {
    const where = `range "${range.id}"`;
    if (range.optIn !== undefined) {
      if (!ID.test(range.optIn)) fail(id, `${where}: a switch is kebab-case`);
      let slot = optIns.indexOf(range.optIn);
      if (slot < 0) {
        slot = optIns.push(range.optIn) - 1;
        if (slot >= 8) fail(id, "at most 8 opt-in switches");
      }
      optInOf[index] = slot;
    }
    const gate = range.when !== undefined;
    if (
      !gate &&
      range.keep === undefined &&
      range.alone === undefined &&
      range.refreshOn === undefined
    ) {
      return;
    }
    if (racePermitted[index]) {
      fail(
        id,
        `${where}: when, keep, alone and refreshOn are for forbidden categories`,
      );
    }
    if (!gate) fail(id, `${where}: keep, alone and refreshOn need when`);
    if (range.everyMs === undefined) fail(id, `${where}: when needs everyMs`);
    if (range.alone !== true && range.refreshOn !== undefined) {
      fail(id, `${where}: refreshOn needs alone`);
    }
    if (modeMasks[index] !== ALL_MODES) {
      fail(id, `${where}: a gated range is read in every mode`);
    }
    const refreshOn = (range.refreshOn ?? []).map((other) => {
      const at = indexOf.get(other);
      if (at === undefined)
        fail(id, `${where}: refreshOn: unknown range "${other}"`);
      return at;
    });
    isGated[index] = true;
    isAlone[index] = range.alone === true;
    gated.push({ alone: range.alone === true, index, refreshOn });
  });

  // An alone range refreshing on another alone range is read after it, so a
  // change of that one is seen on the same tick
  const visiting = new Set<number>();
  const position = (k: number): number => {
    if (visiting.has(k)) {
      fail(id, `range "${ranges[gated[k].index].id}": refreshOn loops`);
    }
    visiting.add(k);
    let after = k;
    for (const other of gated[k].refreshOn) {
      const at = gated.findIndex((g) => g.index === other);
      if (at >= 0 && gated[at].alone) {
        after = Math.max(after, position(at) + 0.5);
      }
    }
    visiting.delete(k);
    return after;
  };
  const order = gated.map((_, k) => position(k));
  const sortedGated = gated
    .map((entry, k) => ({ entry, key: order[k] }))
    .sort((a, b) => a.key - b.key)
    .map(({ entry }) => entry);

  const gap = source.gap ?? 16;
  if (!Number.isInteger(gap) || gap < 0)
    fail(id, "gap must be a natural number");

  // The flag is always readable in Race Mode: the profile permits it.
  const flagBytes =
    raceFlag === null
      ? []
      : [{ address: raceFlag.address, size: raceFlag.size }];
  permittedBytes.push(...flagBytes);
  // In doubt, forbidden: a race read touches only the bytes of the permitted
  // ranges read in the mode it was planned for, never a gap between them
  const raceBytes = Array.from(
    { length: (modes?.names.length ?? 0) + 1 },
    (_, slot) => {
      const mode = slot - 1;
      const bytes: ByteRange[] = [...flagBytes];
      ranges.forEach((range, index) => {
        const mask = modeMasks[index];
        if (
          racePermitted[index] &&
          (mask === ALL_MODES || (mode >= 0 && (mask & (1 << mode)) !== 0))
        ) {
          bytes.push({ address: range.address, size: range.size });
        }
      });
      return bytes;
    },
  );

  return {
    cycle,
    dueSets,
    forbiddenBytes,
    gameCheck,
    gap,
    gated: sortedGated,
    id,
    indexOf,
    isAlone,
    isGated,
    modeMasks,
    modes,
    optInOf,
    optIns,
    permittedBytes,
    profile,
    raceBarriers: raceBytes.map(complement),
    raceBytes,
    raceFlag,
    racePermitted,
    ranges,
    tickMs: tickMs === 0 ? 1000 : tickMs,
  };
}
