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
  type Analysis,
  type AnalyzeOptions,
  analyze,
  type CompiledWorld,
  type Expr,
  explain,
  itemValue,
  parse,
  type Rules,
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
  everything,
  GATE_OF_ITEM,
  type GoMode,
  type GoModeStatus,
  goModeBlockers,
  goModeOf,
  goModeStatus,
  goModeStatusBy,
  huntGoModeOf,
  type MarginGateId,
  marginFiller,
  TRICKS,
  TRIFORCE_HUNT,
  type TrickId,
  trickFiller,
  UNKNOWN_COUNTS,
  type UntrackedItem,
  untrackedItems,
  withUntracked,
} from "@alltp/pack-alttpr";
import { isHunt, PIECES_ITEM } from "@/games/alttpr/data/items";
import type { RunSettings } from "@/games/alttpr/data/presets";
import {
  HEART_POWER,
  sameWays,
  type Ways,
  waysOf,
} from "@/games/alttpr/logic/needs";
import { RECORDED_LEVELS } from "@/games/alttpr/logic/packItems";
import { KEY_DUNGEONS, SMALL_KEYS_MAX } from "@/games/alttpr/logic/settings";
import {
  fillerOf,
  type Inputs,
  locationName,
  type MarkerState,
  marginOf,
  ownWorldOf,
  prizeOf,
  type Solution,
  solutionOf,
  type TrickSolution,
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
  | { readonly kind: "placement" }
  /**
   * A rule asks for hearts and the hearts are not set: `hearts` on screen,
   * the 3 Link starts with among them; `basic` when it is the basic item
   * placement's dungeon gate (upstream's hasHealth).
   */
  | {
      readonly kind: "hearts";
      readonly hearts: number;
      readonly basic: boolean;
    }
  /** A rule takes the escape's ten bombs, which no cell records. */
  | { readonly kind: "bombs" }
  /** A rule takes the flute activated, which Race Mode does not read. */
  | { readonly kind: "flute" };

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
  /**
   * The tricks the player knows that open it, for one out of logic that
   * they open: each way a set of tricks (fewest first), the pack's tricks
   * world asked what brings it in logic from the trick items alone.
   */
  readonly tricks?: readonly (readonly TrickId[])[];
  /**
   * For one out of logic by basic placement's safety margins alone (the
   * pack's margin world opens it): doable now, `inLogic` saying what the
   * seed waits for.
   */
  readonly margin?: Margin;
};

/** What a check outside basic placement's safety margins tells. */
export type Margin = {
  /**
   * The margins that hold it back, the fewest that open it: a dungeon's
   * way in, a boss's weapon, Ganon's (the pack's `MARGIN_GATES`). Empty
   * when more than three would.
   */
  readonly gates: readonly MarginGateId[];
  /** Link's hearts on screen, when a way asks for hearts. */
  readonly hearts?: number;
};

/** Everything worked out for one solution of the run. */
export type RunAnalysis = {
  /** The solution it was worked out for: stale once the run moves on. */
  readonly solution: Solution;
  /** Every location of the world not in logic. */
  readonly missing: ReadonlyMap<string, Missing>;
  /** What the run's go mode is missing, if its goal has one. */
  readonly goMode?: GoModeLeft;
  /**
   * The tricks it was worked out with (`TrickSolution.techniques`), by
   * identity: another list, or none, and it is stale, as for another run.
   */
  readonly tricks?: readonly TrickId[];
};

/**
 * What the go mode is missing, crystals aside: the player counts the
 * crystals on the board, so the ways are asked with every crystal held, and
 * three items are three items, not two and the crystals.
 */
export type GoModeLeft =
  /**
   * The ways in items, fewest first; none when no three items bring it
   * (everything held does).
   */
  | { readonly kind: "items"; readonly ways: Ways }
  /** Nothing to get but crystals. */
  | { readonly kind: "crystals" }
  /**
   * Nothing to get: in logic with every key the player does not track held.
   * Short of go mode, a dungeon key may sit where the player cannot reach
   * yet (the key model's `maybe`).
   */
  | { readonly kind: "nothing" }
  /**
   * No item brings it, everything held: it hangs on a setting not known yet
   * or on where an item sits, which no list of items can settle.
   */
  | { readonly kind: "unknown" }
  /** Behind a door not noted yet, in a run with shuffled entrances. */
  | { readonly kind: "door" };

