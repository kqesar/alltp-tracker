// What the Door Randomizer's world reads of a door-shuffled run's notes
// beside its links (connections.ts): each door's kind, which dungeon each
// room ends up in, and the rules both make.
//
// - Kinds. With shuffled doors DR's rules read a door's kind in its room
//   (Rules.py:895-906: a bombable door asks bombs, a dashable one bombs or
//   the boots, each on the door and its dependents), its key and big key
//   doors through add_key_logic_rules (:2347-2385), its traps through the
//   door's `trapped` (no exit unless trap_door_exceptions, DoorShuffle.py:
//   2477-2536). A door the shuffle may change (doors.ts kindShuffled) has
//   the kind the player noted; not noted, it is unknown and `maybe` to
//   pass, never yes. Every other door keeps its room's kind.
// - Dungeons. A partitioned or crossed shuffle makes each layout one
//   dungeon's, whatever rooms it holds (update_forced_keys, :1039-1050:
//   `region.dungeon`): its keys open its key doors, its big key its big
//   chest, its drops hold its keys (its boss room is always its own:
//   dungeon_boss_sectors, DungeonGenerator.py:4138). A room's dungeon is
//   the one whose portal the noted links reach it from; basic keeps each
//   room in its own.
// - Keys. DR analyses each generated layout (KeyDoorShuffle.py). Where the
//   notes tell all that analysis reads (key-analysis/noted.ts: intensity
//   1 or 2, coupled doors, vanilla entrances, the layout noted whole, its
//   starts certain), a key door asks the rule DR's analysis gives it
//   (add_key_logic_rules, Rules.py:2347-2365). Elsewhere, and for a key
//   door that analysis gives no rule, it asks every key of its dungeon, or
//   `maybe` (strict-safe), never more yes than DR's rules. Basic keeps a
//   dungeon's key count; partitioned and crossed move it
//   (shuffle_small_key_doors, :2139-2145), so its door asks the count the
//   player noted (`keys`), `maybe` until then.
import type { DrNotedDoors } from "./connections";
import { type DrData, type DrDoor, type DrMode, perData } from "./data";
import {
  type DoorKindNote,
  doorId,
  kindShuffled,
  portalDungeonOf,
  vanillaKind,
} from "./doors";
import type { KeyLogic } from "./key-analysis/analysis";
import {
  DR_KEY_CODES,
  isBigChest,
  specialBigKeyDoors,
  type WorldKeys,
} from "./keys";
import { and, maybeOf, or } from "./text";

/** A door's kind in a run: noted, its room's, or unknown (undefined). */
export function kindIn(
  door: DrDoor,
  doors: DrNotedDoors,
): DoorKindNote | undefined {
  if (!kindShuffled(door, doors.settings)) return vanillaKind(door);
  return doors.notes.kinds?.[doorId(door.name)];
}

/** Room kinds a bunny cannot pass (doors_to_check, Rules.py:2196-2201). */
const BUNNY_WALLS: ReadonlySet<string> = new Set([
  "Dashable",
  "Bombable",
  "Hidden",
]);

/**
 * Whether a door is a wall a bunny cannot pass (set_bunny_rules'
 * doors_to_check, Rules.py:2196-2201 at DR 1.5.8, owr:Rules.py:2024-2029):
 * a normal or interior door whose kind in its room is dashable, bombable or
 * hidden. Its room's kind, or under a door shuffle that may change it the
 * noted one: a bombable or dashable note is a wall, any other none, no note
 * `maybe`. An exit that is no door is none.
 */
export function bunnyWall(
  data: DrData,
  name: string,
  doors?: DrNotedDoors,
): "yes" | "no" | "maybe" {
  const door = data.doorByName.get(name);
  if (door === undefined || !["Normal", "Interior"].includes(door.type))
    return "no";
  if (doors === undefined || !kindShuffled(door, doors.settings))
    return BUNNY_WALLS.has(door.kind ?? "") ? "yes" : "no";
  const note = kindIn(door, doors);
  if (note === undefined) return "maybe";
  return note === "bomb" || note === "dash" ? "yes" : "no";
}

/**
 * Whether a door of bunny_impassible_if_trapped is a trap as the run knows
 * it (Rules.py:2191-2194 at DR 1.5.8 reads the seed's `door.trapped`,
 * which a trap shuffle sets, DoorShuffle.py:2494, :2504): its room's
 * under no shuffle of its kind, else the noted kind, `maybe` until noted.
 */
