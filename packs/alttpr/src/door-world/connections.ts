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
import {
  DOOR_NAMED,
  DR_DOORS,
  DR_PORTALS,
  DR_REGIONS,
  type DrMode,
  PARENT,
  pairsOf,
  parentOf,
  regionNamed,
  tableOf,
} from "./data";

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
function twoWay(c: Map<string, string>, a: string, b: string): void {
  c.set(a, parentOf(b));
  c.set(b, parentOf(a));
}

/** The doors a controller's link carries along (dependents). */
const DEPENDENTS: ReadonlyMap<string, readonly string[]> = (() => {
  const found = new Map<string, string[]>();
  for (const door of DR_DOORS)
    if (door.controller !== undefined)
      found.set(door.controller, [
        ...(found.get(door.controller) ?? []),
        door.name,
      ]);
  return found;
})();

/**
 * DoorShuffle's connect_two_way (:423-448) and connect_one_way
 * (:451-468): a door's dependents lead where it does.
 */
function linkDoor(
  c: Map<string, string>,
  entrance: string,
  exit: string,
  twoWays: boolean,
): void {
  c.set(entrance, parentOf(exit));
  if (twoWays) c.set(exit, parentOf(entrance));
  for (const dep of DEPENDENTS.get(entrance) ?? []) c.set(dep, parentOf(exit));
  if (twoWays)
    for (const dep of DEPENDENTS.get(exit) ?? [])
      c.set(dep, parentOf(entrance));
}

