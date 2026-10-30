// A release's world as its importer wrote it (src/door-rando/world/*.json
// for DR, src/door-rando/owr/*.json for the Overworld Randomizer), typed for
// the world builder. Nothing here decides: each table is read as the source
// has it, at the release upstream.json pins. Each release's bundle is a
// module of its own (dr-data.ts, owr-data.ts), so a run downloads its own.

/** DR's three worlds, as its `mode` option names them. */
export type DrMode = "open" | "standard" | "inverted";

/** A region of Regions.py. */
export interface DrRegion {
  readonly name: string;
  /** drRegionId(name): the engine's id, which reach() and facts read. */
  readonly id: string;
  readonly type: "menu" | "lw" | "dw" | "cave" | "dungeon";
  readonly terrain?: string;
  readonly dungeon: string | null;
  readonly crystalSwitch?: boolean;
  readonly locations: readonly string[];
  /** A location only some modes create (Zelda's in Standard). */
  readonly locationModes?: Readonly<Record<string, readonly DrMode[]>>;
  readonly exits: readonly string[];
  readonly source: string;
}

/** A door of Doors.py, its logic flags (layout bytes left out). */
export interface DrDoor {
  readonly name: string;
  readonly type: string;
  readonly direction?: string;
  readonly supertile?: number;
  readonly smallKey?: boolean;
  readonly bigKey?: boolean;
  /** A barrier's colour, or `either` for a door that hits a switch. */
  readonly crystal?: "blue" | "orange" | "either";
  /** no_exit(): blocked as an exit (BaseClasses.py:1952-1954). */
  readonly trapped?: boolean;
  readonly portal?: string;
  /** A door a door shuffle may make a dungeon's way in (lobby). */
  readonly portalAble?: boolean;
  /** Its index in its room's door list (RoomData.py), if it has one. */
  readonly listPos?: number;
  /**
   * Its kind there (RoomData.py's DoorKind name: `SmallKey`, `Bombable`,
   * `Dashable`, `Trap`...), as the vanilla world has it.
   */
  readonly kind?: string;
  /** The door whose link this one follows (controller_door). */
  readonly controller?: string;
  readonly source: string;
}

/** A rule of rules.json, and the lines it was read at. */
export interface DrSpotRule {
  readonly req: string;
  readonly source: readonly string[];
}

/** A dungeon of Dungeons.py. */
export interface DrDungeon {
  readonly name: string;
  readonly boss: string | null;
  /** Its big key, if it has one (Dungeons.py make_dungeon). */
  readonly bigKey: string | null;
  /** The small keys its chests hold. */
  readonly smallKeys: readonly string[];
  /** Its prize's location (dungeon_table), if it has one. */
  readonly prize: string | null;
}

/** A dungeon's way in from the overworld (Doors.py create_portals). */
export interface DrPortal {
  readonly name: string;
  readonly door: string;
}

/** rules.json, the translation of Rules.py and Bosses.py. */
export interface DrRules {
  /** set_big_bomb_rules' cases; none in OWR, whose big bomb is an event. */
  readonly bombShop: {
    readonly spot: string;
    readonly cases: readonly {
      readonly doors: readonly string[];
      readonly req: string;
    }[];
  } | null;
  readonly derived: Readonly<
    Record<string, { readonly kind: string; readonly region?: string }>
  >;
  readonly doorData: Readonly<
    Record<string, { readonly door: string; readonly vanilla: boolean }>
  >;
  readonly drops: Readonly<Record<string, { readonly req: string }>>;
  readonly entrances: Readonly<Record<string, DrSpotRule>>;
  readonly events: Readonly<
    Record<string, { readonly item: string; readonly location: string }>
  >;
  readonly helpers: Readonly<Record<string, { readonly req: string }>>;
  readonly locations: Readonly<Record<string, DrSpotRule>>;
  readonly newItems: readonly string[];
}

/** An edge of an overworld screen (OWEdges.py create_owedges). */
export interface OwrEdge {
  readonly name: string;
  readonly screen: number;
  readonly direction: string;
  readonly terrain: "land" | "water";
  /** The same edge of the other world's screen (parallel_links). */
  readonly parallel?: string;
  readonly source: string;
}

/**
 * What the Overworld Randomizer adds to the world (overworld.json, its bonk
 * drops bonk.json).
 */
export interface OwrOverworld {
  /** Each overworld region's screen (OWTileRegions). */
  readonly tiles: Readonly<Record<string, number>>;
  readonly edges: readonly OwrEdge[];
  /** Each flute spot's regions as its screen stands or flipped, its slot. */
  readonly flute: Readonly<
    Record<
      string,
      { readonly regions: readonly [string, string]; readonly slot: number }
    >
  >;
  readonly bonk: readonly {
    readonly name: string;
    readonly region: string;
    readonly aga: boolean;
    readonly flag?: { readonly screen: number; readonly mask: number };
    /** Where the fork's world map draws it, in the 4096-pixel world. */
    readonly map?: { readonly x: number; readonly y: number };
    readonly source: string;
  }[];
}

type Table = { readonly line: number; readonly value: unknown };
/** A data file's tables, by the upstream file and the table's name. */
export type DrTables = Readonly<
  Record<string, Readonly<Record<string, Table>> | unknown>