export function bunnyTrapped(
  data: DrData,
  name: string,
  doors?: DrNotedDoors,
): "yes" | "no" | "maybe" {
  const door = data.doorByName.get(name);
  if (door === undefined) return "no";
  if (doors === undefined || !kindShuffled(door, doors.settings))
    return door.trapped === true ? "yes" : "no";
  const note = kindIn(door, doors);
  if (note === undefined) return "maybe";
  return note === "trap" ? "yes" : "no";
}

/**
 * Whether a trap door shuts as an exit (is_trap_door_blocked,
 * DoorShuffle.py:2533-2534): every trap but trap_door_exceptions
 * (:2511-2530), which a trap mode leaves passable once in.
 */
const TRAP_EXCEPTIONS: ReadonlySet<string> = new Set([
  "PoD Mimics 2 SW",
  "TR Twin Pokeys NW",
  "Thieves Blocked Entry SW",
  "Hyrule Dungeon Armory Interior Key Door N",
  "Desert Compass Key Door WN",
  "TR Tile Room SE",
  "Mire Cross SW",
  "Tower Circle of Pots ES",
  "PoD Mimics 1 SW",
  "Eastern Single Eyegore ES",
  "Eastern Duo Eyegores SE",
  "Swamp Push Statue S",
  "Skull 2 East Lobby WS",
  "GT Hope Room WN",
  "Eastern Courtyard Ledge S",
  "Ice Lobby SE",
  "GT Speed Torch WN",
  "Ice Switch Room ES",
  "Ice Switch Room NE",
  "Skull Torch Room WS",
  "GT Speed Torch NE",
  "GT Speed Torch WS",
  "GT Torch Cross WN",
  "Mire Tile Room SW",
  "Mire Tile Room ES",
  "TR Torches WN",
  "PoD Lobby N",
  "PoD Middle Cage S",
  "Ice Bomb Jump NW",
  "GT Hidden Spikes SE",
  "Ice Tall Hint EN",
  "Ice Tall Hint SE",
  "Eastern Pot Switch WN",
  "Thieves Conveyor Maze WN",
  "Thieves Conveyor Maze SW",
  "Eastern Dark Square Key Door WN",
  "Eastern Lobby NW",
  "Eastern Lobby NE",
  "Ice Cross Bottom SE",
  "Ice Cross Right ES",
  "Desert Back Lobby S",
  "Desert West S",
  "Desert West Lobby ES",
  "Mire Hidden Shooters SE",
  "Mire Hidden Shooters ES",
  "Mire Hidden Shooters WS",
  "Tower Dark Pits EN",
  "Tower Dark Maze ES",
  "TR Tongue Pull WS",
  "GT Conveyor Cross EN",
]);

/**
 * Whether a door's exit is shut (no exit, BaseClasses.py:646): a noted
 * trap but the exceptions, a door whose room's kind no shuffle touches as
 * Doors.py sets it, never a lobby (connect_portal unblocks it).
 */
export function isShut(
  door: DrDoor,
  doors: DrNotedDoors,
  lobbies: ReadonlySet<string>,
): boolean {
  if (lobbies.has(door.name)) return false;
  if (!kindShuffled(door, doors.settings)) return door.trapped === true;
  return kindIn(door, doors) === "trap" && !TRAP_EXCEPTIONS.has(door.name);
}

/**
 * Each dungeon room's dungeon in a run: basic keeps its own; partitioned
 * and crossed give it the dungeon of the portal whose lobby its layout
 * holds, or of the drop it lands from (dungeon_drops, DungeonGenerator.py:
 * 4239-4242 at DR 1.5.8, owr :4245-4248: the castle's rat path, Skull Woods'
 * four holes), which DR builds its dungeon from as from a lobby: the rooms
 * the noted links join to it, whichever way they are crossed (a layout is
 * a set of sectors DR joins by their doors, a trap's included), its own
 * while no portal's or drop's layout holds it.
 * @param exits - The world's connected exits, the shut ones among them
 * @param lobbies - Each portal's lobby door, by portal name
 */
