// The world the entrance randomizer fills a seed with shuffled entrances
// in: its regions (Regions.py), its rules (Rules.py, translated by
// scripts/er-rules.mjs into entrances/rules.json), and the entrances as
// they are connected. README.md, "The entrance randomizer's world", says how
// it is built.
//
// Read from cassidoxa/ALttPEntranceRandomizer at the commit upstream.json
// pins (entranceRandomizer). What the translation leaves to the world, it
// ports here by hand: the save-and-quit points (Rules.py:115-127), the
// bunny's paths (set_bunny_rules, 1520-1589) and what the derived settings
// read of the connections.
import {
  type Analysis,
  type AnalyzeOptions,
  type Atom,
  analyze,
  type Blockers,
  type CompiledWorld,
  compileWorld,
  type Exit,
  type Location,
  loadRules,
  type Region,
  type Settings,
  type Solution,
  type State,
  solve,
  type World,
} from "@alltp/engine";
import {
  ENTRANCES,
  type EntranceTarget,
  erLocationId,
  TARGETS,
} from "./entrances";
import er from "./entrances/er.json" with { type: "json" };
import ruleTables from "./entrances/rules.json" with { type: "json" };
import { joinBlockers } from "./goals";
import { everything } from "./keys";
import { STATE_NAMES } from "./pack";
import { RULES } from "./rules";
import type { AlttprSettings } from "./settings";

/** A rule of rules.json, and the lines it was read at. */
interface SpotRule {
  readonly req: string;
  readonly source: readonly string[];
}

/** A region of er.json. */
interface ErRegion {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly locations: readonly string[];
  readonly exits: readonly string[];
}

const RULE_TABLES = ruleTables as unknown as {
  readonly allItemsReach: Readonly<Record<string, string>>;
  readonly bombShop: {
    readonly spot: string;
    readonly cases: readonly {
      readonly doors: readonly string[];
      readonly req: string;
    }[];
  };
  readonly bunny: {
    readonly accessibleLocations: { readonly value: readonly string[] };
    readonly impassableCaves: { readonly value: readonly string[] };
  };
  readonly derived: Readonly<
    Record<string, { readonly kind: string; readonly region?: string }>
  >;
  readonly entrances: Readonly<Record<string, SpotRule>>;
  readonly events: Readonly<
    Record<string, { readonly item: string; readonly location: string }>
  >;
  readonly helpers: Readonly<Record<string, { readonly req: string }>>;
  readonly locations: Readonly<Record<string, SpotRule>>;
};

const REGIONS = er.regions as readonly ErRegion[];
const REGION_NAMED = new Map(REGIONS.map((r) => [r.name, r]));

/** The region each entrance (or cave's exit) leaves from, by name. */
const PARENT = new Map(
  REGIONS.flatMap((r) => r.exits.map((exit) => [exit, r.name] as const)),
);

const region = (name: string): ErRegion => {
  const found = REGION_NAMED.get(name);
  if (found === undefined) throw new RangeError(`No region "${name}"`);
  return found;
};

const parentOf = (exit: string): string => {
  const found = PARENT.get(exit);
  if (found === undefined) throw new RangeError(`No entrance "${exit}"`);
  return found;
};

/** The region each location lies in, by name. */
const REGION_OF_LOCATION = new Map(
  REGIONS.flatMap((r) => r.locations.map((l) => [l, r.name] as const)),
);

// ---------------------------------------------------------------------------
// Connections

/**
 * Where each entrance leads, by the randomizer's names: an entrance (or a
 * cave's exit, which the randomizer also calls an entrance) to the region
 * it opens on. One not in it leads nowhere.
 */
export type ErConnections = ReadonlyMap<string, string>;

const pairs = (table: keyof typeof er.tables) =>
  er.tables[table].value as unknown as readonly (readonly [string, string])[];

/**
 * The connections every world makes: link_entrances keeps Link's House
 * (EntranceShuffle.py:8-9), then the mandatory ones (:17-19).
 */
function baseConnections(): Map<string, string> {
  const connections = new Map<string, string>();
  twoWay(connections, "Links House", "Links House Exit");
  // connect_exit: the room's exit opens where Link's House's door is
  connections.set("Chris Houlihan Room Exit", parentOf("Links House"));
  for (const [exit, to] of pairs("mandatory_connections"))
    connections.set(exit, to);
  return connections;
}

/** connect_two_way: the door leads into the exit's cave, the exit out. */
function twoWay(
  connections: Map<string, string>,
  entrance: string,
  exit: string,
): void {
  connections.set(entrance, parentOf(exit));
  connections.set(exit, parentOf(entrance));
}

