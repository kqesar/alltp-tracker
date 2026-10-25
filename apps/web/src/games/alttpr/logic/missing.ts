// What each check is missing, and the run's go mode: the engine's blockers
// and explanations over the pack's world, for what the player recorded.
//
// The blockers are asked in the state with every key the player does not
// track held (the pack's withUntracked): a key is never something to
// collect, and the key model says what keys change. So a location at
// `maybe` that the rules hold in logic with every key is `maybe` for its
// keys alone: a key may sit where the player cannot follow yet. One still
// `maybe` with every key is `maybe` by its rules, which `explain` says:
// where an item sits (a placement the tracker cannot know), or a medallion
// pad not noted yet.
//
// Working this out costs a millisecond or two for every location, so it
// never runs on a click: apps/web/src/hooks/useRunAnalysis.ts asks for it
// when the browser is idle, once per solution, and a hover only reads it.
import {
  type AnalyzeOptions,
  analyze,
  type CompiledWorld,
  explain,
  parse,
  type Solution as Solved,
  type State,
  solve,
  type TraceNode,
  type Tri,
  trace,
} from "@alltp/engine";
import {
  type AlttprSettings,
  DUNGEONS,
  type DungeonId,
  dungeon,
  type GoModeStatus,
  goModeBlockers,
  goModeOf,
  goModeStatus,
  type UntrackedItem,
  untrackedItems,
  withUntracked,
} from "@alltp/pack-alttpr";
import type { RunSettings } from "@/games/alttpr/data/presets";
import { sameWays, type Ways, waysOf } from "@/games/alttpr/logic/needs";
import { RECORDED_LEVELS } from "@/games/alttpr/logic/packItems";
import { KEY_DUNGEONS, SMALL_KEYS_MAX } from "@/games/alttpr/logic/settings";
import {
  fillerOf,
  type Inputs,
  locationName,
  type MarkerState,
  prizeOf,
  type Solution,
  solutionOf,
} from "@/games/alttpr/logic/solution";

/** Why a location is only possible. */
export type Doubt =
  /**
   * The rules hold it in logic with every key, but one of a dungeon's keys
   * may sit where the player cannot reach yet: `spots` names them.
   */
  | {
      readonly kind: "keys";
      readonly dungeon: string;
      readonly key: "big key" | "small key";
      readonly spots: readonly string[];
    }
  /** A medallion pad the player has not noted: any medallion may open it. */
  | { readonly kind: "medallion"; readonly dungeon: string }
  /** A rule asks where an item sits, which the tracker cannot know. */
  | { readonly kind: "placement" };

/** What a location not in logic is missing. */
export type Missing = {
  /** Its value in the key model: `maybe` or `no`. */
  readonly tri: Tri;
  /** The ways to bring it in logic. */
  readonly inLogic: Ways;
  /**
   * The ways to make it possible, for one out of logic, when they are not
   * the same as `inLogic` (a sequence break the logic does not vouch for).
   */
  readonly possible?: Ways;
  /** Why it is only possible, for a location at `maybe`. */
  readonly doubts: readonly Doubt[];
};

/** Everything worked out for one solution of the run. */
export type RunAnalysis = {
  /** The solution it was worked out for: stale once the run moves on. */
  readonly solution: Solution;
  /** Every location of the world not in logic. */
  readonly missing: ReadonlyMap<string, Missing>;
  /** What the run's go mode is missing, if its goal has one. */
  readonly goMode?: Ways;
};

/** The most atoms in one set: three things to get at once. */
const MAX_ATOMS = 3;

const options = new WeakMap<AlttprSettings, AnalyzeOptions>();

/**
 * What the blockers may propose: what the tracker's cells can record, up to
 * the level they reach, and with wild keys the small keys of the dungeons
 * the grid counts them for (KEY_DUNGEONS).
 */
const optionsOf = (settings: AlttprSettings): AnalyzeOptions => {
  let found = options.get(settings);
  if (found === undefined) {
    const levels = new Map(RECORDED_LEVELS);
    if (settings.wildKeys) {
      KEY_DUNGEONS.forEach((id, index) => {
        const keys = SMALL_KEYS_MAX[index] ?? 0;
        if (keys > 0) levels.set(`key${dungeon(id).code}`, keys);
      });
    }
    found = {
      acquirable: (item) => levels.has(item),
      maxAtoms: MAX_ATOMS,
      maxLevel: (item) => levels.get(item) ?? 1,
    };
    options.set(settings, found);
  }
  return found;
};