export function roomDungeons(
  data: DrData,
  exits: readonly { readonly from: string; readonly to: string }[],
  lobbies: ReadonlyMap<string, string>,
  doors: DrNotedDoors,
): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const r of data.regions)
    if (r.type === "dungeon" && r.dungeon !== null)
      found.set(r.name, r.dungeon);
  if (doors.settings.shuffle === "basic") return found;
  const next = new Map<string, string[]>();
  const join = (a: string, b: string) =>
    next.set(a, [...(next.get(a) ?? []), b]);
  for (const exit of exits)
    if (
      data.regionNamed(exit.from).type === "dungeon" &&
      data.regionNamed(exit.to).type === "dungeon"
    ) {
      join(exit.from, exit.to);
      join(exit.to, exit.from);
    }
  const seen = new Set<string>();
  const starts: [string | undefined, string | undefined][] = [
    ...[...lobbies].map(
      ([portal, door]) =>
        [portalDungeonOf(data).get(portal), data.parent.get(door)] as [
          string | undefined,
          string | undefined,
        ],
    ),
    ...Object.entries(DUNGEON_DROPS).flatMap(([dungeon, regions]) =>
      regions.map((region) => [dungeon, region] as [string, string]),
    ),
  ];
  for (const [dungeon, start] of starts) {
    if (dungeon === undefined || start === undefined || seen.has(start))
      continue;
    const queue = [start];
    seen.add(start);
    for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
      found.set(at, dungeon);
      for (const to of next.get(at) ?? [])
        if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
    }
  }
  return found;
}

/** The drops DR builds a dungeon from (dungeon_drops), by dungeon. */
const DUNGEON_DROPS: Readonly<Record<string, readonly string[]>> = {
  "Hyrule Castle": ["Sewers Rat Path"],
  "Skull Woods": [
    "Skull Pot Circle",
    "Skull Pinball",
    "Skull Left Drop",
    "Skull Back Drop",
  ],
};

/** The rule a door of a kind asks beside its keys (Rules.py:895-906). */
const KIND_RULES: Partial<Record<DoorKindNote, string>> = {
  bomb: "@drCanUseBombs",
  dash: "@drCanUseBombs | @drHasBoots",
};

/** An exit, as the world builder holds it. */
interface ShuffleExit {
  readonly name: string;
  readonly from: string;
  req: string;
}

/**
 * The rules a door-shuffled run's doors and rooms ask: each door its
 * kind's (its dependents its controller's), a key door the rule DR's
 * analysis of its noted layout gives it (`logic`, noted.ts) or else the
 * strict-safe rule of its room's dungeon, a big key door (and the two cells DR always
 * asks it at, special_big_key_doors) and a big chest its big key, an
 * unknown kind `maybe`. A boss room never changes dungeon: DR assigns each
 * dungeon its own first (dungeon_boss_sectors, DungeonGenerator.py:1320-
 * 1322, :4138-4152), so its boss and its prize stay its dungeon's.
 */
export function addShuffledDoorRules(
  data: DrData,
  exits: readonly ShuffleExit[],
  locations: Map<string, string>,
  keys: WorldKeys,
  doors: DrNotedDoors,
  dungeons: ReadonlyMap<string, string>,
  mode: DrMode,
  logic: ReadonlyMap<string, KeyLogic> = new Map(),
): void {
  const special = specialBigKeyDoors(mode);
  const doorNamed = data.doorByName;
  // add_key_logic_rules: a door's rule by its own (or its controller's)
  // name, its dependents along
  const smallRule = (dungeon: string, door: string) => {
    const analysed = logic.get(dungeon);
    const rule = analysed?.doorRules.get(door);
    return analysed === undefined || rule === undefined
      ? strictSafe(keys, doors, dungeon)
      : keys.doorRule(dungeon, rule, analysed);
  };
  for (const exit of exits) {
    const door = doorNamed.get(exit.name);
    const dungeon = dungeons.get(exit.from);
    if (door === undefined || dungeon === undefined) continue;
    const controller =
      door.controller === undefined
        ? undefined
        : doorNamed.get(door.controller);
    const kind = kindIn(controller ?? door, doors);
    if (kind === undefined) exit.req = and(exit.req, "maybe");
    else if (kind === "small")
      exit.req = and(exit.req, smallRule(dungeon, (controller ?? door).name));
    else if (kind === "big") exit.req = and(exit.req, keys.bigKeyRule(dungeon));
    else {
      const rule = KIND_RULES[kind];
      if (rule !== undefined) exit.req = and(exit.req, rule);
    }
    if (special.has(door.name))
      exit.req = and(exit.req, keys.bigKeyRule(dungeon));
  }
  for (const region of data.regions) {
    const dungeon = dungeons.get(region.name);
    if (dungeon === undefined) continue;
    for (const name of region.locations) {
      const rule = locations.get(name);
      if (rule !== undefined && isBigChest(name))
        locations.set(name, and(rule, keys.bigKeyRule(dungeon)));
    }
  }
}

/**
 * A key door's strict-safe rule in a door-shuffled run: every key of its
 * dungeon (basic: as many as the vanilla dungeon holds; partitioned and
 * crossed: as many as the player noted, the drops of its rooms counted as
 * their keys), or `maybe`; `maybe` while the count is not noted.
 */
