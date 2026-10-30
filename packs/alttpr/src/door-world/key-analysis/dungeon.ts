// What DR's key analysis walks (KeyDoorShuffle.py, DungeonGenerator.py's
// ExplorationState): each dungeon's regions with their doors, the
// overworld regions only a dungeon reaches (find_inaccessible_regions,
// DoorShuffle.py:3402-3437), which the walk crosses through the logical
// doors DR gives their exits (add_inaccessible_doors, :3494-3516), and the
// regions each dungeon's walk starts from (determine_entrance_list,
// :1199-1229, and vanilla_key_logic's loop over the builders, :226-279,
// with find_new_entrances, :1263-1300). Read from aerinon/
// ALttPDoorRandomizer at the release upstream.json pins (doorRandomizer).
// Only DR's own data feeds it: the regions, doors and connections of
// src/door-rando/world/, never an item rule (the analysis ignores them).
import {
  type DrConnections,
  dynamicExits,
  vanillaConnections,
} from "../connections";
import {
  DOOR_NAMED,
  DR_DOORS,
  DR_PORTALS,
  DR_REGIONS,
  type DrMode,
  REGION_NAMED,
  tableOf,
} from "../data";
import { KEY_DROPS, UGLY_SMALLS } from "../keys";

/** DR's dungeons, in the order create_dungeons lists them (Dungeons.py:30). */
export const DR_DUNGEON_ORDER: readonly string[] = [
  "Hyrule Castle",
  "Eastern Palace",
  "Desert Palace",
  "Tower of Hera",
  "Agahnims Tower",
  "Palace of Darkness",
  "Thieves Town",
  "Skull Woods",
  "Swamp Palace",
  "Ice Palace",
  "Misery Mire",
  "Turtle Rock",
  "Ganons Tower",
];

/** The vanilla small key doors (default_small_key_doors, DoorShuffle.py:4351-4439). */
export const DEFAULT_SMALL_KEY_DOORS: Readonly<
  Record<string, readonly (string | readonly [string, string])[]>
