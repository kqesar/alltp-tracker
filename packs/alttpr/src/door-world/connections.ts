// Where each exit of the Door Randomizer's world leads with vanilla doors
// and vanilla entrances, as DR links them: link_overworld
// (OverworldShuffle.py:5-20), create_dynamic_exits (:31-73),
// link_entrances_new on its vanilla path (source/overworld/
// EntranceShuffle2.py:45-88, do_vanilla_connections :162-176 at 1.5.8, the
// Inverted swaps :64-78) and link_doors_prep's vanilla doors
// (DoorShuffle.py:60-133, connect_portal :739-752).
import {
  type DrPoolSettings,
  type DrShuffle,
  drDecoupled,
  drEntranceName,
  drKeepsRest,
  drShuffled,
  drTargetName,
  vanillaEntrances,
} from "../door-rando/entrances";
import { type DrData, type DrMode, type DrRegion, dependentsOf } from "./data";
import {
  type DoorNotes,
  type DoorShuffleSettings,
  doorById,
  isShuffledDoor,
  portalId,
} from "./doors";
import {
  linkOwrEntrances,
  linkOwrOverworld,
  type OwrNotes,
  type OwrPossibleLinks,
  type OwrScreens,
  owrScreensOf,
} from "./overworld";

/** Where each exit leads, by DR's names: an exit to a region. */
export type DrConnections = ReadonlyMap<string, string>;

/** An exit DR adds to a region in code, with its rule. */
export interface DrDynamicExit {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  /** The rule DR gives it when it makes it, in the engine's language. */
  readonly req: string;
  readonly source: string;
}

/** connect_two_way: each side leads into the other's region. */
function twoWay(
  data: DrData,
  c: Map<string, string>,
  a: string,
  b: string,
): void {
  c.set(a, data.parentOf(b));
  c.set(b, data.parentOf(a));
}

/**
 * DoorShuffle's connect_two_way (:423-448) and connect_one_way
 * (:451-468): a door's dependents lead where it does.
 */
function linkDoor(
  data: DrData,
  c: Map<string, string>,
  entrance: string,
  exit: string,
  twoWays: boolean,
): void {
  const dependents = dependentsOf(data);
  c.set(entrance, data.parentOf(exit));
  if (twoWays) c.set(exit, data.parentOf(entrance));
  for (const dep of dependents.get(entrance) ?? [])
    c.set(dep, data.parentOf(exit));
  if (twoWays)
    for (const dep of dependents.get(exit) ?? [])
      c.set(dep, data.parentOf(entrance));
}

/** link_overworld (OverworldShuffle.py:5-20). */
function linkOverworld(
  data: DrData,
  c: Map<string, string>,
  mode: DrMode,
): void {
  for (const [exit, region] of data.pairsOf(
    "OverworldShuffle.py",
    "mandatory_connections",
  ))
    c.set(exit, region);
  for (const [exit, region] of data.pairsOf(
    "OverworldShuffle.py",
    mode === "inverted"
      ? "inverted_mandatory_connections"
      : "open_mandatory_connections",
  ))
    c.set(exit, region);
  for (const [a, b] of data.pairsOf(
    "OverworldShuffle.py",
    "default_connections",
  ))
    twoWay(data, c, a, b);
}

/**
 * link_entrances_new with `shuffle` vanilla (EntranceShuffle2.py:45-88):
 * the mandatory connections, then each entrance of the pool to its
 * vanilla exit, two ways for a cave or dungeon (entrance_map) and one way
 * for a drop or a single cave (drop_map, single_entrance_map), with the
 * swaps of the Inverted world (:64-78) and its pyramid's names
 * (inverted_sub_table, :1328-1335 at 1.5.8). The Inverted world's Dark
 * Sanctuary exit, which no table links, is linked to the place its
 * entrance stands since 1.5.7 (3c4307e, :171-176 at 1.5.8): a seed of an
 * older or unknown version keeps its save point leading nowhere, as its
 * logic did (`version`, DR's title digits, 156 for 1.5.6).
 * @param kept - The entrances linked vanilla: every one by default
 * @param rest - Whether do_vanilla_connections links them, which links the
 *   save point's exit too; a shuffle's kept pool (do_vanilla_connect) does
 *   not
 */
