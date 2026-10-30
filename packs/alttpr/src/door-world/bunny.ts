// The bunny's rules of the Door Randomizer's world (set_bunny_rules,
// Rules.py:2039-2189, No Glitches): where Link is a bunny, a cave the
// bunny cannot cross, a door it cannot pass and a location it cannot get
// take the moon pearl, or a path from a region wholly on Link's own side
// of the world, each entrance on it passable (get_rule_to_add, :2083-2165).
//
// Each rule found is a helper of its own (`@bunny<n>`), its text what the
// rule is when found: DR's paths capture each entrance's rule as a function
// (`path + [entrance.access_rule]`, :2108), so a rule grown by an earlier
// bunny rule is shared, not copied. Written out as text it would be copied
// at each step: a dungeon whose regions lie on both sides of a shuffled
// world (Turtle Rock entered from the Light World and the Dark World, in a
// Crosskeys race of DR 1.4.8.1) grew sevenfold a room, to 157 million
// characters at its boss, and the world ran out of memory.
//
// The doors a bunny cannot pass by their kind in their room (a dashable,
// bombable or hidden wall, Rules.py:2196-2201 at DR 1.5.8, owr:Rules.py:
// 2024-2029) read the kind the run gives the door (`wallOf`): its room's,
// or the noted one under a door shuffle, unknown (`maybe`) until noted.

import type { DrData, DrMode } from "./data";
import { and, or } from "./text";

/** An exit, as the world builder holds it: its rule may grow. */
interface BunnyExit {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  req: string;
  readonly blocked?: boolean;
}

type List = { readonly line: number; readonly value: readonly string[] };
/** set_bunny_rules' lists, as rules.json holds them. */
const listsOf = (data: DrData) =>
  (
    data.rules as unknown as {
      readonly bunny: {
        readonly accessibleLocations: List;
        readonly impassableCaves: List;
        readonly impassableDoors: List;
        readonly impassableIfTrapped: List;
      };
    }
  ).bunny;

const PEARL = "moonPearl";

/** Whether a door is a wall a bunny cannot pass, as the run knows it. */
export type BunnyWall = "yes" | "no" | "maybe";

/** What a world adds to set_bunny_rules' own lists. */
export interface BunnyOptions {
  /**
   * The locations added to regions beside their own (the run's pots and
   * drops, Murahdahla), by region.
   */
  readonly added?: ReadonlyMap<string, readonly string[]>;
  /**
   * Caves a bunny cannot cross beside the list's: OWR's Death Mountain
   * Return Cave once its screen flips with vanilla-like entrances
   * (owr:Rules.py:2002-2008).
   */
  readonly moreCaves?: readonly string[];
  /**
   * Whether an exit is a door of a normal or interior type, open as an
   * exit, whose kind in its room is a dashable, bombable or hidden wall
   * (doors_to_check, Rules.py:2196-2201): none by default.
   */
  readonly wallOf?: (exit: string) => BunnyWall;
  /**
   * Whether a door of bunny_impassible_if_trapped is a trap in the run
   * (Rules.py:2191-2194 at DR 1.5.8): by default its vanilla `trapped`.
   */
  readonly trappedOf?: (exit: string) => BunnyWall;
}

/**
 * Adds the bunny's rules to the exits and locations, as set_bunny_rules
 * does last: each rule a path reads is the one its entrance has when the
 * path is found, as DR's lambdas capture them.
 * @returns The helpers the rules call, by name (`bunny<n>`), each a rule
 *   that reads only those before it
 * @param data - The release's world (data.ts)
 * @param exits - The world's exits, the trapped dungeon doors left out
 * @param locations - Each location's rule, by name
 */
