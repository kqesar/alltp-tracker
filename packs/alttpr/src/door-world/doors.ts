// The Door Randomizer's door shuffle (DoorShuffle.py, at the release
// upstream.json pins): which doors a seed relinks, among which dungeons,
// which may change kind, and what a player notes of them. Nothing here
// decides where a door leads: the notes do (DoorNotes), and a door not
// noted leads nowhere in the world (connections.ts), never to a guess.
//
// - Links. link_doors_prep connects the doors no shuffle moves (logical
//   connections, interior doors, pits, warps, :62-74); at intensity 1 the
//   open edges, straight stairs and ladders stay vanilla too (:76-82). The
//   rest of a dungeon's doors of the shuffled types (create_door_spoiler,
//   :178-182: normal doors and spiral stairs, open edges, straight stairs
//   and ladders from intensity 2) are paired by main_dungeon_pool among a
//   pool of dungeons (create_dungeon_pool, :139-167: each dungeon alone in
//   `basic`, three groups in `partitioned`, all of them in `crossed`), by
//   the side they face (hook_from_door, BaseClasses.py:1684-1689: north to
//   south, east to west, stairs to stairs).
// - Lobbies. From intensity 3 each portal (a dungeon's way in from the
//   overworld) opens on a door choose_portals picks among the `portal`
//   doors of its pool (:522-643, find_portal_candidates :768-786); below,
//   each keeps its own (connect_portal, :739-752).
// - Kinds. shuffle_door_types (:1894-1916) reassigns the trap, big key,
//   small key, bombable and dashable doors among the doors of a room's
//   door list (positions 0 to 3) whose kind allows it (okay_normals,
//   okay_interiors, :3063-3066; a spiral stair's key kinds; a trap kind),
//   so a door the shuffle may change has its kind noted, and one not noted
//   is unknown: `maybe` to pass. Every other door keeps its room's kind.
import { locationId } from "@alltp/engine";
import {
  DOOR_NAMED,
  DR_DOORS,
  DR_PORTALS,
  type DrDoor,
  PARENT,
  regionNamed,
} from "./data";

/** DR's door shuffles (`--door_shuffle`, args.json) but `vanilla`. */
export type DoorShuffleMode = "basic" | "partitioned" | "crossed";

/** What of a run decides which doors its shuffle relinks. */
export interface DoorShuffleSettings {
  readonly shuffle: DoorShuffleMode;
  /** `--intensity`: 1 doors and stairs, 2 open edges too, 3 lobbies. */
  readonly intensity: 1 | 2 | 3;
  /** `--decoupledoors`: a door's way back leads elsewhere. */
  readonly decoupled: boolean;
  /**
   * `--trap_door_mode`: vanilla and optional keep the bosses' trap doors
   * (find_current_trap_doors, DoorShuffle.py:2466-2474), boss and oneway
   * may open them.
   */
  readonly trapMode: "vanilla" | "optional" | "boss" | "oneway";
}

/**
 * A door's kind as a player notes it: a plain door, a key door, a big key
 * door, a bombable or dashable wall, a trap door (shut behind Link).
 */
export type DoorKindNote =
  | "normal"
  | "small"
  | "big"
  | "bomb"
  | "dash"
  | "trap";

export const DOOR_KIND_NOTES: readonly DoorKindNote[] = [
  "normal",
  "small",
  "big",
  "bomb",
  "dash",
  "trap",
];

/** What a player notes of a door-shuffled run, by ids (doorId, portalId). */
export interface DoorNotes {
  /** Where each door leads: the door it comes out of. */
  readonly links?: Readonly<Record<string, string>>;
  /** At intensity 3, the door each portal opens on. */
  readonly lobbies?: Readonly<Record<string, string>>;
  /** Each door's kind, as seen. */
  readonly kinds?: Readonly<Record<string, DoorKindNote>>;
  /**
   * How many small keys a dungeon holds in all (its chests' and its
   * drops'), by DR's dungeon name: a partitioned or crossed shuffle moves
   * them (shuffle_small_key_doors, :2139-2145).
   */
  readonly keys?: Readonly<Record<string, number>>;
}

/** A door's id: its name's slug, a save key (`eastern-lobby-nw`). */
export const doorId = (name: string): string => locationId(name);

/** A portal's id: its name's slug (`hyrule-castle-south`). */
export const portalId = (name: string): string => locationId(name);