function linkEntrances(
  data: DrData,
  c: Map<string, string>,
  mode: DrMode,
  version: number,
  kept: (entrance: string) => boolean = () => true,
  rest = true,
): void {
  for (const [exit, region] of data.pairsOf(
    "EntranceShuffle2",
    "mandatory_connections",
  ))
    c.set(exit, region);
  const inverted = mode === "inverted";
  const { oneWay, pool, twoWay: twoWays } = vanillaEntrances(inverted);
  // do_vanilla_connections (:162-170): Chris Houlihan's room back to Link's
  // House, wherever it leads with it
  const linksHouse = inverted ? "Big Bomb Shop" : "Links House";
  if (kept(linksHouse))
    c.set("Chris Houlihan Room Exit", data.parentOf(linksHouse));
  for (const entrance of pool) {
    if (!kept(entrance)) continue;
    const exit = twoWays.get(entrance);
    if (exit !== undefined) twoWay(data, c, entrance, exit);
    const region = oneWay.get(entrance);
    if (region !== undefined) c.set(entrance, region);
  }
  if (
    inverted &&
    rest &&
    version >= 157 &&
    kept(DARK_SANCTUARY) &&
    !c.has(DARK_SANCTUARY_EXIT)
  )
    c.set(DARK_SANCTUARY_EXIT, data.parentOf(DARK_SANCTUARY));
}

/** The Inverted world's save point (EntranceShuffle2.py:171-176). */
const DARK_SANCTUARY = "Dark Sanctuary Hint";

/** The Inverted world's save point's way out (EntranceShuffle2.py:174). */
const DARK_SANCTUARY_EXIT = "Dark Sanctuary Hint Exit";

/** A run's door shuffle, as the player noted it (doors.ts). */
export interface DrNotedDoors {
  readonly settings: DoorShuffleSettings;
  readonly notes: DoorNotes;
}

/** The portal_map entry of a portal: its door's way out, its way in. */
function portalEnds(data: DrData, name: string): readonly [string, string] {
  const portalMap = data.tableOf<readonly [string, string, string]>(
    "DoorShuffle.py",
    "portal_map",
  );
  const [, exit, enter] = portalMap[name] ?? [];
  if (exit === undefined || enter === undefined)
    throw new RangeError(`No portal_map entry for ${name}`);
  return [exit, enter];
}

/**
 * connect_portal (DoorShuffle.py:739-752): the lobby's door out to the
 * portal region, the portal region's way in to the lobby.
 */
function linkPortal(
  data: DrData,
  c: Map<string, string>,
  name: string,
  door: string,
) {
  const [exit, enter] = portalEnds(data, name);
  c.set(door, data.parentOf(exit));
  c.set(enter, data.parentOf(door));
}

/**
 * The doors each portal opens on: its own below intensity 3, the noted
 * lobby from 3 (a portal not noted opens on none), by name.
 */
export function lobbiesOf(
  data: DrData,
  doors: DrNotedDoors | undefined,
): Map<string, string> {
  const found = new Map<string, string>();
  for (const portal of data.portals) {
    if (doors === undefined || doors.settings.intensity < 3) {
      found.set(portal.name, portal.door);
      continue;
    }
    const noted = doors.notes.lobbies?.[portalId(portal.name)];
    const door = noted === undefined ? undefined : doorById(noted, data);
    if (door !== undefined) found.set(portal.name, door.name);
  }
  return found;
}