const untrackedOf = new WeakMap<AlttprSettings, readonly UntrackedItem[]>();

/** The items the player does not track, with where each may sit. */
const untracked = (settings: AlttprSettings): readonly UntrackedItem[] => {
  let found = untrackedOf.get(settings);
  if (found === undefined) {
    found = untrackedItems(fillerOf(settings));
    untrackedOf.set(settings, found);
  }
  return found;
};

/** The medallion rules, by the dungeon whose pad they read. */
const PADS: Readonly<Record<string, DungeonId>> = {
  hasMireMedallion: "misery-mire",
  hasTurtleRockMedallion: "turtle-rock",
};

/**
 * The `maybe`s that make a traced requirement `maybe`: under every node at
 * `maybe`, the arguments at `maybe` too, down to a `maybe` constant (where
 * an item sits) or a medallion pad's rule.
 */
const doubtsIn = (node: TraceNode, found: Set<string>) => {
  if (node.value !== "maybe") return;
  const { expr } = node;
  if (expr.type === "const") {
    found.add("placement");
    return;
  }
  if (expr.type === "helper" && PADS[expr.name] !== undefined) {
    found.add(`medallion:${PADS[expr.name]}`);
    return;
  }
  for (const child of node.children) doubtsIn(child, found);
};

const nameOf = (id: string) => DUNGEONS.find((d) => d.id === id)?.name ?? id;

/** A location's name inside its dungeon: "Big Chest" in Desert Palace. */
const spotName = (id: string, place: string): string => {
  const name = locationName(id);
  return name.startsWith(`${place} - `) ? name.slice(place.length + 3) : name;
};

/**
 * Why a location the key model holds at `maybe` is not in logic.
 * @param allKeys - The world solved with every untracked item held
 */
const doubtsOf = (
  id: string,
  solution: Solution,
  state: State,
  allKeys: Solved,
): Doubt[] => {
  const { keyed, settings } = solution;
  const fill = fillerOf(settings);
  if (allKeys.location(id) === "yes") {
    // In logic with every key: a dungeon not safe for keys holds it back
    return keyed
      .dungeons(id)
      .filter((d) => !keyed.safe(d))
      .flatMap((d) => {
        const place = nameOf(d);
        return untracked(settings)
          .filter((item) => item.dungeon === d)
          .map((item) => ({
            dungeon: place,
            key: item.item.startsWith("bigKey")
              ? ("big key" as const)
              : ("small key" as const),
            kind: "keys" as const,
            spots: item.locations
              .filter((spot) => keyed.location(spot) !== "yes")
              .map((spot) => spotName(spot, place)),
          }))
          .filter((doubt) => doubt.spots.length > 0);
      });
  }
  return rulesDoubts(fill.world, state, id);
};

/**
 * Why a location is `maybe` by its rules, which `explain` says: where an
 * item sits, or a medallion pad not noted.
 */
const rulesDoubts = (
  world: CompiledWorld,
  state: State,
  id: string,
): Doubt[] => {
  const { path, requirement } = explain(world, state, id);
  const found = new Set<string>();
  doubtsIn(requirement, found);
  for (const step of path) {
    if (step.exit?.value !== "maybe") continue;
    doubtsIn(trace(parse(step.exit.req), state, world.rules), found);
  }
  return [...found].sort().map((doubt) =>
    doubt === "placement"
      ? { kind: "placement" as const }
      : {
          dungeon: nameOf(doubt.slice("medallion:".length)),
          kind: "medallion" as const,
        },
  );
};

/** One place to look in a dungeon, or several that share a room. */
export type Spot = {
  /** "Big Chest", or the room they share: "Dark Basement" */
  readonly name: string;
  /** How many checks it stands for */
  readonly count: number;
};

/** The checks that miss the same thing. */
export type MissingGroup = {
  /** Stable for what the group says: its ways and doubts, not its spots. */
  readonly key: string;
  /** What its first check is missing: the others miss the same. */
  readonly missing: Missing;
  readonly spots: readonly Spot[];
};

const ROOM_SEPARATOR = " - ";

/**
 * Shortens the names of a dungeon's checks: those that share a room (the
 * words before " - ") become the room with a count, "Dark Basement - Left"
 * and "Dark Basement - Right" being "Dark Basement" twice, placed where the
 * first of them stood.
 */