const DOOR_BY_ID: ReadonlyMap<string, DrDoor> = new Map(
  DR_DOORS.map((d) => [doorId(d.name), d]),
);

/** A door by its id, if one has it. */
export const doorById = (id: string): DrDoor | undefined => DOOR_BY_ID.get(id);

const PORTAL_BY_ID: ReadonlyMap<string, (typeof DR_PORTALS)[number]> = new Map(
  DR_PORTALS.map((p) => [portalId(p.name), p]),
);

/** A portal by its id, if one has it. */
export const portalById = (id: string) => PORTAL_BY_ID.get(id);

/** The dungeon a door's room lies in, as DR's world builds it. */
export const homeDungeonOf = (door: DrDoor): string | null => {
  const region = PARENT.get(door.name);
  return region === undefined ? null : regionNamed(region).dungeon;
};

/** The dungeon each portal leads into (its own door's, Doors.py:1549-1575). */
export const PORTAL_DUNGEON: ReadonlyMap<string, string> = new Map(
  DR_PORTALS.map((p) => {
    const door = DOOR_NAMED.get(p.door);
    const dungeon = door === undefined ? null : homeDungeonOf(door);
    if (dungeon === null) throw new RangeError(`No dungeon for ${p.name}`);
    return [p.name, dungeon];
  }),
);

/** partitioned's groups (create_dungeon_pool, DoorShuffle.py:149-152). */
export const PARTITIONS: readonly (readonly string[])[] = [
  [
    "Hyrule Castle",
    "Eastern Palace",
    "Desert Palace",
    "Tower of Hera",
    "Agahnims Tower",
  ],
  ["Palace of Darkness", "Swamp Palace", "Skull Woods", "Thieves Town"],
  ["Ice Palace", "Misery Mire", "Turtle Rock", "Ganons Tower"],
];

/** The dungeons a dungeon's doors may lead into (its pool). */
export function poolOf(
  dungeon: string,
  shuffle: DoorShuffleMode,
): readonly string[] {
  if (shuffle === "basic") return [dungeon];
  if (shuffle === "crossed") return PARTITIONS.flat();
  const group = PARTITIONS.find((g) => g.includes(dungeon));
  if (group === undefined) throw new RangeError(`No partition of ${dungeon}`);
  return group;
}

/** The types a shuffle relinks (create_door_spoiler, DoorShuffle.py:180-182). */
const shuffledTypes = (intensity: number): ReadonlySet<string> =>
  new Set([
    "Normal",
    "SpiralStairs",
    ...(intensity > 1 ? ["Open", "StraightStairs", "Ladder"] : []),
  ]);

/** Whether a door is a portal's own (connect_portal links it below 3). */
const PORTAL_DOOR_NAMES: ReadonlySet<string> = new Set(
  DR_PORTALS.map((p) => p.door),
);

/**
 * Whether the shuffle relinks a door: one of a dungeon's doors of the
 * types it shuffles, a portal's own door aside below intensity 3 (it
 * stays the portal's), the doors DR never shuffles aside (a pit, a warp,
 * an interior or logical door are other types).
 */
export function isShuffledDoor(
  door: DrDoor,
  settings: DoorShuffleSettings,
): boolean {
  if (!shuffledTypes(settings.intensity).has(door.type)) return false;
  if (homeDungeonOf(door) === null) return false;
  if (settings.intensity < 3 && PORTAL_DOOR_NAMES.has(door.name)) return false;
  return true;
}

/** Every door a run's shuffle relinks, by name, in Doors.py's order. */
export function shuffledDoors(
  settings: DoorShuffleSettings,
): readonly DrDoor[] {
  return DR_DOORS.filter((door) => isShuffledDoor(door, settings));
}

/** The side a door faces, which the door it leads into faces back. */
const OPPOSITE: Readonly<Record<string, string>> = {
  East: "West",
  North: "South",
  South: "North",
  West: "East",
};

/**
 * The doors a door may lead into in a run (a picker's choices): one the
 * shuffle relinks in its pool, facing it back (hook_from_door: north to
 * south, east to west; stairs to stairs), itself aside. Wider than DR's
 * generator (which also weighs the layout): only a note decides.
 */
