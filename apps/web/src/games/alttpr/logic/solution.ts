// The run, solved by the alltpr pack: what each location of the world shows
// for what the player recorded, and the hooks the map reads it through.
//
// There is no second store. The solution is derived from the game store by
// a selector memoized on the four slices it reads (items, medallions, small
// keys, settings), so it is computed once per change of the run, by the
// first component to ask, and is never out of step with the store: a click
// on a map marker, which only checks locations, solves nothing. Each hook
// returns a string, which Zustand compares by value, so a change re-renders
// only the markers whose status it changed.
import type { State, Tri } from "@alltp/engine";
import {
  type AlttprSettings,
  bossLocation,
  compile,
  type DrLocation,
  type DungeonId,
  dungeon,
  dungeonItemCount,
  dungeonLocations,
  dungeonRegions,
  dungeonStatus,
  EVENT_CHECKS,
  type Filler,
  filler,
  INVERTED_MARKERS,
  type KeyedSolution,
  LEGACY_DUNGEONS,
  MARGIN_STATE,
  type MapMarker,
  type MarkerStatus,
  type Medallion,
  marginFiller,
  markerStatus,
  OPEN,
  regionModules,
  STANDARD,
  settingsFromUpstream,
  solveWithKeys,
  type TrackerInput,
  type TrickId,
  toState,
  trickFiller,
  trickState,
  UNKNOWN_COUNTS,
} from "@alltp/pack-alttpr";
import type { OwrNotes } from "@alltp/pack-alttpr/door-world";
import { BOSS_STATES, DUNGEON_INDICES } from "@/games/alttpr/constants";
import {
  doorLocationsOf,
  doorPoolSettingsOf,
  doorShuffleOf,
  doorShuffleSettingsOf,
  isBagRun,
  owrNotesOf,
  type Randomizer,
} from "@/games/alttpr/data/doorRando";
import {
  BAG_BOMBS,
  items as freshItems,
  type ItemState,
} from "@/games/alttpr/data/items";
import {
  crossedLogic,
  doorLogic,
  isHidden,
  logicModelled,
  portedShuffleOf,
  type RunSettings,
} from "@/games/alttpr/data/presets";
import type { TrickPrefs } from "@/games/alttpr/data/tricks";
import type { CrossedRun, CrossedSolver } from "@/games/alttpr/logic/crossed";
import type { DoorRun, DoorSolver } from "@/games/alttpr/logic/doorWorld";
import type {
  OwnWorldRun,
  OwnWorldSolver,
} from "@/games/alttpr/logic/ownWorld";
import { packReading } from "@/games/alttpr/logic/packItems";
import {
  drSettingsOf,
  glitchBounds,
  KEY_DUNGEONS,
  packSettings,
  worldOf,
} from "@/games/alttpr/logic/settings";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import type {
  DoorNotes,
  OverworldNotes,
  Prefs,
  Progress,
} from "@/games/alttpr/stores/persistence";

/**
 * What a location shows while it is not checked: the pack's markerStatus,
 * seen, for one out of logic that the player can already see (the Book
 * reads the Pedestal, a ledge item shows from below), trick, for one out
 * of logic that a trick the player knows would open (`trickSolutionOf`),
 * or margin, for one out of logic by basic placement's safety margin alone
 * (`marginSolutionOf`): doable, the seed only counting on it later.
 */
export type LocationStatus = MarkerStatus | "margin" | "seen" | "trick";

/** What a marker shows: what is left in logic, or done. */
export type MarkerState = LocationStatus | "opened";

/**
 * What locations left show, from their tris, what can be seen of them
 * (`visible`, never below the tri), their tris with the player's tricks and
 * without basic placement's safety margin: available > possible > margin >
 * trick > seen > unavailable. markerStatus says the first two; failing
 * those, margin when dropping the margin would open one of them (nothing to
 * learn: only hearts or gear the seed waits for), trick when a trick would
 * (a technique to know), else seen when one of them can be seen, a `maybe`
 * sight included, as a `maybe` tri is possible.
 * @param tris - The locations' tris
 * @param visibles - What can be seen of each, in the same order
 * @param tricks - Their tris with the tricks known, if any are
 * @param margin - Their tris without the margin, in a basic placement run
 */
export const locationStatus = (
  tris: readonly Tri[],
  visibles: readonly Tri[],
  tricks?: readonly Tri[],
  margin?: readonly Tri[],
): LocationStatus => {
  const status = markerStatus(tris);
  if (status !== "unavailable") return status;
  if (margin?.some((opened) => opened !== "no")) return "margin";
  if (tricks?.some((opened) => opened !== "no")) return "trick";
  return visibles.some((seen) => seen !== "no") ? "seen" : status;
};

