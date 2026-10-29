// The Door Randomizer's locations checked: its key drops, pots, enemy drops
// and shop items, read from the tables its base patch keeps beside the save
// (memory.ts: `door-pots`, `door-drops`, `door-purchases`). Only the
// locations the run's settings make are decoded (door-rando/locations.ts,
// `drLocationsOf`): v2.0 counts a pot, an enemy drop or a shop item as a
// location "only ... in modes where they are shuffled", and a bit of such a
// table for a pot that is no location (a vanilla key's, a switch's) says
// nothing the tracker may tell.

import {
  type DrFlag,
  type DrLocation,
  drFlagAddress,
} from "../door-rando/locations";
import type { MemoryView, Unsettled } from "./decode";
import {
  DOOR_DROPS_SWITCH,
  DOOR_POTS_SWITCH,
  DOOR_SHOPS_SWITCH,
  MEMORY_RANGE,
  type MemoryRangeId,
} from "./memory";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

/** The memory range each kind of flag is read from, and its switch. */
export const DOOR_FLAG_RANGES = {
  drop: { range: "door-drops", switch: DOOR_DROPS_SWITCH },
  pot: { range: "door-pots", switch: DOOR_POTS_SWITCH },
  purchase: { range: "door-purchases", switch: DOOR_SHOPS_SWITCH },
} as const satisfies Record<
  DrFlag["memory"],
  { readonly range: MemoryRangeId; readonly switch: string }
>;

/** The switches a run's locations need on: one per table they lie in. */
export function doorSwitches(
  locations: readonly DrLocation[],
): ReadonlySet<string> {
  return new Set(
    locations.map((location) => DOOR_FLAG_RANGES[location.flag.memory].switch),
  );
}

/** What memory says of a run's Door Randomizer locations. */
export interface DoorChecksReading {
  /** The locations memory says were taken, by id. */
  readonly checked: ReadonlySet<string>;
  /** Locations whose table is not known, and why, by id. */
  readonly unsettled: ReadonlyMap<string, Unsettled>;
}

/**
 * The run's DR locations memory says were taken. Pure and total: a table not
 * read leaves its locations unsettled, never unchecked; a location memory
 * cannot tell (`unflagged`: a key pot potshuffle moved, a take-any's item a
 * purchase marks only as the shop's) is left out of both.
 * @param memory - The ranges read, by id: the session's snapshot
 * @param locations - The run's DR locations (`drLocationsOf`)
 * @param unflagged - The ids among them memory cannot tell
 */
export function decodeDoorChecks(
  memory: MemoryView,
  locations: readonly DrLocation[],
  options: { readonly race: boolean; readonly unflagged?: ReadonlySet<string> },
): DoorChecksReading {
  const checked = new Set<string>();
  const unsettled = new Map<string, Unsettled>();
  for (const location of locations) {
    if (options.unflagged?.has(location.id)) continue;
    const id = DOOR_FLAG_RANGES[location.flag.memory].range;
    const range = MEMORY_RANGE[id];
    if (
      options.race &&
      ALTTPR_RACE_PROFILE.categories[range.category]?.permitted !== true
    ) {
      unsettled.set(location.id, "race-mode");
      continue;
    }
    const bytes = memory.has(id) ? memory.bytes(id) : null;
    if (bytes === null || bytes.length < range.size) {
      unsettled.set(location.id, "not-read");
      continue;
    }
    const { bus, mask, size } = drFlagAddress(location.flag);
    const at = bus - range.bus;
    const value = size === 2 ? bytes[at] | (bytes[at + 1] << 8) : bytes[at];
    if ((value & mask) !== 0) checked.add(location.id);
  }
  return { checked, unsettled };
}