export function doorTargets(
  door: DrDoor,
  settings: DoorShuffleSettings,
): readonly DrDoor[] {
  if (!isShuffledDoor(door, settings)) return [];
  const home = homeDungeonOf(door);
  if (home === null) return [];
  const pool = new Set(poolOf(home, settings.shuffle));
  const stairs = door.type === "SpiralStairs";
  return shuffledDoors(settings).filter((other) => {
    if (other.name === door.name) return false;
    const dungeon = homeDungeonOf(other);
    if (dungeon === null || !pool.has(dungeon)) return false;
    if (stairs) return other.type === "SpiralStairs";
    return (
      other.type !== "SpiralStairs" &&
      other.direction !== undefined &&
      other.direction === OPPOSITE[door.direction ?? ""]
    );
  });
}

/**
 * The doors a portal may open on at intensity 3 (find_portal_candidates,
 * DoorShuffle.py:768-786): a door that may be a lobby (`portal()`,
 * Doors.py) in its pool. Its dungeon link, passage and dead-end tests
 * narrow DR's choice further: the picker offers wider.
 */
export function lobbyDoors(
  portal: string,
  shuffle: DoorShuffleMode,
): readonly DrDoor[] {
  const dungeon = PORTAL_DUNGEON.get(portal);
  if (dungeon === undefined) throw new RangeError(`No portal ${portal}`);
  const pool = new Set(poolOf(dungeon, shuffle));
  return DR_DOORS.filter((door) => {
    const home = homeDungeonOf(door);
    return door.portalAble === true && home !== null && pool.has(home);
  });
}

/** The kinds a door of each type may hold in its room's list. */
const KIND_CANDIDATES: Readonly<Record<string, ReadonlySet<string>>> = {
  // okay_interiors, and the trap kinds an all or chaos trap shuffle takes
  // (DoorShuffle.py:3066, :2266-2273)
  Interior: new Set([
    "Normal",
    "SmallKey",
    "Bombable",
    "Dashable",
    "BigKey",
    "Trap2",
    "TrapTriggerable",
  ]),
  // okay_normals (:3063-3064)
  Normal: new Set([
    "Normal",
    "SmallKey",
    "Bombable",
    "Dashable",
    "DungeonChanger",
    "BigKey",
  ]),
  // The stair keys (find_key_door_candidates, :3092)
  SpiralStairs: new Set(["StairKey", "StairKey2", "StairKeyLow"]),
};

/** The trap kinds of a room's door list. */
const TRAP_KINDS: ReadonlySet<string> = new Set([
  "Trap",
  "Trap2",
  "TrapTriggerable",
]);

/**
 * A boss's or Agahnim's trap door, which trap_door_mode vanilla and
 * optional leave shut (exclude_boss_traps, DoorShuffle.py:2462-2463).
 */
const isBossTrap = (name: string): boolean =>
  name.includes(" Boss ") ||
  name.includes(" Agahnim ") ||
  name === "Skull Spike Corner SW";

/**
 * Whether a door shuffle may change a door's kind (shuffle_door_types'
 * candidates, DoorShuffle.py:2258-3115): a normal, interior or spiral door
 * at positions 0 to 3 of its room's door list whose kind there one of the
 * shuffles may take or leave, or a trap door a trap shuffle may open (a
 * boss's only in the boss and oneway modes), or from intensity 3 a door
 * that may be a lobby, which choose_portals makes a plain door where no
 * portal opens on it (:629-643). Wider than DR's tests (a pair's other
 * side): its kind is then the player's note.
 */
export function kindShuffled(
  door: DrDoor,
  settings: Pick<DoorShuffleSettings, "intensity" | "trapMode">,
): boolean {
  if (settings.intensity >= 3 && door.portalAble === true) return true;
  const trap = door.trapped === true && TRAP_KINDS.has(door.kind ?? "");
  if (trap && isBossTrap(door.name))
    return settings.trapMode === "boss" || settings.trapMode === "oneway";
  if (trap) return true;
  const listPos = door.listPos;
  if (listPos === undefined || listPos < 0 || listPos > 3) return false;
  return KIND_CANDIDATES[door.type]?.has(door.kind ?? "") === true;
}

/**
 * A door's kind in the vanilla world as the note a player would make of
 * it: its flags of Doors.py (key, big key, no exit), else its room's kind.
 */