/**
 * The slices of the run the solution reads; of what is checked, only the
 * events (EVENT_CHECKS), so checking any other location solves nothing; the
 * entrances noted, in a run whose logic reads them (crossedLogic). The
 * tricks are a preference `solutionOf` never reads: only `trickSolutionOf`
 * does, for the markers.
 */
export type Inputs = Pick<
  Progress,
  "items" | "medallions" | "settings" | "smallKeys"
> &
  Partial<Pick<Progress, "checked" | "entrances" | "doors" | "overworld">> &
  Partial<Pick<Prefs, "tricks">>;

/** The slices a marker's status reads: the solution's, and what is checked. */
export type MarkerInputs = Inputs & Pick<Progress, "checked">;

const EVENT_IDS = Object.keys(EVENT_CHECKS);

/** The events checked, as one comparable value: "bomb-merchant" or "". */
const eventsOf = ({ checked }: Inputs): string =>
  EVENT_IDS.filter((id) => checked?.[id] === true).join(",");

/** The medallion each value of the store's `medallions` names. */
const PAD_VALUES: readonly (Medallion | "unknown")[] = [
  "unknown",
  "bombos",
  "ether",
  "quake",
];

/** What a pad wants, from the store's value for it. */
const padOf = (value: number | undefined): Medallion | "unknown" =>
  PAD_VALUES[value ?? 0] ?? "unknown";

/**
 * What the player recorded, as the pack's TrackerInput: the items, bosses
 * beaten and prizes through the app's one table (packReading), the
 * medallion pads (Misery Mire's slot 8, Turtle Rock's 9), the small keys
 * by grid dungeon, the Triforce pieces found and asked for, and the events
 * checked on the map.
 */
export const trackerInput = (inputs: Inputs): TrackerInput => {
  const { items, medallions, smallKeys } = inputs;
  const events = eventsOf(inputs);
  return {
    ...packReading(items),
    // The pieces a ganonhunt's Ganon wants, as the board counts them
    goalPieces: {
      found: Number(items.triforce ?? 0),
      required: Number(items.goalpieces ?? 0),
    },
    ...(events === ""
      ? {}
      : {
          checked: Object.fromEntries(
            events.split(",").map((id) => [id, true]),
          ),
        }),
    keys: Object.fromEntries(
      KEY_DUNGEONS.map((id, index) => [id, smallKeys[index] ?? 0]),
    ),
    medallions: {
      mire: padOf(medallions[DUNGEON_INDICES.MISERY_MIRE]),
      turtleRock: padOf(medallions[DUNGEON_INDICES.TURTLE_ROCK]),
    },
  };
};

const fillers = new WeakMap<AlttprSettings, Filler>();

/** The run's world, compiled once per settings, with its key model. */
export const fillerOf = (settings: AlttprSettings): Filler => {
  let found = fillers.get(settings);
  if (found === undefined) {
    found = filler(compile(settings), settings);
    fillers.set(settings, found);
  }
  return found;
};

/** A run, solved. */
export interface Solution {
  /** The pack's settings it was solved under. */
  readonly settings: AlttprSettings;
  /**
   * Whether the pack models the run's logic (`logicModelled`). When it does
   * not, every location is maybe: the Open logic it was solved under would
   * be wrong for it.
   */
  readonly modelled: boolean;
  /** Every location of the run's world, as the tracker shows it. */
  readonly tris: Readonly<Record<string, Tri>>;
  /**
   * What can be seen of every location: the engine's visible channel, the
   * tri itself for a location that cannot be seen from afar.
   */
  readonly visibles: Readonly<Record<string, Tri>>;
  /**
   * The key model's view of the state: the keys surely in hand, which
   * dungeons' keys a location reads, whether each dungeon is safe for keys.
   */
  readonly keyed: KeyedSolution;
  /**
   * A run with shuffled entrances (crossedLogic): the entrance randomizer's
   * world solved for the entrances noted, its keys read by its own key
   * model, whose tris the tracker shows. `keyed` above is then vt's world's,
   * which nothing of the run reads.
   */
  readonly crossed?: CrossedRun & {
    readonly solver: CrossedSolver;
    readonly entrances: Readonly<Record<string, string>>;
  };
  /**
   * A Door Randomizer run DR's own world holds (doorLogic): that world
   * solved for the run's settings, whose tris the tracker shows.
   */
  readonly door?: DoorRun & { readonly solver: DoorSolver };
  /**
   * A run whose glitches are not known yet (Mystery): solved again in the
   * most permissive logic (`glitchBounds`), `settings` and `keyed` being
   * the least. Its tris are those two met (`meetTri`).
   */
  readonly upper?: {
    readonly settings: AlttprSettings;
    readonly keyed: KeyedSolution;
  };
}

