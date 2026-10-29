// The Door Randomizer's world: its regions, its exits as the connections
// link them, and the rules DR's Rules.py gives each (translated by
// scripts/dr-rules.mjs into door-rando/world/rules.json), compiled for the
// engine. Read from aerinon/ALttPDoorRandomizer at the release
// upstream.json pins (doorRandomizer). What the translation leaves to the
// world, it ports here: the save-and-quit points (Rules.py:194-201, the
// Menu every exit of which DR reaches), the flute and mirror exits DR makes
// in code (OverworldShuffle.py:31-73), the bomb shop's case
// (set_big_bomb_rules, Rules.py:1610), the bunny's paths (set_bunny_rules,
// Rules.py:2035, bunny.ts) and what the derived settings read of the
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
import type { FactWorld } from "../facts";
import { STATE_NAMES } from "../pack";
import { RULES } from "../rules";
import { unknownCountRequirement } from "../unknown-counts";
import { addBunnyRules } from "./bunny";
import {
  type DrConnections,
  type DrDynamicExit,
  dynamicExits,
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
  regionNamed,
} from "./data";
import {
  type DoorRule,
  type KeyLogic,
  vanillaKeyLogic,
} from "./key-analysis/analysis";
import {
  addKeyRules,
  DR_KEY_CODES,
  KEY_DROPS,
  KEY_ITEMS,
  type KeyHolding,
  type WorldKeys,
  worldKeys,
} from "./keys";
import { addZeldaPath, UNCLE_SAVE_AND_QUIT, zeldaPath } from "./standard";
import { and, maybeOf, or, readFact } from "./text";

export type { DrConnections } from "./connections";
export { vanillaConnections } from "./connections";
export type { DrMode } from "./data";

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
  /** Test only: items the `doorRule` reads beside the pack's. */
  readonly items?: readonly string[];
}

/** A compiled Door Randomizer world, its facts and its locations' ids. */
export interface DrWorld extends FactWorld {
  readonly compiled: CompiledWorld;
  /** The engine's id of each DR location, by DR's name. */
  readonly locationIds: ReadonlyMap<string, string>;
}

/** The engine's id of the Menu, DR's start (BaseClasses.py:610-614). */
const MENU = "Menu";

/** The id of a DR location: the pack's slug, vt's name where it differs. */
export const drLocationId = (name: string): string => erLocationId(name);

