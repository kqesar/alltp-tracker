// DR's key analysis on a door shuffle's noted layouts. With shuffled doors
// DR analyses each dungeon's generated layout once, as it picks its key
// doors (find_valid_combination, DoorShuffle.py:2753-2812, in
// shuffle_small_key_doors :2049-2140, after the traps and big key doors,
// shuffle_door_types :1894-1915): build_key_layout (KeyDoorShuffle.py:
// 234-242) over the layout's regions, the key doors chosen and the start
// regions filter_start_regions keeps (:2332-2365), then analyze_dungeon.
// The notes tell that layout only in part, and some of its inputs rest on
// DR's random choices, so a dungeon is analysed only where they are all
// known: intensity 1 or 2 (each portal on its own door, link_doors_prep
// :95-108), coupled doors, entrances vanilla (the caller's), every door
// of its layout linked and of a known kind, and its start regions certain.
// Any other dungeon keeps the strict-safe rule (shuffle.ts).
import type { DrConnections, DrNotedDoors } from "../connections";
import { dynamicExits, lobbiesOf } from "../connections";
import type { DrData, DrMode } from "../data";
import { doorById, isShuffledDoor } from "../doors";
import { regionTypeOf, screensOf } from "../overworld";
import { isShut, kindIn } from "../shuffle";
import { analyzeDungeon, type KeyLogic } from "./analysis";
import { keyLayout } from "./counters";
import {
  DR_DUNGEON_ORDER,
  exitsByRegion,
  type KDoor,
  type KeyAnalysisSettings,
  type KRegion,
  keyWorld,
} from "./dungeon";

/** drop_entrances (DungeonGenerator.py:4172-4186), the non-empty ones. */
const DROP_ENTRANCES: Readonly<Record<string, readonly string[]>> = {
  "Hyrule Castle": ["Sewers Rat Path"],
  "Skull Woods": [
    "Skull Pinball",
    "Skull Left Drop",
    "Skull Pot Circle",
    "Skull Back Drop",
  ],
};

/**
 * The portals link_doors_prep marks as destinations below intensity 3 with
 * vanilla entrances (DoorShuffle.py:100-108), which filter_start_regions
 * leaves out.
 */
const destinationsOf = (mode: DrMode): ReadonlySet<string> =>
  new Set([
    ...(mode === "standard" ? ["Sanctuary"] : []),
    "Desert East",
    ...(mode === "inverted"
      ? ["Desert West"]
      : ["Skull 2 West", "Turtle Rock Lazy Eyes", "Turtle Rock Eye Bridge"]),
  ]);

/**
 * The analyses run, by all that one dungeon's reads (the run's settings,
 * its starts, each exit of its layout's rooms: its link, its kind, its
 * dest); null where DR could not walk the layout. The last few hundred
 * kept: a player's notes move one dungeon at a time.
 */
const ANALYSES = new Map<string, KeyLogic | null>();
const ANALYSES_KEPT = 256;

/** Keeps an analysis, the oldest let go past ANALYSES_KEPT. */
function keep(key: string, analysed: KeyLogic | null): void {
  ANALYSES.set(key, analysed);
  for (const old of ANALYSES.keys()) {
    if (ANALYSES.size <= ANALYSES_KEPT) break;
    ANALYSES.delete(old);
  }
}

/** Test only: forgets the analyses kept, of one dungeon or of all. */
export function forgetNotedKeyLogic(dungeon?: string): void {
  const prefix = dungeon === undefined ? "" : `[${JSON.stringify(dungeon)},`;
  for (const key of [...ANALYSES.keys()])
    if (key.startsWith(prefix)) ANALYSES.delete(key);
}

/**
 * The inaccessible regions (find_inaccessible_regions), by data and mode:
 * their walk crosses no door nor portal (DoorShuffle.py:3402-3437), so the
 * door notes never move them, and the entrances are vanilla here.
 */
const INACCESSIBLE = new WeakMap<DrData, Map<DrMode, ReadonlySet<string>>>();

function inaccessibleOf(
  data: DrData,
  mode: DrMode,
  connections: DrConnections,
): ReadonlySet<string> {
  let byMode = INACCESSIBLE.get(data);
  if (byMode === undefined) {
    byMode = new Map();
    INACCESSIBLE.set(data, byMode);
  }
  let found = byMode.get(mode);
  if (found === undefined) {
    found = keyWorld({
      accessibility: "items",
      bigKeyShuffle: false,
      connections,
      data,
      dropShuffleNone: true,
      forcedDrops: new Set(),
      keyShuffle: "none",
      // No starts worked out: a layout of none
      layout: {
        dests: new Map(),
        dungeons: new Map(),
        kindOf: () => ({ bigKey: false, blocked: false, smallKey: false }),
      },
      mode,
    }).inaccessible;
    byMode.set(mode, found);
  }
  return found;
}