/**
 * What holds between two bounds of a location: `yes` once the least
 * permissive logic says so, `no` once the most permissive does, else
 * maybe. Every logic in between reads as one of them would.
 */
export const meetTri = (lower: Tri, upper: Tri): Tri =>
  lower === "yes" ? "yes" : upper === "no" ? "no" : "maybe";

/** Two bounds' tris met, location by location. */
const meetTris = (
  lower: Readonly<Record<string, Tri>>,
  upper: Readonly<Record<string, Tri>>,
): Readonly<Record<string, Tri>> =>
  Object.fromEntries(
    Object.entries(lower).map(([id, low]) => [
      id,
      meetTri(low, upper[id] ?? "yes"),
    ]),
  );

/**
 * The world of its own a run is solved in, with its solver: the entrance
 * randomizer's (`crossed`) or the Door Randomizer's (`door`); undefined for
 * a run of vt's world.
 */
export const ownWorldOf = (
  solution: Solution,
): (OwnWorldRun & { readonly solver: OwnWorldSolver }) | undefined =>
  solution.crossed ?? solution.door;

/** The solver of runs with shuffled entrances, once its chunk is loaded. */
let crossed: CrossedSolver | undefined;

/** Whether the solver of runs with shuffled entrances is loaded. */
export const crossedSolverLoaded = (): boolean => crossed !== undefined;

/**
 * Takes up the solver of runs with shuffled entrances (useCrossedLogic): the
 * store is set again as it was, so every selector solves the run anew.
 */
export const setCrossedSolver = (solver: CrossedSolver): void => {
  crossed = solver;
  useGameStore.setState({});
};

/**
 * The solvers of Door Randomizer runs, once their chunk is loaded: DR's
 * own world, and the Overworld Randomizer's, built on the fork's data.
 */
const doorSolvers: Partial<Record<Randomizer, DoorSolver>> = {};

/** Which solver a run is solved by: its generator's. */
const doorFlavorOf = (run: RunSettings): Randomizer =>
  run.randomizer === "owr" ? "owr" : "dr";

/** Whether the solver of a run's generator (DR's by default) is loaded. */
export const doorSolverLoaded = (randomizer: Randomizer = "dr"): boolean =>
  doorSolvers[randomizer] !== undefined;

/**
 * Takes up the solver of a generator's runs (useDoorLogic): the store is
 * set again as it was, so every selector solves the run anew.
 */
export const setDoorSolver = (
  solver: DoorSolver,
  randomizer: Randomizer = "dr",
): void => {
  doorSolvers[randomizer] = solver;
  useGameStore.setState({});
};

/**
 * The state of a Door Randomizer run: the pack's of what the player
 * recorded, and every dungeon's small keys as given, whether they are wild
 * or not and beyond vt's pools (DR's dungeons hold their drops' keys too,
 * Eastern Palace's among them): DR's world reads a key door below its
 * number as maybe while the keys stay in their dungeons, never no. The
 * Triforce pieces a hunt asks, once found (the pack's `ganonhuntPieces`),
 * are one piece, all that the world's `treasureHunt` of 1 asks
 * (drSettingsOf). A run known to have the bomb bag tells it found by its
 * bombs (BAG_BOMBS: none until a bag): the +10 upgrade can_use_bombs asks
 * (dr:BaseClasses.py:1209, owr:BaseClasses.py:1367) is then known, held
 * once the capacity reaches 10; with the bag not known it stays unknown
 * (the pack's `bombUpgradeUnknown`), as a run's 10 bombs to start with
 * would then say nothing.
 * @param recorded - The pack's state of what the player recorded
 * @param keys - The small keys held, by dungeon
 * @param bombs - A bomb-bag run's bombs capacity; none when not known on
 */
