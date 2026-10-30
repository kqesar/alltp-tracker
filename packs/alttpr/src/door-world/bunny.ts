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
// Not ported: the doors a bunny cannot pass by their kind in the room's
// data (dashable, bombable, hidden walls, :2175-2180), which RoomData.py
// holds and import-dr does not read yet.

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

/**
 * Adds the bunny's rules to the exits and locations, as set_bunny_rules
 * does last: each rule a path reads is the one its entrance has when the
 * path is found, as DR's lambdas capture them.
 * @returns The helpers the rules call, by name (`bunny<n>`), each a rule
 *   that reads only those before it
 * @param data - The release's world (data.ts)
 * @param exits - The world's exits, the trapped dungeon doors left out
 * @param locations - Each location's rule, by name
 * @param added - The locations added to regions beside their own (the
 *   run's pots and drops, Murahdahla), by region
 * @param moreCaves - Caves a bunny cannot cross beside the list's: OWR's
 *   Death Mountain Return Cave once its screen flips with vanilla-like
 *   entrances (owr:Rules.py:2002-2008)
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
  added: ReadonlyMap<string, readonly string[]> = new Map(),
  moreCaves: readonly string[] = [],
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
  // The doors a bunny cannot pass (:2175-2178), and those it cannot once
  // trapped (:2180-2183)
  for (const name of lists.impassableDoors.value) {
    const exit = named.get(name);
    if (exit !== undefined && isBunny(exit.from))
      add(exit, ruleToAdd(exit.from));
  }
  for (const name of lists.impassableIfTrapped.value) {
    const exit = named.get(name);
    if (
      exit !== undefined &&
      data.doorByName.get(name)?.trapped === true &&
      isBunny(exit.from)
    )
      add(exit, ruleToAdd(exit.from));
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
