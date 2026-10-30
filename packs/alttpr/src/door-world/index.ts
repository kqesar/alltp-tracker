// The Door Randomizer's world: its regions, its exits as the connections
// link them, and the rules DR's Rules.py gives each (translated by
// scripts/dr-rules.mjs into door-rando/world/rules.json), compiled for the
// engine. Read from aerinon/ALttPDoorRandomizer at the release
// upstream.json pins (doorRandomizer). What the translation leaves to the
// world, it ports here: the save-and-quit points (Rules.py:197-204, the
// Menu every exit of which DR reaches), the flute and mirror exits DR makes
// in code (OverworldShuffle.py:31-73), the bomb shop's case
// (set_big_bomb_rules, Rules.py:1614), the bunny's paths (set_bunny_rules,
// Rules.py:2039, bunny.ts) and what the derived settings read of the
// connections (light and dark world, Regions.py:1113; the swamp patch,
// EntranceShuffle2.py:141-143; the doors' flags, Doors.py), the crystal
// switches' states (crystal.ts) and the keys of DR's key analysis
// (keys.ts), strict-safe where the analysis is not run: other connections
// than the vanilla ones, or a run whose pots or enemy drops join the
// dungeons (`dungeonPotsAndDrops`).
import {
  type CompiledWorld,
  compileWorld,
  type Exit,
  evaluate,
  type Location,
  loadRules,
  parse,
  type Region,
  type Settings,
  type World,
} from "@alltp/engine";
import { erLocationId } from "../entrances";
import { type FactWorld, solveFacts } from "../facts";
import { everything } from "../keys";
import { STATE_NAMES } from "../pack";
import { RULES } from "../rules";
import { settingsFromUpstream } from "../settings";
import { unknownCountRequirement } from "../unknown-counts";
import { addBunnyRules } from "./bunny";
import {
  type DrConnections,
  type DrDynamicExit,
  type DrNotedDoors,
  type DrNotedEntrances,
  dynamicExits,
  lobbiesOf,
  notedConnections,
  PORTAL_DOORS,
  vanillaConnections,
} from "./connections";
import {
  CRYSTAL_READ,
  crystalNodes,
  crystalStates,
  crystalsThrough,
  inState,
} from "./crystal";
import {
  DOOR_NAMED,
  DR_DUNGEONS,
  DR_REGIONS,
  DR_RULES,
  type DrMode,
  type DrRegion,
  REGION_NAMED,
  regionNamed,
} from "./data";
import {
  type DoorRule,
  type KeyLogic,
  vanillaKeyLogic,
} from "./key-analysis/analysis";
import { portalsKnown } from "./key-analysis/dungeon";
import {
  addKeyRules,
  DR_KEY_CODES,
  dropKeyFact,
  KEY_DROPS,
  KEY_ITEMS,
  type KeyHolding,
  type WorldKeys,
  worldKeys,
} from "./keys";
import {
  addShuffledDoorRules,
  isShut,
  roomDungeons,
  sanctuaryRoute,
  shuffledDoorSettings,
} from "./shuffle";
import { addZeldaPath, UNCLE_SAVE_AND_QUIT, zeldaPath } from "./standard";
import {
  addStaticKeyRules,
  staticKeyLogic,
  TURTLE_ROCK_PROBES,
  type TurtleRockAccess,
  type TurtleRockCase,
  turtleRockCase,
} from "./static";
import { and, maybeOf, or, readFact } from "./text";

export type {
  DrConnections,
  DrNotedConnections,
  DrNotedDoors,
  DrNotedEntrances,
} from "./connections";
export { notedConnections, vanillaConnections } from "./connections";
export type { DrMode } from "./data";
export * from "./doors";
export { KEY_ITEMS } from "./keys";

/** How a world is built beside its settings. */
export interface DrWorldOptions {
  /**
   * Regions the Menu reaches with no rule, beside its save-and-quit exits:
   * the start regions of DR's dungeon tests (TestDungeon.py, "Test Start").
   */
  readonly start?: readonly string[];
  /**
   * Exits to answer as locations: each a location `exit:<name>` in the
   * exit's region with the exit's rule, as Entrance.can_reach reads it
   * (BaseClasses.py:1566-1571). DR's entrance tests ask them.
   */
  readonly probes?: readonly string[];
  /**
   * Whether the solver collects DR's events once their location is
   * reached, as sweep_for_events does (BaseClasses.py:1051-1066). True by
   * default; DR's dungeon tests never sweep (TestDungeon.py), so they set
   * it false and hold the events as items.
   */
  readonly sweepEvents?: boolean;
  /**
   * Where each exit leads: the vanilla world's for the mode by default
   * (vanillaConnections).
   */
  readonly connections?: DrConnections;
  /**
   * A run's shuffled entrances, as noted (notedConnections): the world is
   * built on them, in place of `connections`.
   */
  readonly entrances?: DrNotedEntrances;
  /**
   * A run's door shuffle, as noted (doors.ts, shuffle.ts): its doors link
   * as the notes say, a door not noted leads nowhere, a kind not noted is
   * `maybe` to pass, and its key doors ask the strict-safe rule.
   */
  readonly doors?: DrNotedDoors;
  /**
   * Test only: how a key door reads its rule of DR's analysis, the
   * player's reading by default (keys.ts). The key model's soundness spec
   * passes the fill's truth, where a placement is known.
   */
  readonly doorRule?: (
    dungeon: string,
    rule: DoorRule,
    logic: KeyLogic,
    keys: WorldKeys,
  ) => string;
  /**
   * Big keys the player has no way to record (the app draws no cell for
   * Hyrule Castle's): each reads `maybe` until held, never `no`.
   */
  readonly unrecorded?: readonly string[];
  /**
   * The run's pots and enemy drops (the pack's `drLocationsOf`), which
   * adjust_locations adds to their regions (Regions.py:1165-1232): each in
   * its DR region with its rules, pot_rules' and drop_rules' (Rules.py:
   * 949-1007) as the translation reads them by name (the two pots of the
   * Dark Lake Hylia ledge's spike cave its loop names, :973-978, are no pots
   * of DR's at 1.5.8: `get_location_unsafe` finds none). Key drops are in
   * the world already.
   */
  readonly dropsAndPots?: readonly {
    readonly name: string;
    readonly region: string;
  }[];
  /** Test only: items the `doorRule` reads beside the pack's. */
  readonly items?: readonly string[];
  /**
   * Regions to answer as locations: each a location `region:<name>` in it
   * with no rule, reached with the region (Region.can_reach): what the
   * static key logic's Turtle Rock probe asks.
   */
  readonly regions?: readonly string[];
}