export const compactSpots = (labels: readonly string[]): Spot[] => {
  const room = (label: string) => {
    const at = label.indexOf(ROOM_SEPARATOR);
    return at < 0 ? undefined : label.slice(0, at);
  };
  const sizes = new Map<string, number>();
  for (const label of labels) {
    const name = room(label);
    if (name !== undefined) sizes.set(name, (sizes.get(name) ?? 0) + 1);
  }
  const done = new Set<string>();
  const spots: Spot[] = [];
  for (const label of labels) {
    const name = room(label);
    const count = name === undefined ? 1 : (sizes.get(name) ?? 1);
    if (name === undefined || count < 2) {
      spots.push({ count: 1, name: label });
    } else if (!done.has(name)) {
      done.add(name);
      spots.push({ count, name });
    }
  }
  return spots;
};

/**
 * What makes two checks miss "the same thing": the same ways and the same
 * kinds of doubt (which spots hold a key differs by check, and is left out).
 */
const sameThing = (missing: Missing): string =>
  JSON.stringify([
    missing.tri,
    missing.inLogic,
    missing.possible,
    [
      ...new Set(
        missing.doubts.map((doubt) =>
          doubt.kind === "keys" ? `${doubt.kind}:${doubt.key}` : doubt.kind,
        ),
      ),
    ].sort(),
  ]);

/**
 * Groups checks by what they are missing, from the run's analysis: those
 * out of logic first, then those only maybe, each in the order given, a
 * group's checks shortened by compactSpots. A check the analysis has
 * nothing on (it is in logic) is left out. Pure: nothing is solved here.
 * @param spots - The checks to look at, with the name to say them by
 */
export const groupMissing = (
  spots: readonly { id: string; label: string }[],
  analysis: RunAnalysis,
): MissingGroup[] => {
  const groups = new Map<string, { labels: string[]; missing: Missing }>();
  for (const { id, label } of spots) {
    const missing = analysis.missing.get(id);
    if (missing === undefined) continue;
    const key = sameThing(missing);
    const group = groups.get(key) ?? { labels: [], missing };
    group.labels.push(label);
    groups.set(key, group);
  }
  return [...groups]
    .map(([key, { labels, missing }]) => ({
      key,
      missing,
      spots: compactSpots(labels),
    }))
    .sort(
      (a, b) =>
        Number(a.missing.tri === "maybe") - Number(b.missing.tri === "maybe"),
    );
};

/**
 * What a dungeon's checks left are missing, grouped: every check not done
 * and not in logic, and the boss. Castle Tower and Ganon's Tower have no
 * boss check, so theirs is the prize's rule, said "Boss".
 * @param checks - The dungeon's checks as shown, with their name in it
 * @param boss - What its boss shows; undefined for a dungeon without one
 */
export const dungeonMissing = (
  checks: readonly { id: string; label: string; state: MarkerState }[],
  dungeon: DungeonId,
  boss: MarkerState | undefined,
  analysis: RunAnalysis,
): MissingGroup[] => {
  const beaten = boss === "opened";
  const spots = checks.filter(
    ({ id, state }) => state !== "opened" && !(beaten && id.endsWith("/boss")),
  );
  if (
    boss !== undefined &&
    !beaten &&
    !checks.some(({ id }) => id.endsWith("/boss"))
  ) {
    spots.push({
      id: prizeOf(dungeon, analysis.solution.settings),
      label: "Boss",
      state: boss,
    });
  }
  return groupMissing(spots, analysis);
};

/**
 * Works out, for one solution of the run, what every location not in logic
 * is missing and why one is only possible, and what the go mode is missing.
 * About a millisecond for the whole world, a few more the first time a
 * world's untracked items are placed: call it off a click's path.
 * @param solution - The run solved (solutionOf)
 * @param run - The run's settings, whose goal says the go mode
 */