> = {
  "Agahnims Tower": [
    "Tower Room 03 Up Stairs",
    ["Tower Dark Maze ES", "Tower Dark Chargers WS"],
    "Tower Dark Archers Up Stairs",
    ["Tower Circle of Pots ES", "Tower Pacifist Run WS"],
  ],
  "Desert Palace": [
    ["Desert East Wing Key Door EN", "Desert Compass Key Door WN"],
    "Desert Tiles 1 Up Stairs",
    ["Desert Beamos Hall NE", "Desert Tiles 2 SE"],
    ["Desert Tiles 2 NE", "Desert Wall Slide SE"],
  ],
  "Eastern Palace": [
    ["Eastern Dark Square Key Door WN", "Eastern Cannonball Ledge Key Door EN"],
    "Eastern Darkness Up Stairs",
  ],
  "Ganons Tower": [
    ["GT Torch EN", "GT Hope Room WN"],
    ["GT Tile Room EN", "GT Speed Torch WN"],
    ["GT Hookshot ES", "GT Map Room WS"],
    ["GT Double Switch EN", "GT Spike Crystals WN"],
    ["GT Firesnake Room SW", "GT Warp Maze (Rails) NW"],
    ["GT Conveyor Star Pits EN", "GT Falling Bridge WN"],
    ["GT Mini Helmasaur Room WN", "GT Bomb Conveyor EN"],
    ["GT Crystal Circles SW", "GT Left Moldorm Ledge NW"],
  ],
  "Hyrule Castle": [
    ["Sewers Key Rat NE", "Sewers Secret Room Key Door S"],
    ["Sewers Dark Cross Key Door N", "Sewers Water S"],
    [
      "Hyrule Dungeon Map Room Key Door S",
      "Hyrule Dungeon North Abyss Key Door N",
    ],
    [
      "Hyrule Dungeon Armory Interior Key Door N",
      "Hyrule Dungeon Armory Interior Key Door S",
    ],
  ],
  "Ice Palace": [
    "Ice Jelly Key Down Stairs",
    ["Ice Conveyor SW", "Ice Bomb Jump NW"],
    ["Ice Spike Cross ES", "Ice Spike Room WS"],
    ["Ice Tall Hint SE", "Ice Lonely Freezor NE"],
    "Ice Backwards Room Down Stairs",
    ["Ice Switch Room ES", "Ice Refill WS"],
  ],
  "Misery Mire": [
    ["Mire Hub WS", "Mire Conveyor Crystal ES"],
    ["Mire Hub Right EN", "Mire Map Spot WN"],
    ["Mire Spikes NW", "Mire Ledgehop SW"],
    ["Mire Fishbone SE", "Mire Spike Barrier NE"],
    ["Mire Conveyor Crystal WS", "Mire Tile Room ES"],
    ["Mire Dark Shooters SE", "Mire Key Rupees NE"],
  ],
  "Palace of Darkness": [
    ["PoD Middle Cage N", "PoD Pit Room S"],
    ["PoD Arena Main NW", "PoD Falling Bridge SW"],
    ["PoD Falling Bridge WN", "PoD Dark Maze EN"],
    "PoD Basement Ledge Up Stairs",
    ["PoD Compass Room SE", "PoD Harmless Hellway NE"],
    ["PoD Dark Pegs WN", "PoD Lonely Turtle EN"],
  ],
  "Skull Woods": [
    ["Skull 1 Lobby WS", "Skull Pot Prison ES"],
    ["Skull Map Room SE", "Skull Pinball NE"],
    ["Skull 2 West Lobby NW", "Skull X Room SW"],
    ["Skull 3 Lobby NW", "Skull Star Pits SW"],
    ["Skull Spike Corner ES", "Skull Final Drop WS"],
  ],
  "Swamp Palace": [
    "Swamp Entrance Down Stairs",
    ["Swamp Pot Row WS", "Swamp Trench 1 Approach ES"],
    ["Swamp Trench 1 Key Ledge NW", "Swamp Hammer Switch SW"],
    ["Swamp Hub WN", "Swamp Crystal Switch EN"],
    ["Swamp Hub North Ledge N", "Swamp Push Statue S"],
    ["Swamp Waterway NW", "Swamp T SW"],
  ],
  "Thieves Town": [
    ["Thieves Hallway WS", "Thieves Pot Alcove Mid ES"],
    "Thieves Spike Switch Up Stairs",
    ["Thieves Conveyor Bridge WS", "Thieves Big Chest Room ES"],
  ],
  "Tower of Hera": ["Hera Lobby Key Stairs"],
  "Turtle Rock": [
    ["TR Hub NW", "TR Pokey 1 SW"],
    ["TR Pokey 1 NW", "TR Chain Chomps SW"],
    "TR Chain Chomps Down Stairs",
    ["TR Pokey 2 ES", "TR Lava Island WS"],
    "TR Crystaroller Down Stairs",
    ["TR Dash Bridge WS", "TR Crystal Maze ES"],
  ],
};

/** dungeon_portals (DungeonGenerator.py:4223-4237). */
const DUNGEON_PORTALS: Readonly<Record<string, readonly string[]>> = {
  "Agahnims Tower": ["Agahnims Tower"],
  "Desert Palace": [
    "Desert Back",
    "Desert South",
    "Desert West",
    "Desert East",
  ],
  "Eastern Palace": ["Eastern"],
  "Ganons Tower": ["Ganons Tower"],
  "Hyrule Castle": [
    "Hyrule Castle South",
    "Hyrule Castle West",
    "Hyrule Castle East",
    "Sanctuary",
  ],
  "Ice Palace": ["Ice"],
  "Misery Mire": ["Mire"],
  "Palace of Darkness": ["Palace of Darkness"],
  "Skull Woods": ["Skull 1", "Skull 2 East", "Skull 2 West", "Skull 3"],
  "Swamp Palace": ["Swamp"],
  "Thieves Town": ["Thieves Town"],
  "Tower of Hera": ["Hera"],
  "Turtle Rock": [
    "Turtle Rock Main",
    "Turtle Rock Lazy Eyes",
    "Turtle Rock Chest",
    "Turtle Rock Eye Bridge",
  ],
};