/** A compiled Door Randomizer world, its facts and its locations' ids. */
export interface DrWorld extends FactWorld {
  readonly compiled: CompiledWorld;
  /** The engine's id of each DR location, by DR's name. */
  readonly locationIds: ReadonlyMap<string, string>;
  /**
   * With a door shuffle, each dungeon room's dungeon as the notes make it
   * (shuffle.ts roomDungeons), by region name.
   */
  readonly roomDungeons?: ReadonlyMap<string, string>;
}

/** The engine's id of the Menu, DR's start (BaseClasses.py:610-614). */
const MENU = "Menu";

/** The id of a DR location: the pack's slug, vt's name where it differs. */
export const drLocationId = (name: string): string => erLocationId(name);

/**
 * The engine's id of a DR region, by DR's name ("Eastern Lobby"); undefined
 * for a region the world does not hold (a take-any cave, which ItemList.py
 * makes where the seed puts it).
 */
export const drRegionId = (name: string): string | undefined =>
  REGION_NAMED.get(name)?.id;

/** The id of a probe on an exit. */
export const probeId = (exit: string): string => `exit:${exit}`;

/** The id of a probe on a region. */
export const regionProbeId = (region: string): string => `region:${region}`;

/** The mode a run's settings say. */
export const drModeOf = (settings: Settings): DrMode =>
  settings.invertedMode === true
    ? "inverted"
    : settings.standardMode === true
      ? "standard"
      : "open";

// ---------------------------------------------------------------------------
// Rules as the world reads them

/** A rule's reach() of a region, as a fact the solver holds once reached. */
const factOf = (id: string) => `reached_${id}`;
const REACH = /reach\((\w+)\)/g;

/** DR's events, each a fact its rules read. */
const EVENT_READ = new RegExp(
  `\\b(${Object.keys(DR_RULES.events).join("|")})\\b`,
  "g",
);

/**
 * The facts a rule reads, each read at maybe too while what gives it is
 * reached at maybe only (facts.ts): the events, the crystal reads.
 */
const factsRead = (req: string): string =>
  req
    .replace(EVENT_READ, (event) => readFact(event))
    .replace(CRYSTAL_READ, (read) => readFact(read));

/**
 * A rule as an exit (or a helper) reads it: each reach() a fact, as each
 * crystal read is (`reachedBlue_<id>`, given in that state's node).
 */
const exitRule = (req: string): string =>
  unknownCountRequirement(
    factsRead(req).replace(REACH, (_, id) => readFact(factOf(id))),
  );

/** The pack's helpers, then DR's, each reach() a fact. */
const LOADED_RULES = loadRules({
  groups: RULES.groups,
  helpers: {
    ...RULES.helpers,
    ...Object.fromEntries(
      Object.entries(DR_RULES.helpers).map(([name, { req }]) => [
        name,
        exitRule(req),
      ]),
    ),
  },
});

/** The regions DR's helpers reach, by id: an exit may call any. */
const HELPERS_REACH = Object.values(DR_RULES.helpers).flatMap(({ req }) =>
  [...req.matchAll(REACH)].map((m) => m[1] ?? ""),
);

// ---------------------------------------------------------------------------
// The graph

/** An exit of the built world: where it leaves from and leads, and its rule. */
export interface DrExit {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  req: string;
  /**
   * A dungeon's trapped door, no exit to traverse (BaseClasses.py:646),
   * which DR's code walking the connections still reads.
   */
  readonly blocked?: boolean;
}

/** The locations a region holds in a mode. */
const locationsIn = (region: DrRegion, mode: DrMode): readonly string[] =>
  region.locations.filter(
    (name) => region.locationModes?.[name]?.includes(mode) ?? true,
  );

/**
 * Every exit of the world that leads somewhere, with its rule of
 * rules.json: the connected static exits (a dungeon's trapped door
 * blocked, but a portal's), the flute and mirror exits, Standard's
 * save-and-quit to Uncle, the test's start exits.
 */