export const doorStateOf = (
  recorded: State,
  keys: Readonly<Partial<Record<DungeonId, number>>>,
  bombs?: number,
): State => {
  const state: Record<string, State[string]> = { ...recorded };
  if (bombs !== undefined) {
    delete state[UNKNOWN_COUNTS.bombUpgrade.fact];
    const bags = Math.floor(Math.min(BAG_BOMBS.top, bombs) / BAG_BOMBS.step);
    if (bags > 0) state.bombUpgrade = bags;
    else delete state.bombUpgrade;
  }
  for (const id of KEY_DUNGEONS) {
    const held = keys[id] ?? 0;
    const item = `key${dungeon(id).code}`;
    if (held > 0) state[item] = held;
    else delete state[item];
  }
  if (recorded.ganonhuntPieces === 1) state.triforcePiece = 1;
  else delete state.triforcePiece;
  return state;
};

/** The small keys recorded, by dungeon. */
const keysOf = (inputs: Inputs): Partial<Record<DungeonId, number>> =>
  Object.fromEntries(
    KEY_DUNGEONS.map((id, index) => [id, inputs.smallKeys[index] ?? 0]),
  );

const added = new WeakMap<readonly DrLocation[], DrLocation[]>();

/**
 * The pots and enemy drops of a DR run, and an OWR run's bonk drops, which
 * DR's world adds to their regions with their rules (key drops are in it
 * already, shop items too): the same list for the same locations, so the
 * world built for it is kept.
 */
export const doorAddedOf = (run: RunSettings): readonly DrLocation[] => {
  const { locations } = doorLocationsOf(run);
  let found = added.get(locations);
  if (found === undefined) {
    found = locations.filter(
      (location) =>
        location.kind === "pot" ||
        location.kind === "enemyDrop" ||
        location.kind === "bonk",
    );
    added.set(locations, found);
  }
  return found;
};

/** No entrance noted yet: one object, so DR's world is built once for it. */
const NO_NOTES: Readonly<Record<string, string>> = {};

/** No door noted yet, likewise. */
const NO_DOORS: DoorNotes = {};

/** Nothing of the overworld noted yet, likewise. */
const NO_OVERWORLD: OverworldNotes = {};

let last:
  | {
      crossed?: CrossedSolver;
      door?: DoorSolver;
      events: string;
      inputs: Inputs;
      overworld?: OwrNotes;
      solution: Solution;
    }
  | undefined;

/**
 * The run solved: the pack's key model over the state of what the player
 * recorded. Memoized on the slices it reads, so every component asking
 * after one change gets the one solution computed for it, and a change to
 * anything else (a checked location but an event, a preference) computes
 * nothing.
 * @param state - The game store's state, or any object with those slices
 */
