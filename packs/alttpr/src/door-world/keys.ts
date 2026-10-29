// The keys of the Door Randomizer's world, strict-safe (design §2.5, 4a):
// DR's key rules come from its analysis of each dungeon (KeyDoorShuffle.py,
// attached by add_key_logic_rules, Rules.py:2343-2381), which this module
// does not port yet. Until it does, a small key door asks every key of its
// dungeon, the chests' and the vanilla drops', or reads maybe: never more
// yes than DR's partial rule (a door's WorstCase is at most them all), never
// no because of keys. The big key doors and chests ask the big key, as the
// analysis attaches them (bk_doors, bk_chests); Misery Mire's blue barriers
// take their fixed alternative of two keys (DoorShuffle.py:293-303).
//
// A key a vanilla drop holds (an enemy's or a pot's, key_drop_data) is a
// forced item DR collects as an event once reached (Regions.py:1105-1107,
// sweep_for_events): a fact here, `dropKey_<location>`, unless the run
// shuffles that drop, when the key found is one the player records.
import { locationId } from "@alltp/engine";
import { DR_LOCATIONS } from "../door-rando/locations";
import { DOOR_NAMED, DR_DUNGEONS, DR_REGIONS, type DrMode } from "./data";
import { and, maybeOf, or, readFact } from "./text";

/** DR's dungeons in the pack's key codes (`key<code>`, `bigKey<code>`). */
export const DR_KEY_CODES: Readonly<Record<string, string>> = {
  "Agahnims Tower": "A1",
  "Desert Palace": "P2",
  "Eastern Palace": "P1",
  "Ganons Tower": "A2",
  "Hyrule Castle": "H2",
  "Ice Palace": "D5",
  "Misery Mire": "D6",
  "Palace of Darkness": "D1",
  "Skull Woods": "D3",
  "Swamp Palace": "D2",
  "Thieves Town": "D4",
  "Tower of Hera": "P3",
  "Turtle Rock": "D7",
};

/**
 * Every key item the rules read, a dungeon's small keys and big key: DR's
 * Eastern Palace has keys (its drops) where vt's has none.
 */
export const KEY_ITEMS: readonly string[] = Object.values(DR_KEY_CODES).flatMap(
  (code) => [`key${code}`, `bigKey${code}`],
);

/**
 * Small key doors that are no key doors with vanilla doors
 * (unmark_ugly_smalls, DoorShuffle.py:472-476).
 */
const UGLY_SMALLS = new Set([
  "Eastern Hint Tile Blocked Path SE",
  "Eastern Darkness S",
  "Thieves Hallway SE",
  "Mire Left Bridge S",
  "TR Lava Escape SE",
  "GT Hidden Spikes SE",
]);

/**
 * The doors that ask the big key beside the big key doors
 * (special_big_key_doors, DungeonGenerator.py:774-781).
 */
const specialBigKeyDoors = (mode: DrMode): ReadonlySet<string> =>
  new Set([
    "Hyrule Dungeon Cellblock Door",
    "Thieves Blind's Cell Door",
    ...(mode === "standard" ? ["Hyrule Castle Throne Room Tapestry"] : []),
  ]);

/**
 * The locations a big key opens (find_big_chest_locations,
 * find_big_key_locked_locations, KeyDoorShuffle.py:1163-1175).
 */
const isBigChest = (name: string): boolean =>
  name.includes("Big Chest") ||
  name === "Thieves' Town - Blind's Cell" ||
  name === "Hyrule Castle - Zelda's Chest";

/**
 * Misery Mire's blue barriers that two keys open from either crystal state
 * (create_alternative_door_rules, DoorShuffle.py:293-303, 312-316).
 */
export const ALTERNATIVE_CRYSTAL_DOORS: ReadonlySet<string> = new Set([
  "Mire Hub Upper Blue Barrier",
  "Mire Hub Lower Blue Barrier",
  "Mire Hub Right Blue Barrier",
  "Mire Hub Top Blue Barrier",
  "Mire Hub Switch Blue Barrier N",
  "Mire Hub Switch Blue Barrier S",
  "Mire Map Spot Blue Barrier",
  "Mire Map Spike Side Blue Barrier",
  "Mire Crystal Dead End Left Barrier",
  "Mire Crystal Dead End Right Barrier",
]);

/** The fact a vanilla key drop gives once reached. */
export const dropKeyFact = (location: string): string =>
  `dropKey_${locationId(location).replace(/[^a-z0-9]+/g, "_")}`;

const DUNGEON_OF_REGION = new Map(DR_REGIONS.map((r) => [r.name, r.dungeon]));

/** Which vanilla drops a run shuffles: their keys are then items. */
export interface DropShuffle {
  /** Enemies' key drops (`dropshuffle` keys or underworld). */
  readonly drops: boolean;
  /** Pots' keys (`pottery` other than none and cave). */
  readonly pots: boolean;
}

/** A dungeon's key drops, each with its fact, the key it holds. */
export interface KeyDrop {
  readonly location: string;
  readonly fact: string;
  readonly dungeon: string;
  readonly big: boolean;
  readonly pot: boolean;
}