function exitsOf(
  connections: DrConnections,
  mode: DrMode,
  options: DrWorldOptions,
  lobbies: ReadonlySet<string> = PORTAL_DOORS,
): DrExit[] {
  const found: DrExit[] = [];
  const { doors } = options;
  for (const region of DR_REGIONS) {
    for (const name of region.exits) {
      const to = connections.get(name);
      if (to === undefined) continue;
      const door = DOOR_NAMED.get(name);
      const blocked =
        region.type === "dungeon" &&
        door !== undefined &&
        (doors === undefined
          ? door.trapped === true && !lobbies.has(name)
          : isShut(door, doors, lobbies));
      found.push({
        ...(blocked ? { blocked } : {}),
        from: region.name,
        name,
        req: DR_RULES.entrances[name]?.req ?? "true",
        to,
      });
    }
  }
  const dynamic: readonly DrDynamicExit[] = dynamicExits(mode);
  for (const exit of dynamic) found.push({ ...exit });
  if (mode === "standard") found.push({ ...UNCLE_SAVE_AND_QUIT });
  for (const name of options.start ?? [])
    found.push({
      from: MENU,
      name: `Test Start: ${name}`,
      req: "true",
      to: name,
    });
  return found;
}

/**
 * set_big_bomb_rules / set_inverted_big_bomb_rules (Rules.py:1614, :1846):
 * the Pyramid Fairy's rule gains the case of the door the Big Bomb Shop is
 * entered by, its region's first entrance.
 */
function addBombShopRule(
  exits: readonly DrExit[],
  mode: DrMode,
  version: number,
): void {
  const door = exits.find((e) => e.to === "Big Bomb Shop")?.name;
  const inverted = mode === "inverted";
  const { cases, spot } = DR_RULES.bombShop;
  const found = cases.find(
    (c) =>
      door !== undefined &&
      c.doors.includes(door) &&
      ((c as { when?: string }).when === "setting(invertedMode)") === inverted,
  );
  const target = exits.find((e) => e.name === spot);
  if (found === undefined || target === undefined) return;
  // Before 1.5.7 (9f688f8) the Kings Grave case read the region "West Dark
  // World", which DR's world no longer had: can_reach raised whenever the
  // fill came to it, so no seed of those releases took that way
  const req =
    version < 157 && found.doors.includes("Kings Grave")
      ? found.req.replace(/reach\(villageOfOutcasts\)/g, "false")
      : found.req;
  target.req = and(target.req, req);
}

/** The worlds' light and dark regions (mark_light_dark_world_regions). */
export function markWorlds(exits: readonly DrExit[]): {
  readonly light: ReadonlySet<string>;
  readonly dark: ReadonlySet<string>;
} {
  const out = new Map<string, string[]>();
  for (const exit of exits)
    out.set(exit.from, [...(out.get(exit.from) ?? []), exit.to]);
  // From every region of a world, through its exits, never into the other
  // world (Regions.py:1113-1140)
  const mark = (type: string, other: string) => {
    const seen = new Set(
      DR_REGIONS.filter((r) => r.type === type).map((r) => r.name),
    );
    const queue = [...seen];
    for (let name = queue.shift(); name !== undefined; name = queue.shift())
      for (const to of out.get(name) ?? []) {
        if (seen.has(to) || regionNamed(to).type === other) continue;
        seen.add(to);
        queue.push(to);
      }
    return seen;
  };
  return { dark: mark("dw", "lw"), light: mark("lw", "dw") };
}

/**
 * The derived settings rules.json names, by what the connections make of
 * them: a region's world (is_light_world, is_dark_world, and is_not_bunny's
 * side, light but in Inverted), the swamp's patch, the doors' flags.
 */
function derivedSettings(
  connections: DrConnections,
  marked: ReturnType<typeof markWorlds>,
  mode: DrMode,
): Settings {
  const derived: Record<string, boolean> = {};
  for (const [name, { kind, region }] of Object.entries(DR_RULES.derived)) {
    const of = region ?? "";
    if (name.startsWith("notBunny_"))
      derived[name] =
        mode === "inverted" ? marked.dark.has(of) : marked.light.has(of);
    else if (kind === "lightWorld") derived[name] = marked.light.has(of);
    else if (kind === "darkWorld") derived[name] = marked.dark.has(of);
    else if (kind === "swampPatch") {
      // EntranceShuffle2.py:141-143: required once either door is known to
      // lead elsewhere; while one is not noted, not required (the mirror
      // asked), which only asks more
      const dam = connections.get("Dam");
      const swamp = connections.get("Swamp Palace");
      derived[name] =
        (dam !== undefined && dam !== "Dam") ||
        (swamp !== undefined && swamp !== "Swamp Portal");
    } else if (kind === "door")
      derived[name] = DR_RULES.doorData[name]?.vanilla ?? false;
    // add_conditional_lamps (Rules.py:1359-1366): the sewers lit in
    // Standard (sewer_light_cone); a door shuffle's pools, shuffle.ts
    else if (kind === "litRoom")
      derived[name] =
        mode === "standard" &&
        (DR_RULES.derived[name] as { sewer?: boolean }).sewer === true;
    else throw new RangeError(`No derived setting of kind ${kind}`);
  }
  return derived;
}

/** A region's side, which enemy rules read (lightWorld_, darkWorld_). */
const SIDE_READ = /setting\((?:lightWorld|darkWorld)_\w+\)/g;

/**
 * A rule that reads regions' sides (is_light_world, is_dark_world: Regions.
 * py:1113-1140), held in every side they may take: what a region is marked
 * grows with the entrances noted, a cave entered from both worlds is both,
 * and a rule may read either way. Each read is set true and false in turn
 * and the rule asks all; past four reads it is maybe.
 */
