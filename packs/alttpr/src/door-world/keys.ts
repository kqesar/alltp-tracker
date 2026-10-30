// The keys of the Door Randomizer's world. DR's key rules come from its
// analysis of each dungeon (key-analysis/, KeyDoorShuffle.py), attached by
// add_key_logic_rules (Rules.py:2347-2385): each key door the analysis
// names asks its own number of keys, partial logic's figure by default
// (eval_small_key_door_partial_main, :2416-2447: the worst case capped at
// `small_key_num`), `dangerous` logic's the worst case uncapped
// (eval_small_key_door_main, :2399-2400), `strict` logic every key of the
// chests once keys are wild (:2450-2457). What a door asks beside
// that number rests on where an item lies (a key in the one location
// behind the door, the big key behind it): the tracker does not know, so
// it is `maybe`. With the keys in their dungeons, a door short of its
// number is `maybe`, never `no` (a key may lie inside); with wild keys,
// what the player recorded decides. The big key doors and chests ask the
// big key (bk_doors, bk_chests); Misery Mire's blue barriers take their
// alternative of two keys (DoorShuffle.py:297-307). On other connections
// than the vanilla ones the analysis is not run (a dungeon's portals may be
// unknown): there a key door asks every key of its dungeon, or `maybe`,
// never more `yes` than any of DR's rules.
//
// A key a vanilla drop holds (an enemy's or a pot's, key_drop_data) is a
// forced item DR collects as an event once reached (Regions.py:1105-1107,
// sweep_for_events): a fact here, `dropKey_<location>`, unless the run
// shuffles that drop, when the key found is one the player records.
import { locationId } from "@alltp/engine";
import { DR_LOCATIONS } from "../door-rando/locations";
import { DOOR_NAMED, DR_DUNGEONS, DR_REGIONS, type DrMode } from "./data";
import type { DoorRule, KeyLogic } from "./key-analysis/analysis";
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
 * (unmark_ugly_smalls, DoorShuffle.py:476-480).
 */