function strictSafe(
  keys: WorldKeys,
  doors: DrNotedDoors,
  dungeon: string,
): string {
  if (doors.settings.shuffle === "basic" || keys.holding === "universal")
    return keys.strictSafeRule(dungeon);
  const total = doors.notes.keys?.[dungeon];
  if (total === undefined) return "maybe";
  if (total <= 0) return "true";
  const key = `key${DR_KEY_CODES[dungeon] ?? ""}`;
  // Each forced drop holds its room's dungeon's key (worldKeys)
  const facts = keys.forcedDrops
    .filter((d) => !d.big && d.dungeon === dungeon)
    .map((d) => d.fact);
  const sure = `count(${[key, ...facts].join(", ")}) >= ${total}`;
  const unsure =
    facts.length === 0
      ? "false"
      : and(
          `count(${[key, ...facts, ...facts.map(maybeOf)].join(", ")}) >= ${total}`,
          "maybe",
        );
  return or(sure, unsure, "maybe");
}

/**
 * The derived door settings rules.json reads, in a door-shuffled run:
 * `vanillaDoors` false; a door's `trapped` its kind's (unknown: trapped,
 * which only asks more); `entranceFlag` a lobby's; its room's crystal as
 * Doors.py sets it; in a pool of dungeons, a dark room lit in Standard
 * only in the castle's layout (add_conditional_lamps, Rules.py:1364-1366).
 */
export function shuffledDoorSettings(
  data: DrData,
  doors: DrNotedDoors,
  lobbies: ReadonlySet<string>,
  dungeons: ReadonlyMap<string, string>,
  mode: DrMode,
): Record<string, boolean> {
  const found: Record<string, boolean> = { vanillaDoors: false };
  if (doors.settings.shuffle !== "basic")
    for (const [name, derived] of Object.entries(data.rules.derived))
      if (derived.kind === "litRoom")
        found[name] =
          mode === "standard" &&
          dungeons.get(derived.region ?? "") === "Hyrule Castle";
  for (const [name, entry] of Object.entries(data.rules.doorData)) {
    const door = data.doorByName.get(entry.door);
    const flag = (entry as { flag?: string }).flag;
    if (door === undefined) continue;
    const shuffled = kindShuffled(door, doors.settings);
    const kind = kindIn(door, doors);
    if (flag === "trapped")
      found[name] = shuffled
        ? kind === undefined || kind === "trap"
        : entry.vanilla;
    else if (flag === "entranceFlag") found[name] = lobbies.has(entry.door);
    else if (flag === "bigKey")
      found[name] = shuffled
        ? kind === undefined || kind === "big"
        : entry.vanilla;
  }
  return found;
}

/** The portals of each dungeon (Doors.py:1549-1575), by dungeon. */
const portalsOfDungeon = perData(
  (data): ReadonlyMap<string, readonly string[]> => {
    const found = new Map<string, string[]>();
    for (const [portal, dungeon] of portalDungeonOf(data))
      found.set(dungeon, [...(found.get(dungeon) ?? []), portal]);
    return found;
  },
);

/**
 * The Sanctuary Mirror Route of a pool of dungeons from intensity 3
 * (cross_dungeon_clean_up, DoorShuffle.py:1005-1028): to the lobby of the
 * portal of Sanctuary's dungeon DR picks, its only portal, or the one
 * whose lobby is Sanctuary's door; the castle's own Sanctuary portal while
 * Sanctuary stays the castle's. Where DR picks at random among several
 * (`random.choice`, :1023), none: the route is left out.
 */
export function sanctuaryRoute(
  data: DrData,
  doors: DrNotedDoors,
  dungeons: ReadonlyMap<string, string>,
  lobbies: ReadonlyMap<string, string>,
):
  | {
      readonly from: string;
      readonly name: string;
      req: string;
      readonly to: string;
    }
  | undefined {
  if (doors.settings.intensity < 3 || doors.settings.shuffle === "basic")
    return undefined;
  const dungeon = dungeons.get(SANCTUARY);
  const portals = portalsOfDungeon(data).get(dungeon ?? "") ?? [];
  const picked =
    dungeon === "Hyrule Castle"
      ? "Sanctuary"
      : (portals.find((p) => lobbies.get(p) === "Sanctuary S") ??
        (portals.length === 1 ? portals[0] : undefined));
  const lobby = picked === undefined ? undefined : lobbies.get(picked);
  const to = lobby === undefined ? undefined : data.parent.get(lobby);
  if (to === undefined) return undefined;
  return { from: SANCTUARY, name: "Sanctuary Mirror Route", req: "true", to };
}

/** The Sanctuary's region. */
const SANCTUARY = "Sanctuary";