export function everySide(req: string): string {
  const reads = [...new Set(req.match(SIDE_READ) ?? [])];
  if (reads.length === 0) return req;
  if (reads.length > 4) return "maybe";
  const cases: string[] = [];
  for (let bits = 0; bits < 1 << reads.length; bits++) {
    let one = req;
    reads.forEach((read, i) => {
      const side = ((bits >> i) & 1) === 1;
      // A negated read first: the engine takes no `!true`
      one = one
        .split(`!${read}`)
        .join(side ? "false" : "true")
        .split(read)
        .join(side ? "true" : "false");
    });
    cases.push(one);
  }
  return and(...cases);
}

/** DR's settings beside the pack's, at their defaults (CLI.py, args.json). */
export const DR_DEFAULTS: Settings = {
  bombBag: false,
  cantTakeDamage: false,
  completionistGoal: false,
  // key_logic_algorithm dangerous: a door asks its worst case uncapped
  dangerousKeyLogic: false,
  // dropshuffle and pottery: the enemies' and the pots' vanilla keys are
  // forced items, events DR sweeps (keys.ts)
  dropShuffle: false,
  // The DR release the seed was built by, as its ROM title's digits (158
  // for 1.5.8): where a later release asks less than an earlier one, the
  // world asks it only of a seed known to be that release's or later
  // (vanillaConnections). 1.5.6 stands for an older or unknown one too;
  // where a later release asks more, the world always asks it
  drVersion: 156,
  // Pots or enemy drops of the dungeons beyond their keys (pottery beyond
  // keys and caves, the drops of every enemy): adjust_locations adds them
  // to the dungeons before DR's key analysis counts their locations
  // (Main.py:164 before link_doors at :216), which the port's analysis does
  // not, so their key doors ask every key of the dungeon (strict-safe)
  dungeonPotsAndDrops: false,
  ganonHuntGoal: false,
  openPyramid: false,
  potKeys: false,
  // potshuffle: a pot may move, the spikes' key pot onto the spikes
  potShuffle: false,
  pottery: false,
  // restrict_boss_items other than none: a boss's items behind its map
  // and compass
  restrictBossItems: false,
  retroBow: false,
  // key_logic_algorithm static: the entrance randomizer's key rules over
  // DR's analysis, chest keys alone (static.ts)
  staticKeyLogic: false,
  // key_logic_algorithm strict (with wild keys, all the chests' keys)
  strictKeyLogic: false,
  treasureHunt: 0,
  triforceHuntGoal: false,
  trinityGoal: false,
  universalKeys: false,
  vanillaDoors: true,
};

/**
 * The engine's graph: a node per DR region and crystal state (crystal.ts),
 * the Menu its start, each exit with its rule in the state it leaves from
 * (reach() as facts), each location with its own (a crystal read as the
 * reach of that state's node), a probe on each exit asked for, a fact
 * location in each region a rule reads the reach of and in each node whose
 * state a rule reads.
 */
function graph(
  exits: readonly DrExit[],
  locations: ReadonlyMap<string, string>,
  mode: DrMode,
  options: DrWorldOptions,
  reached: ReadonlySet<string>,
  added: ReadonlyMap<string, readonly string[]>,
  helperBodies: readonly string[] = [],
): {
  world: World;
  locationIds: Map<string, string>;
  crystalFacts: { item: string; location: string }[];
} {
  const passable = exits.filter((e) => e.blocked !== true);
  const nodes = crystalNodes(crystalStates(passable));
  const out = new Map<string, DrExit[]>();
  const exitNamed = new Map(exits.map((e) => [e.name, e]));
  for (const exit of passable)
    out.set(exit.from, [...(out.get(exit.from) ?? []), exit]);
  // The crystal reads the exits and helpers make, each a fact
  const crystalRead = new Set<string>();
  for (const req of [
    ...exits.map((e) => e.req),
    ...Object.values(DR_RULES.helpers).map((h) => h.req),
    ...helperBodies,
  ])
    for (const m of req.matchAll(CRYSTAL_READ)) crystalRead.add(m[0]);
  const crystalFacts: { item: string; location: string }[] = [];
  /** A location's rule: each crystal read the reach of its node. */
  const locationRule = (req: string) =>
    unknownCountRequirement(
      req
        .replace(EVENT_READ, (event) => readFact(event))
        .replace(CRYSTAL_READ, (_, colour: string, id: string) => {
          const region = REGION_BY_ID.get(id);
          const s = colour === "Blue" ? "blue" : "orange";
          return region !== undefined && nodes.statesOf(region).includes(s)
            ? `reach(${nodes.nodeOf(region, s)})`
            : "false";
        }),
    );
  const probes = new Map<string, string[]>();
  for (const name of options.probes ?? []) {
    const exit = exitNamed.get(name);
    if (exit === undefined) throw new RangeError(`No exit "${name}" to probe`);
    probes.set(exit.from, [...(probes.get(exit.from) ?? []), name]);
  }
  const locationIds = new Map<string, string>();
  const regions: Region[] = [];
  for (const r of DR_REGIONS) {
    const located: Location[] = [
      ...locationsIn(r, mode),
      ...(added.get(r.name) ?? []),
    ].map((name) => {
      const id = drLocationId(name);
      locationIds.set(name, id);
      return { id, req: locationRule(locations.get(name) ?? "true") };
    });
    for (const name of probes.get(r.name) ?? [])
      located.push({
        id: probeId(name),
        req: locationRule(exitNamed.get(name)?.req ?? "true"),
      });
    if (options.regions?.includes(r.name) === true)
      located.push({ id: regionProbeId(r.name) });
    if (reached.has(r.id)) located.push({ id: factOf(r.id) });
    const states = nodes.statesOf(r);
    const split = nodes.isSplit(r);
    for (const s of states.length === 0 ? [undefined] : states) {
      const leaving: Exit[] = (out.get(r.name) ?? []).flatMap((exit) => {
        const to = regionNamed(exit.to);
        const req = exitRule(
          s === undefined ? exit.req : inState(exit.req, r, s),
        );
        const through =
          to.type !== "dungeon"
            ? [undefined]
            : s === undefined
              ? (["orange"] as const)
              : crystalsThrough(exit.name, s);
        return through.map((t) => ({ req, to: nodes.nodeOf(to, t) }));
      });
      const facts: Location[] = [];
      if (s !== undefined) {
        const fact = `${s === "blue" ? "reachedBlue" : "reachedOrange"}_${r.id}`;
        if (crystalRead.has(fact)) {
          facts.push({ id: fact });
          crystalFacts.push({ item: fact, location: fact });
        }
      }
      if (split)
        regions.push({
          exits: [...leaving, { to: r.id }],
          id: nodes.nodeOf(r, s),
          locations: facts,
        });
      else
        regions.push({
          exits: leaving,
          id: r.id,
          locations: [...located, ...facts],
        });
    }
    if (split) regions.push({ exits: [], id: r.id, locations: located });
  }
  return {
    crystalFacts: [
      ...crystalFacts,
      // Read but never given: the state no path brings the region in
    ],
    locationIds,
    world: { regions, start: regionNamed(MENU).id },
  };
}