/** The id of a probe on an exit. */
export const probeId = (exit: string): string => `exit:${exit}`;

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
): DrExit[] {
  const found: DrExit[] = [];
  for (const region of DR_REGIONS) {
    for (const name of region.exits) {
      const to = connections.get(name);
      if (to === undefined) continue;
      const door = DOOR_NAMED.get(name);
      const blocked =
        region.type === "dungeon" &&
        door?.trapped === true &&
        !PORTAL_DOORS.has(name);
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
 * set_big_bomb_rules / set_inverted_big_bomb_rules (Rules.py:1610, :1842):
 * the Pyramid Fairy's rule gains the case of the door the Big Bomb Shop is
 * entered by, its region's first entrance.
 */
function addBombShopRule(exits: readonly DrExit[], mode: DrMode): void {
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
  if (found !== undefined && target !== undefined)
    target.req = and(target.req, found.req);
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
    else if (kind === "swampPatch")
      // EntranceShuffle2.py:141-143
      derived[name] = !(
        connections.get("Dam") === "Dam" &&
        connections.get("Swamp Palace") === "Swamp Portal"
      );
    else if (kind === "door")
      derived[name] = DR_RULES.doorData[name]?.vanilla ?? false;
    else throw new RangeError(`No derived setting of kind ${kind}`);
  }
  return derived;
}

/** DR's settings beside the pack's, at their defaults (CLI.py, args.json). */
export const DR_DEFAULTS: Settings = {
  bombBag: false,
  cantTakeDamage: false,
  completionistGoal: false,
  // dropshuffle and pottery: the enemies' and the pots' vanilla keys are
  // forced items, events DR sweeps (keys.ts)
  dropShuffle: false,
  // Pots or enemy drops of the dungeons beyond their keys (pottery beyond
  // keys and caves, the drops of every enemy): adjust_locations adds them
  // to the dungeons before DR's key analysis counts their locations
  // (Main.py:234 before link_doors at :286), which the port's analysis does
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
  extra: ReadonlyMap<string, readonly Location[]>,
  added: ReadonlyMap<string, readonly string[]>,
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
    if (reached.has(r.id)) located.push({ id: factOf(r.id) });
    located.push(...(extra.get(r.name) ?? []));
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
 * The flood switches DR does not sweep while their trench's pot key is
 * unchecked (_do_not_flood_the_keys, BaseClasses.py:1074-1084,
 * flooded_keys :2982-2985): the event asks the key's location reached too.
 */
const FLOODED_KEYS: Readonly<Record<string, string>> = {
  "Trench 1 Switch": "Swamp Palace - Trench 1 Pot Key",
  "Trench 2 Switch": "Swamp Palace - Trench 2 Pot Key",
};

/** The location ItemList.py adds for a triforce hunt (:200-212). */
const MURAHDAHLA = "Murahdahla";

/**
 * restrict_boss_items (Rules.py:807-822): each prize and boss of a dungeon
 * that has a prize, and Agahnim 2, behind the dungeon's compass and map
 * (Agahnim 1 too once doors shuffle, which this world does not).
 */
function addBossItemRules(locations: Map<string, string>): void {
  const behind = (location: string, dungeon: string) => {
    const code = DR_KEY_CODES[dungeon];
    if (code === undefined || !locations.has(location)) return;
    locations.set(
      location,
      and(locations.get(location) ?? "true", `compass${code} & map${code}`),
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
 * Mire's spikes' key pot (Rules.py:527-530): where pot shuffle lands it on
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
 * 2345-2347); `dangerous` reads as partial, which the app notes.
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
 * (key-analysis/, vanilla_key_logic, DoorShuffle.py:222-309), once per
 * mode and the settings it reads.
 */
export function drKeyLogic(settings: Settings): ReadonlyMap<string, KeyLogic> {
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
  });
  let found = KEY_LOGIC.get(id);
  if (found === undefined) {
    found = vanillaKeyLogic(analysis);
    KEY_LOGIC.set(id, found);
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
  );
  const connections = options.connections ?? vanillaConnections(mode);
  const exits = exitsOf(connections, mode, options);
  const locations = new Map<string, string>();
  for (const region of DR_REGIONS)
    for (const name of locationsIn(region, mode))
      locations.set(name, DR_RULES.locations[name]?.req ?? "true");
  // The locations ItemList.py adds: Murahdahla, in a triforce hunt (:200-212)
  const added = new Map<string, string[]>();
  if (all.triforceHuntGoal === true || all.trinityGoal === true) {
    added.set("Hyrule Castle Courtyard", [MURAHDAHLA]);
    // Rules.py:69
    locations.set(
      MURAHDAHLA,
      "count(triforcePiece, powerStar) >= setting(treasureHunt)",
    );
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
  const derived = derivedSettings(connections, marked, mode);
  // In set_rules' order: global_rules (the key logic, the boss items, the
  // spikes' pot), standard_rules, the bomb shop, the bunny last
  const { doorRule } = options;
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
    options.connections === undefined && all.dungeonPotsAndDrops !== true
      ? drKeyLogic(all)
      : undefined,
  );
  if (all.restrictBossItems === true) addBossItemRules(locations);
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
  addBombShopRule(exits, mode);
  addBunnyRules(exits, locations, marked, mode);

  // The events: each a fact once its location is reached, a flood switch
  // once its trench's key is too
  const sweep = options.sweepEvents ?? true;
  const regionOf = new Map(
    DR_REGIONS.flatMap((r) => r.locations.map((l) => [l, r] as const)),
  );
  const extra = new Map<string, Location[]>();
  const eventLocation = new Map<string, string>();
  for (const [item, { location }] of Object.entries(DR_RULES.events)) {
    const key = FLOODED_KEYS[location];
    const region = regionOf.get(location);
    const keyRegion = key === undefined ? undefined : regionOf.get(key);
    if (
      key === undefined ||
      region === undefined ||
      keyRegion === undefined ||
      !keys.forcedDrops.some((d) => d.location === key)
    )
      continue;
    const id = `event:${item}`;
    eventLocation.set(item, id);
    extra.set(region.name, [
      ...(extra.get(region.name) ?? []),
      {
        id,
        req: unknownCountRequirement(
          and(
            locations.get(location) ?? "true",
            `reach(${keyRegion.id})`,
            locations.get(key) ?? "true",
          ),
        ),
      },
    ]);
  }

  // The regions a rule reads the reach of where only a fact can stand
  const reached = new Set([
    ...HELPERS_REACH,
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
    extra,
    added,
  );
  const events = Object.entries(DR_RULES.events).flatMap(
    ([item, { location }]) => {
      const id = eventLocation.get(item) ?? locationIds.get(location);
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
    ...crystalFacts,
    ...[...reached].map((id) => ({ item: factOf(id), location: factOf(id) })),
  ].map((fact) => ({ ...fact, maybe: maybeOf(fact.item) }));
  const crystalItems = [
    ...exits.map((e) => e.req),
    ...Object.values(DR_RULES.helpers).map((h) => h.req),
  ].flatMap((req) => [...req.matchAll(CRYSTAL_READ)].map((m) => m[0]));
  const compiled = compileWorld(world, LOADED_RULES, {
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
        ].flatMap((fact) => [fact, maybeOf(fact)]),
      ]),
    ],
    settings: { ...all, ...derived },
  });
  return { compiled, facts, locationIds };
}