/** dungeon_drops (DungeonGenerator.py:4239-4242). */
const DUNGEON_DROPS: Readonly<Record<string, readonly string[]>> = {
  "Hyrule Castle": ["Sewers Rat Path"],
  "Skull Woods": [
    "Skull Pot Circle",
    "Skull Pinball",
    "Skull Left Drop",
    "Skull Back Drop",
  ],
};

/**
 * The portals link_doors_prep marks as destinations with vanilla
 * entrances (DoorShuffle.py:100-109), which should_delay_processing reads.
 */
const destinationPortals = (mode: DrMode): ReadonlySet<string> =>
  new Set([
    ...(mode === "standard" ? ["Sanctuary"] : []),
    "Desert East",
    ...(mode === "inverted"
      ? ["Desert West"]
      : ["Skull 2 West", "Turtle Rock Lazy Eyes", "Turtle Rock Eye Bridge"]),
  ]);

/** standard_starts (Dungeons.py:251-253). */
const STANDARD_STARTS: Readonly<Record<string, readonly string[]>> = {
  "Hyrule Castle": ["Hyrule Castle South"],
};

/** dungeon_events (Regions.py:1325-1336). */
export const DUNGEON_EVENTS: ReadonlySet<string> = new Set([
  "Trench 1 Switch",
  "Trench 2 Switch",
  "Swamp Drain",
  "Attic Cracked Floor",
  "Suspicious Maiden",
  "Revealing Light",
  "Ice Block Drop",
  "Skull Star Tile",
  "Zelda Pickup",
  "Zelda Drop Off",
]);

/** How the run sets what the analysis reads. */
export interface KeyAnalysisSettings {
  readonly mode: DrMode;
  /** keyshuffle: none (in their dungeon), wild, universal. */
  readonly keyShuffle: "none" | "wild" | "universal";
  /** bigkeyshuffle. */
  readonly bigKeyShuffle: boolean;
  /**
   * The key drops whose keys stay forced items (dropshuffle and pottery
   * leave them), by location name: the others are free locations whose
   * keys join their dungeon's (adjust_locations, Regions.py:1186-1199).
   */
  readonly forcedDrops: ReadonlySet<string>;
  /** accessibility: only `locations` changes the analysis. */
  readonly accessibility: "items" | "locations" | "none";
  /** dropshuffle is none (vanilla_key_logic's escape adjustment). */
  readonly dropShuffleNone: boolean;
  /** Where each exit leads: the vanilla world's by default. */
  readonly connections?: DrConnections;
  /**
   * A partly noted world's: a dungeon no way in starts (its doors not
   * noted) is left out rather than looped on, as DR's whole world never
   * has one (`Infinite loop detected`, DoorShuffle.py:251-252).
   */
  readonly partial?: boolean;
}

/** The crystal states DR's walk carries (CrystalBarrier). */
export type Crystal = "orange" | "blue" | "either";

/** A door as the walk reads it (BaseClasses.py Door). */
export interface KDoor {
  readonly name: string;
  readonly type: string;
  readonly smallKey: boolean;
  readonly bigKey: boolean;
  /** A barrier's colour, `either` for a door that hits a switch. */
  readonly crystal: Crystal | null;
  /** no_exit, but a portal's (connect_portal unblocks it). */
  readonly blocked: boolean;
  /** The door this one follows (controller_door), if any. */
  controller: KDoor | null;
  /** The door on the other side, if a door links to it (Door.dest). */
  dest: KDoor | null;
  /** The event that opens it (req_event), if any. */
  readonly reqEvent: string | null;
  /** The region it leads to (its entrance's connected_region). */
  to: KRegion | null;
}