export const solutionOf = (state: Inputs): Solution => {
  const events = eventsOf(state);
  const door = doorSolvers[doorFlavorOf(state.settings)];
  // The entrances noted, in a run whose world reads them: the entrance
  // randomizer's, or DR's where it shuffled them
  const doorShuffle = doorLogic(state.settings)
    ? doorShuffleOf(state.settings)
    : undefined;
  const entrances =
    crossedLogic(state.settings) || doorShuffle !== undefined
      ? state.entrances
      : undefined;
  // The doors noted, in a DR run whose doors are shuffled
  const doorsShuffled = doorLogic(state.settings)
    ? doorShuffleSettingsOf(state.settings)
    : undefined;
  const doors =
    doorsShuffled === undefined ? undefined : (state.doors ?? NO_DOORS);
  // The overworld noted, in an OWR run whose whirlpools or flute spots move
  const overworld = doorLogic(state.settings)
    ? owrNotesOf(state.settings, state.overworld ?? NO_OVERWORLD)
    : undefined;
  if (
    last !== undefined &&
    last.events === events &&
    last.crossed === crossed &&
    last.door === door &&
    last.inputs.entrances === entrances &&
    last.inputs.doors === doors &&
    last.overworld === overworld &&
    last.inputs.items === state.items &&
    last.inputs.medallions === state.medallions &&
    last.inputs.settings === state.settings &&
    last.inputs.smallKeys === state.smallKeys
  ) {
    return last.solution;
  }
  const settings = packSettings(state.settings);
  const input = trackerInput(state);
  const recorded = toState(input, settings);
  const keyed = solveWithKeys(fillerOf(settings), recorded);
  // Glitches not known yet: the most permissive logic too
  const bounds = glitchBounds(state.settings);
  const upper =
    bounds === undefined
      ? undefined
      : {
          keyed: solveWithKeys(
            fillerOf(bounds.upper),
            toState(input, bounds.upper),
          ),
          settings: bounds.upper,
        };
  // Shuffled entrances: the entrance randomizer's world once its solver is
  // loaded, every check maybe until then. It reads what the player recorded,
  // its own key model the keys it kept in their dungeons: vt's keys surely
  // in hand are those of another world
  const shuffle = portedShuffleOf(state.settings);
  const solved =
    entrances === undefined ||
    crossed === undefined ||
    shuffle === undefined ||
    !crossedLogic(state.settings)
      ? undefined
      : {
          ...crossed.solve(settings, shuffle, entrances, recorded),
          entrances,
          solver: crossed,
        };
  // A Door Randomizer run DR's world holds: that world once its solver is
  // loaded, every check maybe until then
  const doorRun = doorLogic(state.settings);
  const doorSolved =
    !doorRun || door === undefined
      ? undefined
      : {
          ...door.solve(
            drSettingsOf(state.settings),
            doorAddedOf(state.settings),
            doorStateOf(
              recorded,
              keysOf(state),
              isBagRun(state.settings)
                ? Number(state.items.bombcapacity ?? 0)
                : undefined,
            ),
            doorShuffle === undefined
              ? undefined
              : {
                  noted: entrances ?? NO_NOTES,
                  pool: doorPoolSettingsOf(state.settings),
                  shuffle: doorShuffle,
                },
            doorsShuffled === undefined || doors === undefined
              ? undefined
              : { notes: doors, settings: doorsShuffled },
            overworld,
          ),
          solver: door,
        };
  const modelled =
    logicModelled(state.settings) &&
    (!crossedLogic(state.settings) || solved !== undefined) &&
    (!doorRun || doorSolved !== undefined);
  const unknown = (tris: Readonly<Record<string, Tri>>) =>
    Object.fromEntries(Object.keys(tris).map((id) => [id, "maybe" as const]));
  const tris =
    solved?.keyed.locations() ??
    doorSolved?.solution.locations() ??
    (upper === undefined
      ? keyed.locations()
      : meetTris(keyed.locations(), upper.keyed.locations()));
  const visibles =
    solved?.solution.visibles() ??
    doorSolved?.solution.visibles() ??
    (upper === undefined
      ? keyed.solution.visibles()
      : meetTris(keyed.solution.visibles(), upper.keyed.solution.visibles()));
  const solution = {
    ...(solved === undefined ? {} : { crossed: solved }),
    ...(doorSolved === undefined ? {} : { door: doorSolved }),
    ...(upper === undefined ? {} : { upper }),
    keyed,
    modelled,
    settings,
    tris: modelled ? tris : unknown(tris),
    visibles: modelled ? visibles : unknown(visibles),
  };
  last = {
    crossed,
    door,
    events,
    ...(overworld === undefined ? {} : { overworld }),
    inputs: {
      ...(entrances === undefined ? {} : { entrances }),
      ...(doors === undefined ? {} : { doors }),
      items: state.items,
      medallions: state.medallions,
      settings: state.settings,
      smallKeys: state.smallKeys,
    },
    solution,
  };
  return solution;
};

/**
 * Whether the map marks the checks a trick opens: the preference is on and
 * lists a trick, and the run has a tricks world (a crossed run or one in the
 * Door Randomizer's world has none).
 */
export const tricksShown = (state: Inputs): boolean =>
  state.tricks?.enabled === true &&
  state.tricks.techniques.length > 0 &&
  !crossedLogic(state.settings) &&
  !doorLogic(state.settings);

/** A run solved again with the tricks the player knows held. */
export interface TrickSolution {
  /** The tricks it was solved with. */
  readonly techniques: readonly TrickId[];
  /** Every location of the run's world, with those tricks. */
  readonly tris: Readonly<Record<string, Tri>>;
}

let lastTricks:
  | {
      solution: Solution;
      techniques: readonly TrickId[];
      result: TrickSolution;
    }
  | undefined;

/**
 * The run solved in the pack's tricks world, with the tricks the player
 * knows held over the state the real solution is made of (its keys surely in
 * hand included), so what a trick opens is what the real world says but for
 * the trick. Synchronous and memoized on the solution and the list of
 * tricks. Undefined when the preference is off or lists none, when the run's
 * logic is not modelled, and for a run of a world of its own (crossed, the
 * Door Randomizer's), which has no tricks world.
 * @param state - The game store's state, or any object with those slices
 */
export const trickSolutionOf = (state: Inputs): TrickSolution | undefined => {
  if (!tricksShown(state)) return undefined;
  const solution = solutionOf(state);
  if (!solution.modelled) return undefined;
  const { techniques } = state.tricks as TrickPrefs;
  if (
    lastTricks !== undefined &&
    lastTricks.solution === solution &&
    lastTricks.techniques === techniques
  ) {
    return lastTricks.result;
  }
  const keyed = solveWithKeys(trickFiller(solution.settings), {
    ...solution.keyed.state,
    ...trickState(techniques),
  });
  const result = { techniques, tris: keyed.locations() };
  lastTricks = { result, solution, techniques };
  return result;
};

