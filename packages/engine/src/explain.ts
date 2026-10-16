import { evaluate, type State, type TraceNode, trace } from "./evaluate";
import { print } from "./printer";
import { run } from "./solve";
import { NO, TRI_VALUES, type Tri } from "./tri";
import type { CompiledWorld } from "./world";

/** One region of the route to a location, and the exit that entered it. */
export interface PathStep {
  readonly region: string;
  /** Absent for the first step, the start. */
  readonly exit?: {
    readonly from: string;
    /** The exit's requirement, settings folded, as `print` writes it. */
    readonly req: string;
    /** What the requirement is worth for the state. */
    readonly value: Tri;
  };
}

/** Why a location has the value it has for one state. */
export interface Explanation {
  /**
   * A best route from the start to the location's region: the start first,
   * then each region with the exit that entered it. The weakest exit value on
   * it is the region's level. Empty when the region is out of reach.
   */
  readonly path: readonly PathStep[];
  /**
   * The location's requirement (settings folded) with every node's value.
   * The location is the lower of this root value and the region's level.
   */
  readonly requirement: TraceNode;
}

/**
 * Explains a location: the route the solver found to its region, and its
 * requirement node by node. The settings are those the world was compiled
 * with. Throws a RangeError for an id the world does not have.
 *
 * The route comes from the solver itself: it records, for each region, the
 * exit that last raised it (that is, the one that gave its final level), so
 * explaining costs one solve, a walk back along those exits and one traced
 * evaluation of the location's requirement.
 */
export function explain(
  world: CompiledWorld,
  state: State,
  id: string,
): Explanation {
  const location = world.locationIndex.get(id);
  if (location === undefined) {
    throw new RangeError(`Unknown location "${id}"`);
  }
  const { levels, via } = run(world, state);
  const { exitExprs, exitSources, regionIds, rules } = world;

  const path: PathStep[] = [];
  let region = world.locationRegions[location];
  if (levels[region] !== NO) {
    // Each region was raised from an exit whose source already had its final
    // level, so the walk goes strictly back in time and ends at the start.
    for (let e = via[region]; e >= 0; e = via[region]) {
      const expr = exitExprs[e];
      path.push({
        exit: {
          from: regionIds[exitSources[e]],
          req: print(expr),
          value: evaluate(expr, state, rules),
        },
        region: regionIds[region],
      });
      region = exitSources[e];
    }
    path.push({ region: regionIds[region] });
    path.reverse();
  }

  const regions = Object.fromEntries(
    regionIds.map((name, r) => [name, TRI_VALUES[levels[r]]]),
  );
  return {
    path,
    requirement: trace(world.locationExprs[location], state, rules, {
      regions,
    }),
  };
}