/** A location as the walk reads it. */
export interface KLocation {
  readonly name: string;
  /** Its forced item, if a vanilla key drop the run leaves in place. */
  readonly forced: { readonly big: boolean; readonly dungeon: string } | null;
  /** Its region's dungeon, if any. */
  readonly dungeon: string | null;
}

/** A region as the walk reads it. */
export interface KRegion {
  readonly name: string;
  readonly isDungeon: boolean;
  readonly dungeon: string | null;
  readonly locations: readonly KLocation[];
  /** Its exits that are doors, in its exits' order (get_doors). */
  readonly doors: KDoor[];
}

/** The world the analysis walks, for one run's settings. */
export interface KeyWorld {
  readonly settings: KeyAnalysisSettings;
  readonly regions: ReadonlyMap<string, KRegion>;
  readonly doors: ReadonlyMap<string, KDoor>;
  /** find_inaccessible_regions. */
  readonly inaccessible: ReadonlySet<string>;
  /** Each dungeon's start regions (the key layout's start_regions). */
  readonly starts: ReadonlyMap<string, readonly KRegion[]>;
}

/** Python's str.rstrip(chars): every trailing character of the set. */
export function rstrip(text: string, chars: string): string {
  let end = text.length;
  while (end > 0 && chars.includes(text.charAt(end - 1))) end--;
  return text.slice(0, end);
}

/** The exits of each region, the dynamic ones after the static. */
function exitsByRegion(mode: DrMode): Map<string, string[]> {
  const exits = new Map(DR_REGIONS.map((r) => [r.name, [...r.exits]]));
  for (const exit of dynamicExits(mode)) exits.get(exit.from)?.push(exit.name);
  return exits;
}

/**
 * find_inaccessible_regions (DoorShuffle.py:3402-3437): the regions out of
 * the dungeons Link cannot walk to from his house or the sanctuary, rules
 * aside, before link_doors_prep links the doors and portals.
 */
function inaccessibleRegions(
  mode: DrMode,
  target: (exit: string) => string | undefined,
  exits: ReadonlyMap<string, readonly string[]>,
  entrances: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  // The doors and the portals' ways in are linked after this walk
  const portalEnters = new Set(
    Object.values(
      tableOf<readonly [string, string, string]>(
        "DoorShuffle.py",
        "portal_map",
      ),
    ).map(([, , enter]) => enter),
  );
  const linked = (exit: string) =>
    !DOOR_NAMED.has(exit) && !portalEnters.has(exit);
  const starts =
    mode === "inverted"
      ? ["Links House", "Dark Sanctuary Hint"]
      : ["Links House", "Sanctuary"];
  const queue = [...starts];
  const queued = new Set(queue);
  const visited = new Set<string>();
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    visited.add(next);
    if (mode === "inverted" && next === "Dark Sanctuary Hint")
      for (const parent of entrances.get(next) ?? [])
        if (
          REGION_NAMED.get(parent)?.type !== "dungeon" &&
          !queued.has(parent)
        ) {
          queued.add(parent);
          queue.push(parent);
        }
    for (const exit of exits.get(next) ?? []) {
      const to = linked(exit) ? target(exit) : undefined;
      if (to === undefined || queued.has(to)) continue;
      const region = REGION_NAMED.get(to);
      if (region?.type !== "dungeon" || to.endsWith(" Portal")) {
        queued.add(to);
        queue.push(to);
      }
    }
  }
  const found = new Set(
    DR_REGIONS.filter(
      (r) =>
        r.type !== "dungeon" &&
        !visited.has(r.name) &&
        // valid_inaccessible_region (:3490-3491)
        (r.type !== "cave" ||
          ((exits.get(r.name)?.length ?? 0) > 0 &&
            r.name !== "Links House" &&
            r.name !== "Chris Houlihan Room")),
    ).map((r) => r.name),
  );
  if (
    mode === "inverted" &&
    (exits.get("Hyrule Castle Ledge") ?? []).some(
      (exit) => target(exit) === "Agahnims Tower Portal",
    )
  )
    found.add("Hyrule Castle Ledge");
  if (mode === "standard") found.add("Hyrule Castle Ledge");
  return found;
}