/**
 * link_doors_prep with shuffled doors (DoorShuffle.py:60-133), then the
 * links main_dungeon_pool makes, as noted: what no shuffle moves (logical
 * connections, interior doors, pits, warps; open edges, straight stairs
 * and ladders at intensity 1), each portal on its lobby (lobbiesOf), and
 * each noted door into the region of the door it comes out of, its
 * dependents along (connect_doors, DungeonGenerator.py:704-725). In a
 * coupled shuffle a door noted leads back too, unless its own note says
 * otherwise. A door the shuffle relinks and no note names leads nowhere,
 * as the vanilla tables it would have stood in are not linked. Below
 * intensity 3 the Sanctuary Mirror Route is removed (:84-90); from 3, in
 * basic, it leads to Sanctuary's portal's lobby (cross_dungeon_clean_up,
 * :1024-1028) once that is noted.
 */
function linkShuffledDoors(
  data: DrData,
  c: Map<string, string>,
  doors: DrNotedDoors,
): void {
  const { notes, settings } = doors;
  const simple = (name: string) => {
    for (const [exit, region] of data.pairsOf("DoorShuffle.py", name))
      c.set(exit, region);
  };
  const vanilla = (name: string) => {
    for (const [a, b] of data.pairsOf("DoorShuffle.py", name))
      linkDoor(data, c, a, b, true);
  };
  simple("logical_connections");
  vanilla("interior_doors");
  simple("falldown_pits");
  simple("dungeon_warps");
  if (settings.intensity < 2) {
    vanilla("open_edges");
    vanilla("straight_staircases");
    vanilla("ladders");
  }
  const lobbies = lobbiesOf(data, doors);
  for (const [portal, door] of lobbies) linkPortal(data, c, portal, door);
  const lobbyDoors = new Set(lobbies.values());
  const ownLinks = new Map<string, string>();
  for (const [fromId, toId] of Object.entries(notes.links ?? {})) {
    const from = doorById(fromId, data);
    const to = doorById(toId, data);
    if (from === undefined || to === undefined) continue;
    if (
      !isShuffledDoor(from, settings, data) ||
      !isShuffledDoor(to, settings, data)
    )
      continue;
    if (lobbyDoors.has(from.name)) continue;
    ownLinks.set(from.name, to.name);
  }
  const links = new Map(ownLinks);
  if (!settings.decoupled)
    for (const [from, to] of ownLinks)
      if (!links.has(to) && !lobbyDoors.has(to)) links.set(to, from);
  for (const [from, to] of links) linkDoor(data, c, from, to, false);
  // Its portal's lobby while Sanctuary stays the castle's (basic); in a
  // pool of dungeons DR picks one of the portals of Sanctuary's layout
  // (:1009-1023, random.choice among those reaching it): left out
  if (settings.intensity >= 3 && settings.shuffle === "basic") {
    const sanctuary = lobbies.get("Sanctuary");
    if (sanctuary !== undefined)
      c.set(SANCTUARY_MIRROR_ROUTE, data.parentOf(sanctuary));
  }
}

/** The Sanctuary's mirror way to its portal's lobby (Doors.py:125). */
const SANCTUARY_MIRROR_ROUTE = "Sanctuary Mirror Route";

/**
 * link_doors_prep with vanilla doors (DoorShuffle.py:60-133), door
 * intensity 1 as DR's tests build it: the logical connections, the
 * interior doors, the pits and warps, then the portals, then every vanilla
 * door table. The Sanctuary Mirror Route is removed (:84-90). With a
 * door shuffle, linkShuffledDoors.
 */