/** The connections a test makes by hand: the mandatory ones alone. */
export function mandatoryConnections(): ErConnections {
  const connections = new Map<string, string>();
  for (const [exit, to] of pairs("mandatory_connections"))
    connections.set(exit, to);
  return connections;
}

/** The vanilla world's (EntranceShuffle.py:22-26). */
export function vanillaConnections(): ErConnections {
  const connections = baseConnections();
  for (const table of [
    "default_connections",
    "default_dungeon_connections",
  ] as const)
    for (const [exit, to] of pairs(table)) connections.set(exit, to);
  return connections;
}

const ENTRANCE_BY_ID = new Map(ENTRANCES.map((e) => [e.id, e]));
const TARGET_BY_ID = new Map(TARGETS.map((t) => [t.id, t]));

/**
 * The crossed shuffle's, as far as the entrances noted tell
 * (EntranceShuffle.py:365-460): what it keeps (the Tavern's back door, and
 * in Standard the castle's front door and its secret passage), then each
 * noted entrance. A cave or dungeon's exit is connected both ways
 * (connect_two_way), a single cave's door or a hole one way
 * (connect_entrance, scramble_holes). An entrance not noted leads nowhere.
 * @param mode - The world's
 * @param noted - Each noted entrance's target, by the pack's ids
 */
export function crossedConnections(
  mode: "open" | "standard",
  noted: Readonly<Record<string, string>>,
): ErConnections {
  const connections = baseConnections();
  // The Tavern's back door is not shuffled yet (:377)
  connections.set("Tavern North", "Tavern");
  if (mode === "standard") {
    // The escape's doors stay (:379-381; scramble_holes, :1827-1830)
    twoWay(
      connections,
      "Hyrule Castle Entrance (South)",
      "Hyrule Castle Exit (South)",
    );
    twoWay(
      connections,
      "Hyrule Castle Secret Entrance Stairs",
      "Hyrule Castle Secret Entrance Exit",
    );
    connections.set(
      "Hyrule Castle Secret Entrance Drop",
      "Hyrule Castle Secret Entrance",
    );
  }
  for (const [entranceId, targetId] of Object.entries(noted)) {
    const entrance = ENTRANCE_BY_ID.get(entranceId);
    const target = TARGET_BY_ID.get(targetId);
    if (entrance === undefined || target === undefined) continue;
    connect(connections, entrance.name, target);
  }
  return connections;
}

/** One entrance to its target, as the shuffle connects that kind. */
function connect(
  connections: Map<string, string>,
  entrance: string,
  target: EntranceTarget,
): void {
  if (target.kind === "dungeon" || target.kind === "connector")
    twoWay(connections, entrance, target.name);
  else connections.set(entrance, target.name);
}

// ---------------------------------------------------------------------------
// The world

/** How a world is built beside its connections. */
export interface ErOptions {
  /**
   * Regions Link stands in from the start, beside the save-and-quit
   * points: those of the randomizer's tests (`starting_regions`).
   */
  readonly start?: readonly string[];
  /**
   * Whether regions are marked light or dark (mark_light_world_regions,
   * Main.py:70): the bunny's rules hang on it. True by default; the
   * randomizer's dungeon and Death Mountain tests never mark them.
   */
  readonly marked?: boolean;
  /**
   * Whether Swamp Palace needs its patch, which the shuffle decides by
   * where Swamp Palace's and the Dam's doors lead (EntranceShuffle.py:
   * 1052-1054); a test may set it.
   */
  readonly swampPatch?: boolean;
  /**
   * More events: an item the solver holds once a location is reached. The
   * randomizer holds Agahnim's defeats so; the tracker leaves them to the
   * player, the tests to the randomizer.
   */
  readonly events?: Readonly<Record<string, string>>;
}

/** A compiled world of the entrance randomizer, and its facts. */
export interface ErWorld {
  readonly compiled: CompiledWorld;
  /**
   * What the solver holds once a location (pack id) is reached, as the
   * randomizer collects events (sweep_for_events): an event's item by the
   * location that gives it, and `reached_x` by a location of its own in
   * region x, read by a rule that asks for the region where the engine
   * allows no reach().
   */
  readonly facts: readonly {
    readonly item: string;
    readonly location: string;
  }[];
}

/** The engine's id of the start, which no region of the randomizer has. */
const START = "start";

/**
 * A rule's reach() of a region, rewritten into a fact the solver holds once
 * the region is reached: where the engine allows no reach() (an exit, a
 * helper an exit calls).
 */
