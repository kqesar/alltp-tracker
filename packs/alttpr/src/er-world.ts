// The world the entrance randomizer fills a seed with shuffled entrances
// in: its regions (Regions.py), its rules (Rules.py, translated by
// scripts/er-rules.mjs into entrances/rules.json), and the entrances as
// they are connected. README.md, "The entrance randomizer's world", says how
// it is built.
//
// Read from cassidoxa/ALttPEntranceRandomizer at the commit upstream.json
// pins (entranceRandomizer). What the translation leaves to the world, it
// ports here by hand: the save-and-quit points (Rules.py:115-127), the
// bunny's paths (set_bunny_rules, 1520-1589), what the derived settings
// read of the connections, and the boss slots under boss shuffle
// (Bosses.py place_bosses, 145-219).
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
  type Tri,
  type UnknownSetting,
  type World,
} from "@alltp/engine";
import {
  BOSS_PLACES,
  type BossPlaceId,
  bossesAt,
  SHUFFLED_BOSSES,
  type ShuffledBoss,
  shuffledBossRule,
} from "./bosses";
import {
  ENTRANCES,
  type EntranceTarget,
  type ErShuffle,
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
import { unknownCountRequirement } from "./unknown-counts";

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
  readonly bossSlots: Readonly<
    Record<
      string,
      {
        readonly place: string;
        readonly refuses: readonly string[];
        readonly swordless: readonly string[];
        readonly vanilla: string;
      }
    >
  >;
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

/**
 * Its regions: Regions.py's, and the retro world's take-any caves
 * (ItemList.py set_up_take_anys), which hold nothing the map shows and lead
 * nowhere but back out.
 */
const REGIONS: readonly ErRegion[] = [
  ...(er.regions as readonly ErRegion[]),
  ...er.takeAnys.regions.map(({ id, name }) => ({
    exits: [],
    id,
    kind: "cave",
    locations: [],
    name,
  })),
];
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
 * (EntranceShuffle.py:365-460): `erConnections` of the crossed shuffle.
 * @param mode - The world's
 * @param noted - Each noted entrance's target, by the pack's ids
 */
export const crossedConnections = (
  mode: "open" | "standard",
  noted: Readonly<Record<string, string>>,
): ErConnections => erConnections("crossed", mode, noted);

/**
 * A shuffle's connections, as far as the entrances noted tell
 * (EntranceShuffle.py:63-440): what it keeps (the Tavern's back door; in
 * Standard the castle's front door and its secret passage, and in the
 * simple and restricted shuffles the castle's other doors and Agahnim's
 * Tower's, which simple_shuffle_dungeons leaves, :2054-2069), then each
 * noted entrance. A cave or dungeon's exit is connected both ways
 * (connect_two_way), a single cave's door or a hole one way
 * (connect_entrance, scramble_holes). An entrance not noted leads nowhere:
 * what one note settles beside it (`EntrancePool.partners`) is noted by
 * the tracker, not guessed here.
 * @param shuffle - The run's
 * @param mode - The world's
 * @param noted - Each noted entrance's target, by the pack's ids
 */
export function erConnections(
  shuffle: ErShuffle,
  mode: "open" | "standard",
  noted: Readonly<Record<string, string>>,
): ErConnections {
  const connections = baseConnections();
  // The Tavern's back door is not shuffled yet (:130, :148, :275, :378)
  connections.set("Tavern North", "Tavern");
  if (mode === "standard") {
    // The escape's doors stay (:279-280, :380-381; scramble_holes,
    // :1827-1830)
    twoWay(
      connections,
      "Hyrule Castle Entrance (South)",
      "Hyrule Castle Exit (South)",
    );
    // And the castle's others, in the simple and restricted shuffles
    if (shuffle === "simple" || shuffle === "restricted")
      for (const [door, exit] of [
        ["Hyrule Castle Entrance (East)", "Hyrule Castle Exit (East)"],
        ["Hyrule Castle Entrance (West)", "Hyrule Castle Exit (West)"],
        ["Agahnims Tower", "Agahnims Tower Exit"],
      ] as const)
        twoWay(connections, door, exit);
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
  /**
   * Whether a door or exit the connections leave out leads anywhere the
   * shuffle may have led it: to every target no noted door leads to, and
   * out by every door not noted. The world the randomizer filled, as far as
   * the doors noted tell, which the key model reads (er-keys.ts). False by
   * default: a door not noted leads nowhere.
   */
  readonly anywhere?: boolean;
}

/** A compiled world of the entrance randomizer, and its facts. */
export interface ErWorld {
  readonly compiled: CompiledWorld;
  /** What it was built from: the connections, and how (er-keys.ts). */
  readonly connections: ErConnections;
  readonly options: ErOptions;
  /**
   * The settings it was compiled with: the run's, and the derived ones the
   * connections give (`derived` in rules.json), which the fill's rules read
   * too (er-keys.ts).
   */
  readonly settings: Settings;
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
/**
 * A rule as the world reads it: each reach() a fact, and each count a tracker
 * may not know read as maybe while it is not (unknown-counts.ts).
 */
const withFacts = (req: string): string =>
  unknownCountRequirement(req.replace(REACH, (_, id) => factOf(id)));

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
  anywhere = false,
) {
  const exits = new Map<string, string>();
  const ruled = anywhere
    ? new Set([...connections.keys(), ...SHUFFLED])
    : connections.keys();
  for (const exit of ruled)
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
  // Rules.py:454: a ganonhunt's Ganon wants the pieces asked for. The
  // translation reads the goal as no ganonhunt (er-rules.mjs WORLD), since
  // `not state.has(...)` has no monotone form there; ported here as the
  // fact the pack holds once they are found (tracker.ts `ganonhuntPieces`)
  locations.set(
    GANON,
    and(
      locations.get(GANON) ?? "true",
      "!setting(ganonhuntGoal) | ganonhuntPieces",
    ),
  );
  return { exits, locations };
}

/** The location Ganon is beaten at. */
const GANON = "Ganon";

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

/** A boss of boss_table (Bosses.py) by the pack's id: `Armos Knights`. */
const shuffledBoss = (name: string): ShuffledBoss | undefined =>
  SHUFFLED_BOSSES.find(
    (boss) => boss.toLowerCase() === name.replaceAll(" ", "").toLowerCase(),
  );

const bossesOf = (names: readonly string[]): ShuffledBoss[] =>
  names.flatMap((name) => {
    const boss = shuffledBoss(name);
    return boss === undefined ? [] : [boss];
  });

/**
 * Each boss slot's rule (rules.json bossSlots, the rules reading a
 * dungeon's boss through it): its vanilla boss without boss shuffle; with
 * it, the boss the player knows (the facts bosses.ts names, which the
 * state holds as for vt's world) or, while unknown, every boss its
 * can_place_boss takes (Bosses.py:123-143), each through its Bosses.py
 * rule. A boss it refuses swordless counts then only with swords. Ice
 * Palace's slot keeps every boss even swordless: 'chaos' (vt's 'random')
 * may place any there, and only 'basic' and 'normal' put Kholdstare back
 * (Bosses.py:186-191), which one flag cannot tell apart.
 */
function bossSlotRule(slot: string): string {
  const { place, refuses, swordless, vanilla } =
    RULE_TABLES.bossSlots[slot] ?? {};
  if (place === undefined || !(place in BOSS_PLACES))
    throw new RangeError(`No boss place for ${slot}`);
  const at = place as BossPlaceId;
  const held = SHUFFLED_BOSSES.filter(
    (boss) => !bossesOf(refuses ?? []).includes(boss),
  );
  // The facts are vt's slots' (bosses.ts): a boss the randomizer may place
  // that vt's slot refuses would have none
  if (held.some((boss) => !bossesAt(at).includes(boss)))
    throw new RangeError(`${slot} may hold a boss vt's slot refuses`);
  const beat = (boss: ShuffledBoss) =>
    `@erDefeat${boss.charAt(0).toUpperCase()}${boss.slice(1)}`;
  return `!setting(bossShuffle) & @${vanilla} | setting(bossShuffle) & (${shuffledBossRule(at, held, beat, bossesOf(swordless ?? []))})`;
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
    ...Object.fromEntries(
      Object.keys(RULE_TABLES.bossSlots).map((slot) => [
        slot,
        withFacts(bossSlotRule(slot)),
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
  options: ErOptions = {},
): World {
  const factRegions = new Set(reached);
  const anywhere = options.anywhere === true;
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
      if (to !== undefined)
        return [
          { req: withFacts(exits.get(exit) ?? "true"), to: region(to).id },
        ];
      // A door or exit not noted, where it may lead
      return anywhere && SHUFFLED.has(exit)
        ? [{ req: withFacts(exits.get(exit) ?? "true"), to: ANYWHERE }]
        : [];
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
      req: unknownCountRequirement(locations.get(name) ?? "true"),
    }));
    // A region's fact, given as it is reached
    if (factRegions.has(r.id)) located.push({ id: factOf(r.id) });
    return { exits: out, id: r.id, locations: located };
  });
  return {
    regions: [
      { exits: saveAndQuit, id: START },
      ...regions,
      ...(anywhere ? [anywhereRegion(connections)] : []),
    ],
    start: START,
  };
}

