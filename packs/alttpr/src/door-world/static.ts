// DR's static key logic (`key_logic_algorithm` static, from 1.5.7:
// source/dungeon/StaticKeyLogic.py): the entrance randomizer's key rules
// for vanilla dungeons, laid over DR's own analysis. Each key door of its
// table asks a fixed number of keys counted from the chests alone, drops
// aside (static_door_rules, :87-112, through apply_key_rule_specs,
// KeyDoorShuffle.py:1422-1500 at 1.5.8, `chest_counting`), and a few
// chests and doors ask their own (set_static_key_rules, :115-182): Hyrule
// Castle's two by its key, Desert's boss by its, Kholdstare by two keys or
// the Cane of Somaria and one, Turtle Rock's by which of its entrances the
// world reaches without its keys (set_turtle_rock_rules, :209-268),
// Ganon's Tower's top by three or four. What rests on where an item lies
// (a big key in a list of chests, a small key in one) is `maybe`, as in
// the rest of the key logic (keys.ts).
//
// Its fixes since 1.5.7 are read by the seed's release: 1.5.7 strips the
// analysis's own alternatives from every door the table sets (4eb983c,
// :99-112), lets Turtle Rock's probe keep the other dungeons' keys
// (4222a44, :214) and opens TR Pokey 2 ES to the chest's own key from the
// back (3416af0, :237-239); 1.5.8 from the front and middle (5d8f8ec,
// :243). An older build, which DR's 1.5.6 version string names too, keeps
// the alternatives (`maybe`, never yes) and probes without keys.
import { DR_RULES } from "./data";
import type { DoorRule, KeyLogic } from "./key-analysis/analysis";
import type { KDoor, KLocation } from "./key-analysis/dungeon";
import type { WorldKeys } from "./keys";
import { and, or } from "./text";

/** A door of the table, as static_door_rules reads its spec (:91-97). */
export interface StaticDoor {
  readonly keys: number;
  readonly bigKeyIn?: readonly string[];
  readonly withBigKey?: number;
  readonly smallKeyIn?: string;
  readonly withSmallKey?: number;
}

/** StaticKeyLogic.py's tables, as import-dr.mjs wrote them. */
export const STATIC_KEY_LOGIC = (
  DR_RULES as unknown as {
    readonly staticKeyLogic: {
      readonly doors: Readonly<
        Record<string, Readonly<Record<string, StaticDoor>>>
      >;
      readonly gtCompass: readonly string[];
      readonly gtRandomizer: readonly string[];
      readonly trEyeBridge: readonly string[];
    };
  }
).staticKeyLogic;

/**
 * Which of Turtle Rock's ways in DR's probe reaches with every item but
 * the dungeon's small keys (set_turtle_rock_rules, :222-223): the back
 * (Eye Bridge), the front (Main Lobby), the middle (Lazy Eyes), the big
 * chest's ledge.
 */
export interface TurtleRockAccess {
  readonly back: boolean;
  readonly front: boolean;
  readonly middle: boolean;
  readonly bigChest: boolean;
}

/** The regions the probe asks about, by DR's names (:222-223). */
export const TURTLE_ROCK_PROBES = {
  back: "TR Eye Bridge",
  bigChest: "TR Big Chest Entrance",
  front: "TR Main Lobby",
  middle: "TR Lazy Eyes",
} as const;

/** set_turtle_rock_rules' case, in its order (:234-266); null: none. */
export type TurtleRockCase = "back" | "front-middle" | "front" | "big-chest";

export const turtleRockCase = (
  access: TurtleRockAccess,
): TurtleRockCase | null =>
  access.back
    ? "back"
    : access.front && access.middle
      ? "front-middle"
      : access.front
        ? "front"
        : access.bigChest
          ? "big-chest"
          : null;

const TR = "Turtle Rock";
const TR_CHEST = "Turtle Rock - Big Key Chest";

/** A copy of a rule the static logic may change. */
const copyOf = (rule: DoorRule): DoorRule => ({
  ...rule,
  alternateBigKeyLoc: new Set(rule.alternateBigKeyLoc),
});

/** A rule DR makes for a door the analysis gave none (DoorRules(n, True)). */
const ruleOf = (keys: number): DoorRule => ({
  allowSmall: false,
  alternateBigKeyLoc: new Set(),
  alternateSmallKey: null,
  isValid: true,
  smallKeyNum: keys,
  smallLocation: null,
  worstCase: keys,
});

/**
 * The static key logic over DR's analysis of the vanilla world: a copy of
 * each dungeon's logic, counting chest keys alone, its doors' rules set by
 * the table, then Turtle Rock's by the probe's case.
 * @param version - The seed's release, its ROM title's digits (158)
 */
