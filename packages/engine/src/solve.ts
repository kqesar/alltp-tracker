import { type Context, UNKNOWN } from "./compile";
import { itemValue, type State } from "./evaluate";
import { type Level, MAYBE, NO, TRI_VALUES, type Tri, YES } from "./tri";
import type { CompiledWorld } from "./world";

/** The availability of every region and location for one state. */
export class Solution {
  readonly #world: CompiledWorld;
  readonly #regions: Uint8Array;
  readonly #locations: Uint8Array;

  constructor(
    world: CompiledWorld,
    regions: Uint8Array,
    locations: Uint8Array,
  ) {
    this.#world = world;
    this.#regions = regions;
    this.#locations = locations;
  }

  /** Throws a RangeError for an id the world does not have. */
  region(id: string): Tri {
    const index = this.#world.regionIndex.get(id);
    if (index === undefined) throw new RangeError(`Unknown region "${id}"`);
    return TRI_VALUES[this.#regions[index]];
  }

  /** Throws a RangeError for an id the world does not have. */
  location(id: string): Tri {
    const index = this.#world.locationIndex.get(id);
    if (index === undefined) throw new RangeError(`Unknown location "${id}"`);
    return TRI_VALUES[this.#locations[index]];
  }

  regions(): Record<string, Tri> {
    return snapshot(this.#world.regionIds, this.#regions);
  }

  locations(): Record<string, Tri> {
    return snapshot(this.#world.locationIds, this.#locations);
  }
}

function snapshot(
  ids: readonly string[],
  levels: Uint8Array,
): Record<string, Tri> {
  return Object.fromEntries(ids.map((id, i) => [id, TRI_VALUES[levels[i]]]));
}

/**
 * Solves a world for one state.
 *
 * A region's level is the best, over every path from the start, of the worst
 * exit on that path: `level(start) = yes`, and otherwise the least fixpoint of
 * `level(r) = max over exits u -> r of min(level(u), req(exit))`. A location
 * is `min(level(its region), req(location))`.
 *
 * With only three levels this is a widest-path search with one bucket per
 * level, highest first. Regions reached with "yes" are expanded first, so
 * every region is expanded exactly once, at its final level, and each exit
 * and location requirement runs at most once, helpers at most once in all
 * (memoized). An exit is skipped without evaluation when it cannot improve
 * its target. Cycles need no special care: a region is never lowered, and is
 * expanded only when raised. Cost: O(R + E + L) plus the size of the
 * requirements actually evaluated; regions out of reach cost nothing.
 */
export function solve(world: CompiledWorld, state: State): Solution {
  const items = world.items;
  const values = new Float64Array(items.length);
  for (let i = 0; i < items.length; i++) values[i] = itemValue(state, items[i]);
  const regionCount = world.regionIds.length;
  const levels = new Uint8Array(regionCount);
  // Exits cannot use reach() (compileWorld rejects it), so `levels` is read
  // only by location requirements, once the regions below are all final.
  const ctx: Context = {
    helpers: new Int8Array(world.helperCount).fill(UNKNOWN),
    regions: levels,
    values,
  };

  const { exitOffsets, exitReqs, exitTargets } = world;
  // A region is raised to each level at most once, so neither stack can
  // hold more than every region.
  const yesStack = new Int32Array(regionCount);
  const maybeStack = new Int32Array(regionCount);
  let yesTop = 0;
  let maybeTop = 0;

  const expand = (region: number, level: Level) => {
    for (let e = exitOffsets[region]; e < exitOffsets[region + 1]; e++) {
      const target = exitTargets[e];
      if (levels[target] >= level) continue;
      const req = exitReqs[e](ctx);
      const reached = req < level ? req : level;
      if (reached > levels[target]) {
        levels[target] = reached;
        if (reached === YES) yesStack[yesTop++] = target;
        else maybeStack[maybeTop++] = target;
      }
    }
  };

  levels[world.start] = YES;
  yesStack[yesTop++] = world.start;
  while (yesTop > 0) expand(yesStack[--yesTop], YES);
  while (maybeTop > 0) {
    const region = maybeStack[--maybeTop];
    // Raised to "yes" after it was queued here: already expanded.
    if (levels[region] === MAYBE) expand(region, MAYBE);
  }

  const { locationOffsets, locationReqs } = world;
  const locations = new Uint8Array(world.locationIds.length);
  for (let r = 0; r < regionCount; r++) {
    const level = levels[r];
    if (level === NO) continue;
    for (let l = locationOffsets[r]; l < locationOffsets[r + 1]; l++) {
      const req = locationReqs[l](ctx);
      locations[l] = req < level ? req : level;
    }
  }

  return new Solution(world, levels, locations);
}