/**
 * Compiles the run's tricks world and its key model ahead of the first trick
 * solve (about 50 ms, more than a frame), so that turning the tricks on
 * costs a solve. A run with no tricks world has nothing to warm.
 * @param run - The run's settings
 */
export const warmTricks = (run: RunSettings): void => {
  if (!logicModelled(run) || crossedLogic(run) || doorLogic(run)) return;
  const settings = packSettings(run);
  const fresh = trackerInput({
    items: freshItems as ItemState,
    medallions: [],
    settings: run,
    smallKeys: [],
  });
  solveWithKeys(trickFiller(settings), toState(fresh, settings));
};

/**
 * Whether the map marks what basic placement's safety margin alone keeps
 * out of logic: a run with basic item placement known, whose logic the pack
 * models in vt's world (the entrance randomizer's and the Door Randomizer's
 * have no margin world). An unknown placement (Mystery) reads the gates as
 * maybe already.
 */
export const marginShown = (state: Inputs): boolean =>
  state.settings.itemPlacement === "basic" &&
  !isHidden(state.settings, "itemPlacement") &&
  logicModelled(state.settings) &&
  !crossedLogic(state.settings) &&
  !doorLogic(state.settings);

/** A run solved again without basic placement's safety margin. */
export interface MarginSolution {
  /** The key model's view of it, which the go mode steps through. */
  readonly keyed: KeyedSolution;
  /** Every location of the run's world, without the margin. */
  readonly tris: Readonly<Record<string, Tri>>;
}

const margins = new WeakMap<Solution, MarginSolution>();

/**
 * A solution solved again in the pack's margin world (`marginFiller`), the
 * margin dropped over the state it is made of (its keys surely in hand
 * included), so what it opens is what the real world says but for basic
 * placement's health gates. Memoized on the solution. Undefined but in a
 * basic placement run whose logic is modelled in vt's world.
 * @param solution - The run solved (solutionOf)
 */
export const marginOf = (solution: Solution): MarginSolution | undefined => {
  if (
    solution.settings.basicPlacement !== true ||
    !solution.modelled ||
    ownWorldOf(solution) !== undefined
  ) {
    return undefined;
  }
  let found = margins.get(solution);
  if (found === undefined) {
    const keyed = solveWithKeys(marginFiller(solution.settings), {
      ...solution.keyed.state,
      ...MARGIN_STATE,
    });
    found = { keyed, tris: keyed.locations() };
    margins.set(solution, found);
  }
  return found;
};

/**
 * The run solved without basic placement's safety margin, when the map
 * marks it (`marginShown`): synchronous, memoized on the solution.
 * @param state - The game store's state, or any object with those slices
 */
export const marginSolutionOf = (state: Inputs): MarginSolution | undefined =>
  marginShown(state) ? marginOf(solutionOf(state)) : undefined;

/**
 * Every marker of any world by id: Inverted's lists each of Open's and
 * Standard's, which differ from it by place alone, and the Bomb Merchant.
 */
const MARKER_BY_ID: ReadonlyMap<string, MapMarker> = new Map(
  INVERTED_MARKERS.map((marker) => [marker.id, marker]),
);

/** A marker by id; throws a RangeError for an id the map does not have. */
export const markerById = (id: string): MapMarker => {
  const marker = MARKER_BY_ID.get(id);
  if (marker === undefined) throw new RangeError(`No map marker "${id}"`);
  return marker;
};

const tri = (solution: Solution, id: string): Tri => solution.tris[id] ?? "no";

const seen = (solution: Solution, id: string): Tri =>
  solution.visibles[id] ?? "no";

/** A trick or margin solution's tris of these locations, `no` where none. */
const otherTris = (
  other: { readonly tris: Readonly<Record<string, Tri>> } | undefined,
  ids: readonly string[],
): readonly Tri[] | undefined =>
  other && ids.map((id) => other.tris[id] ?? "no");

/**
 * What locations of a run show: locationStatus of their tris. The margin
 * and the tricks are solved only for one out of logic, so a run with
 * nothing out of logic in sight never pays for them.
 */
const statusOf = (state: Inputs, ids: readonly string[]) => {
  const solution = solutionOf(state);
  const tris = ids.map((id) => tri(solution, id));
  const visibles = ids.map((id) => seen(solution, id));
  const status = locationStatus(tris, visibles);
  if (status !== "unavailable" && status !== "seen") return status;
  return locationStatus(
    tris,
    visibles,
    otherTris(trickSolutionOf(state), ids),
    otherTris(marginSolutionOf(state), ids),
  );
};