/** What notedDoorKeyLogic reads of a door-shuffled run. */
export interface NotedDoorAnalysis {
  readonly data: DrData;
  readonly mode: DrMode;
  /** The analysis settings drKeyLogic reads (keys, drops, accessibility). */
  readonly analysis: Omit<
    KeyAnalysisSettings,
    "data" | "mode" | "connections" | "layout" | "partial" | "screens"
  >;
  /** The world's connections, the noted doors linked (linkShuffledDoors). */
  readonly connections: DrConnections;
  readonly doors: DrNotedDoors;
  /** Each dungeon room's dungeon (roomDungeons). */
  readonly dungeons: ReadonlyMap<string, string>;
}

/**
 * DR's key analysis of each dungeon whose noted layout tells all it reads
 * (see the module's head), by dungeon; none for a run out of that reach.
 */
export function notedDoorKeyLogic(
  input: NotedDoorAnalysis,
): ReadonlyMap<string, KeyLogic> {
  const { data, doors, dungeons, connections, mode, analysis } = input;
  const found = new Map<string, KeyLogic>();
  const { settings } = doors;
  if (
    data.flavor !== "dr" ||
    settings.intensity >= 3 ||
    settings.decoupled ||
    analysis.keyShuffle === "universal"
  )
    return found;
  const lobbies = lobbiesOf(data, doors);
  const lobbyDoors = new Set(lobbies.values());
  const kindOf = (name: string) => {
    const door = data.doorByName.get(name);
    if (door === undefined)
      return { bigKey: false, blocked: false, smallKey: false };
    const kind = kindIn(door, doors);
    return {
      bigKey: kind === "big",
      blocked: isShut(door, doors, lobbyDoors),
      smallKey: kind === "small",
    };
  };
  // connect_doors' dest: each noted link, and its way back (coupled)
  const dests = new Map<string, string>();
  for (const [fromId, toId] of Object.entries(doors.notes.links ?? {})) {
    const from = doorById(fromId, data);
    const to = doorById(toId, data);
    if (from === undefined || to === undefined) continue;
    if (
      !isShuffledDoor(from, settings, data) ||
      !isShuffledDoor(to, settings, data)
    )
      continue;
    dests.set(from.name, to.name);
    if (!dests.has(to.name)) dests.set(to.name, from.name);
  }
  // The dungeons the notes tell whole, the escape's in Standard aside
  // (filter_start_regions' std_flag, :2333, starts it from its courtyard
  // and Zelda's events): the world is built only for them
  const told = DR_DUNGEON_ORDER.flatMap((dungeon) => {
    if (mode === "standard" && dungeon === "Hyrule Castle") return [];
    const regions = data.regions.filter(
      (r) => r.type === "dungeon" && dungeons.get(r.name) === dungeon,
    );
    return layoutKnown(input, regions, lobbyDoors)
      ? [{ dungeon, regions }]
      : [];
  });
  if (told.length === 0) return found;
  const walk = accessibleEntrances(
    data,
    mode,
    connections,
    settings,
    inaccessibleOf(data, mode, connections),
  );
  // Each dungeon's analysis reads its own layout, its starts and the run's
  // settings alone: a note elsewhere leaves it as it was, kept (ANALYSES)
  const run = JSON.stringify([
    data.flavor,
    mode,
    { ...analysis, forcedDrops: [...analysis.forcedDrops].sort() },
    settings,
  ]);
  const wanted: {
    readonly dungeon: string;
    readonly regions: (typeof told)[number]["regions"];
    readonly starts: readonly string[];
    readonly key: string;
  }[] = [];
  for (const { dungeon, regions } of told) {
    const starts = startsOf(input, dungeon, walk);
    if (starts === undefined) continue;
    const layout = regions.map((region) => [
      region.name,
      region.exits.map((exit) => {
        const door = data.doorByName.get(exit);
        const kind = (name: string | undefined) => {
          if (name === undefined) return null;
          const { bigKey, blocked, smallKey } = kindOf(name);
          return `${Number(smallKey)}${Number(bigKey)}${Number(blocked)}`;
        };
        return [
          exit,
          connections.get(exit) ?? null,
          door === undefined ? null : kind(exit),
          dests.get(exit) ?? null,
          kind(door?.controller),
        ];
      }),
    ]);
    const key = JSON.stringify([dungeon, run, starts, layout]);
    wanted.push({ dungeon, key, regions, starts });
  }
  const missed = wanted.filter(({ key }) => !ANALYSES.has(key));
  if (missed.length > 0) {
    const world = keyWorld({
      ...analysis,
      connections,
      data,
      layout: { dests, dungeons, kindOf },
      mode,
    });
    for (const { dungeon, key, regions, starts } of missed) {
      const startRegions = starts.map((name) => world.regions.get(name));
      const proposal = proposalOf(world.doors, regions, kindOf);
      const units = proposal.length;
      let analysed: KeyLogic | null = null;
      // Notes no generated layout has (a slip, or another run's settings)
      // stop DR's own walk (find_counter's "Unable to find door
      // permutation", KeyDoorShuffle.py): such a dungeon stays strict-safe
      try {
        if (startRegions.every((r) => r !== undefined)) {
          const layout = keyLayout(world, dungeon, {
            // calc_max_chests (KeyDoorShuffle.py:262-265): the vanilla
            // dungeon's in basic, the key doors less the forced drops in a
            // pool
            maxChests: (drops) =>
              settings.shuffle === "basic"
                ? undefined
                : Math.max(0, units - drops),
            proposal,
            starts: startRegions as KRegion[],
          });
          analysed = analyzeDungeon(layout);
        }
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
      }
      keep(key, analysed);
    }
  }
  for (const { dungeon, key } of wanted) {
    const analysed = ANALYSES.get(key);
    if (analysed !== undefined && analysed !== null)
      found.set(dungeon, analysed);
  }
  return found;
}