const factOf = (id: string) => `reached_${id}`;
const REACH = /reach\((\w+)\)/g;
const withFacts = (req: string): string =>
  req.replace(REACH, (_, id) => factOf(id));

/** Both rules: `(a) & (b)`, as text, `true` dropped. */
const and = (...reqs: string[]): string => {
  const kept = reqs.filter((r) => r !== "true");
  if (kept.includes("false")) return "false";
  return kept.length === 0 ? "true" : kept.map((r) => `(${r})`).join(" & ");
};

/** Either rule, likewise. */
const or = (...reqs: string[]): string => {
  const kept = reqs.filter((r) => r !== "false");
  if (kept.includes("true")) return "true";
  return kept.length === 0 ? "false" : kept.map((r) => `(${r})`).join(" | ");
};

/** The worlds' light and dark regions (mark_light_world_regions). */
function markWorlds(connections: ErConnections): {
  light: ReadonlySet<string>;
  dark: ReadonlySet<string>;
} {
  // From every region of a world, through its connected exits, never into
  // the other world's overworld (Regions.py:339-366)
  const mark = (kind: string, other: string) => {
    const seen = new Set(
      REGIONS.filter((r) => r.kind === kind).map((r) => r.name),
    );
    const queue = [...seen];
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      for (const exit of region(name).exits) {
        const to = connections.get(exit);
        if (to === undefined || region(to).kind === other || seen.has(to))
          continue;
        seen.add(to);
        queue.push(to);
      }
    }
    return seen;
  };
  return { dark: mark("dw", "lw"), light: mark("lw", "dw") };
}

/** The door the Big Bomb Shop's region is entered by, if connected. */
const bombShopDoor = (connections: ErConnections): string | undefined =>
  [...connections].find(([, to]) => to === "Big Bomb Shop")?.[0];

/**
 * The rules of every connected exit and every location, as the randomizer
 * ends with them before the bunny's: rules.json, and the bomb shop's case.
 * With `then`, the exits' rules as they were when Turtle Rock's key rules
 * looked (rules.json allItemsReach), before the bomb shop's case.
 */
function spotRules(
  connections: ErConnections,
  then?: Readonly<Record<string, string>>,
) {
  const exits = new Map<string, string>();
  for (const [exit] of connections)
    exits.set(exit, then?.[exit] ?? RULE_TABLES.entrances[exit]?.req ?? "true");
  // set_big_bomb_rules: the case of the door the shop is entered by
  const door = bombShopDoor(connections);
  const { cases, spot } = RULE_TABLES.bombShop;
  const found = cases.find((c) => door !== undefined && c.doors.includes(door));
  if (found !== undefined && exits.has(spot) && then === undefined)
    exits.set(spot, and(exits.get(spot) ?? "true", found.req));
  const locations = new Map<string, string>(
    [...REGION_OF_LOCATION.keys()].map((name) => [
      name,
      RULE_TABLES.locations[name]?.req ?? "true",
    ]),
  );
  return { exits, locations };
}

/**
 * The bunny's rules (set_bunny_rules, Rules.py:1520-1589). Where the
 * regions are marked: each exit of a cave the bunny cannot cross that lies
 * in the dark world, and each location in the dark world it cannot get,
 * takes the pearl, or (for a region also in the light world) a path from
 * a region wholly in the light world, each entrance on it passable.
 */
function addBunnyRules(
  connections: ErConnections,
  marked: { light: ReadonlySet<string>; dark: ReadonlySet<string> },
  exits: Map<string, string>,
  locations: Map<string, string>,
): void {
  const into = new Map<string, string[]>();
  for (const [exit, to] of connections)
    into.set(to, [...(into.get(to) ?? []), exit]);
  const pearl = "moonPearl";

  // get_rule_to_add: read when added, so a later region's paths see the
  // rules added before, as the randomizer's lambdas do
  const ruleToAdd = (name: string): string => {
    if (!marked.light.has(name)) return pearl;
    const options = [pearl];
    const seen = new Set([name]);
    const queue: [string, string[]][] = [[name, []]];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const [current, path] = next;
      for (const entrance of into.get(current) ?? []) {
        const from = parentOf(entrance);
        if (seen.has(from)) continue;
        const rule = exits.get(entrance) ?? "true";
        const newPath = [...path, rule];
        seen.add(from);
        if (!marked.light.has(from)) continue;
        if (marked.dark.has(from)) queue.push([from, newPath]);
        // can_reach(entrance): its region, and its rule
        else options.push(and(`reach(${region(from).id})`, rule, ...newPath));
      }
    }
    return or(...options);
  };

  for (const name of RULE_TABLES.bunny.impassableCaves.value) {
    if (!marked.dark.has(name)) continue;
    const rule = ruleToAdd(name);
    for (const exit of region(name).exits)
      if (exits.has(exit))
        exits.set(exit, and(exits.get(exit) ?? "true", rule));
  }
  const shop = "Light World Death Mountain Shop";
  if (marked.dark.has(shop)) {
    const entrance = into.get(shop)?.[0];
    if (entrance !== undefined)
      exits.set(entrance, and(exits.get(entrance) ?? "true", ruleToAdd(shop)));
  }
  const accessible = new Set(RULE_TABLES.bunny.accessibleLocations.value);
  for (const [location, name] of REGION_OF_LOCATION) {
    if (!marked.dark.has(name) || accessible.has(location)) continue;
    locations.set(
      location,
      and(locations.get(location) ?? "true", ruleToAdd(name)),
    );
  }
}