/**
 * What a location marker shows: done once every location it stands for is
 * checked, else locationStatus of those left.
 */
export const markerStateOf = (
  marker: MapMarker,
  state: MarkerInputs,
): MarkerState => {
  const left = marker.locations.filter((id) => !state.checked[id]);
  if (left.length === 0) return "opened";
  return statusOf(state, left);
};

const itemLocations = new Map<string, readonly string[]>();

/** A dungeon's item locations in the run's world. */
const itemLocationsOf = (
  id: DungeonId,
  settings: AlttprSettings,
): readonly string[] => {
  const key = `${worldOf(settings)}/${id}`;
  let found = itemLocations.get(key);
  if (found === undefined) {
    found = dungeonLocations(dungeon(id), settings);
    itemLocations.set(key, found);
  }
  return found;
};

/** A dungeon's index in the grid (0-9), or -1 for one it lacks. */
const gridIndex = (id: DungeonId): number =>
  (LEGACY_DUNGEONS as readonly string[]).indexOf(id);

/**
 * The items a dungeon's counter has left: the grid's ten dungeons have one;
 * Castle Tower and Ganon's Tower do not (undefined).
 */
export const dungeonCount = (
  id: DungeonId,
  state: Pick<Progress, "items">,
): number | undefined => {
  const value = state.items[`chest${KEY_DUNGEONS.indexOf(id)}`];
  return value === undefined ? undefined : Number(value);
};

/**
 * What a dungeon's square shows. With a counter (the ten dungeons of the
 * grid and Ganon's Tower), done at 0, else dungeonStatus: the pigeonhole
 * rule over its item locations, from the items left. Castle Tower has no
 * counter, so what is left is unknown: it shows markerStatus of its item
 * locations, and is done when it holds nothing for the player (its two
 * chests keep their keys while small keys stay in their dungeons).
 */
export const dungeonStateOf = (id: DungeonId, state: Inputs): MarkerState => {
  const solution = solutionOf(state);
  const tris = itemLocationsOf(id, solution.settings).map((location) =>
    tri(solution, location),
  );
  const left = dungeonCount(id, state);
  const status = (all: readonly Tri[]): MarkerStatus =>
    left === undefined ? markerStatus(all) : dungeonStatus(left, all);
  if (left === undefined) {
    if (dungeonItemCount(dungeon(id), solution.settings) === 0) return "opened";
  } else if (left === 0) {
    return "opened";
  }
  const shown = status(tris);
  if (shown !== "unavailable") return shown;
  const items = itemLocationsOf(id, solution.settings);
  const opens = (other?: readonly Tri[]) =>
    other !== undefined && status(other) !== "unavailable";
  if (opens(otherTris(marginSolutionOf(state), items))) return "margin";
  return opens(otherTris(trickSolutionOf(state), items)) ? "trick" : shown;
};

/**
 * How many of a dungeon's items left are surely in logic: those the
 * locations out of logic cannot all hold (pigeonholes). 0 without a counter.
 */
export const itemsSurelyInLogic = (id: DungeonId, state: Inputs): number => {
  const left = dungeonCount(id, state);
  if (left === undefined) return 0;
  const solution = solutionOf(state);
  const notYes = itemLocationsOf(id, solution.settings).filter(
    (location) => tri(solution, location) !== "yes",
  ).length;
  return Math.max(0, left - notYes);
};

/** Whether the player marked a dungeon's boss beaten. */
export const isBeaten = (id: DungeonId, items: Progress["items"]): boolean => {
  const index = gridIndex(id);
  if (index >= 0) return items[`boss${index}`] === BOSS_STATES.BEATEN;
  if (id === "castle-tower") return items.agahnim === 1;
  return id === "ganons-tower" && items.agahnim2 === 1;
};

/** The location of a dungeon's prize, whose rule is its boss's. */
export const prizeOf = (id: DungeonId, settings: AlttprSettings): string => {
  const prize = dungeonRegions(dungeon(id), settings).find(
    (region) => region.prize !== undefined,
  )?.prize;
  if (prize === undefined) throw new RangeError(`No prize for ${id}`);
  return prize;
};

/**
 * What a dungeon's boss shows: done once beaten, else the status of its
 * prize, which upstream gives the boss's own rule (Agahnim's for Castle
 * Tower, Agahnim 2's for Ganon's Tower).
 */