const REGION_BY_ID = new Map(DR_REGIONS.map((r) => [r.id, r]));

/**
 * The flood switches DR holds back while their trench's pot is unchecked:
 * flooding drowns the pot (location_can_be_flooded, BaseClasses.py:1107-
 * 1109) and closes the dry paths to it (Rules.py:417-419, 433). A logic
 * rule, not an order of play: every reach DR asks reads it (can_beat_game
 * :525, the fill's spheres Fill.py:760, :941, the playthrough Main.py:697,
 * :762), and the far sides of the trenches are reached only flooded
 * (Rules.py:423-428, 434-435). not_flooding_a_key (:1086-1093) passes the
 * switch once the pot is checked or holds no key or progress item;
 * _do_not_flood_the_keys (:1074-1084) holds its event back while the pot
 * holds anything unchecked (flooded_keys :3023-3026).
 */
const FLOODED_KEYS: Readonly<Record<string, string>> = {
  "Trench 1 Switch": "Swamp Palace - Trench 1 Pot Key",
  "Trench 2 Switch": "Swamp Palace - Trench 2 Pot Key",
};

/** The location ItemList.py adds for a triforce hunt (:200-212). */
const MURAHDAHLA = "Murahdahla";

/**
 * restrict_boss_items (Rules.py:810-825): each prize and boss of a dungeon
 * that has a prize, and Agahnim 2, behind the dungeon's compass and map
 * (Agahnim 1 too once doors shuffle, which this world does not). Maps and
 * compasses kept in their dungeons are not recorded: the rule is then
 * theirs or `maybe` (they may be in hand), never `no`.
 * @param recorded - Whether the player records maps and compasses (wild)
 */
function addBossItemRules(
  locations: Map<string, string>,
  recorded: boolean,
): void {
  const behind = (location: string, dungeon: string) => {
    const code = DR_KEY_CODES[dungeon];
    if (code === undefined || !locations.has(location)) return;
    const items = `compass${code} & map${code}`;
    locations.set(
      location,
      and(
        locations.get(location) ?? "true",
        recorded ? items : or(items, "maybe"),
      ),
    );
  };
  for (const dungeon of DR_DUNGEONS) {
    if (dungeon.prize === null) continue;
    const name = dungeon.name.startsWith("Thieves")
      ? "Thieves' Town"
      : dungeon.name;
    behind(dungeon.prize, dungeon.name);
    behind(`${name} - Boss`, dungeon.name);
  }
  behind("Agahnim 2", "Ganons Tower");
}

/**
 * Mire's spikes' key pot (Rules.py:530-533): where pot shuffle lands it on
 * the spikes, it takes the spike chest's rule; where it lands is unknown,
 * so the rule or maybe.
 */
function addSpikesPotRule(locations: Map<string, string>): void {
  const pot = "Misery Mire - Spikes Pot Key";
  const spikes = DR_RULES.locations["Misery Mire - Spike Chest"]?.req;
  if (spikes === undefined || !locations.has(pot)) return;
  locations.set(pot, and(locations.get(pot) ?? "true", or(spikes, "maybe")));
}

/**
 * How the run holds its small keys (keyshuffle, key_logic_algorithm):
 * strict logic reads its own rule only once keys are wild (Rules.py:
 * 2345-2347); `dangerous` is partial's holding, its doors asking their
 * worst case uncapped (`worldKeys`).
 */
export function keyHoldingOf(settings: Settings): KeyHolding {
  if (settings.universalKeys === true) return "universal";
  if (settings.wildKeys !== true) return "dungeon";
  return settings.strictKeyLogic === true ? "strict" : "wild";
}

/** The analyses run, by what they read of the settings. */
const KEY_LOGIC = new Map<string, ReadonlyMap<string, KeyLogic>>();

/**
 * DR's key analysis of the vanilla world for a run's settings
 * (key-analysis/, vanilla_key_logic, DoorShuffle.py:226-313), once per
 * mode and the settings it reads.
 */