export const UGLY_SMALLS: ReadonlySet<string> = new Set([
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
export const specialBigKeyDoors = (mode: DrMode): ReadonlySet<string> =>
  new Set([
    "Hyrule Dungeon Cellblock Door",
    "Thieves Blind's Cell Door",
    ...(mode === "standard" ? ["Hyrule Castle Throne Room Tapestry"] : []),
  ]);

/**
 * The locations a big key opens (find_big_chest_locations,
 * find_big_key_locked_locations, KeyDoorShuffle.py:1164-1176).
 */
const isBigChest = (name: string): boolean =>
  name.includes("Big Chest") ||
  name === "Thieves' Town - Blind's Cell" ||
  name === "Hyrule Castle - Zelda's Chest";

/**
 * Misery Mire's blue barriers that two keys open from either crystal state
 * (create_alternative_door_rules, DoorShuffle.py:297-307, 312-316).
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

/**
 * How the run holds its small keys: in their dungeons, wild (keysanity)
 * under partial logic or under strict logic, or universal.
 */
export type KeyHolding = "dungeon" | "wild" | "strict" | "universal";

/** The keys of the world, for a mode and the drops shuffled. */
export interface WorldKeys {
  readonly holding: KeyHolding;
  /**
   * The rule a key door asks, from its dungeon's analysis (universal keys
   * aside: addKeyRules reads them as bought, `maybe`).
   */
  doorRule(dungeon: string, rule: DoorRule, logic: KeyLogic): string;
  /**
   * The rule a small key door asks where no analysis ran: every key of its
   * dungeon, else maybe (strict-safe: never more yes than DR's rules).
   */
  strictSafeRule(dungeon: string): string;
  /** The rule a big key door or chest asks. */
  bigKeyRule(dungeon: string): string;
  /**
   * At least `n` keys of a dungeon, as has_sm_key counts them: those
   * recorded and the vanilla drops reached.
   */
  atLeast(dungeon: string, n: number): string;
  /**
   * At least `n` keys of a dungeon from its chests, as has_sm_key_strict
   * counts them (the forced keys aside, BaseClasses.py:1124-1130), as the
   * run holds them: below `n` maybe while they stay in their dungeons, as
   * a door is; bought, `maybe`, with universal keys.
   */
  chestKeys(dungeon: string, n: number): string;
  /** The key drops whose keys are facts, not items. */
  readonly forcedDrops: readonly KeyDrop[];
}

/**
 * The keys of a world.
 * @param bigKeys - Whether the big keys are wild (keysanity's big keys),
 *   and the big keys the player has no way to record (by item): a big key
 *   kept in its dungeon, or one not recorded, reads `maybe` until held, as
 *   a small key below its number does (it may lie inside), never `no`
 * @param dangerous - key_logic_algorithm `dangerous`: a door asks its worst
 *   case uncapped (eval_small_key_door_main, Rules.py:2399-2400), which
 *   partial logic caps at `small_key_num` (:2428-2430)
 */
export function worldKeys(
  holding: KeyHolding,
  shuffled: DropShuffle,
  bigKeys: {
    readonly wild: boolean;
    readonly unrecorded?: ReadonlySet<string>;
  } = { wild: true },
  dangerous = false,
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
    if (n <= 0) return "true";
    const key = `key${codeOf(dungeon)}`;
    const facts = factsOf(dungeon, false);
    const sure = `count(${[key, ...facts].join(", ")}) >= ${n}`;
    if (facts.length === 0) return sure;
    const unsure = [key, ...facts, ...facts.map(maybeOf)].join(", ");
    return or(sure, and(`count(${unsure}) >= ${n}`, "maybe"));
  };
  const chestsAtLeast = (dungeon: string, n: number) =>
    n <= 0 ? "true" : `key${codeOf(dungeon)} >= ${n}`;
  return {
    atLeast,
    bigKeyRule: (dungeon) => {
      const item = `bigKey${codeOf(dungeon)}`;
      const unsure = !bigKeys.wild || bigKeys.unrecorded?.has(item) === true;
      return or(
        item,
        ...factsOf(dungeon, true).map(readFact),
        ...(unsure ? ["maybe"] : []),
      );
    },
    chestKeys: (dungeon, n) =>
      holding === "universal"
        ? "maybe"
        : holding === "dungeon"
          ? or(chestsAtLeast(dungeon, n), "maybe")
          : chestsAtLeast(dungeon, n),
    doorRule: (dungeon, rule, logic) => {
      // has_sm_key_strict: the keys found, the forced ones aside
      // (BaseClasses.py:1124-1130), as many as the chests hold
      if (holding === "strict")
        return chestsAtLeast(dungeon, logic.layout.maxChests);
      // A dungeon counting its chests' keys alone (static key logic,
      // Rules.py:2394 at 1.5.8) reads them with has_sm_key_strict
      const count = logic.chestCounting === true ? chestsAtLeast : atLeast;
      // Every door the analysis walks gets one (analyze_dungeon): a rule
      // without it would open the door for nothing
      const worst = rule.worstCase;
      if (worst === undefined)
        throw new RangeError(`No worst case for a door of ${dungeon}`);
      const n = dangerous ? worst : Math.min(worst, rule.smallKeyNum);
      if (holding === "dungeon") return or(count(dungeon, n), "maybe");
      const alternatives: string[] = [];
      // AllowSmall: the one location behind the door holds its key
      if (rule.allowSmall && rule.allowSmallNum !== undefined)
        alternatives.push(and("maybe", count(dungeon, rule.allowSmallNum)));
      // (Lock, big key): the big key lies behind the door
      if (rule.lockNum !== undefined && rule.alternateSmallKey !== null)
        alternatives.push(
          and(
            "maybe",
            count(dungeon, Math.min(rule.lockNum, rule.alternateSmallKey)),
          ),
        );
      return or(count(dungeon, n), ...alternatives);
    },
    forcedDrops: forced,
    holding,
    strictSafeRule: (dungeon) => {
      if (holding === "universal") return "maybe";
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
 * Misery Mire's blue barriers from the orange state: DR's code opens them
 * with two keys (eval_alternative_crystal, Rules.py:2356-2358, set by
 * vanilla_key_logic, DoorShuffle.py:298-307), but DR's own key logic seeds
 * refuse the chests behind them with two keys and more
 * (test/suite/partial_key_logic_2.yaml, strict_key_logic.yaml), a comment
 * there saying the logic "is not yet smart enough". Which DR runs, only
 * running it would tell: the keys make it `maybe`, never `yes`.
 */
const crystalAlternative = (keys: WorldKeys, dungeon: string, n: number) =>
  and("maybe", keys.atLeast(dungeon, n));

/** The doors whose link follows each door's (dependents). */
const DEPENDENTS: ReadonlyMap<string, readonly string[]> = (() => {
  const found = new Map<string, string[]>();
  for (const door of DOOR_NAMED.values())
    if (door.controller !== undefined)
      found.set(door.controller, [
        ...(found.get(door.controller) ?? []),
        door.name,
      ]);
  return found;
})();

/**
 * Adds the key rules (add_key_logic_rules, Rules.py:2347-2385): each key
 * door of a dungeon's analysis and the doors its link carries along ask
 * its rule, each big key door and chest the big key, each of Mire's blue
 * barriers its alternative. Without an analysis (`logic` undefined: other
 * connections than the vanilla ones, or pots and drops the analysis does
 * not count), or for a dungeon it leaves out, each small key door asks the
 * strict-safe rule.
 */
export function addKeyRules(
  exits: readonly KeyExit[],
  locations: Map<string, string>,
  keys: WorldKeys,
  mode: DrMode,
  logic: ReadonlyMap<string, KeyLogic> | undefined,
): void {
  const special = specialBigKeyDoors(mode);
  // The rule each exit asks, by the door rules of the analysis
  const ruled = new Map<string, string>();
  const alternative = new Map<string, string>();
  if (logic !== undefined)
    for (const [dungeon, dungeonLogic] of logic) {
      // Universal keys: every door of the proposal but Standard's escape
      // asks a key bought (:2380-2384)
      if (keys.holding === "universal") {
        if (mode === "standard" && dungeon === "Hyrule Castle") continue;
        for (const door of dungeonLogic.layout.flatProposal)
          ruled.set(door.name, "maybe");
        continue;
      }
      for (const [name, rule] of dungeonLogic.doorRules) {
        if (rule.crystalAlternative !== undefined) {
          alternative.set(
            name,
            crystalAlternative(keys, dungeon, rule.crystalAlternative),
          );
          continue;
        }
        const req = keys.doorRule(dungeon, rule, dungeonLogic);
        for (const door of [name, ...(DEPENDENTS.get(name) ?? [])])
          ruled.set(door, and(ruled.get(door) ?? "true", req));
      }
    }
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
    // A dungeon the analysis leaves out (a shuffled world's, its ways in
    // not all known) asks the strict-safe rule as a world without one does
    const analysed = logic?.has(dungeon) === true;
    if (!analysed) {
      if (small(door) || small(controller))
        exit.req = and(exit.req, keys.strictSafeRule(dungeon));
    } else {
      const rule = ruled.get(exit.name);
      if (rule !== undefined) exit.req = and(exit.req, rule);
    }
    if (big(door) || big(controller))
      exit.req = and(exit.req, keys.bigKeyRule(dungeon));
    // add_rule(…, 'or') (Rules.py:2357-2358)
    const or2 = alternative.get(exit.name);
    if (or2 !== undefined) exit.req = or(exit.req, or2);
    else if (!analysed && ALTERNATIVE_CRYSTAL_DOORS.has(exit.name))
      if (keys.holding !== "universal")
        exit.req = or(exit.req, crystalAlternative(keys, "Misery Mire", 2));
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