function linkDoors(
  data: DrData,
  c: Map<string, string>,
  shuffled?: DrNotedDoors,
): void {
  if (shuffled !== undefined) {
    linkShuffledDoors(data, c, shuffled);
    return;
  }
  const simple = (name: string) => {
    for (const [exit, region] of data.pairsOf("DoorShuffle.py", name))
      c.set(exit, region);
  };
  const doors = (name: string, twoWays = true) => {
    for (const [a, b] of data.pairsOf("DoorShuffle.py", name))
      linkDoor(data, c, a, b, twoWays);
  };
  simple("logical_connections");
  doors("interior_doors");
  simple("falldown_pits");
  simple("dungeon_warps");
  doors("open_edges");
  doors("straight_staircases");
  doors("ladders");
  for (const portal of data.portals)
    linkPortal(data, c, portal.name, portal.door);
  simple("vanilla_logical_connections");
  doors("spiral_staircases");
  doors("default_door_connections");
  doors("default_one_way_connections", false);
}

/** The exits DR removes from the world (link_doors_prep :80-86). */
export const REMOVED_EXITS: ReadonlySet<string> = new Set([
  "Sanctuary Mirror Route",
]);

/**
 * The vanilla world's connections for a mode: every exit DR links, by
 * name, to the region it leads to; for the Overworld Randomizer's data,
 * its own overworld and entrances (overworld.ts), the doors as DR's.
 * @param version - The DR release the seed was built by, as its ROM title's
 *   digits (157 for 1.5.7), 156 for 1.5.6 or an older or unknown one
 * @param screens - An OWR run's screens (owrScreensOf), its notes' by
 *   default
 * @param possible - Where an OWR run's links its notes do not tell yet go
 */
export function vanillaConnections(
  data: DrData,
  mode: DrMode,
  version = 156,
  doors?: DrNotedDoors,
  overworld?: OwrNotes,
  screens: OwrScreens = owrScreensOf(data, mode, overworld),
  possible?: OwrPossibleLinks,
): DrConnections {
  const c = new Map<string, string>();
  if (data.flavor === "owr") {
    linkOwrOverworld(data, c, mode, overworld, screens, possible);
    linkOwrEntrances(data, c, mode, screens, possible);
  } else {
    linkOverworld(data, c, mode);
    linkEntrances(data, c, mode, version);
  }
  linkDoors(data, c, doors);
  removeExits(c, doors);
  return c;
}

/** REMOVED_EXITS, but the mirror route a lobby shuffle links. */
function removeExits(c: Map<string, string>, doors?: DrNotedDoors): void {
  for (const exit of REMOVED_EXITS)
    if (doors === undefined || doors.settings.intensity < 3) c.delete(exit);
}

/** A DR run's shuffled entrances, as the player noted them. */
export interface DrNotedEntrances {
  readonly shuffle: DrShuffle;
  readonly pool: DrPoolSettings;
  /** Each noted entrance's target, by the entrance randomizer's ids. */
  readonly noted: Readonly<Record<string, string>>;
}

/** A shuffled world's connections, and how much of it the notes tell. */
export interface DrNotedConnections {
  readonly connections: DrConnections;
  /** Every entrance the shuffle may move is noted, each way back known. */
  readonly complete: boolean;
  /** Its exits lead back elsewhere than their doors (insanity). */
  readonly decoupled: boolean;
}

/**
 * The world's connections in a run whose entrances DR shuffled, as far as
 * the notes tell: what the shuffle surely leaves vanilla (`drShuffled`) is
 * linked as the vanilla world links it, each noted entrance as
 * connect_two_way, connect_entrance and connect_exit do (EntranceShuffle2.
 * py:1455-1517): a cave's or dungeon's door both ways but in a decoupled
 * shuffle, where its exit leads elsewhere, unnoted; a hole or a single
 * cave's door one way. A door noted to the Inverted world's save point also
 * lets its exit out where that door stands (:220-226). An entrance not
 * noted leads nowhere, so the world never says yes through a guess.
 * @param version - The DR release, as vanillaConnections takes it
 */