/** Whether a list of ways is the one empty set: nothing to get. */
export const isThere = (ways: Ways): boolean =>
  ways.sets.length === 1 && ways.sets[0]?.length === 0;

/** `state` with every crystal held: the members of the rules' crystal group. */
const withCrystals = (rules: Rules, state: State): State => ({
  ...state,
  ...Object.fromEntries(
    (rules.groups.get("crystal") ?? []).map((crystal) => [crystal, 1]),
  ),
});

/**
 * What the go mode is missing, from the ways to it with every crystal held.
 * @param asIs - The ways to it as the run stands, asked only when nothing
 *   is left with the crystals: are they what it waits on, or a key?
 * @param anyItems - Whether everything held puts it in logic, asked only
 *   when no three items do
 */
export const goModeLeftOf = (
  left: Ways,
  asIs: () => Ways,
  anyItems: () => boolean,
): GoModeLeft => {
  if (isThere(left)) return { kind: isThere(asIs()) ? "nothing" : "crystals" };
  if (left.sets.length === 0 && !anyItems()) return { kind: "unknown" };
  // waysOf may fold a set's hearts into one need: fewest needs first again
  const sets = [...left.sets].sort((a, b) => a.length - b.length);
  return { kind: "items", ways: { ...left, sets } };
};

const everythingGoMode = new WeakMap<AlttprSettings, boolean>();