export function staticKeyLogic(
  logic: ReadonlyMap<string, KeyLogic>,
  trCase: TurtleRockCase | null,
  version: number,
): ReadonlyMap<string, KeyLogic> {
  const out = new Map<string, KeyLogic>();
  for (const [dungeon, l] of logic)
    out.set(dungeon, {
      ...l,
      doorRules: new Map([...l.doorRules].map(([n, r]) => [n, copyOf(r)])),
    });
  const layoutOf = (door: string) => {
    for (const [dungeon, l] of out) {
      const found = l.layout.flatProposal.find((d) => d.name === door);
      if (found !== undefined) return { door: found, dungeon, logic: l };
    }
    throw new RangeError(`${door} is not a small key door of DR's layout`);
  };
  // key_logic.sm_doors (analyze_dungeon, KeyDoorShuffle.py:270-279): a
  // pair's other door, else the door across, but up spiral stairs
  const partnerOf = (l: KeyLogic, door: KDoor): KDoor | null => {
    for (const entry of l.layout.proposal)
      if (Array.isArray(entry)) {
        const [a, b] = entry as readonly [KDoor, KDoor];
        if (a === door) return b;
        if (b === door) return a;
      }
    return door.type !== "SpiralStairs" ? door.dest : null;
  };
  const locationOf = (l: KeyLogic, name: string): KLocation => {
    for (const region of l.layout.regions)
      for (const location of region.locations)
        if (location.name === name) return location;
    throw new RangeError(`No location ${name} in ${l.dungeon}`);
  };

  // apply_key_rule_specs (KeyDoorShuffle.py:1422-1500), validate=False,
  // chest_counting=True: each listed door, and its pair at its number
  const specs = new Map<string, StaticDoor>();
  for (const doors of Object.values(STATIC_KEY_LOGIC.doors))
    for (const [door, spec] of Object.entries(doors)) specs.set(door, spec);
  const resolved = new Map<
    KDoor,
    { readonly logic: KeyLogic; readonly spec: StaticDoor }
  >();
  for (const [name, spec] of specs) {
    const { door, logic: l } = layoutOf(name);
    resolved.set(door, { logic: l, spec });
  }
  for (const [door, { logic: l, spec }] of [...resolved]) {
    const partner = partnerOf(l, door);
    if (partner !== null && !resolved.has(partner))
      resolved.set(partner, { logic: l, spec: { keys: spec.keys } });
  }
  for (const { logic: l } of resolved.values())
    out.set(l.dungeon, { ...(out.get(l.dungeon) ?? l), chestCounting: true });
  for (const [door, { logic: l, spec }] of resolved) {
    const rules = (out.get(l.dungeon) ?? l).doorRules;
    const number = spec.keys;
    const rule = rules.get(door.name) ?? ruleOf(number);
    rules.set(door.name, rule);
    rule.smallKeyNum = number;
    rule.worstCase = number;
    if (spec.bigKeyIn !== undefined && spec.withBigKey !== undefined) {
      rule.alternateBigKeyLoc = new Set(
        spec.bigKeyIn.map((n) => locationOf(l, n)),
      );
      rule.lockNum = spec.withBigKey;
      rule.alternateSmallKey = spec.withBigKey;
    }
    if (spec.smallKeyIn !== undefined && spec.withSmallKey !== undefined) {
      rule.smallLocation = locationOf(l, spec.smallKeyIn);
      rule.allowSmall = true;
      rule.allowSmallNum = spec.withSmallKey;
    }
    // The other alternatives stay one below the new number (:1484-1491)
    const lower = (n: number | undefined) =>
      n === undefined || number === 0
        ? undefined
        : n >= number
          ? number - 1
          : n;
    rule.allowSmallNum = lower(rule.allowSmallNum);
    rule.lockNum = lower(rule.lockNum);
    rule.crystalAlternative = lower(rule.crystalAlternative);
    if (rule.alternateSmallKey !== null && rule.alternateSmallKey >= number)
      rule.alternateSmallKey = Math.max(number - 1, 0);
  }
  // 4eb983c (1.5.7): the analysis's own alternatives off each door the
  // table sets and the door across, unless its own spec asks (:99-112)
  if (version >= 157)
    for (const [name, spec] of specs) {
      const { door } = layoutOf(name);
      for (const [d, own] of [
        [door, spec],
        [door.dest, door.dest === null ? undefined : specs.get(door.dest.name)],
      ] as const) {
        if (d === null) continue;
        const rule = [...out.values()]
          .map((l) => l.doorRules.get(d.name))
          .find((r) => r !== undefined);
        if (rule === undefined) continue;
        if (own?.bigKeyIn === undefined) {
          rule.lockNum = undefined;
          rule.alternateSmallKey = null;
          rule.alternateBigKeyLoc = new Set();
        }
        if (own?.smallKeyIn === undefined) {
          rule.allowSmallNum = undefined;
          rule.allowSmall = false;
          rule.smallLocation = null;
        }
      }
    }
  turtleRockDoors(out, trCase, version, partnerOf, locationOf);
  return out;
}