/** The engine's id of where a door or exit not noted leads (`anywhere`). */
const ANYWHERE = "anywhere";

/**
 * What the shuffles connect: the doors and holes (`ENTRANCES`), and the
 * exits of the caves and dungeons they lead into, which lead out by a door.
 */
const SHUFFLED = new Set(
  [
    ...ENTRANCES.map((e) => e.name),
    ...TARGETS.filter(
      (t) => t.kind === "dungeon" || t.kind === "connector",
    ).map((t) => t.name),
  ].filter((name) => PARENT.has(name)),
);

/**
 * Where a door or exit not noted may lead: into every target no noted door
 * leads into (a cave's or dungeon's side by its exit, a single cave, a
 * drop), and out by every door not noted, which an exit not noted may be
 * coupled with.
 */
function anywhereRegion(connections: ErConnections): Region {
  // What a noted door or hole leads into: a region a fixed way leads into
  // (inside a dungeon, between Skull Woods' sections) may be a drop too
  const entered = new Set(
    [...connections].flatMap(([exit, to]) => (SHUFFLED.has(exit) ? [to] : [])),
  );
  // The Open and Standard worlds' alone: Inverted's are not ported
  const into = TARGETS.flatMap((t) => {
    if (t.kind === "dungeon" || t.kind === "connector")
      return connections.has(t.name) || !SHUFFLED.has(t.name)
        ? []
        : [parentOf(t.name)];
    return entered.has(t.name) || !REGION_NAMED.has(t.name) ? [] : [t.name];
  });
  const out = ENTRANCES.filter(
    (e) =>
      e.kind === "door" && SHUFFLED.has(e.name) && !connections.has(e.name),
  ).map((e) => parentOf(e.name));
  return {
    exits: [...new Set([...into, ...out])].map((name) => ({
      to: region(name).id,
    })),
    id: ANYWHERE,
    locations: [],
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
  // Read once per connections: the key model's world (er-keys.ts) asks again
  const key = JSON.stringify([
    Object.entries(settings).filter(
      ([name]) => !Object.hasOwn(RULE_TABLES.derived, name),
    ),
    derived,
    options.events ?? {},
  ]);
  let read = TROCK_READ.get(connections);
  if (read === undefined) {
    read = new Map();
    TROCK_READ.set(connections, read);
  }
  const known = read.get(key);
  if (known !== undefined) return { ...derived, ...known };
  // set_trock_key_rules reads what everything held reaches in the seed's
  // whole world (all_state.can_reach, Rules.py:1007-1016), the doors not
  // noted yet included. The doors noted bound it: where a door not noted
  // leads nowhere, everything held reaches no more than in the seed's world
  // (a region reached there, the flag holds); where it leads anywhere the
  // shuffle leaves room for, no less (a region not reached there, the flag
  // fails). In between the flag is not known, and the engine folds each
  // rule reading it both ways and meets them (foldSettings): `yes` only if
  // it is whatever the doors not noted lead to. Read off the doors noted
  // alone, the eye bridge not reached yet, the doors took fewer keys than
  // the seed's, and noting a door could turn a `yes` into `no`
  const lower = allItemsReach(settings, connections, derived, allItems, {
    ...options,
    anywhere: false,
  });
  // The second world only where it may reach more: a door left to note
  const upper =
    allItems.every((name) => lower(name) === "yes") ||
    [...SHUFFLED].every((exit) => connections.has(exit))
      ? lower
      : allItemsReach(settings, connections, derived, allItems, {
          ...options,
          anywhere: true,
        });
  const flags = Object.fromEntries(
    allItems.map((name) => {
      if (lower(name) === "yes") return [name, true];
      return [name, upper(name) === "no" ? false : NOT_KNOWN];
    }),
  );
  read.set(key, flags);
  return { ...derived, ...flags };
}

/** A derived setting the doors noted do not settle. */
const NOT_KNOWN: UnknownSetting = { unknown: true };

/**
 * Turtle Rock's flags (`derivedSettings`), by the connections they were
 * read from, then by the settings and events they were read with.
 */
const TROCK_READ = new WeakMap<
  ErConnections,
  Map<string, Readonly<Record<string, boolean | UnknownSetting>>>
>();

/**
 * What everything held reaches of each region Turtle Rock's key rules ask
 * for, in the world as the randomizer has it then (rules.json
 * allItemsReach), its other derived settings known; a test's starting
 * regions are set after set_rules.
 */
function allItemsReach(
  settings: AlttprSettings,
  connections: ErConnections,
  derived: Settings,
  allItems: readonly string[],
  options: ErOptions,
): (name: string) => Tri {
  const mode = settings.standardMode ? "standard" : "open";
  const events = options.events ?? {};
  const { exits, locations } = spotRules(
    connections,
    RULE_TABLES.allItemsReach,
    options.anywhere,
  );
  const reached = reachedBy(exits, locations);
  const thenSettings: Settings = {
    ...settings,
    ...derived,
    ...Object.fromEntries(allItems.map((name) => [name, false])),
  };
  const then = compileWorld(
    graph(connections, exits, locations, mode, [], reached, options),
    LOADED_RULES,
    { items: itemsOf(events, reached), settings: thenSettings },
  );
  const solved = solveFacts(
    {
      compiled: then,
      connections,
      facts: eventFacts(events, reached),
      options,
      settings: thenSettings,
    },
    everything(settings),
  );
  return (name) =>
    solved.region(region(RULE_TABLES.derived[name]?.region ?? "").id);
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
  const { exits, locations } = spotRules(
    connections,
    undefined,
    options.anywhere,
  );
  if (options.marked !== false)
    addBunnyRules(connections, marked, exits, locations);
  const reached = reachedBy(exits, locations);
  const compiledSettings: Settings = {
    ...settings,
    ...derivedSettings(settings, connections, marked, options),
  };
  const compiled = compileWorld(
    graph(
      connections,
      exits,
      locations,
      mode,
      options.start ?? [],
      reached,
      options,
    ),
    LOADED_RULES,
    { items: itemsOf(events, reached), settings: compiledSettings },
  );
  return {
    compiled,
    connections,
    facts: eventFacts(events, reached),
    options,
    settings: compiledSettings,
  };
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