/**
 * Whether the notes tell a dungeon's layout whole: each door of its rooms
 * the shuffle relinks noted, and each door's kind known (its controller's
 * where it has one).
 */
function layoutKnown(
  { data, connections, doors }: NotedDoorAnalysis,
  regions: readonly { readonly exits: readonly string[] }[],
  lobbyDoors: ReadonlySet<string>,
): boolean {
  if (regions.length === 0) return false;
  for (const region of regions)
    for (const exit of region.exits) {
      const door = data.doorByName.get(exit);
      if (door === undefined) continue;
      if (
        isShuffledDoor(door, doors.settings, data) &&
        !lobbyDoors.has(door.name) &&
        !connections.has(door.name)
      )
        return false;
      const controller =
        door.controller === undefined
          ? door
          : data.doorByName.get(door.controller);
      if (controller === undefined || kindIn(controller, doors) === undefined)
        return false;
    }
  return true;
}

/** find_accessible_entrances' walk, once per world: what it reaches. */
interface Walk {
  /**
   * The entrances of a dungeon the walk reaches, from its starts (less
   * those `skipped`).
   */
  readonly reached: (
    entrances: ReadonlySet<string>,
    skipped: ReadonlySet<string>,
  ) => {
    readonly found: ReadonlySet<string>;
    /** Whether a door it crossed into is not noted: a way it may miss. */
    readonly certain: boolean;
  };
  /** Each region's parents, by its entrances. */
  readonly parents: ReadonlyMap<string, readonly string[]>;
  readonly inaccessible: ReadonlySet<string>;
}

/**
 * find_accessible_entrances (DoorShuffle.py:3439-3479), run at the end of
 * main_dungeon_generation (:1170-1172), before the door types are
 * shuffled: a walk of every exit, rules aside, from Link's House, the
 * Sanctuary and the Pyramid (Inverted's own three), skipping a door its
 * vanilla data shuts, stopping at the dungeon's own entrances. The walk
 * crosses other dungeons' layouts, which the notes may tell in part: a
 * door it reaches that the shuffle relinks and no note names makes what it
 * did not find uncertain.
 */