/** set_turtle_rock_rules' doors (:185-207, :234-266). */
function turtleRockDoors(
  out: ReadonlyMap<string, KeyLogic>,
  trCase: TurtleRockCase | null,
  version: number,
  partnerOf: (l: KeyLogic, door: KDoor) => KDoor | null,
  locationOf: (l: KeyLogic, name: string) => KLocation,
): void {
  const l = out.get(TR);
  if (l === undefined || trCase === null) return;
  const doorNamed = (name: string) => {
    const found = l.layout.flatProposal.find((d) => d.name === name);
    if (found === undefined) throw new RangeError(`No TR key door ${name}`);
    return found;
  };
  const both = (name: string) => {
    const door = doorNamed(name);
    const partner = partnerOf(l, door);
    return [door, ...(partner === null ? [] : [partner])].flatMap((d) => {
      const rule = l.doorRules.get(d.name);
      return rule === undefined ? [] : [rule];
    });
  };
  // set_door_number (:185-195): the number, every alternative at or above
  // it gone
  const setNumber = (name: string, number: number) => {
    for (const rule of both(name)) {
      rule.smallKeyNum = number;
      rule.worstCase = number;
      const kept = (n: number | undefined) =>
        n !== undefined && n >= number ? undefined : n;
      rule.allowSmallNum = kept(rule.allowSmallNum);
      rule.lockNum = kept(rule.lockNum);
      rule.crystalAlternative = kept(rule.crystalAlternative);
    }
  };
  // allow_door_with_small_key_at (:198-206): no key, the chest's own
  const allowChestKey = (name: string) => {
    for (const rule of both(name)) {
      rule.allowSmall = true;
      rule.smallLocation = locationOf(l, TR_CHEST);
      rule.allowSmallNum = 0;
    }
  };
  if (trCase === "back") {
    setNumber("TR Crystaroller Down Stairs", 4);
    if (version >= 157) allowChestKey("TR Pokey 2 ES");
  } else if (trCase === "front-middle") {
    if (version >= 158) allowChestKey("TR Pokey 2 ES");
  } else if (trCase === "front") {
    for (const door of ["TR Chain Chomps Down Stairs", "TR Pokey 2 ES"])
      setNumber(door, 2);
    for (const door of ["TR Hub NW", "TR Pokey 1 NW"]) setNumber(door, 1);
  } else {
    // The doors back into the first section: 2 keys if the big key lies
    // there (:253-261)
    const first = [
      "Turtle Rock - Compass Chest",
      "Turtle Rock - Roller Room - Left",
      "Turtle Rock - Roller Room - Right",
    ].map((name) => locationOf(l, name));
    for (const door of ["TR Chain Chomps SW", "TR Pokey 1 SW"]) {
      const rule = l.doorRules.get(door);
      if (rule === undefined) continue;
      rule.alternateBigKeyLoc = new Set(first);
      rule.lockNum = 2;
      rule.alternateSmallKey = 2;
    }
  }
}

/** An exit, as the world builder holds it. */
interface StaticExit {
  readonly name: string;
  req: string;
}

/**
 * set_static_key_rules (:115-182): the chests and doors the static logic
 * gives rules of their own, after DR's key rules and Standard's (Rules.py:
 * 56-58 at 1.5.8). Each counts a dungeon's keys from its chests
 * (has_sm_key_strict); one placed (item_name, item_in_locations) is
 * `maybe`. What only DR's fill reads (forbid_item, set_always_allow) is
 * left out.
 */
export function addStaticKeyRules(
  exits: readonly StaticExit[],
  locations: Map<string, string>,
  keys: WorldKeys,
  mode: "open" | "standard" | "inverted",
  trCase: TurtleRockCase | null,
): void {
  const add = (location: string, rule: string) => {
    if (!locations.has(location))
      throw new RangeError(`No location ${location}`);
    locations.set(location, and(locations.get(location) ?? "true", rule));
  };
  const chests = keys.chestKeys;
  if (mode !== "standard")
    for (const name of [
      "Hyrule Castle - Boomerang Chest",
      "Hyrule Castle - Zelda's Chest",
    ])
      add(name, chests("Hyrule Castle", 1));
  for (const name of ["Desert Palace - Boss", "Desert Palace - Prize"])
    add(name, chests("Desert Palace", 1));
  // Kholdstare: two keys, or the Cane of Somaria and one (:166-169)
  const somaria = and("caneOfSomaria", chests("Ice Palace", 1));
  for (const name of [
    "Ice Backwards Room Down Stairs",
    "Ice Switch Room ES",
    "Ice Refill WS",
  ]) {
    const exit = exits.find((e) => e.name === name);
    if (exit === undefined) throw new RangeError(`No exit ${name}`);
    exit.req = or(exit.req, somaria);
  }
  // The big key chest: four keys, else as its own item says (set_rule)
  if (trCase !== null) locations.set(TR_CHEST, or(chests(TR, 4), "maybe"));
  const gt = "Ganons Tower";
  const placed = (n: number) => and("maybe", chests(gt, n));
  add("Ganons Tower - Firesnake Room", or(chests(gt, 3), placed(2)));
  for (const name of [
    ...STATIC_KEY_LOGIC.gtRandomizer,
    ...STATIC_KEY_LOGIC.gtCompass,
  ])
    add(name, or(chests(gt, 4), placed(3)));
}