export function drKeyLogic(
  settings: Settings,
  noted?: { readonly connections: DrConnections; readonly key: string },
): ReadonlyMap<string, KeyLogic> {
  const all = { ...DR_DEFAULTS, ...settings };
  const mode = drModeOf(all);
  const keys = worldKeys(keyHoldingOf(all), {
    drops: all.dropShuffle === true,
    pots: all.potKeys === true,
  });
  const analysis = {
    accessibility:
      all.locationsAccessibility === true
        ? ("locations" as const)
        : ("items" as const),
    bigKeyShuffle: all.wildBigKeys === true,
    dropShuffleNone: all.dropShuffle !== true,
    forcedDrops: new Set(keys.forcedDrops.map((d) => d.location)),
    keyShuffle:
      keys.holding === "universal"
        ? ("universal" as const)
        : keys.holding === "dungeon"
          ? ("none" as const)
          : ("wild" as const),
    mode,
  };
  const id = JSON.stringify({
    ...analysis,
    forcedDrops: [...analysis.forcedDrops].sort(),
    noted: noted?.key,
  });
  let found = KEY_LOGIC.get(id);
  if (found === undefined) {
    found = vanillaKeyLogic(
      noted === undefined
        ? analysis
        : { ...analysis, connections: noted.connections, partial: true },
    );
    // The vanilla world's few analyses stay; a noted world's, one per note,
    // only the last few
    if (noted !== undefined) {
      const notedIds = [...KEY_LOGIC.keys()].filter((k) =>
        k.includes('"noted":'),
      );
      for (const old of notedIds.slice(0, Math.max(0, notedIds.length - 7)))
        KEY_LOGIC.delete(old);
    }
    KEY_LOGIC.set(id, found);
  }
  return found;
}

/**
 * DR's key analysis on a shuffled world's noted connections, for the
 * dungeons whose ways in are all known (portalsKnown): DR analyses its
 * world once every entrance is linked (vanilla_key_logic, DoorShuffle.py:
 * 136, after link_entrances_new), which the notes tell only part of. A
 * dungeon each of whose portals and drops is noted and stands in a region
 * reached from Link's House or Sanctuary through known entrances starts
 * and walks as DR's analysis of the whole world has it; any other keeps
 * the strict-safe rule (keys.ts). Standard's castle keeps it too: its side
 * portals wait on the escape (is_standard_inaccessible). A decoupled world,
 * whose exits lead elsewhere unnoted, has none.
 */
function notedKeyLogic(
  settings: Settings,
  mode: DrMode,
  entrances: DrNotedEntrances,
  connections: DrConnections,
  decoupled: boolean,
): ReadonlyMap<string, KeyLogic> | undefined {
  if (decoupled) return undefined;
  const key = JSON.stringify([
    entrances.shuffle,
    entrances.pool,
    Object.entries(entrances.noted).sort(),
    settings.drVersion,
  ]);
  const known = portalsKnown(mode, connections);
  if (mode === "standard") known.delete("Hyrule Castle");
  if (known.size === 0) return new Map();
  const logic = drKeyLogic(settings, { connections, key });
  return new Map([...logic].filter(([dungeon]) => known.has(dungeon)));
}

/** The probe's answers, by mode and release. */
const TR_ACCESS = new Map<string, TurtleRockAccess>();

/**
 * Which of Turtle Rock's ways in the vanilla world reaches with every item
 * but the dungeon's small keys (set_turtle_rock_rules, StaticKeyLogic.py:
 * 211-223): every other key door open and every big key held from 1.5.7
 * (4222a44, get_all_state(keys=True)), none before (keys=False). Its own
 * world, of partial key logic, answers once per mode and release.
 * get_all_state collects the item pool, then sweeps the events
 * (BaseClasses.py:350-413): Agahnim's defeats and Zelda's rescue are no
 * items of DR's but events, which the pack's state holds as items. With
 * the keys the sweep reaches both towers' Agahnim; without them it does
 * not (their key doors shut), so the probe holds them only then. Without
 * them Standard's probe finds no way out of the castle, as upstream says
 * (4222a44's message: "every TR entrance probe returned False").
 */
export function turtleRockAccess(
  mode: DrMode,
  version: number,
): TurtleRockAccess {
  const id = `${mode}/${version}`;
  const known = TR_ACCESS.get(id);
  if (known !== undefined) return known;
  const keys = version >= 157;
  const world = drWorld(
    {
      ...DR_DEFAULTS,
      ...settingsFromUpstream(mode),
      drVersion: version,
      wildBigKeys: true,
      wildKeys: true,
    },
    {
      doorRule: (dungeon) =>
        keys && dungeon !== "Turtle Rock" ? "true" : "false",
      regions: Object.values(TURTLE_ROCK_PROBES),
    },
  );
  const all = everything(settingsFromUpstream(mode));
  const state = keys
    ? all
    : Object.fromEntries(
        Object.entries(all).filter(
          ([item]) => !/^(big)?[kK]ey|^defeatAgahnim|^rescueZelda$/.test(item),
        ),
      );
  const solution = solveFacts(world, state);
  const reached = (region: string) =>
    solution.location(regionProbeId(region)) === "yes";
  const access: TurtleRockAccess = {
    back: reached(TURTLE_ROCK_PROBES.back),
    bigChest: reached(TURTLE_ROCK_PROBES.bigChest),
    front: reached(TURTLE_ROCK_PROBES.front),
    middle: reached(TURTLE_ROCK_PROBES.middle),
  };
  TR_ACCESS.set(id, access);
  return access;
}