/**
 * The exits add_inaccessible_doors gives a logical door: every exit of an
 * inaccessible region, the exits back into it, and through a portal its
 * other side (create_doors_for_inaccessible_region, :3497-3512).
 */
function logicalDoors(
  inaccessible: ReadonlySet<string>,
  target: (exit: string) => string | undefined,
  exits: ReadonlyMap<string, readonly string[]>,
  mode: DrMode,
): Set<string> {
  const found = new Set<string>();
  const create = (exit: string, region: string) => {
    const connect = target(exit);
    if (connect !== undefined)
      for (const back of exits.get(connect) ?? [])
        if (target(back) === region) found.add(back);
    found.add(exit);
  };
  const regions = [
    ...(mode === "standard" ? ["Hyrule Castle Ledge"] : []),
    ...inaccessible,
  ];
  for (const region of regions)
    for (const exit of exits.get(region) ?? []) {
      create(exit, region);
      const connect = target(exit);
      if (connect?.endsWith(" Portal"))
        for (const more of exits.get(connect) ?? []) create(more, connect);
    }
  return found;
}

/** Each door's dest: the door a door table links it with. */
function destinations(): Map<string, string> {
  const dest = new Map<string, string>();
  const table = (name: string, twoWays: boolean) => {
    const value = tableOf<unknown>("DoorShuffle.py", name);
    const pairs = (
      Array.isArray(value) ? value : Object.entries(value)
    ) as readonly (readonly [string, string])[];
    for (const [a, b] of pairs) {
      dest.set(a, b);
      if (twoWays) dest.set(b, a);
    }
  };
  // connect_two_way and connect_one_way (DoorShuffle.py:427-472): the
  // interior doors, the vanilla door tables
  for (const name of [
    "interior_doors",
    "open_edges",
    "straight_staircases",
    "ladders",
    "spiral_staircases",
    "default_door_connections",
  ])
    table(name, true);
  table("default_one_way_connections", false);
  return dest;
}

/**
 * The dungeons whose ways in a shuffled world's connections all tell, as
 * DR's key analysis would find them in the whole world: each portal and
 * each drop region (dungeon_portals, dungeon_drops) entered from a region
 * of the overworld (or the sewers' drop) that the walk from Link's House
 * and Sanctuary reaches (find_inaccessible_regions). Such a dungeon's
 * entrances are all its starts (determine_entrance_list), none waits on
 * another dungeon (find_enabled_origins, should_delay_processing: there is
 * no potential origin) and no logical door joins it (add_inaccessible_doors
 * reads inaccessible regions only); more notes never take a region out of
 * the walk, so its analysis is the whole world's. Coupled entrances only:
 * a portal's exit leads back to the door that enters it.
 */
export function portalsKnown(
  mode: DrMode,
  connections: DrConnections,
): Set<string> {
  const dynamic = new Map(dynamicExits(mode).map((e) => [e.name, e.to]));
  const target = (exit: string) => connections.get(exit) ?? dynamic.get(exit);
  const exits = exitsByRegion(mode);
  const entrances = new Map<string, string[]>();
  for (const [region, list] of exits)
    for (const exit of list) {
      const to = target(exit);
      if (to !== undefined)
        entrances.set(to, [...(entrances.get(to) ?? []), region]);
    }
  const inaccessible = inaccessibleRegions(mode, target, exits, entrances);
  const known = new Set<string>();
  for (const dungeon of DR_DUNGEON_ORDER) {
    const regions = [
      ...(DUNGEON_DROPS[dungeon] ?? []),
      ...(DUNGEON_PORTALS[dungeon] ?? []).map((p) => `${p} Portal`),
    ];
    const told = regions.every((region) => {
      const parents = (entrances.get(region) ?? []).filter(
        (parent) =>
          (REGION_NAMED.get(parent)?.type !== "dungeon" && parent !== "Menu") ||
          parent === "Sewer Drop",
      );
      return (
        parents.length > 0 &&
        parents.every((parent) => !inaccessible.has(parent))
      );
    });
    if (told) known.add(dungeon);
  }
  return known;
}

