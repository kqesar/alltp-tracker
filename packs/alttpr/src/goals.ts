// Go mode: the moment a run can be finished in logic, per goal.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31):
// - app/World.php:101-106: a world is won once Link holds the Triforce
//   (or, for triforce-hunt, enough pieces brought to Murahdahla);
// - app/Randomizer.php:103-114: prepareWorld puts the Triforce at the
//   Master Sword Pedestal for the pedestal goal, at Ganon for ganon,
//   fast_ganon, dungeons, ganonhunt and completionist;
// - Ganon's rule, app/Region/Standard/DarkWorld/NorthEast.php:186-234 (the
//   location `ganon`): crystals.ganon crystals for ganon and fast_ganon
//   (213-222), the pearl, and Agahnim 2 but for fast_ganon (226);
// - Agahnim 2, Ganon's Tower's prize (app/Region/Standard/GanonsTower.php:
//   388-392), which gives DefeatAgahnim2 (84).
//
// So go mode is the Triforce's location in logic. For the ganon goal, Ganon
// wants Agahnim 2 beaten, which the solver does not compute (the player
// records it): its go mode is Ganon's Tower up to Agahnim 2 in logic, then
// Ganon with Agahnim 2 beaten. Not modeled: the dungeons goal, whose Ganon
// wants every dungeon done (no go mode before the end), completionist,
// which wants every location, and the triforce hunts, whose pieces are not
// items of this pack.
import {
  type Analysis,
  type AnalyzeOptions,
  type Atom,
  analyze,
  type Blockers,
  type CompiledWorld,
  itemValue,
  rank,
  type State,
  type Tri,
} from "@alltp/engine";
import type { Filler } from "./fill";
import { type KeyedSolution, solveWithKeys } from "./keys";
import type { Source } from "./location";
import type { AlttprSettings } from "./settings";

/** One step of a go mode: a location to reach in logic. */
export interface GoStep {
  /** The location, in logic in the state the steps before it gave. */
  readonly location: string;
  /**
   * The fact reaching it gives the steps after it. Once the player holds
   * it, the step is done.
   */
  readonly gives?: string;
  readonly source: Source;
}

/** What a goal's go mode asks: its steps, in order. */
export interface GoMode {
  /** Where the goal puts the Triforce, whose location is the last step. */
  readonly source: Source;
  readonly steps: readonly GoStep[];
}

const GANON: GoStep = {
  location: "ganon",
  source: "app/Region/Standard/DarkWorld/NorthEast.php:186",
};

export const GO_MODES = {
  /** Ganon through the pyramid's hole, with the crystals he asks for. */
  fastGanon: { source: "app/Randomizer.php:108", steps: [GANON] },
  /** Ganon's Tower up to Agahnim 2, then Ganon. */
  ganon: {
    source: "app/Randomizer.php:107",
    steps: [
      {
        gives: "defeatAgahnim2",
        location: "agahnim-2",
        source: "app/Region/Standard/GanonsTower.php:388",
      },
      GANON,
    ],
  },
  pedestal: {
    source: "app/Randomizer.php:104",
    steps: [
      {
        location: "master-sword-pedestal",
        source: "app/Region/Standard/LightWorld/NorthWest.php:86",
      },
    ],
  },
} as const satisfies Readonly<Record<string, GoMode>>;

/**
 * The go mode of a run's goal: none for the dungeons and completionist
 * goals, whose end is every dungeon or every location, nor for a goal not
 * known yet.
 */
export function goModeOf(settings: AlttprSettings): GoMode | undefined {
  if (settings.ganonGoal === true) return GO_MODES.ganon;
  if (settings.fastGanonGoal === true) return GO_MODES.fastGanon;
  if (settings.pedestalGoal === true) return GO_MODES.pedestal;
  return undefined;
}

/** How far a run is from its go mode. */
export interface GoModeStatus {
  /**
   * The lowest of its steps: `yes` once every step is in logic or done,
   * `maybe` once each is at least possible.
   */
  readonly tri: Tri;
  /**
   * Each step's own value, in the key model; `done` when the player holds
   * what it gives. A step after one out of logic is not solved: undefined.
   */
  readonly steps: readonly {
    readonly location: string;
    readonly tri?: Tri;
    readonly done: boolean;
  }[];
}

/** A run solved: each location's tri. */
export interface LocationSolution {
  location(id: string): Tri;
}

/**
 * Where a run stands against its go mode: each step solved in the state the
 * steps before it gave, until one is out of logic.
 * @param solveAt - How a state is solved: the key model, or another world's
 *   solver (the entrance randomizer's)
 * @param first - `state` solved, if at hand
 */