/** The pack's rules, then the randomizer's helpers, reach() as facts. */
const RULES_SOURCE = {
  groups: RULES.groups,
  helpers: {
    ...RULES.helpers,
    ...Object.fromEntries(
      Object.entries(RULE_TABLES.helpers).map(([name, { req }]) => [
        name,
        withFacts(req),
      ]),
    ),
  },
};
const LOADED_RULES = loadRules(RULES_SOURCE);

/** The regions a helper reaches, by id: an exit may call it. */
const HELPERS_REACH = Object.values(RULE_TABLES.helpers).flatMap(({ req }) =>
  [...req.matchAll(REACH)].map((m) => m[1] ?? ""),
);

/** The location whose rule the Old Man's house's save point reads. */
const OLD_MAN = "Old Man";

/**
 * The regions a world's exits reach (the Old Man's house's among them) or
 * a helper does, by id: each one a fact the solver keeps.
 */
const reachedBy = (
  exits: ReadonlyMap<string, string>,
  locations: ReadonlyMap<string, string>,
): string[] => [
  ...new Set([
    ...HELPERS_REACH,
    ...[...exits.values(), locations.get(OLD_MAN) ?? ""].flatMap((req) =>
      [...req.matchAll(REACH)].map((m) => m[1] ?? ""),
    ),
  ]),
];

/**
 * The engine's graph of a world: its regions with their connected exits,
 * its locations, and a start that reaches the save-and-quit points.
 */
function graph(
  connections: ErConnections,
  exits: ReadonlyMap<string, string>,
  locations: ReadonlyMap<string, string>,
  mode: "open" | "standard",
  start: readonly string[],
  reached: readonly string[],
): World {
  const factRegions = new Set(reached);
  const saveAndQuit: Exit[] = (
    mode === "open"
      ? // Rules.py:121-123: always reached
        ["Links House", "Sanctuary"]
      : // Rules.py:116-117: the escape starts by the uncle
        ["Hyrule Castle Secret Entrance"]
  )
    .concat(start)
    .map((name) => ({ to: region(name).id }));
  const regions: Region[] = REGIONS.map((r) => {
    const out: Exit[] = r.exits.flatMap((exit) => {
      const to = connections.get(exit);
      return to === undefined
        ? []
        : [{ req: withFacts(exits.get(exit) ?? "true"), to: region(to).id }];
    });
    // Rules.py:118-119: in Standard, Link's House once Sanctuary is reached
    if (mode === "standard" && r.name === "Sanctuary")
      out.push({ to: region("Links House").id });
    // Rules.py:126-127: the Old Man's house once the Old Man is reached
    if (r.locations.includes(OLD_MAN))
      out.push({
        req: withFacts(locations.get(OLD_MAN) ?? "true"),
        to: region("Old Man House").id,
      });
    const located: Location[] = r.locations.map((name) => ({
      id: erLocationId(name),
      req: locations.get(name) ?? "true",
    }));
    // A region's fact, given as it is reached
    if (factRegions.has(r.id)) located.push({ id: factOf(r.id) });
    return { exits: out, id: r.id, locations: located };
  });
  return {
    regions: [{ exits: saveAndQuit, id: START }, ...regions],
    start: START,
  };
}

/** The randomizer's events, and any the options add, as facts. */
function eventFacts(
  events: Readonly<Record<string, string>>,
  reached: readonly string[],
): ErWorld["facts"] {
  return [
    ...Object.entries(RULE_TABLES.events).map(([item, { location }]) => ({
      item,
      location: erLocationId(location),
    })),
    ...Object.entries(events).map(([item, location]) => ({
      item,
      location: erLocationId(location),
    })),
    ...reached.map((id) => ({ item: factOf(id), location: factOf(id) })),
  ];
}

