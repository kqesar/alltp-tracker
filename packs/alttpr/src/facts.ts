// Solving a world whose rules read facts: what the randomizer holds once a
// location is reached (its events, sweep_for_events), or a region reached
// where the engine allows no reach(). The entrance randomizer's world
// (er-world.ts) and the Door Randomizer's (door-world/) give them; this
// module solves and analyzes either.
import {
  type Analysis,
  type AnalyzeOptions,
  type Atom,
  analyze,
  type Blockers,
  type CompiledWorld,
  type Solution,
  type State,
  solve,
} from "@alltp/engine";
import { joinBlockers } from "./goals";

/** A compiled world, and the facts its rules read. */
export interface FactWorld {
  readonly compiled: CompiledWorld;
  /**
   * What the solver holds once a location (by id) is reached: an item, or
   * a fact named for what gives it.
   */
  readonly facts: readonly {
    readonly item: string;
    readonly location: string;
    /**
     * The item held while the location is reached at maybe only: a rule
     * reads the fact `item | maybe & <this>`, so what hangs on a location
     * the solver is unsure of is maybe, never no.
     */
    readonly maybe?: string;
  }[];
}

/**
 * Solves a world, holding each fact once what gives it is surely reached,
 * as the randomizer sweeps for events, until nothing more is gained (and a
 * fact's `maybe` item while it is reached at maybe only, dropped once it is
 * surely). Each pass can only raise a fact, so this ends within two passes
 * per fact.
 * @returns The solution, and the state with the facts gained
 */
export function solveFactsState(
  world: FactWorld,
  state: State,
): { readonly solution: Solution; readonly state: State } {
  let current: State = state;
  for (;;) {
    const solution = solve(world.compiled, current);
    const raised: Record<string, number> = {};
    for (const { item, location, maybe } of world.facts) {
      if (current[item]) continue;
      const level = solution.location(location);
      if (level === "yes") {
        raised[item] = 1;
        if (maybe !== undefined && current[maybe]) raised[maybe] = 0;
      } else if (level === "maybe" && maybe !== undefined && !current[maybe])
        raised[maybe] = 1;
    }
    if (Object.keys(raised).length === 0) return { solution, state: current };
    current = { ...current, ...raised };
  }
}

/** solveFactsState's solution. */
export const solveFacts = (world: FactWorld, state: State): Solution =>
  solveFactsState(world, state).solution;

/**
 * The engine's analysis of a world, its facts read through: a fact is no
 * item to get, so the analysis proposes it, then each set that holds one
 * takes, in its place, what brings the location that gives it (`yes`, the
 * level a fact asks), every way of it, at most `maxAtoms` atoms in all. A
 * fact that needs itself again gives nothing.
 * @param state - The state with its facts gained (solveFactsState)
 */
export function analyzeFacts(
  world: FactWorld,
  state: State,
  options: AnalyzeOptions = {},
): Analysis {
  const sources = new Map(
    world.facts.flatMap((f) => [
      [f.item, f.location] as const,
      ...(f.maybe === undefined ? [] : [[f.maybe, f.location] as const]),
    ]),
  );
  const inner = analyze(world.compiled, state, {
    ...options,
    acquirable: (item) =>
      sources.has(item) || (options.acquirable?.(item) ?? true),
  });
  const memo = new Map<string, Blockers>();
  const expand = (
    location: string,
    target: "yes" | "maybe",
    seen: ReadonlySet<string>,
  ): Blockers => {
    const key = `${location}/${target}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const raw = inner.blockers(location, target);
    let sets: (readonly Atom[])[] = [];
    let truncated = raw.truncated;
    for (const set of raw.sets) {
      let ways: Blockers = {
        sets: [
          set.filter((atom) => !("item" in atom && sources.has(atom.item))),
        ],
        truncated: false,
      };
      for (const atom of set) {
        const from = "item" in atom ? sources.get(atom.item) : undefined;
        if (from === undefined) continue;
        if (seen.has(from)) {
          ways = { sets: [], truncated: ways.truncated };
          break;
        }
        ways = joinBlockers(
          ways,
          expand(from, "yes", new Set([...seen, from])),
          options.maxAtoms,
        );
      }
      sets = [...sets, ...ways.sets];
      truncated ||= ways.truncated;
    }
    // Each way once, the minimal ones
    const found = joinBlockers(
      { sets: [[]], truncated: false },
      { sets, truncated },
      options.maxAtoms,
    );
    memo.set(key, found);
    return found;
  };
  return {
    blockers: (location, target) =>
      expand(location, target, new Set([location])),
    doableNow: () => inner.doableNow(),
  };
}