export const analyzeRun = (
  solution: Solution,
  run: RunSettings,
): RunAnalysis => {
  const { keyed, settings, tris } = solution;
  // Nothing to say of a check under logic the pack does not model
  if (!solution.modelled) return { missing: new Map(), solution };
  if (solution.crossed !== undefined) return analyzeCrossed(solution, run);
  const fill = fillerOf(settings);
  const state = withUntracked(fill, keyed.state);
  const settingsOptions = optionsOf(settings);
  const analysis = analyze(fill.world, state, settingsOptions);
  const allKeys = solve(fill.world, state);
  const missing = new Map<string, Missing>();
  for (const [id, tri] of Object.entries(tris)) {
    if (tri === "yes") continue;
    const inLogic = waysOf(analysis.blockers(id, "yes"));
    const possible =
      tri === "no" ? waysOf(analysis.blockers(id, "maybe")) : undefined;
    missing.set(id, {
      doubts: tri === "maybe" ? doubtsOf(id, solution, state, allKeys) : [],
      inLogic,
      possible:
        possible === undefined || sameWays(possible, inLogic)
          ? undefined
          : possible,
      tri,
    });
  }
  const mode = goModeOfRun(run, settings);
  return {
    goMode:
      mode === undefined
        ? undefined
        : waysOf(
            goModeBlockers(fill.world, state, mode, settingsOptions, (s) =>
              s === state ? analysis : analyze(fill.world, s, settingsOptions),
            ),
          ),
    missing,
    solution,
  };
};

/**
 * analyzeRun for a run with shuffled entrances: the same, over the entrance
 * randomizer's world solved for the entrances noted, its facts (an event, a
 * region reached) read through as the items that bring them. It has no key
 * the player does not track (crossedLogic), so a `maybe` is by its rules.
 */
const analyzeCrossed = (solution: Solution, run: RunSettings): RunAnalysis => {
  const { crossed, settings, tris } = solution;
  if (crossed === undefined) return { missing: new Map(), solution };
  const settingsOptions = optionsOf(settings);
  const analysis = crossed.solver.analyze(
    crossed,
    crossed.state,
    settingsOptions,
  );
  // A fact's own location is no check
  const facts = new Set(crossed.world.facts.map(({ location }) => location));
  // The world solved with everything held
  const all = crossed.solver.everything(crossed, settings);
  const door = { door: true, sets: [], truncated: false } as const;
  const missing = new Map<string, Missing>();
  for (const [id, tri] of Object.entries(tris)) {
    if (tri === "yes" || facts.has(id)) continue;
    // Out of reach with everything held: no item brings it, a door does
    const behind = all.location(id) === "no";
    const inLogic = behind ? door : waysOf(analysis.blockers(id, "yes"));
    const possible =
      tri !== "no"
        ? undefined
        : behind
          ? door
          : waysOf(analysis.blockers(id, "maybe"));
    missing.set(id, {
      doubts:
        tri === "maybe"
          ? rulesDoubts(crossed.world.compiled, crossed.state, id)
          : [],
      inLogic,
      possible:
        possible === undefined || sameWays(possible, inLogic)
          ? undefined
          : possible,
      tri,
    });
  }
  const mode = goModeOfRun(run, settings);
  return {
    goMode:
      mode === undefined
        ? undefined
        : mode.steps.some(({ location }) => all.location(location) === "no")
          ? door
          : waysOf(
              goModeBlockers(
                crossed.world.compiled,
                crossed.state,
                mode,
                settingsOptions,
                (s) =>
                  s === crossed.state
                    ? analysis
                    : crossed.solver.analyze(crossed, s, settingsOptions),
              ),
            ),
    missing,
    solution,
  };
};

/**
 * The run's go mode, from the pack's goal; none for a triforce hunt, which
 * the pack reads as Ganon though its end is the pieces it does not count.
 */
const goModeOfRun = (run: RunSettings, settings: AlttprSettings) =>
  run.goal === "triforce-hunt" ? undefined : goModeOf(settings);

let lastStatus: { solution: Solution; status?: GoModeStatus } | undefined;

/**
 * Where the run stands against its go mode: each step in the key model.
 * Undefined when its goal has none (all dungeons, triforce hunt). Memoized
 * on the solution: a step past the first, solved with what it gives, costs
 * a solve only once the first is possible.
 */
export const goModeStatusOf = (inputs: Inputs): GoModeStatus | undefined => {
  const solution = solutionOf(inputs);
  if (lastStatus?.solution === solution) return lastStatus.status;
  const mode = goModeOfRun(inputs.settings, solution.settings);
  // A run whose logic the pack does not model has no go mode to speak of;
  // one with shuffled entrances takes the entrance randomizer's world
  const { crossed } = solution;
  const status =
    mode === undefined || !solution.modelled
      ? undefined
      : crossed !== undefined
        ? crossed.solver.goMode(crossed, mode)
        : goModeStatus(
            fillerOf(solution.settings),
            solution.keyed.state,
            mode,
            solution.keyed,
          );
  lastStatus = { solution, status };
  return status;
};