/**
 * The world DR's key analysis walks, for a run's settings: its regions,
 * its doors and logical doors, the inaccessible regions and each
 * dungeon's start regions.
 */
export function keyWorld(settings: KeyAnalysisSettings): KeyWorld {
  const { mode } = settings;
  const connections = settings.connections ?? vanillaConnections(mode);
  const dynamic = new Map(dynamicExits(mode).map((e) => [e.name, e.to]));
  const target = (exit: string) => connections.get(exit) ?? dynamic.get(exit);
  const exits = exitsByRegion(mode);
  const parentOf = new Map<string, string>();
  for (const [region, list] of exits)
    for (const exit of list) parentOf.set(exit, region);
  const entrances = new Map<string, string[]>();
  for (const [region, list] of exits)
    for (const exit of list) {
      const to = target(exit);
      if (to !== undefined)
        entrances.set(to, [...(entrances.get(to) ?? []), region]);
    }
  const inaccessible = inaccessibleRegions(mode, target, exits, entrances);
  const logical = logicalDoors(inaccessible, target, exits, mode);

  const forcedOf = new Map(
    KEY_DROPS.filter((d) => settings.forcedDrops.has(d.location)).map((d) => [
      d.location,
      { big: d.big, dungeon: d.dungeon },
    ]),
  );
  const regions = new Map<string, KRegion>();
  for (const r of DR_REGIONS)
    regions.set(r.name, {
      doors: [],
      dungeon: r.dungeon,
      isDungeon: r.type === "dungeon",
      locations: r.locations
        .filter((name) => r.locationModes?.[name]?.includes(mode) ?? true)
        .map((name) => ({
          dungeon: r.dungeon,
          forced: forcedOf.get(name) ?? null,
          name,
        })),
      name: r.name,
    });

  // The doors: Doors.py's, then a logical door for each exit
  // add_inaccessible_doors names that is none
  const doors = new Map<string, KDoor>();
  const standard = mode === "standard";
  const proposed = new Set(
    Object.values(DEFAULT_SMALL_KEY_DOORS).flatMap((list) => list.flat()),
  );
  for (const d of DR_DOORS) {
    const event =
      (d as { event?: string }).event ??
      (standard
        ? ((
            d as { conditional?: readonly { field: string; value: unknown }[] }
          ).conditional?.find((c) => c.field === "event")?.value as
            | string
            | undefined)
        : undefined);
    doors.set(d.name, {
      // unmark_ugly_smalls (DoorShuffle.py:476-480)
      bigKey: d.bigKey === true,
      blocked: d.trapped === true && !DR_PORTALS.some((p) => p.door === d.name),
      controller: null,
      crystal: d.crystal ?? null,
      dest: null,
      name: d.name,
      reqEvent: event ?? null,
      smallKey:
        d.smallKey === true &&
        (!UGLY_SMALLS.has(d.name) || proposed.has(d.name)),
      to: null,
      type: d.type,
    });
  }
  for (const name of logical)
    if (!doors.has(name))
      doors.set(name, {
        bigKey: false,
        blocked: false,
        controller: null,
        crystal: null,
        dest: null,
        name,
        reqEvent: null,
        smallKey: false,
        to: null,
        type: "Logical",
      });
  const dest = destinations();
  for (const door of doors.values()) {
    const to = target(door.name);
    door.to = to === undefined ? null : (regions.get(to) ?? null);
    const other = dest.get(door.name);
    door.dest = other === undefined ? null : (doors.get(other) ?? null);
    const controller = DOOR_NAMED.get(door.name)?.controller;
    door.controller =
      controller === undefined ? null : (doors.get(controller) ?? null);
  }
  for (const [name, region] of regions)
    for (const exit of exits.get(name) ?? []) {
      const door = doors.get(exit);
      if (door !== undefined) region.doors.push(door);
    }

  const starts = startRegions(
    settings,
    regions,
    entrances,
    inaccessible,
    target,
    exits,
  );
  return { doors, inaccessible, regions, settings, starts };
}

