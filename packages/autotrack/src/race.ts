// Race Mode. A race profile is a racing community's autotracking rules as
// data: the memory it permits, and the categories of tracked information it
// permits or forbids. With Race Mode on, the scheduler reads only permitted
// bytes for permitted categories, and the guard below checks every request
// against that before it is sent.

import { busRange, hex, type MemoryMapping } from "./address";
import { DefinitionError, RaceViolationError } from "./errors";
import type { ByteRange, ReadPlan } from "./plan";

/** One category of tracked information and whether races permit it. */
export interface RaceCategory {
  readonly permitted: boolean;
  /** The rule it comes from, quoted from the profile's source. */
  readonly rule: string;
}

/** The race flag a ROM carries, and how to read it. */
export interface RaceFlagSpec {
  /** FX Pak Pro address of the flag byte. */
  readonly address: number;
  /** Byte value meaning "race ROM". */
  readonly raceValue: number;
  /** Byte value meaning "not a race ROM". */
  readonly openValue: number;
}

export interface RaceProfile {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly source: string;
  /**
   * The game's memory mapping, which its A-bus addresses were translated
   * under; a transport that reads by bus address (RetroArch) translates back.
   */
  readonly mapping: MemoryMapping;
  /** Memory a race-mode read may touch, in FX Pak Pro space. */
  readonly permitted: readonly ByteRange[];
  readonly categories: Readonly<Record<string, RaceCategory>>;
  readonly raceFlag?: RaceFlagSpec;
}

/**
 * Builds a profile from A-bus ranges as a spec writes them (inclusive ends).
 * Throws a DefinitionError if a range does not translate to one block, if
 * the race flag lies outside the permitted memory, or if no category is
 * permitted.
 */
export function defineRaceProfile(source: {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly source: string;
  readonly mapping: MemoryMapping;
  readonly permitted: readonly (readonly [first: number, last: number])[];
  readonly categories: Readonly<Record<string, RaceCategory>>;
  readonly raceFlag?: {
    readonly bus: number;
    readonly raceValue: number;
    readonly openValue: number;
  };
}): RaceProfile {
  const permitted = source.permitted.map(([first, last]) =>
    busRange(first, last, source.mapping),
  );
  if (!Object.values(source.categories).some((c) => c.permitted)) {
    throw new DefinitionError(`${source.id}: no category is permitted`);
  }
  let raceFlag: RaceFlagSpec | undefined;
  if (source.raceFlag !== undefined) {
    const { address } = busRange(
      source.raceFlag.bus,
      source.raceFlag.bus,
      source.mapping,
    );
    if (!covers(permitted, address, 1)) {
      throw new DefinitionError(
        `${source.id}: the race flag at $${hex(source.raceFlag.bus, 6)} is outside the permitted memory`,
      );
    }
    raceFlag = {
      address,
      openValue: source.raceFlag.openValue,
      raceValue: source.raceFlag.raceValue,
    };
  }
  return {
    categories: source.categories,
    id: source.id,
    mapping: source.mapping,
    permitted,
    raceFlag,
    source: source.source,
    title: source.title,
    version: source.version,
  };
}

/** Whether `[address, address + size)` lies inside the union of `ranges`. */
export function covers(
  ranges: readonly ByteRange[],
  address: number,
  size: number,
): boolean {
  return firstUncovered(ranges, address, size) === null;
}

/** The first byte of `[address, address + size)` no range covers, or null. */
function firstUncovered(
  ranges: readonly ByteRange[],
  address: number,
  size: number,
): number | null {
  // Walk the bytes block by block: ranges may abut without merging.
  let at = address;
  const end = address + size;
  while (at < end) {
    let next = at;
    for (const range of ranges) {
      if (range.address <= at && range.address + range.size > at) {
        next = Math.max(next, range.address + range.size);
      }
    }
    if (next === at) return at;
    at = next;
  }
  return null;
}

/**
 * Throws a RaceViolationError unless every byte `plan` reads is permitted
 * memory and lies in a range of `allowed`: the race-permitted ranges the plan
 * was made for, and the race flag. A byte between two of them is refused,
 * whatever it holds: in doubt, forbidden.
 */
export function assertRaceSafe(
  plan: ReadPlan,
  profile: RaceProfile,
  allowed: readonly ByteRange[],
): void {
  for (const request of plan.requests) {
    const { pieces } = request;
    for (let i = 0; i < pieces.length; i += 2) {
      const address = pieces[i];
      const size = pieces[i + 1];
      if (!covers(profile.permitted, address, size)) {
        throw new RaceViolationError(
          `Race Mode: $${hex(address, 6)}+${size} reaches outside the memory ${profile.id} permits`,
        );
      }
      const stray = firstUncovered(allowed, address, size);
      if (stray !== null) {
        throw new RaceViolationError(
          `Race Mode: $${hex(address, 6)}+${size} reads $${hex(stray, 6)}, which no permitted range covers`,
        );
      }
    }
  }
}