/**
 * The derived settings rules.json names (`derived`), by what the
 * connections make of them: whether a region lies in the light world,
 * whether Swamp Palace needs its patch, and what everything held reaches
 * as Turtle Rock's key rules ask (set_trock_key_rules, Rules.py:1008-1017).
 */
function derivedSettings(
  settings: AlttprSettings,
  connections: ErConnections,
  marked: { light: ReadonlySet<string> },
  options: ErOptions,
): Settings {
  const derived: Record<string, boolean> = {};
  const allItems: string[] = [];
  for (const [name, { kind, region: of }] of Object.entries(
    RULE_TABLES.derived,
  )) {
    if (kind === "lightWorld") derived[name] = marked.light.has(of ?? "");
    else if (kind === "swampPatch")
      derived[name] =
        options.swampPatch ??
        !(
          connections.get("Dam") === "Dam" &&
          connections.get("Swamp Palace") === "Swamp Palace (Entrance)"
        );
    else allItems.push(name);
  }
  if (allItems.length === 0) return derived;
  // The world as the randomizer has it then (rules.json allItemsReach),
  // its other derived settings known, solved with everything held; a
  // test's starting regions are set after set_rules
  const mode = settings.standardMode ? "standard" : "open";
  const events = options.events ?? {};
  const { exits, locations } = spotRules(
    connections,
    RULE_TABLES.allItemsReach,
  );
  const reached = reachedBy(exits, locations);
  const then = compileWorld(
    graph(connections, exits, locations, mode, [], reached),
    LOADED_RULES,
    {
      items: itemsOf(events, reached),
      settings: {
        ...settings,
        ...derived,
        ...Object.fromEntries(allItems.map((name) => [name, false])),
      },
    },
  );
  const solved = solveFacts(
    { compiled: then, facts: eventFacts(events, reached) },
    everything(settings),
  );
  for (const name of allItems) {
    const of = RULE_TABLES.derived[name]?.region ?? "";
    derived[name] = solved.region(region(of).id) === "yes";
  }
  return derived;
}

/** Every item a world's rules may read. */
const itemsOf = (
  events: Readonly<Record<string, string>>,
  reached: readonly string[],
) => [
  ...new Set([
    ...STATE_NAMES,
    ...Object.keys(RULE_TABLES.events),
    ...Object.keys(events),
    ...reached.map(factOf),
  ]),
];

/**
 * The entrance randomizer's world for a run's settings and its
 * connections, compiled: about a few milliseconds, once per entrance
 * noted. Open or Standard; the Inverted world runs other rules.
 */
export function erWorld(
  settings: AlttprSettings,
  connections: ErConnections,
  options: ErOptions = {},
): ErWorld {
  if (settings.invertedMode)
    throw new RangeError("The Inverted entrance randomizer is not ported");
  const mode = settings.standardMode ? "standard" : "open";
  const marked =
    options.marked === false
      ? { dark: new Set<string>(), light: new Set<string>() }
      : markWorlds(connections);
  const events = options.events ?? {};
  const { exits, locations } = spotRules(connections);
  if (options.marked !== false)
    addBunnyRules(connections, marked, exits, locations);
  const reached = reachedBy(exits, locations);
  const compiled = compileWorld(
    graph(connections, exits, locations, mode, options.start ?? [], reached),
    LOADED_RULES,
    {
      items: itemsOf(events, reached),
      settings: {
        ...settings,
        ...derivedSettings(settings, connections, marked, options),
      },
    },
  );
  return { compiled, facts: eventFacts(events, reached) };
}

/**
 * Solves a world, holding each fact once what gives it is surely reached,
 * as the randomizer sweeps for events, until nothing more is gained. Each
 * pass can only add facts, so this ends within a pass per fact.
 * @returns The solution, and the state with the facts gained
 */
export function solveFactsState(
  world: ErWorld,
  state: State,
): { readonly solution: Solution; readonly state: State } {
  let current: State = state;
  for (;;) {
    const solution = solve(world.compiled, current);
    const gained = world.facts.filter(
      ({ item, location }) =>
        !current[item] && solution.location(location) === "yes",
    );
    if (gained.length === 0) return { solution, state: current };
    current = {
      ...current,
      ...Object.fromEntries(gained.map(({ item }) => [item, 1])),
    };
  }
}

/** solveFactsState's solution. */
export const solveFacts = (world: ErWorld, state: State): Solution =>
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
  world: ErWorld,
  state: State,
  options: AnalyzeOptions = {},
): Analysis {
  const sources = new Map(world.facts.map((f) => [f.item, f.location]));
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