/**
 * Each dungeon's start regions, as vanilla_key_logic finds them
 * (DoorShuffle.py:226-279): determine_entrance_list's entrances Link
 * walks to, then the dungeons in create_dungeons' order, each taking the
 * entrances an earlier one enabled (find_enabled_origins) unless
 * should_delay_processing puts it back in the queue, and enabling those
 * its own portals reach (find_new_entrances, inverted_aga_check).
 */
function startRegions(
  settings: KeyAnalysisSettings,
  regions: ReadonlyMap<string, KRegion>,
  entrances: ReadonlyMap<string, readonly string[]>,
  inaccessible: ReadonlySet<string>,
  target: (exit: string) => string | undefined,
  exits: ReadonlyMap<string, readonly string[]>,
): Map<string, KRegion[]> {
  const { mode } = settings;
  const portalOf = new Map(DR_PORTALS.map((p) => [p.name, p]));
  const lobbyOf = (portal: string) => {
    const p = portalOf.get(portal);
    if (p === undefined) throw new RangeError(`No portal ${portal}`);
    const lobby = DR_REGIONS.find((r) => r.exits.includes(p.door));
    if (lobby === undefined) throw new RangeError(`No lobby for ${portal}`);
    return lobby.name;
  };
  // determine_entrance_list (:1199-1229)
  const entranceMap = new Map<string, string[]>();
  const potentials = new Map<string, string[]>();
  const connections = new Map<string, string>();
  for (const dungeon of DR_DUNGEON_ORDER) {
    const list: string[] = [];
    entranceMap.set(dungeon, list);
    const names: [string, string | null][] = [
      ...(DUNGEON_DROPS[dungeon] ?? []).map((d): [string, null] => [d, null]),
      ...(DUNGEON_PORTALS[dungeon] ?? []).map((p): [string, string] => [
        lobbyOf(p),
        p,
      ]),
    ];
    for (const [name, portal] of names) {
      const region = portal === null ? name : `${portal} Portal`;
      for (const parent of entrances.get(region) ?? []) {
        const type = REGION_NAMED.get(parent)?.type;
        if (
          !(
            (type !== "dungeon" && parent !== "Menu") ||
            parent === "Sewer Drop"
          )
        )
          continue;
        // is_standard_inaccessible (:1232-1233)
        const stdInaccessible =
          mode === "standard" &&
          STANDARD_STARTS[dungeon] !== undefined &&
          (portal === null || !STANDARD_STARTS[dungeon]?.includes(portal));
        if (!inaccessible.has(parent) && !stdInaccessible) list.push(name);
        else {
          const known = potentials.get(parent) ?? [];
          if (!known.includes(name)) known.push(name);
          potentials.set(parent, known);
          connections.set(name, parent);
        }
      }
    }
  }
  const enabled = new Map<string, { region: string; dungeon: string | null }>();
  const dungeonOfRegion = (name: string) => regions.get(name)?.dungeon ?? null;
  // enable_new_entrances (:1270-1289)
  const enable = (region: string, enabler: string) => {
    const newRegion = connections.get(region);
    if (newRegion === undefined) return;
    const found = potentials.get(newRegion);
    if (found !== undefined) {
      potentials.delete(newRegion);
      for (const p of found)
        enabled.set(p, { dungeon: dungeonOfRegion(enabler), region: enabler });
    }
    const queue = [...(exits.get(newRegion) ?? [])];
    const visited = new Set<string>();
    for (let ext = queue.shift(); ext !== undefined; ext = queue.shift()) {
      visited.add(ext);
      const to = target(ext);
      if (to === undefined) continue;
      const parent = connections.get(to);
      if (parent !== undefined) {
        const more = potentials.get(parent);
        if (more !== undefined) {
          potentials.delete(parent);
          for (const p of more)
            enabled.set(p, { dungeon: dungeonOfRegion(region), region });
        }
      }
      if (inaccessible.has(to) || to.endsWith(" Portal"))
        for (const next of exits.get(to) ?? [])
          if (!visited.has(next)) queue.push(next);
    }
  };
  const regionsOf = (dungeon: string) =>
    DR_REGIONS.filter((r) => r.dungeon === dungeon).map((r) => r.name);
  const destinations = destinationPortals(mode);
  // _find_portal_for_region (:352-354) strips its parent's name with
  // rstrip(' Portal'), a set of characters, not a suffix: "Hyrule Castle
  // West Portal" turns "Hyrule Castle Wes", no portal, as DR finds it
  const portalOfLobby = (lobby: string) => {
    for (const parent of entrances.get(lobby) ?? []) {
      const found = portalOf.get(rstrip(parent, " Portal"));
      if (found !== undefined) return found;
    }
    return null;
  };
  const starts = new Map<string, KRegion[]>();
  const queue = [...DR_DUNGEON_ORDER];
  let lastKey: string | undefined;
  let loops = 0;
  for (
    let dungeon = queue.shift();
    dungeon !== undefined;
    dungeon = queue.shift()
  ) {
    const origins = entranceMap.get(dungeon) ?? [];
    // find_enabled_origins (:1251-1260)
    for (const name of regionsOf(dungeon)) {
      const by = enabled.get(name);
      if (by === undefined || origins.includes(name)) continue;
      origins.push(name);
      if (by.region !== name && by.dungeon !== dungeonOfRegion(name))
        origins.push(name);
    }
    const potentialOrigins = new Set(
      (DUNGEON_PORTALS[dungeon] ?? []).map(lobbyOf),
    );
    if (origins.length === 0 || delayed(origins, potentialOrigins)) {
      if (lastKey === dungeon || loops > 1000) {
        if (settings.partial === true) continue;
        throw new RangeError(`Infinite loop detected for "${dungeon}"`);
      }
      queue.push(dungeon);
      lastKey = dungeon;
      loops++;
      continue;
    }
    // find_new_entrances (:1263-1267)
    for (const name of regionsOf(dungeon)) {
      const parent = connections.get(name);
      if (
        parent !== undefined &&
        (potentials.has(parent) || inaccessible.has(parent))
      )
        enable(name, name);
    }
    // inverted_aga_check (:1292-1300)
    if (mode === "inverted") {
      const ledge = potentials.get("Hyrule Castle Ledge");
      if (ledge !== undefined)
        for (const name of ledge) enable(name, "Tower Agahnim 1");
    }
    starts.set(dungeon, [
      ...new Set(origins.map((name) => regions.get(name) as KRegion)),
    ]);
  }
  return starts;

  /** should_delay_processing (:326-345). */
  function delayed(
    origins: readonly string[],
    potentialOrigins: ReadonlySet<string>,
  ): boolean {
    const targets = [...potentialOrigins].filter((name) => {
      if (origins.includes(name)) return false;
      const portal = portalOfLobby(name);
      return portal !== null && !destinations.has(portal.name);
    });
    if (targets.length === 0) return false;
    for (const enabling of new Set(targets.map((r) => connections.get(r)))) {
      const names = new Set(
        (potentials.get(enabling ?? "") ?? []).flatMap((r) => {
          const portal = portalOfLobby(r);
          return portal === null ? [] : [dungeonOfRegion(r)];
        }),
      );
      if (names.size > 1) return true;
    }
    return false;
  }
}