function accessibleEntrances(
  data: DrData,
  mode: DrMode,
  connections: DrConnections,
  settings: DrNotedDoors["settings"],
  inaccessible: ReadonlySet<string>,
): Walk {
  const screens = screensOf(mode);
  const dynamic = new Map(
    dynamicExits(data, mode, regionTypeOf(data, screens)).map((e) => [
      e.name,
      e.to,
    ]),
  );
  const target = (exit: string) => connections.get(exit) ?? dynamic.get(exit);
  const exits = exitsByRegion(data, mode, screens);
  const parents = new Map<string, string[]>();
  for (const [region, list] of exits)
    for (const exit of list) {
      const to = target(exit);
      if (to !== undefined)
        parents.set(to, [...(parents.get(to) ?? []), region]);
    }
  const blocked = (exit: string) => {
    const door = data.doorByName.get(exit);
    return door?.trapped === true && !data.portals.some((p) => p.door === exit);
  };
  const starts =
    mode === "inverted"
      ? ["Links House", "Dark Sanctuary Hint", "Hyrule Castle Ledge"]
      : ["Links House", "Sanctuary", "Pyramid Area"];
  const reached = (
    entrances: ReadonlySet<string>,
    skipped: ReadonlySet<string>,
  ) => {
    const found = new Set<string>();
    let certain = true;
    const queue = starts.filter((r) => !skipped.has(r));
    const seen = new Set(queue);
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      // Inverted: Agahnim's tower leads to the castle's ledge (:3465-3468)
      const more =
        mode === "inverted" && next === "Tower Agahnim 1"
          ? ["Hyrule Castle Ledge"]
          : [];
      for (const to of more)
        if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      for (const exit of exits.get(next) ?? []) {
        const door = data.doorByName.get(exit);
        const to = target(exit);
        if (to === undefined) {
          if (door !== undefined && isShuffledDoor(door, settings, data))
            certain = false;
          continue;
        }
        if (blocked(exit)) continue;
        if (entrances.has(to)) found.add(to);
        else if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    return { certain, found };
  };
  return { inaccessible, parents, reached };
}

/**
 * A dungeon's start regions as filter_start_regions keeps them (DoorShuffle.
 * py:2332-2365) of find_possible_entrances' (:3482-3487): the lobbies of
 * the portals its layout holds, then its drops. A destination portal's
 * lobby is out unless the overworld drops into it too; any other portal's
 * is in where the walk reaches it; a drop is out where the overworld above
 * it is inaccessible. Undefined where the notes do not tell: a drop of its
 * own outside its layout, a walk that may have missed a lobby, a drop whose
 * overworld parents disagree. By region name.
 */
function startsOf(
  { data, dungeons, mode }: NotedDoorAnalysis,
  dungeon: string,
  walk: Walk,
): string[] | undefined {
  const destinations = destinationsOf(mode);
  const overworld = (name: string) =>
    (walk.parents.get(name) ?? []).filter((parent) => {
      const type = data.regionByName.get(parent)?.type;
      return type === "lw" || type === "dw" || parent === "Sewer Drop";
    });
  const portals: { readonly lobby: string; readonly portal: string }[] = [];
  for (const portal of data.portals) {
    const lobby = data.parent.get(portal.door);
    if (lobby !== undefined && dungeons.get(lobby) === dungeon)
      portals.push({ lobby, portal: portal.name });
  }
  const drops = DROP_ENTRANCES[dungeon] ?? [];
  if (drops.some((drop) => dungeons.get(drop) !== dungeon)) return undefined;
  const entrances = new Set([...portals.map((p) => p.lobby), ...drops]);
  // Open mode: Sanctuary's save point enters its dungeon (:3455-3459)
  const sanctuary =
    mode === "open" && dungeons.get("Sanctuary") === dungeon
      ? new Set(["Sanctuary"])
      : new Set<string>();
  const walked = walk.reached(new Set([...entrances, ...sanctuary]), sanctuary);
  const path = new Set([...walked.found, ...sanctuary]);
  const starts: string[] = [];
  for (const { lobby, portal } of portals) {
    if (destinations.has(portal)) {
      if (overworld(lobby).length > 0) starts.push(lobby);
      continue;
    }
    if (path.has(lobby)) starts.push(lobby);
    else if (!walked.certain) return undefined;
  }
  for (const drop of drops) {
    const above = overworld(drop);
    const shut = above.filter((parent) => walk.inaccessible.has(parent));
    if (shut.length > 0 && shut.length < above.length) return undefined;
    if (shut.length === 0) starts.push(drop);
  }
  return [...new Set(starts)];
}

/**
 * The layout's key doors as DR proposes them (build_pair_list, DoorShuffle.
 * py:3038-3049): each small key door of its rooms (a controlled door's
 * controller), paired with its dest where that is one too and leads back,
 * stairs alone.
 */
function proposalOf(
  doors: ReadonlyMap<string, KDoor>,
  regions: readonly { readonly exits: readonly string[] }[],
  kindOf: (name: string) => { readonly smallKey: boolean },
): (KDoor | readonly [KDoor, KDoor])[] {
  const flat: KDoor[] = [];
  for (const region of regions)
    for (const exit of region.exits) {
      const door = doors.get(exit);
      if (door === undefined) continue;
      const key = door.controller ?? door;
      if (kindOf(key.name).smallKey && !flat.includes(key)) flat.push(key);
    }
  const queue = [...flat];
  const paired: (KDoor | readonly [KDoor, KDoor])[] = [];
  for (let d = queue.pop(); d !== undefined; d = queue.pop()) {
    const dest = d.dest;
    if (
      dest !== null &&
      queue.includes(dest) &&
      d.type !== "SpiralStairs" &&
      dest.dest === d
    ) {
      paired.push([d, dest]);
      queue.splice(queue.indexOf(dest), 1);
    } else paired.push(d);
  }
  return paired;
}