>;

/** The files a connection table is read from, the short names the code uses. */
const FILES: Readonly<Record<string, string>> = {
  EntranceShuffle2: "source/overworld/EntranceShuffle2.py",
  FluteShuffle: "source/overworld/FluteShuffle.py",
};

/**
 * A release's world as its importer wrote it: the Door Randomizer's
 * (dr-data.ts, `DR_DATA`) or the Overworld Randomizer's (owr-data.ts,
 * `OWR_DATA`), each the data
 * every function of the world builder reads, passed to it rather than
 * imported, so either world is built by the same code.
 */
export interface DrData {
  /** Whose release: DR's, or the Overworld Randomizer's on its own DR. */
  readonly flavor: "dr" | "owr";
  /** The Overworld Randomizer's screens, edges and flute spots. */
  readonly overworld?: OwrOverworld;
  readonly regions: readonly DrRegion[];
  readonly dungeons: readonly DrDungeon[];
  readonly doors: readonly DrDoor[];
  readonly portals: readonly DrPortal[];
  readonly rules: DrRules;
  readonly regionByName: ReadonlyMap<string, DrRegion>;
  readonly regionById: ReadonlyMap<string, DrRegion>;
  readonly doorByName: ReadonlyMap<string, DrDoor>;
  /** The region each static exit leaves from, by name. */
  readonly parent: ReadonlyMap<string, string>;
  /** A region by name; throws for one the world does not have. */
  regionNamed(name: string): DrRegion;
  /** The region an exit leaves from; throws for one it does not have. */
  parentOf(exit: string): string;
  /** A connection table, as pairs, by its file and name. */
  pairsOf(file: string, name: string): readonly (readonly [string, string])[];
  /** A table that maps a name to a value of its own shape. */
  tableOf<T>(file: string, name: string): Readonly<Record<string, T>>;
}

/**
 * A release's data bundle from its JSON files.
 * @param tables - Its connection files (connections.json, entrances.json),
 *   each file's tables merged
 */
export function drDataOf(
  flavor: DrData["flavor"],
  source: {
    readonly regions: unknown;
    readonly doors: unknown;
    readonly rules: unknown;
    readonly tables: readonly unknown[];
    readonly overworld?: unknown;
  },
): DrData {
  const { regions, dungeons } = source.regions as {
    readonly regions: readonly DrRegion[];
    readonly dungeons: readonly DrDungeon[];
  };
  const { doors, portals } = source.doors as {
    readonly doors: readonly DrDoor[];
    readonly portals: readonly DrPortal[];
  };
  const merged: Record<string, Record<string, Table>> = {};
  for (const data of source.tables as DrTables[])
    for (const [file, tables] of Object.entries(data))
      if (typeof tables === "object")
        merged[file] = {
          ...merged[file],
          ...(tables as Record<string, Table>),
        };
  const tableNamed = (file: string, name: string): Table => {
    const table = merged[FILES[file] ?? file]?.[name];
    if (table === undefined) throw new RangeError(`No table ${file} ${name}`);
    return table;
  };
  const label = flavor === "dr" ? "DR" : "OWR";
  const regionByName = new Map(regions.map((r) => [r.name, r]));
  const parent = new Map(
    regions.flatMap((r) => r.exits.map((exit) => [exit, r.name] as const)),
  );
  return {
    doorByName: new Map(doors.map((d) => [d.name, d])),
    doors,
    dungeons,
    flavor,
    ...(source.overworld === undefined
      ? {}
      : { overworld: source.overworld as OwrOverworld }),
    pairsOf: (file, name) => {
      const { value } = tableNamed(file, name);
      return (
        Array.isArray(value) ? value : Object.entries(value as object)
      ) as readonly (readonly [string, string])[];
    },
    parent,
    parentOf: (exit) => {
      const found = parent.get(exit);
      if (found === undefined)
        throw new RangeError(`No ${label} exit "${exit}"`);
      return found;
    },
    portals,
    regionById: new Map(regions.map((r) => [r.id, r])),
    regionByName,
    regionNamed: (name) => {
      const found = regionByName.get(name);
      if (found === undefined)
        throw new RangeError(`No ${label} region "${name}"`);
      return found;
    },
    regions,
    rules: source.rules as DrRules,
    tableOf: <T>(file: string, name: string) =>
      tableNamed(file, name).value as Readonly<Record<string, T>>,
  };
}

/**
 * A value derived from a release's data, built once per bundle: what a
 * module would otherwise compute at load from one release's tables.
 */
export function perData<T>(build: (data: DrData) => T): (data: DrData) => T {
  const built = new WeakMap<DrData, T>();
  return (data) => {
    if (built.has(data)) return built.get(data) as T;
    const value = build(data);
    built.set(data, value);
    return value;
  };
}

/** The doors whose link follows each door's (dependents), by controller. */
export const dependentsOf = perData(
  (data): ReadonlyMap<string, readonly string[]> => {
    const found = new Map<string, string[]>();
    for (const door of data.doors)
      if (door.controller !== undefined)
        found.set(door.controller, [
          ...(found.get(door.controller) ?? []),
          door.name,
        ]);
    return found;
  },
);