/** The 33 vanilla key drops (key_drop_data), by dungeon. */
export const KEY_DROPS: readonly KeyDrop[] = DR_LOCATIONS.filter(
  (l) => l.kind === "keyDrop",
).map((l) => {
  const dungeon = DUNGEON_OF_REGION.get(l.region);
  if (dungeon === undefined || dungeon === null)
    throw new RangeError(`No dungeon for the key drop ${l.name}`);
  return {
    big: l.key === "big",
    dungeon,
    fact: dropKeyFact(l.name),
    location: l.name,
    pot: l.flag.memory === "pot",
  };
});

/** The keys of the world, for a mode and the drops shuffled. */
export interface WorldKeys {
  /** The rule a small key door of a dungeon asks. */
  smallKeyRule(dungeon: string): string;
  /** The rule a big key door or chest asks. */
  bigKeyRule(dungeon: string): string;
  /**
   * At least `n` keys of a dungeon, as has_sm_key counts them: those
   * recorded and the vanilla drops reached.
   */
  atLeast(dungeon: string, n: number): string;
  /** The key drops whose keys are facts, not items. */
  readonly forcedDrops: readonly KeyDrop[];
}

export function worldKeys(
  universal: boolean,
  shuffled: DropShuffle,
): WorldKeys {
  const forced = KEY_DROPS.filter(
    (d) => !(d.pot ? shuffled.pots : shuffled.drops),
  );
  const codeOf = (dungeon: string) => {
    const code = DR_KEY_CODES[dungeon];
    if (code === undefined) throw new RangeError(`No dungeon ${dungeon}`);
    return code;
  };
  const factsOf = (dungeon: string, big: boolean) =>
    forced
      .filter((d) => d.big === big && d.dungeon === dungeon)
      .map((d) => d.fact);
  // A drop reached at maybe only counts at maybe (facts.ts)
  const atLeast = (dungeon: string, n: number) => {
    const key = `key${codeOf(dungeon)}`;
    const facts = factsOf(dungeon, false);
    const sure = `count(${[key, ...facts].join(", ")}) >= ${n}`;
    if (facts.length === 0) return sure;
    const unsure = [key, ...facts, ...facts.map(maybeOf)].join(", ");
    return or(sure, and(`count(${unsure}) >= ${n}`, "maybe"));
  };
  return {
    atLeast,
    bigKeyRule: (dungeon) =>
      or(`bigKey${codeOf(dungeon)}`, ...factsOf(dungeon, true).map(readFact)),
    forcedDrops: forced,
    smallKeyRule: (dungeon) => {
      // Universal keys are bought (has_sm_key, BaseClasses.py:1113-1117):
      // not ported yet
      if (universal) return "maybe";
      const chests =
        DR_DUNGEONS.find((d) => d.name === dungeon)?.smallKeys.length ?? 0;
      const drops = KEY_DROPS.filter((d) => !d.big && d.dungeon === dungeon);
      const all = chests + drops.length;
      return all === 0 ? "true" : or(atLeast(dungeon, all), "maybe");
    },
  };
}

/** An exit, as the world builder holds it. */
interface KeyExit {
  readonly name: string;
  readonly from: string;
  req: string;
}

/**
 * Adds the key rules: each small key door (or a door it controls) asks its
 * dungeon's keys, each big key door and chest the big key, each of Mire's
 * blue barriers its alternative.
 */
export function addKeyRules(
  exits: readonly KeyExit[],
  locations: Map<string, string>,
  keys: WorldKeys,
  mode: DrMode,
  universal: boolean,
): void {
  const special = specialBigKeyDoors(mode);
  for (const exit of exits) {
    const door = DOOR_NAMED.get(exit.name);
    const dungeon = DUNGEON_OF_REGION.get(exit.from);
    if (door === undefined || dungeon === undefined || dungeon === null)
      continue;
    const controller =
      door.controller === undefined
        ? undefined
        : DOOR_NAMED.get(door.controller);
    const small = (d: typeof door | undefined) =>
      d?.smallKey === true && !UGLY_SMALLS.has(d.name);
    const big = (d: typeof door | undefined) =>
      d !== undefined && (d.bigKey === true || special.has(d.name));
    if (small(door) || small(controller))
      exit.req = and(exit.req, keys.smallKeyRule(dungeon));
    if (big(door) || big(controller))
      exit.req = and(exit.req, keys.bigKeyRule(dungeon));
    // add_rule(…, 'or') (Rules.py:2353-2354), not with universal keys
    if (ALTERNATIVE_CRYSTAL_DOORS.has(exit.name) && !universal)
      exit.req = or(exit.req, keys.atLeast("Misery Mire", 2));
  }
  for (const region of DR_REGIONS) {
    if (region.dungeon === null) continue;
    for (const name of region.locations)
      if (isBigChest(name) && locations.has(name))
        locations.set(
          name,
          and(locations.get(name) ?? "true", keys.bigKeyRule(region.dungeon)),
        );
  }
}