export function notedConnections(
  data: DrData,
  mode: DrMode,
  entrances: DrNotedEntrances,
  version = 156,
  doors?: DrNotedDoors,
): DrNotedConnections {
  // OWR's shuffled entrances (its own pools, District and Swapped) are
  // not modelled yet
  if (data.flavor === "owr")
    throw new RangeError("No noted entrances of the Overworld Randomizer");
  const c = new Map<string, string>();
  linkOverworld(data, c, mode);
  const moved = drShuffled(entrances.shuffle, entrances.pool);
  linkEntrances(
    data,
    c,
    mode,
    version,
    (entrance) => !moved.has(entrance),
    drKeepsRest(entrances.shuffle),
  );
  const decoupled = drDecoupled(entrances.shuffle);
  const { twoWay: twoWays } = vanillaEntrances(mode === "inverted");
  const exits = new Set(twoWays.values());
  const noted = new Set<string>();
  for (const [id, targetId] of Object.entries(entrances.noted)) {
    const entrance = drEntranceName(id);
    const target = drTargetName(targetId);
    if (entrance === undefined || target === undefined || !moved.has(entrance))
      continue;
    if (!data.parent.has(entrance)) continue;
    noted.add(entrance);
    if (exits.has(target)) {
      c.set(entrance, data.parentOf(target));
      if (!decoupled) c.set(target, data.parentOf(entrance));
    } else c.set(entrance, target);
    if (mode === "inverted" && target === DARK_SANCTUARY)
      c.set(DARK_SANCTUARY_EXIT, data.parentOf(entrance));
  }
  linkDoors(data, c, doors);
  removeExits(c, doors);
  return {
    complete: !decoupled && [...moved].every((e) => noted.has(e)),
    connections: c,
    decoupled,
  };
}

/** Regions no flute or mirror exit leaves (OverworldShuffle.py:32, :49). */
const NO_DYNAMIC_EXITS = new Set([
  "Zoras Domain",
  "Master Sword Meadow",
  "Hobo Bridge",
]);

/**
 * create_dynamic_exits (OverworldShuffle.py:31-73): a flute exit from every
 * land region of Link's own world to the sky, and a mirror exit from each
 * region of the other world that mirror_connections lists, which a water
 * region asks the flippers and the pearl for; OWR's (FluteShuffle.py:665-
 * 676, create_dynamic_mirror_exits, OverworldShuffle.py:1186-1207) read
 * the same regions by the type Mixed leaves them (`typeOf`, regionTypeOf),
 * none from a region whose type is not known.
 */
export function dynamicExits(
  data: DrData,
  mode: DrMode,
  typeOf: (region: DrRegion) => DrRegion["type"] | undefined = (r) => r.type,
): readonly DrDynamicExit[] {
  const inverted = mode === "inverted";
  const own = inverted ? "dw" : "lw";
  const other = inverted ? "lw" : "dw";
  const mirrors = data.tableOf<readonly string[]>(
    "OverworldShuffle.py",
    "mirror_connections",
  );
  const found: DrDynamicExit[] = [];
  for (const region of data.regions) {
    if (NO_DYNAMIC_EXITS.has(region.name)) continue;
    if (typeOf(region) === own && region.terrain === "land")
      found.push({
        from: region.name,
        name: `Flute From ${region.name}`,
        req: "true",
        source: "OverworldShuffle.py:32-38",
        to: "Flute Sky",
      });
  }
  for (const region of data.regions) {
    if (NO_DYNAMIC_EXITS.has(region.name) || typeOf(region) !== other) continue;
    const targets = mirrors[region.name] ?? [];
    for (const to of targets) {
      const target = data.regionNamed(to);
      const water = region.terrain === "water" || target.terrain === "water";
      found.push({
        from: region.name,
        // get_mirror_exit_name (:40-46)
        name:
          targets.length === 1
            ? `Mirror From ${region.name}`
            : `Mirror To ${to}`,
        req: water ? "flippers & moonPearl & magicMirror" : "magicMirror",
        source: "OverworldShuffle.py:48-66",
        to,
      });
    }
  }
  return found;
}

/** Whether a name is a static exit of a release's regions. */
export const isStaticExit = (data: DrData, name: string): boolean =>
  data.parent.has(name);
