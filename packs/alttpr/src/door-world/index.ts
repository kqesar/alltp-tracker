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
// switches' states (crystal.ts) and the keys, strict-safe until DR's key
// analysis is ported (keys.ts).
import {
  type CompiledWorld,
  compileWorld,
  type Exit,
  type Location,
  loadRules,
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
  DR_REGIONS,
  DR_RULES,
  type DrMode,
  type DrRegion,
  regionNamed,
} from "./data";
import { addKeyRules, KEY_DROPS, KEY_ITEMS, worldKeys } from "./keys";
import { and } from "./text";

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

/**
 * A rule as an exit (or a helper) reads it: each reach() a fact, as each
 * crystal read is (`reachedBlue_<id>`, given in that state's node).
 */
const exitRule = (req: string): string =>
  unknownCountRequirement(req.replace(REACH, (_, id) => factOf(id)));

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
}

/** The locations a region holds in a mode. */
const locationsIn = (region: DrRegion, mode: DrMode): readonly string[] =>
  region.locations.filter(
    (name) => region.locationModes?.[name]?.includes(mode) ?? true,
  );

/**
 * Every exit of the world that leads somewhere, with the rule DR ends with
 * before the bunny's: the connected static exits (a dungeon's trapped door
 * is no exit, BaseClasses.py:646, but a portal's), the flute and mirror
 * exits, the test's start exits.
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
      if (
        region.type === "dungeon" &&
        door?.trapped === true &&
        !PORTAL_DOORS.has(name)
      )
        continue;
      found.push({
        from: region.name,
        name,
        req: DR_RULES.entrances[name]?.req ?? "true",
        to,
      });
    }
  }
  const dynamic: readonly DrDynamicExit[] = dynamicExits(mode);
  for (const exit of dynamic) found.push({ ...exit });
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
  ganonHuntGoal: false,
  openPyramid: false,
  potKeys: false,
  pottery: false,
  retroBow: false,
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
): {
  world: World;
  locationIds: Map<string, string>;
  crystalFacts: { item: string; location: string }[];
} {
  const nodes = crystalNodes(crystalStates(exits));
  const out = new Map<string, DrExit[]>();
  const exitNamed = new Map(exits.map((e) => [e.name, e]));
  for (const exit of exits)
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
      req.replace(CRYSTAL_READ, (_, colour: string, id: string) => {
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
    const located: Location[] = locationsIn(r, mode).map((name) => {
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
  const universal = all.universalKeys === true;
  const keys = worldKeys(universal, {
    drops: all.dropShuffle === true,
    pots: all.potKeys === true,
  });
  const connections = vanillaConnections(mode);
  const exits = exitsOf(connections, mode, options);
  const locations = new Map<string, string>();
  for (const region of DR_REGIONS)
    for (const name of locationsIn(region, mode))
      locations.set(name, DR_RULES.locations[name]?.req ?? "true");
  // In set_rules' order: the key logic (global_rules), the bomb shop, the
  // bunny last
  addKeyRules(exits, locations, keys, mode, universal);
  addBombShopRule(exits, mode);
  const marked = markWorlds(exits);
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
    ...exits.flatMap((e) => [...e.req.matchAll(REACH)].map((m) => m[1] ?? "")),
  ]);
  const { crystalFacts, locationIds, world } = graph(
    exits,
    locations,
    mode,
    options,
    reached,
    extra,
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
  ];
  const crystalItems = [
    ...exits.map((e) => e.req),
    ...Object.values(DR_RULES.helpers).map((h) => h.req),
  ].flatMap((req) => [...req.matchAll(CRYSTAL_READ)].map((m) => m[0]));
  const compiled = compileWorld(world, LOADED_RULES, {
    items: [
      ...new Set([
        ...STATE_NAMES,
        ...DR_RULES.newItems,
        ...Object.keys(DR_RULES.events),
        ...KEY_ITEMS,
        ...KEY_DROPS.map((d) => d.fact),
        ...crystalItems,
        ...facts.map((f) => f.item),
      ]),
    ],
    settings: {
      ...all,
      ...derivedSettings(connections, marked, mode),
    },
  });
  return { compiled, facts, locationIds };
}