export function vanillaKind(door: DrDoor): DoorKindNote {
  if (door.smallKey === true) return "small";
  if (door.bigKey === true || door.kind === "BigKey") return "big";
  // A trap DR's logic reads: a door that shuts (no_exit), whatever the
  // room's kind (a room's trap kind alone shuts nothing DR's logic reads)
  if (door.trapped === true) return "trap";
  switch (door.kind) {
    case "SmallKey":
    case "StairKey":
    case "StairKey2":
    case "StairKeyLow":
      return "small";
    case "Bombable":
      return "bomb";
    case "Dashable":
      return "dash";
    default:
      return "normal";
  }
}

/** A DR JSON spoiler's door sections (Spoiler.to_json, BaseClasses.py:2723-2725). */
export interface DoorSpoiler {
  readonly Doors?: readonly {
    readonly entrance: string;
    readonly exit: string;
    readonly direction: "both" | "entrance" | "exit";
  }[];
  readonly Lobbies?: readonly {
    readonly lobby_name: string;
    readonly door_name: string;
  }[];
  readonly DoorTypes?: readonly {
    readonly doorNames: string;
    readonly type: string;
  }[];
}

/** DoorTypes' words (set_door_type's calls, DoorShuffle.py). */
const SPOILER_KINDS: Readonly<Record<string, DoorKindNote>> = {
  "Big Key Door": "big",
  "Bomb Door": "bomb",
  "Dash Door": "dash",
  "Key Door": "small",
  "Trap Door": "trap",
};

/**
 * The notes a player who walked every door would have made, read off a
 * DR JSON spoiler: each pair of `Doors` both ways (`entrance`: the way in
 * alone, as DR lists a blocked door's), each lobby, each door of
 * `DoorTypes` its kind (`A <-> B (Dungeon)` both doors, `A (Dungeon)` one),
 * every other door a shuffle may change plain (DR lists every kind it
 * gives: reassign_*_doors make the others plain). Names DR's world lacks
 * throw: the spoiler is not this release's.
 */
export function doorNotesFromSpoiler(
  spoiler: DoorSpoiler,
  settings: DoorShuffleSettings,
): DoorNotes {
  const known = (name: string) => {
    if (!DOOR_NAMED.has(name)) throw new RangeError(`No DR door "${name}"`);
    return doorId(name);
  };
  const links: Record<string, string> = {};
  for (const { direction, entrance, exit } of spoiler.Doors ?? []) {
    links[known(entrance)] = known(exit);
    if (direction === "both" && !settings.decoupled)
      links[known(exit)] = known(entrance);
    // A blocked door leads back where it is entered from, as DR links it
    // (connect_doors, DungeonGenerator.py:710-715): its kind is a trap's
    if (direction === "entrance" && !settings.decoupled)
      links[known(exit)] = known(entrance);
  }
  const lobbies: Record<string, string> = {};
  for (const { door_name, lobby_name } of spoiler.Lobbies ?? []) {
    if (!PORTAL_DUNGEON.has(lobby_name))
      throw new RangeError(`No DR portal "${lobby_name}"`);
    lobbies[portalId(lobby_name)] = known(door_name);
  }
  const kinds: Record<string, DoorKindNote> = {};
  for (const door of DR_DOORS)
    if (kindShuffled(door, settings)) kinds[doorId(door.name)] = "normal";
  for (const { doorNames, type } of spoiler.DoorTypes ?? []) {
    const kind = SPOILER_KINDS[type];
    if (kind === undefined) throw new RangeError(`No door type "${type}"`);
    const names = /^(.+?)(?: <-> (.+?))? \(([^()]+)\)$/.exec(doorNames);
    if (names === null) throw new RangeError(`No doors in "${doorNames}"`);
    for (const name of [names[1], names[2]])
      if (name !== undefined) kinds[known(name)] = kind;
  }
  return { kinds, links, lobbies };
}

/**
 * The doors a run's shuffle may change the kind of without relinking them
 * (an interior door, a door of a room's list it leaves where it is), each
 * in a dungeon: their kinds are noted alone.
 */
export function kindOnlyDoors(
  settings: DoorShuffleSettings,
): readonly DrDoor[] {
  return DR_DOORS.filter(
    (door) =>
      homeDungeonOf(door) !== null &&
      !isShuffledDoor(door, settings) &&
      kindShuffled(door, settings),
  );
}

/** The portals of a dungeon, in Doors.py's order. */
export const portalsOf = (dungeon: string): readonly string[] =>
  DR_PORTALS.filter((p) => PORTAL_DUNGEON.get(p.name) === dungeon).map(
    (p) => p.name,
  );