export function goModeStatusBy(
  solveAt: (state: State) => LocationSolution,
  state: State,
  mode: GoMode,
  first: LocationSolution = solveAt(state),
): GoModeStatus {
  let current = state;
  let solved: LocationSolution | undefined = first;
  let lowest = 2;
  const steps: { location: string; tri?: Tri; done: boolean }[] = [];
  for (const step of mode.steps) {
    const { gives, location } = step;
    if (gives !== undefined && itemValue(current, gives) >= 1) {
      steps.push({ done: true, location, tri: "yes" });
      continue;
    }
    if (lowest === 0) {
      steps.push({ done: false, location });
      continue;
    }
    solved ??= solveAt(current);
    const tri = solved.location(location);
    steps.push({ done: false, location, tri });
    lowest = Math.min(lowest, rank(tri));
    if (gives !== undefined) {
      current = { ...current, [gives]: 1 };
      solved = undefined;
    }
  }
  return { steps, tri: lowest === 2 ? "yes" : lowest === 1 ? "maybe" : "no" };
}

/**
 * Where a run stands against its go mode, in the key model.
 * @param keyed - The key model's solution of `state`, if at hand
 */
export function goModeStatus(
  filler: Filler,
  state: State,
  mode: GoMode,
  keyed: KeyedSolution = solveWithKeys(filler, state),
): GoModeStatus {
  return goModeStatusBy((s) => solveWithKeys(filler, s), state, mode, keyed);
}

const atomKey = (atom: Atom): string =>
  "item" in atom ? `item:${atom.item}` : `group:${atom.group}`;

const atomName = (atom: Atom): string =>
  "item" in atom ? atom.item : atom.group;

/** Whether `a` asks for no more than `b`: each atom of it, at most as high. */
function covers(a: readonly Atom[], b: readonly Atom[]): boolean {
  const levels = new Map(b.map((atom) => [atomKey(atom), atom.min]));
  return a.every((atom) => (levels.get(atomKey(atom)) ?? 0) >= atom.min);
}

/** The engine's order: items before groups, each by name, then by level. */
function compareAtoms(a: Atom, b: Atom): number {
  const kind = Number("group" in a) - Number("group" in b);
  if (kind !== 0) return kind;
  const [x, y] = [atomName(a), atomName(b)];
  if (x !== y) return x < y ? -1 : 1;
  return a.min - b.min;
}

/** Sets in the engine's order: fewest atoms first, then atom by atom. */
function compareSets(a: readonly Atom[], b: readonly Atom[]): number {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i++) {
    const order = compareAtoms(a[i], b[i]);
    if (order !== 0) return order;
  }
  return 0;
}

/**
 * What brings both of two targets: every set of one joined with every set
 * of the other (each atom at the higher of its levels), those over
 * `maxAtoms` atoms dropped, then only the minimal ones, in the engine's
 * order. Truncated when either was.
 */
export function joinBlockers(a: Blockers, b: Blockers, maxAtoms = 3): Blockers {
  const joined: Atom[][] = [];
  for (const x of a.sets) {
    for (const y of b.sets) {
      const levels = new Map<string, Atom>();
      for (const atom of [...x, ...y]) {
        const key = atomKey(atom);
        const held = levels.get(key);
        if (held === undefined || held.min < atom.min) levels.set(key, atom);
      }
      if (levels.size <= maxAtoms) {
        joined.push([...levels.values()].sort(compareAtoms));
      }
    }
  }
  joined.sort(compareSets);
  const minimal: Atom[][] = [];
  for (const set of joined) {
    if (!minimal.some((kept) => covers(kept, set))) minimal.push(set);
  }
  return { sets: minimal, truncated: a.truncated || b.truncated };
}

/**
 * What a run is missing for its go mode: the minimal sets of at most
 * `maxAtoms` atoms that bring every step not done in logic, each step in
 * the state the steps before it gave. `[[]]` once in go mode.
 * @param state - The state to analyze: with the player's untracked keys
 * all held, as the key model would grant them, the sets say what the
 * rules want beyond the keys
 * @param analysisOf - Analyzes a state; the default calls `analyze` with
 * `options`, a caller may pass one it already made for `state`
 */
export function goModeBlockers(
  world: CompiledWorld,
  state: State,
  mode: GoMode,
  options: AnalyzeOptions = {},
  analysisOf: (state: State) => Analysis = (s) => analyze(world, s, options),
): Blockers {
  let current = state;
  let result: Blockers = { sets: [[]], truncated: false };
  for (const { gives, location } of mode.steps) {
    if (gives !== undefined && itemValue(current, gives) >= 1) continue;
    result = joinBlockers(
      result,
      analysisOf(current).blockers(location, "yes"),
      options.maxAtoms,
    );
    if (gives !== undefined) current = { ...current, [gives]: 1 };
  }
  return result;
}