export const bossStateOf = (id: DungeonId, state: Inputs): MarkerState => {
  if (isBeaten(id, state.items)) return "opened";
  const solution = solutionOf(state);
  const prize = prizeOf(id, solution.settings);
  const status = markerStatus([tri(solution, prize)]);
  if (status !== "unavailable") return status;
  const opens = (other?: readonly Tri[]) =>
    other !== undefined && markerStatus(other) !== "unavailable";
  if (opens(otherTris(marginSolutionOf(state), [prize]))) return "margin";
  return opens(otherTris(trickSolutionOf(state), [prize])) ? "trick" : status;
};

/**
 * A dungeon's boss location in the run's world: undefined for Hyrule Castle,
 * which has no boss, and for Castle Tower and Ganon's Tower, whose bosses
 * are rules.
 */
export const bossLocationOf = (
  id: DungeonId,
  state: Inputs,
): string | undefined => bossLocation(dungeon(id), solutionOf(state).settings);

/**
 * Whether a dungeon's counter says its checks are done: at 0 while the
 * dungeon is tracked by its counter alone, none of its checks ticked but its
 * boss's (which follows the boss). Once one is ticked (autotracking ticks
 * each outside Race Mode), every check shows its own state: the counter
 * counts items, so at 0 a chest left unopened may still hold the dungeon's
 * map, compass or keys, and is no more opened for that.
 */
export const isCountedOut = (id: DungeonId, state: MarkerInputs): boolean => {
  if (dungeonCount(id, state) !== 0) return false;
  const boss = bossLocationOf(id, state);
  return !itemLocationsOf(id, solutionOf(state).settings).some(
    (location) => location !== boss && state.checked[location] === true,
  );
};

/**
 * What a location of a dungeon counted out (`isCountedOut`) shows: done,
 * but for the boss location, which the counter (of items) does not clear.
 * It follows the boss, so it stays open until the boss is beaten.
 */
export const clearedStateOf = (
  id: DungeonId,
  location: string,
  state: Inputs,
): MarkerState =>
  location === bossLocationOf(id, state) ? bossStateOf(id, state) : "opened";

/** Every location's official name, every world's together. */
const NAMES: ReadonlyMap<string, string> = new Map(
  [OPEN, STANDARD, settingsFromUpstream("inverted", {})].flatMap((settings) =>
    regionModules(settings).flatMap((module) =>
      module.regions.flatMap((region) =>
        region.locations.map((location) => [location.id, location.name]),
      ),
    ),
  ),
);

/** A location's official name: "Kakariko Well - Top". */
export const locationName = (id: string): string => NAMES.get(id) ?? id;

/**
 * A location's name under its marker: its official name, without the
 * marker's own name when it starts with it ("Kakariko Well - Top" is "Top"
 * under Kakariko Well).
 */
export const locationLabel = (marker: MapMarker, id: string): string => {
  const name = NAMES.get(id) ?? id;
  if (!name.startsWith(marker.name) || name === marker.name) return name;
  return name.slice(marker.name.length).replace(/^\s*-?\s*/, "") || name;
};

/**
 * What each location of a marker shows, in the marker's order: done once
 * checked, else its own status. A dungeon's locations are counted, never
 * checked, so they show their status.
 */
export const markerDetail = (
  marker: MapMarker,
  state: MarkerInputs,
): MarkerState[] => marker.locations.map((id) => locationStateOf(id, state));

/** What one location shows: done once checked, else its own status. */
export const locationStateOf = (
  id: string,
  state: MarkerInputs,
): MarkerState => (state.checked[id] ? "opened" : statusOf(state, [id]));

/** A location's tri as the tracker shows it, stable between changes. */
export const useLocationStatus = (id: string): Tri =>
  useGameStore((state) => tri(solutionOf(state), id));

/**
 * What a map marker shows: a location marker's status, or a dungeon
 * marker's square (its counter).
 */
export const useMarkerStatus = (markerId: string): MarkerState => {
  const marker = markerById(markerId);
  return useGameStore((state) =>
    marker.dungeon === undefined
      ? markerStateOf(marker, state)
      : dungeonStateOf(marker.dungeon, state),
  );
};

/** What a dungeon's counter shows, by the pigeonhole rule. */
export const useDungeonStatus = (id: DungeonId): MarkerState =>
  useGameStore((state) => dungeonStateOf(id, state));

/** What a dungeon's boss shows. */
export const useBossStatus = (id: DungeonId): MarkerState =>
  useGameStore((state) => bossStateOf(id, state));