/** The static key logic built, by analysis, Turtle Rock's case and release. */
const STATIC_LOGIC = new WeakMap<
  ReadonlyMap<string, KeyLogic>,
  Map<string, ReadonlyMap<string, KeyLogic>>
>();

/** staticKeyLogic, once per analysis, case and release. */
function staticLogicOf(
  analysis: ReadonlyMap<string, KeyLogic>,
  trCase: TurtleRockCase | null,
  version: number,
): ReadonlyMap<string, KeyLogic> {
  let byKey = STATIC_LOGIC.get(analysis);
  if (byKey === undefined) {
    byKey = new Map();
    STATIC_LOGIC.set(analysis, byKey);
  }
  const id = `${trCase}/${version}`;
  let found = byKey.get(id);
  if (found === undefined) {
    found = staticKeyLogic(analysis, trCase, version);
    byKey.set(id, found);
  }
  return found;
}

/**
 * The Door Randomizer's world for a run's settings, its doors and
 * entrances vanilla, compiled: once per settings change.
 * @param settings - The pack's settings and DR's (DR_DEFAULTS)
 */
export function drWorld(
  settings: Settings,
  options: DrWorldOptions = {},
): DrWorld {
  const all = { ...DR_DEFAULTS, ...settings };
  const mode = drModeOf(all);
  const keys = worldKeys(
    keyHoldingOf(all),
    { drops: all.dropShuffle === true, pots: all.potKeys === true },
    {
      unrecorded: new Set(options.unrecorded),
      wild: all.wildBigKeys === true,
    },
    all.dangerousKeyLogic === true,
  );
  const version = Number(all.drVersion);
  const { doors } = options;
  const noted =
    options.entrances === undefined
      ? undefined
      : notedConnections(mode, options.entrances, version, doors);
  const connections =
    noted?.connections ??
    options.connections ??
    vanillaConnections(mode, version, doors);
  const lobbies = lobbiesOf(doors);
  const lobbyDoors = new Set(lobbies.values());
  const exits = exitsOf(connections, mode, options, lobbyDoors);
  const dungeonOfRoom =
    doors === undefined ? undefined : roomDungeons(exits, lobbies, doors);
  if (doors !== undefined && dungeonOfRoom !== undefined) {
    const route = sanctuaryRoute(doors, dungeonOfRoom, lobbies);
    if (route !== undefined && !connections.has(route.name)) exits.push(route);
  }
  const locations = new Map<string, string>();
  for (const region of DR_REGIONS)
    for (const name of locationsIn(region, mode))
      locations.set(name, DR_RULES.locations[name]?.req ?? "true");
  // The locations ItemList.py adds: Murahdahla, in a triforce hunt (:200-212)
  const added = new Map<string, string[]>();
  if (all.triforceHuntGoal === true || all.trinityGoal === true) {
    added.set("Hyrule Castle Courtyard", [MURAHDAHLA]);
    // Rules.py:72
    locations.set(
      MURAHDAHLA,
      "count(triforcePiece, powerStar) >= setting(treasureHunt)",
    );
  }
  for (const { name, region } of options.dropsAndPots ?? []) {
    if (locations.has(name)) continue;
    // Throws for a region DR's world does not have
    const at = regionNamed(region).name;
    added.set(at, [...(added.get(at) ?? []), name]);
    locations.set(name, DR_RULES.locations[name]?.req ?? "true");
  }
  // A big key a vanilla drop holds (the escape's) is the item DR's rules
  // read: its fact stands for it wherever they do
  for (const drop of keys.forcedDrops) {
    if (!drop.big) continue;
    const item = new RegExp(`\\bbigKey${DR_KEY_CODES[drop.dungeon]}\\b`, "g");
    const rule = keys.bigKeyRule(drop.dungeon);
    for (const exit of exits) exit.req = exit.req.replace(item, rule);
    for (const [name, req] of locations)
      locations.set(name, req.replace(item, rule));
  }
  const marked = markWorlds(exits);
  const derived = {
    ...derivedSettings(connections, marked, mode),
    ...(doors === undefined || dungeonOfRoom === undefined
      ? {}
      : shuffledDoorSettings(doors, lobbyDoors, dungeonOfRoom, mode)),
  };
  // DoorShuffle.py:640-643: a Swamp portal on another lobby needs the patch
  if (
    doors !== undefined &&
    doors.settings.intensity >= 3 &&
    lobbies.has("Swamp") &&
    lobbies.get("Swamp") !== "Swamp Lobby S"
  )
    for (const [name, { kind }] of Object.entries(DR_RULES.derived))
      if (kind === "swampPatch") derived[name] = true;
  // A shuffled world's sides are known once every entrance is: until then
  // a rule reading a region's side holds in each side it may still take
  if (noted !== undefined && !noted.complete) {
    for (const exit of exits) exit.req = everySide(exit.req);
    for (const [name, req] of locations) locations.set(name, everySide(req));
  }
  // In set_rules' order: global_rules (the key logic, the boss items, the
  // spikes' pot), standard_rules, the static key logic's own rules
  // (Rules.py:56-58 at 1.5.8), the bomb shop, the bunny last. The static
  // key logic sets its doors' rules first, at link_doors (DoorShuffle.py:
  // 55-57 at 1.5.8), over DR's analysis: none without one (strict-safe)
  const { doorRule } = options;
  const analysis =
    all.dungeonPotsAndDrops === true || doors !== undefined
      ? undefined
      : noted !== undefined && options.entrances !== undefined
        ? // The static key logic's Turtle Rock probe reads the vanilla
          // world, and its table stands over the analysis: strict-safe
          all.staticKeyLogic === true
          ? undefined
          : notedKeyLogic(
              all,
              mode,
              options.entrances,
              connections,
              noted.decoupled,
            )
        : options.connections === undefined
          ? drKeyLogic(all)
          : undefined;
  const isStatic = all.staticKeyLogic === true && analysis !== undefined;
  const trCase = isStatic
    ? turtleRockCase(turtleRockAccess(mode, version))
    : null;
  if (doors !== undefined && dungeonOfRoom !== undefined)
    addShuffledDoorRules(exits, locations, keys, doors, dungeonOfRoom, mode);
  else
    addKeyRules(
      exits,
      locations,
      doorRule === undefined
        ? keys
        : {
            ...keys,
            doorRule: (dungeon, rule, logic) =>
              doorRule(dungeon, rule, logic, keys),
          },
      mode,
      isStatic ? staticLogicOf(analysis, trCase, version) : analysis,
    );
  if (all.restrictBossItems === true)
    addBossItemRules(
      locations,
      all.wildMaps === true && all.wildCompasses === true,
    );
  if (all.potShuffle === true) addSpikesPotRule(locations);
  if (mode === "standard") {
    const blank = { ...all, ...derived };
    const path = zeldaPath(
      exits,
      (req) =>
        evaluate(parse(exitRule(req)), {}, LOADED_RULES, {
          settings: blank,
        }) === "yes",
    );
    addZeldaPath(exits, locations, path);
  }
  if (isStatic) addStaticKeyRules(exits, locations, keys, mode, trCase);
  addBombShopRule(exits, mode, version);
  const bunny = addBunnyRules(exits, locations, marked, mode, added);
  const bunnyBodies = [...bunny.values()];

  // The events: each a fact once its location is reached. A flood switch
  // waits on its trench's pot: on the vanilla key's fact, or on the pot
  // reached (a fact of its own), maybe before, as the item it holds may be
  // neither a key nor progress, which DR floods over
  const sweep = options.sweepEvents ?? true;
  const potFacts: { item: string; location: string }[] = [];
  for (const { location } of Object.values(DR_RULES.events)) {
    const pot = FLOODED_KEYS[location];
    if (pot === undefined || !locations.has(location)) continue;
    const drop = keys.forcedDrops.find((d) => d.location === pot);
    const fact = drop?.fact ?? `potReached_${dropKeyFact(pot)}`;
    if (drop === undefined)
      potFacts.push({ item: fact, location: drLocationId(pot) });
    locations.set(
      location,
      and(
        locations.get(location) ?? "true",
        drop === undefined ? or(readFact(fact), "maybe") : readFact(fact),
      ),
    );
  }

  // The regions a rule reads the reach of where only a fact can stand
  const reached = new Set([
    ...HELPERS_REACH,
    ...bunnyBodies.flatMap((req) =>
      [...req.matchAll(REACH)].map((m) => m[1] ?? ""),
    ),
    ...exits
      .filter((e) => e.blocked !== true)
      .flatMap((e) => [...e.req.matchAll(REACH)].map((m) => m[1] ?? "")),
  ]);
  const { crystalFacts, locationIds, world } = graph(
    exits,
    locations,
    mode,
    options,
    reached,
    added,
    bunnyBodies,
  );
  const events = Object.entries(DR_RULES.events).flatMap(
    ([item, { location }]) => {
      const id = locationIds.get(location);
      return sweep && id !== undefined ? [{ item, location: id }] : [];
    },
  );
  const drops = sweep
    ? keys.forcedDrops.flatMap((d) => {
        const id = locationIds.get(d.location);
        return id === undefined ? [] : [{ item: d.fact, location: id }];
      })
    : [];
  const facts = [
    ...events,
    ...drops,
    ...(sweep ? potFacts : []),
    ...crystalFacts,
    ...[...reached].map((id) => ({ item: factOf(id), location: factOf(id) })),
  ].map((fact) => ({ ...fact, maybe: maybeOf(fact.item) }));
  const crystalItems = [
    ...exits.map((e) => e.req),
    ...bunnyBodies,
    ...Object.values(DR_RULES.helpers).map((h) => h.req),
  ].flatMap((req) => [...req.matchAll(CRYSTAL_READ)].map((m) => m[0]));
  // The bunny's helpers beside DR's, read as an exit reads a rule
  const rules =
    bunny.size === 0
      ? LOADED_RULES
      : {
          groups: LOADED_RULES.groups,
          helpers: new Map([
            ...LOADED_RULES.helpers,
            ...[...bunny].map(
              ([name, req]) => [name, parse(exitRule(req))] as const,
            ),
          ]),
        };
  const compiled = compileWorld(world, rules, {
    items: [
      ...new Set([
        ...STATE_NAMES,
        ...(options.items ?? []),
        ...DR_RULES.newItems,
        ...Object.keys(DR_RULES.events),
        ...KEY_ITEMS,
        ...[
          ...Object.keys(DR_RULES.events),
          ...KEY_DROPS.map((d) => d.fact),
          ...crystalItems,
          ...facts.map((f) => f.item),
          ...potFacts.map((f) => f.item),
        ].flatMap((fact) => [fact, maybeOf(fact)]),
      ]),
    ],
    settings: { ...all, ...derived },
  });
  return {
    compiled,
    facts,
    locationIds,
    ...(dungeonOfRoom === undefined ? {} : { roomDungeons: dungeonOfRoom }),
  };
}