export function addBunnyRules(
  data: DrData,
  exits: readonly BunnyExit[],
  locations: Map<string, string>,
  marked: {
    readonly light: ReadonlySet<string>;
    readonly dark: ReadonlySet<string>;
  },
  mode: DrMode,
  {
    added = new Map(),
    moreCaves = [],
    wallOf = () => "no",
    trappedOf = (name) =>
      data.doorByName.get(name)?.trapped === true ? "yes" : "no",
  }: BunnyOptions = {},
): Map<string, string> {
  /** The rules found, each a helper read by name, in the order found. */
  const helpers = new Map<string, string>();
  const inverted = mode === "inverted";
  const isBunny = (region: string) =>
    inverted ? marked.light.has(region) : marked.dark.has(region);
  const isLink = (region: string) =>
    inverted ? marked.dark.has(region) : marked.light.has(region);
  const into = new Map<string, BunnyExit[]>();
  const outOf = new Map<string, BunnyExit[]>();
  const named = new Map<string, BunnyExit>();
  for (const exit of exits) {
    into.set(exit.to, [...(into.get(exit.to) ?? []), exit]);
    outOf.set(exit.from, [...(outOf.get(exit.from) ?? []), exit]);
    named.set(exit.name, exit);
  }
  const lists = listsOf(data);
  const typeOf = (region: string) => data.regionNamed(region).type;
  const idOf = (region: string) => data.regionNamed(region).id;

  // get_rule_to_add (:2079-2161), its No Glitches branches
  const ruleToAdd = (region: string): string => {
    if (!isLink(region)) return PEARL;
    const options = [PEARL];
    const seenSets = new Set([region]);
    const queue: [string, string[], Set<string>][] = [
      [region, [], new Set([region])],
    ];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const [current, path, seen] = next;
      for (const entrance of into.get(current) ?? []) {
        // A blocked door is no way (:2105-2106)
        if (entrance.blocked === true) continue;
        const from = entrance.from;
        const newSeen = new Set([...seen, from]);
        const key = [...newSeen].sort().join("\n");
        const type = typeOf(from);
        if ((type === "cave" || type === "dungeon") && seenSets.has(key))
          continue;
        const newPath = [...path, entrance.req];
        seenSets.add(key);
        if (!isLink(from)) continue;
        if (isBunny(from)) queue.push([from, newPath, newSeen]);
        // state.can_reach(entrance): its region, and its rule
        else
          options.push(and(`reach(${idOf(from)})`, entrance.req, ...newPath));
      }
    }
    const rule = or(...options);
    if (rule === PEARL) return PEARL;
    const name = `bunny${helpers.size}`;
    helpers.set(name, rule);
    return `@${name}`;
  };
  const add = (exit: BunnyExit, rule: string) => {
    exit.req = and(exit.req, rule);
  };

  // The caves a bunny cannot cross (:2163-2169)
  for (const name of [...lists.impassableCaves.value, ...moreCaves]) {
    if (!isBunny(name)) continue;
    const rule = ruleToAdd(name);
    for (const exit of outOf.get(name) ?? []) add(exit, rule);
  }
  // The Paradox Shop's way in (:2171-2173)
  const shop = "Paradox Shop";
  const shopEntrance = into.get(shop)?.[0];
  if (isBunny(shop) && shopEntrance !== undefined)
    add(shopEntrance, ruleToAdd(shop));
  // The doors a bunny cannot pass (:2175-2178)
  for (const name of lists.impassableDoors.value) {
    const exit = named.get(name);
    if (exit !== undefined && isBunny(exit.from))
      add(exit, ruleToAdd(exit.from));
  }
  // Those it cannot pass once trapped (:2180-2183; Rules.py:2191-2194 at
  // DR 1.5.8, owr:Rules.py:2019-2022): the seed's trap, as the run knows
  // it, maybe while its kind is not noted
  for (const name of lists.impassableIfTrapped.value) {
    const exit = named.get(name);
    if (exit === undefined || !isBunny(exit.from)) continue;
    const trapped = trappedOf(name);
    if (trapped === "no") continue;
    const rule = ruleToAdd(exit.from);
    add(exit, trapped === "yes" ? rule : or(rule, "maybe"));
  }
  // The walls a bunny cannot pass (doors_to_check, Rules.py:2196-2201: its
  // filter `x not in bunny_impassible_doors` sets a door against names, so
  // it leaves none out); a kind not known yet is maybe a wall
  for (const exit of exits) {
    if (exit.blocked === true || !isBunny(exit.from)) continue;
    const wall = wallOf(exit.name);
    if (wall === "no") continue;
    const rule = ruleToAdd(exit.from);
    add(exit, wall === "yes" ? rule : or(rule, "maybe"));
  }
  // Every location of a bunny's region but those it can get (:2191-2196)
  const accessible = new Set(lists.accessibleLocations.value);
  for (const region of data.regions) {
    if (!isBunny(region.name)) continue;
    for (const name of [
      ...region.locations,
      ...(added.get(region.name) ?? []),
    ]) {
      if (accessible.has(name) || !locations.has(name)) continue;
      locations.set(
        name,
        and(locations.get(name) ?? "true", ruleToAdd(region.name)),
      );
    }
  }
  return helpers;
}
