// The Door Randomizer's world as import-dr.mjs wrote it (src/door-rando/
// world/*.json), typed for the world builder. Nothing here decides: each
// table is read as DR's source has it, at the release upstream.json pins.
import connectionData from "../door-rando/world/connections.json" with {
  type: "json",
};
import doorData from "../door-rando/world/doors.json" with { type: "json" };
import entranceData from "../door-rando/world/entrances.json" with {
  type: "json",
};
import regionData from "../door-rando/world/regions.json" with { type: "json" };
import ruleData from "../door-rando/world/rules.json" with { type: "json" };

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

export const DR_REGIONS = regionData.regions as readonly DrRegion[];
export const DR_DUNGEONS = regionData.dungeons as readonly {
  readonly name: string;
  readonly boss: string | null;
  /** Its big key, if it has one (Dungeons.py make_dungeon). */
  readonly bigKey: string | null;
  /** The small keys its chests hold. */
  readonly smallKeys: readonly string[];
  /** Its prize's location (dungeon_table), if it has one. */
  readonly prize: string | null;
}[];
export const DR_DOORS = doorData.doors as readonly DrDoor[];
export const DR_PORTALS = doorData.portals as readonly {
  readonly name: string;
  readonly door: string;
}[];

/** rules.json, the translation of Rules.py and Bosses.py. */
export const DR_RULES = ruleData as unknown as {
  readonly bombShop: {
    readonly spot: string;
    readonly cases: readonly {
      readonly doors: readonly string[];
      readonly req: string;
    }[];
  };
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
};

type Table = { readonly line: number; readonly value: unknown };
type Tables = Readonly<Record<string, Readonly<Record<string, Table>>>>;
/** connections.json and entrances.json, a file's tables from both. */
const TABLES: Tables = (() => {
  const merged: Record<string, Record<string, Table>> = {};
  for (const data of [connectionData, entranceData] as unknown as Tables[])
    for (const [file, tables] of Object.entries(data))
      if (typeof tables === "object")
        merged[file] = { ...merged[file], ...tables };
  return merged;
})();

/** A connection table, as pairs, by its file and name. */
export function pairsOf(
  file: "DoorShuffle.py" | "OverworldShuffle.py" | "EntranceShuffle2",
  name: string,
): readonly (readonly [string, string])[] {
  const key =
    file === "EntranceShuffle2" ? "source/overworld/EntranceShuffle2.py" : file;
  const table = TABLES[key]?.[name];
  if (table === undefined) throw new RangeError(`No table ${file} ${name}`);
  const { value } = table;
  return (
    Array.isArray(value) ? value : Object.entries(value as object)
  ) as readonly (readonly [string, string])[];
}

/** A table that maps a name to a value of its own shape. */
export function tableOf<T>(
  file: "DoorShuffle.py" | "OverworldShuffle.py",
  name: string,
): Readonly<Record<string, T>> {
  const table = TABLES[file]?.[name];
  if (table === undefined) throw new RangeError(`No table ${file} ${name}`);
  return table.value as Readonly<Record<string, T>>;
}

export const REGION_NAMED: ReadonlyMap<string, DrRegion> = new Map(
  DR_REGIONS.map((r) => [r.name, r]),
);
export const DOOR_NAMED: ReadonlyMap<string, DrDoor> = new Map(
  DR_DOORS.map((d) => [d.name, d]),
);

/** The region each static exit leaves from, by name. */
export const PARENT: ReadonlyMap<string, string> = new Map(
  DR_REGIONS.flatMap((r) => r.exits.map((exit) => [exit, r.name] as const)),
);

export const regionNamed = (name: string): DrRegion => {
  const found = REGION_NAMED.get(name);
  if (found === undefined) throw new RangeError(`No DR region "${name}"`);
  return found;
};

export const parentOf = (exit: string): string => {
  const found = PARENT.get(exit);
  if (found === undefined) throw new RangeError(`No DR exit "${exit}"`);
  return found;
};