/** Whether a run's go mode is in logic with everything held. */
const inLogicWithEverything = (
  settings: AlttprSettings,
  mode: GoMode,
): boolean => {
  let found = everythingGoMode.get(settings);
  if (found === undefined) {
    const { world } = fillerOf(settings);
    found =
      goModeStatusBy((s) => solve(world, s), everything(settings), mode).tri ===
      "yes";
    everythingGoMode.set(settings, found);
  }
  return found;
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

/**
 * The ways the tricks known open each location they open: the pack's
 * tricks world, asked what brings the location in logic when the only items
 * to get are the tricks' (every key held, as for `analyze`). A location the
 * tricks leave closed has no entry; none is asked for one in logic or one
 * that only maybe is, which the markers do not mark.
 * @param missing - What each location not in logic is missing
 */
const trickWays = (
  solution: Solution,
  trick: TrickSolution,
  missing: ReadonlyMap<string, Missing>,
): Map<string, readonly (readonly TrickId[])[]> => {
  const fill = trickFiller(solution.settings);
  const known = new Map(trick.techniques.map((id) => [TRICKS[id].item, id]));
  const analysis = analyze(
    fill.world,
    withUntracked(fill, solution.keyed.state),
    {
      acquirable: (item) => known.has(item),
      maxAtoms: MAX_ATOMS,
      maxLevel: () => 1,
    },
  );
  const ways = new Map<string, readonly (readonly TrickId[])[]>();
  for (const [id, { tri }] of missing) {
    const opened = trick.tris[id];
    if (tri !== "no" || opened === undefined || opened === "no") continue;
    const sets = analysis
      .blockers(id, opened === "yes" ? "yes" : "maybe")
      .sets.map((set) =>
        set.flatMap((atom) => {
          const found = "item" in atom ? known.get(atom.item) : undefined;
          return found === undefined ? [] : [found];
        }),
      )
      .filter((set) => set.length > 0);
    if (sets.length > 0) ways.set(id, sets);
  }
  return ways;
};

/**
 * The hearts on screen a state holds: the 3 Link starts with are in it, as
 * every world is given them (the pack's PRE_COLLECTED_STATE).
 */
const heartsHeld = (state: State): number =>
  Object.entries(HEART_POWER).reduce(
    (sum, [item, power]) => sum + power * itemValue(state, item),
    0,
  );

/** What a check out of logic by the margins alone says. */
const marginOfWays = (
  gates: readonly MarginGateId[],
  ways: Ways,
  state: State,
): Margin =>
  ways.sets.some((set) => set.some(({ key }) => key.startsWith("hearts>=")))
    ? { gates, hearts: heartsHeld(state) }
    : { gates };

/**
 * The margins that hold each location back that the margin world opens: the
 * pack's margin world, asked what brings the location in logic when the
 * only items to get are the margins (every key held, as for `analyze`), the
 * fewest first. A location the margins leave closed has no entry.
 */
const marginGates = (
  solution: Solution,
  opened: Readonly<Record<string, Tri>>,
  ids: readonly string[],
): Map<string, readonly MarginGateId[]> => {
  const fill = marginFiller(solution.settings);
  const analysis = analyze(
    fill.world,
    withUntracked(fill, solution.keyed.state),
    {
      acquirable: (item) => GATE_OF_ITEM.has(item),
      maxAtoms: MAX_ATOMS,
      maxLevel: () => 1,
    },
  );
  const gates = new Map<string, readonly MarginGateId[]>();
  for (const id of ids) {
    const tri = opened[id] ?? "no";
    if (tri === "no") continue;
    const [fewest] = analysis
      .blockers(id, tri === "yes" ? "yes" : "maybe")
      .sets.map((set) =>
        set.flatMap((atom) => {
          const gate = "item" in atom ? GATE_OF_ITEM.get(atom.item) : undefined;
          return gate === undefined ? [] : [gate];
        }),
      )
      .filter((set) => set.length > 0);
    gates.set(id, fewest ?? []);
  }
  return gates;
};

/** The medallion rules, by the dungeon whose pad they read. */
const PADS: Readonly<Record<string, DungeonId>> = {
  hasMireMedallion: "misery-mire",
  hasTurtleRockMedallion: "turtle-rock",
};

/** The facts of the counts the tracker may not know, by fact. */
const UNKNOWN_FACTS: ReadonlyMap<string, string> = new Map(
  Object.entries(UNKNOWN_COUNTS).map(([count, { fact }]) => [fact, count]),
);

/** The count a `fact & maybe` branch stands for, if it is one. */
const unknownBranch = (expr: Expr): string | undefined => {
  if (expr.type !== "and") return undefined;
  const fact = expr.args.find((arg) => arg.type === "item");
  return fact?.type === "item" ? UNKNOWN_FACTS.get(fact.name) : undefined;
};

/**
 * The hearts on screen a rule of hearts alone asks for, the fewest any of
 * its ways does (hasHealth7: 7, Link's 3 starting hearts among them);
 * undefined for a rule that reads anything else.
 */
const heartsAsked = (expr: Expr): number | undefined => {
  if (expr.type === "item") {
    const power = HEART_POWER[expr.name];
    return power === undefined || typeof expr.min !== "number"
      ? undefined
      : expr.min * power;
  }
  if (expr.type !== "and" && expr.type !== "or") return undefined;
  const parts = expr.args
    .filter((arg) => unknownBranch(arg) === undefined)
    .map(heartsAsked);
  if (parts.length === 0 || parts.some((part) => part === undefined)) {
    return undefined;
  }
  const values = parts as number[];
  return expr.type === "and"
    ? values.reduce((sum, value) => sum + value, 0)
    : Math.min(...values);
};

/**
 * The `maybe`s that make a traced requirement `maybe`: under every node at
 * `maybe`, the arguments at `maybe` too, down to a `maybe` constant (where
 * an item sits), a medallion pad's rule, a rule of hearts not set or a
 * count the tracker does not know.
 */
const doubtsIn = (node: TraceNode, found: Set<string>, rules: Rules) => {
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
  const body = expr.type === "helper" ? rules.helpers.get(expr.name) : expr;
  const hearts = body === undefined ? undefined : heartsAsked(body);
  if (hearts !== undefined && hearts > 0) {
    // upstream's hasHealth is the basic placement's gate, and only that
    const basic = expr.type === "helper" && expr.name.startsWith("hasHealth");
    found.add(`hearts:${hearts}:${basic}`);
    return;
  }
  const count = unknownBranch(expr);
  if (count !== undefined) {
    found.add(`unknown:${count}`);
    return;
  }
  for (const child of node.children) doubtsIn(child, found, rules);
};

/** A doubt, from its key in doubtsIn's set. */
const doubtOf = (key: string): Doubt => {
  const [kind = "", what = "", basic] = key.split(":");
  if (kind === "medallion") {
    return { dungeon: nameOf(what), kind: "medallion" };
  }
  if (kind === "hearts") {
    return {
      basic: basic === "true",
      hearts: Number(what),
      kind: "hearts",
    };
  }
  if (kind === "unknown") {
    if (what === "bombs") return { kind: "bombs" };
    if (what === "flute") return { kind: "flute" };
    return { basic: false, hearts: 0, kind: "hearts" };
  }
  return { kind: "placement" };
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
  doubtsIn(requirement, found, world.rules);
  for (const step of path) {
    if (step.exit?.value !== "maybe") continue;
    doubtsIn(
      trace(parse(step.exit.req), state, world.rules),
      found,
      world.rules,
    );
  }
  return [...found].sort().map(doubtOf);
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
    missing.tricks,
    missing.margin,
    [
      ...new Set(
        missing.doubts.map((doubt) => {
          if (doubt.kind === "keys") return `${doubt.kind}:${doubt.key}`;
          return doubt.kind === "hearts"
            ? `${doubt.kind}:${doubt.hearts}`
            : doubt.kind;
        }),
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
 * @param tricks - The run solved with the tricks the player knows
 *   (trickSolutionOf), to say which of them open each check they open
 */
export const analyzeRun = (
  solution: Solution,
  run: RunSettings,
  tricks?: TrickSolution,
): RunAnalysis => {
  const { keyed, settings, tris } = solution;
  // Nothing to say of a check under logic the pack does not model
  if (!solution.modelled) return { missing: new Map(), solution };
  if (ownWorldOf(solution) !== undefined) return analyzeOwnWorld(solution, run);
  const fill = fillerOf(settings);
  const state = withUntracked(fill, keyed.state);
  const settingsOptions = optionsOf(settings);
  const analysis = analyze(fill.world, state, settingsOptions);
  const allKeys = solve(fill.world, state);
  const missing = new Map<string, Missing>();
  for (const [id, tri] of Object.entries(tris)) {
    if (tri === "yes") continue;
    const inLogic = waysOf(analysis.blockers(id, "yes"), state);
    const possible =
      tri === "no" ? waysOf(analysis.blockers(id, "maybe"), state) : undefined;
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
  const margin = marginOf(solution);
  if (margin !== undefined) {
    const held = [...missing]
      .filter(
        ([id, { tri }]) => tri === "no" && (margin.tris[id] ?? "no") !== "no",
      )
      .map(([id]) => id);
    const gates = marginGates(solution, margin.tris, held);
    for (const id of held) {
      const found = missing.get(id) as Missing;
      missing.set(id, {
        ...found,
        margin: marginOfWays(gates.get(id) ?? [], found.inLogic, keyed.state),
      });
    }
  }
  const mode = goModeOfRun(run, settings);
  if (tricks !== undefined) {
    for (const [id, ways] of trickWays(solution, tricks, missing)) {
      const found = missing.get(id) as Missing;
      missing.set(id, { ...found, tricks: ways });
    }
  }
  return {
    goMode: mode && standardGoMode(solution, mode, state, analysis),
    missing,
    solution,
    tricks: tricks?.techniques,
  };
};

/**
 * What the go mode is missing in a world without shuffled entrances.
 * @param state - The run's state with every untracked key held
 * @param analysis - That state analyzed
 */
const standardGoMode = (
  { settings }: Solution,
  mode: GoMode,
  state: State,
  analysis: Analysis,
): GoModeLeft => {
  const { world } = fillerOf(settings);
  const opts = optionsOf(settings);
  const crystals = withCrystals(world.rules, state);
  return goModeLeftOf(
    waysOf(goModeBlockers(world, crystals, mode, opts), crystals),
    () =>
      waysOf(
        goModeBlockers(world, state, mode, opts, (s) =>
          s === state ? analysis : analyze(world, s, opts),
        ),
        state,
      ),
    () => inLogicWithEverything(settings, mode),
  );
};

/**
 * analyzeRun for a run of a world of its own (ownWorldOf): the same, over
 * the entrance randomizer's world solved for the entrances noted, or the
 * Door Randomizer's, its facts (an event, a region reached) read through as
 * the items that bring them. A `maybe` is by its rules: the crossed world
 * has no key the player does not track (crossedLogic), DR's reads a key
 * kept in its dungeon as maybe below its number.
 */
const analyzeOwnWorld = (solution: Solution, run: RunSettings): RunAnalysis => {
  const { settings, tris } = solution;
  const crossed = ownWorldOf(solution);
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
    const inLogic = behind
      ? door
      : waysOf(analysis.blockers(id, "yes"), crossed.state);
    const possible =
      tri !== "no"
        ? undefined
        : behind
          ? door
          : waysOf(analysis.blockers(id, "maybe"), crossed.state);
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
  const goMode = (found: GoMode): GoModeLeft => {
    const steps = found.steps.map(({ location }) => all.location(location));
    if (steps.includes("no")) return { kind: "door" };
    const { compiled } = crossed.world;
    const blockers = (state: State) =>
      waysOf(
        goModeBlockers(compiled, state, found, settingsOptions, (s) =>
          s === crossed.state
            ? analysis
            : crossed.solver.analyze(crossed, s, settingsOptions),
        ),
        state,
      );
    return goModeLeftOf(
      blockers(withCrystals(compiled.rules, crossed.state)),
      () => blockers(crossed.state),
      () => steps.every((tri) => tri === "yes"),
    );
  };
  return {
    goMode: mode && goMode(mode),
    missing,
    solution,
  };
};

/**
 * The Triforce pieces found and the pieces the goal asks for, from the
 * board's two counts.
 * @param items - The run's items
 */
export const piecesOf = (
  items: Readonly<Record<string, number | boolean>>,
): [found: number, asked: number] => [
  Number(items[PIECES_ITEM] ?? 0),
  Number(items.goalpieces ?? TRIFORCE_HUNT.required),
];

/**
 * The run's go mode, from the pack's goal; none for a triforce hunt, which
 * the pack reads as Ganon though its end is the pieces it does not count: a
 * hunt's is the count (`goModeStatusOf`).
 */
const goModeOfRun = (run: RunSettings, settings: AlttprSettings) =>
  run.goal === "triforce-hunt" ? undefined : goModeOf(settings);

let lastStatus: { solution: Solution; status?: GoModeStatus } | undefined;

/**
 * Where the run stands against its go mode: each step in the key model.
 * Undefined when its goal has none (all dungeons). A triforce hunt's is the
 * pieces found against the pieces asked for, with no step. Memoized
 * on the solution: a step past the first, solved with what it gives, costs
 * a solve only once the first is possible.
 */
export const goModeStatusOf = (inputs: Inputs): GoModeStatus | undefined => {
  // A triforce hunt is won by the count: no rule of the pack to solve
  if (isHunt(inputs.settings)) {
    return { steps: [], tri: huntGoModeOf(...piecesOf(inputs.items)) };
  }
  const solution = solutionOf(inputs);
  if (lastStatus?.solution === solution) return lastStatus.status;
  const mode = goModeOfRun(inputs.settings, solution.settings);
  // A run whose logic the pack does not model has no go mode to speak of;
  // one of a world of its own (shuffled entrances, DR's) takes that world
  const crossed = ownWorldOf(solution);
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

let lastMargin: { solution: Solution; margin: boolean } | undefined;

/**
 * Whether the go mode, not in logic, is reached but for basic placement's
 * safety margin: every step to the goal in logic, or maybe, in the pack's
 * margin world. Memoized on the solution; false but in a basic placement
 * run (`marginOf`), and when the go mode is in logic or maybe already.
 */
export const goModeMarginOf = (inputs: Inputs): boolean => {
  if (isHunt(inputs.settings)) return false;
  const status = goModeStatusOf(inputs);
  if (status?.tri !== "no") return false;
  const solution = solutionOf(inputs);
  if (lastMargin?.solution === solution) return lastMargin.margin;
  const margin = marginOf(solution);
  const mode = goModeOfRun(inputs.settings, solution.settings);
  const found =
    margin !== undefined &&
    mode !== undefined &&
    goModeStatus(
      marginFiller(solution.settings),
      margin.keyed.state,
      mode,
      margin.keyed,
    ).tri !== "no";
  lastMargin = { margin: found, solution };
  return found;
};