/** link_overworld (OverworldShuffle.py:5-20). */
function linkOverworld(c: Map<string, string>, mode: DrMode): void {
  for (const [exit, region] of pairsOf(
    "OverworldShuffle.py",
    "mandatory_connections",
  ))
    c.set(exit, region);
  for (const [exit, region] of pairsOf(
    "OverworldShuffle.py",
    mode === "inverted"
      ? "inverted_mandatory_connections"
      : "open_mandatory_connections",
  ))
    c.set(exit, region);
  for (const [a, b] of pairsOf("OverworldShuffle.py", "default_connections"))
    twoWay(c, a, b);
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
  c: Map<string, string>,
  mode: DrMode,
  version: number,
  kept: (entrance: string) => boolean = () => true,
  rest = true,
): void {
  for (const [exit, region] of pairsOf(
    "EntranceShuffle2",
    "mandatory_connections",
  ))
    c.set(exit, region);
  const inverted = mode === "inverted";
  const { oneWay, pool, twoWay: twoWays } = vanillaEntrances(inverted);
  // do_vanilla_connections (:162-170): Chris Houlihan's room back to Link's
  // House, wherever it leads with it
  const linksHouse = inverted ? "Big Bomb Shop" : "Links House";
  if (kept(linksHouse)) c.set("Chris Houlihan Room Exit", parentOf(linksHouse));
  for (const entrance of pool) {
    if (!kept(entrance)) continue;
    const exit = twoWays.get(entrance);
    if (exit !== undefined) twoWay(c, entrance, exit);
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
    c.set(DARK_SANCTUARY_EXIT, parentOf(DARK_SANCTUARY));
}

/** The Inverted world's save point (EntranceShuffle2.py:171-176). */
const DARK_SANCTUARY = "Dark Sanctuary Hint";

/** The Inverted world's save point's way out (EntranceShuffle2.py:174). */
const DARK_SANCTUARY_EXIT = "Dark Sanctuary Hint Exit";

/**
 * link_doors_prep with vanilla doors (DoorShuffle.py:60-133), door
 * intensity 1 as DR's tests build it: the logical connections, the
 * interior doors, the pits and warps, then the portals, then every vanilla
 * door table. The Sanctuary Mirror Route is removed (:84-90).
 */
function linkDoors(c: Map<string, string>): void {
  const simple = (name: string) => {
    for (const [exit, region] of pairsOf("DoorShuffle.py", name))
      c.set(exit, region);
  };
  const doors = (name: string, twoWays = true) => {
    for (const [a, b] of pairsOf("DoorShuffle.py", name))
      linkDoor(c, a, b, twoWays);
  };
  simple("logical_connections");
  doors("interior_doors");
  simple("falldown_pits");
  simple("dungeon_warps");
  doors("open_edges");
  doors("straight_staircases");
  doors("ladders");
  // connect_portal (:739-752): the lobby's door out to the portal region,
  // the portal region's way in to the lobby
  const portalMap = tableOf<readonly [string, string, string]>(
    "DoorShuffle.py",
    "portal_map",
  );
  for (const portal of DR_PORTALS) {
    const [, exit, enter] = portalMap[portal.name] ?? [];
    if (exit === undefined || enter === undefined)
      throw new RangeError(`No portal_map entry for ${portal.name}`);
    c.set(portal.door, parentOf(exit));
    c.set(enter, parentOf(portal.door));
  }
  simple("vanilla_logical_connections");
  doors("spiral_staircases");
  doors("default_door_connections");
  doors("default_one_way_connections", false);
}

/** The doors a portal unblocks (connect_portal sets `blocked` false). */
export const PORTAL_DOORS: ReadonlySet<string> = new Set(
  DR_PORTALS.map((p) => p.door),
);

/** The exits DR removes from the world (link_doors_prep :80-86). */
export const REMOVED_EXITS: ReadonlySet<string> = new Set([
  "Sanctuary Mirror Route",
]);

/**
 * The vanilla world's connections for a mode: every exit DR links, by
 * name, to the region it leads to.
 * @param version - The DR release the seed was built by, as its ROM title's
 *   digits (157 for 1.5.7), 156 for 1.5.6 or an older or unknown one
 */
export function vanillaConnections(mode: DrMode, version = 156): DrConnections {
  const c = new Map<string, string>();
  linkOverworld(c, mode);
  linkEntrances(c, mode, version);
  linkDoors(c);
  for (const exit of REMOVED_EXITS) c.delete(exit);
  return c;
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
  mode: DrMode,
  entrances: DrNotedEntrances,
  version = 156,
): DrNotedConnections {
  const c = new Map<string, string>();
  linkOverworld(c, mode);
  const moved = drShuffled(entrances.shuffle, entrances.pool);
  linkEntrances(
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
    if (!PARENT.has(entrance)) continue;
    noted.add(entrance);
    if (exits.has(target)) {
      c.set(entrance, parentOf(target));
      if (!decoupled) c.set(target, parentOf(entrance));
    } else c.set(entrance, target);
    if (mode === "inverted" && target === DARK_SANCTUARY)
      c.set(DARK_SANCTUARY_EXIT, parentOf(entrance));
  }
  linkDoors(c);
  for (const exit of REMOVED_EXITS) c.delete(exit);
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
 * region asks the flippers and the pearl for.
 */
export function dynamicExits(mode: DrMode): readonly DrDynamicExit[] {
  const inverted = mode === "inverted";
  const own = inverted ? "dw" : "lw";
  const other = inverted ? "lw" : "dw";
  const mirrors = tableOf<readonly string[]>(
    "OverworldShuffle.py",
    "mirror_connections",
  );
  const found: DrDynamicExit[] = [];
  for (const region of DR_REGIONS) {
    if (NO_DYNAMIC_EXITS.has(region.name)) continue;
    if (region.type === own && region.terrain === "land")
      found.push({
        from: region.name,
        name: `Flute From ${region.name}`,
        req: "true",
        source: "OverworldShuffle.py:32-38",
        to: "Flute Sky",
      });
  }
  for (const region of DR_REGIONS) {
    if (NO_DYNAMIC_EXITS.has(region.name) || region.type !== other) continue;
    const targets = mirrors[region.name] ?? [];
    for (const to of targets) {
      const target = regionNamed(to);
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

/** Whether a name is a static exit of DR's regions. */
export const isStaticExit = (name: string): boolean => PARENT.has(name);

/** A door by name, if the exit is one. */
export const doorOf = (exit: string) => DOOR_NAMED.get(exit);
