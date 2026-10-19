// The world model: how SMZ3's regions become the engine's graph.
//
// Read from tewtal/SMZ3Randomizer at d53be76 (upstream.json),
// Randomizer.SMZ3/Region.cs and Location.cs. A region has a CanEnter, which
// every location's Available starts with (Location.cs) and which may call
// another region's (World.CanEnter); a location has its own requirement,
// which upstream's logic tests read alone (Location.CanAccess). Both games
// are one graph, as the engine's README plans for SMZ3: the portals between
// them are conditions on the items (Item.cs, ProgressionExtensions), not
// regions.
//
// Most rules differ between Super Metroid's two logics (`Logic switch {
// Normal => ..., _ => ... }`): a rule may give one for each, and the world
// of a run takes the one its logic asks for. Keysanity, which rules read as
// `Config.Keysanity ? a : b`, stays a setting of the engine.

import type { Location, Region, World } from "@alltp/engine";

/** The root of the graph: a region whose CanEnter calls no other's. */
export const START = "start";

/** Where a rule was read: an upstream file, and its line. */
export type Source = `Randomizer.SMZ3/${string}.cs:${number}`;

/** A requirement, or one for each of Super Metroid's logics. */
export type Rule = string | { readonly normal: string; readonly hard: string };

/** The requirement of a rule under a logic. */
export const pick = (rule: Rule, hard: boolean): string =>
  typeof rule === "string" ? rule : hard ? rule.hard : rule.normal;

/**
 * One way into a region: a branch of its CanEnter. A branch that calls
 * another region's CanEnter comes `from` that region; any other comes from
 * START. An OR of several such branches is several entrances.
 */
export interface Entrance {
  readonly from: string;
  /** What it needs beyond being in `from`. It cannot use `reach()`. */
  readonly req: Rule;
  readonly source: Source;
}

/** A location: upstream's name, its id and its own requirement. */
export interface LocationDef {
  /** `locationId(name)`, a save key. */
  readonly id: string;
  readonly name: string;
  readonly req: Rule;
  readonly source: Source;
}

/** A region of the graph, which a region module defines. */
export interface RegionDef {
  /** `regionId(name)`: other modules come from it and `reach()` it. */
  readonly id: string;
  /** Upstream's name, which World.CanEnter and the tests use. */
  readonly name: string;
  /** Its CanEnter, as entrances. */
  readonly entrances: readonly Entrance[];
  readonly locations: readonly LocationDef[];
}

/** The port of one upstream region file. */
export interface RegionModule {
  readonly file: `Randomizer.SMZ3/Regions/${string}.cs`;
  readonly region: RegionDef;
  /**
   * The region's own helper methods (CanReachAqueduct, LaserBridge...),
   * which its rules call with `@`.
   */
  readonly helpers?: Readonly<Record<string, Rule>>;
}

/**
 * The id of a location: its name in lowercase kebab case, with " - " as
 * "/" and apostrophes dropped, as the ALttPR pack names A Link to the
 * Past's ("Tower of Hera - Big Key Chest" is tower-of-hera/big-key-chest).
 * Ids are save keys.
 */
export function locationId(name: string): string {
  return name
    .split(" - ")
    .map((part) =>
      part
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .join("/");
}

/** The id of a region: its name in camelCase ("Crateria West" is crateriaWest). */
export function regionId(name: string): string {
  return name
    .replace(/['’]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word !== "")
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join("");
}

/** How the graph is built. */
export interface BuildOptions {
  /** Super Metroid's logic: Hard's rules, else Normal's. */
  readonly hard: boolean;
  /**
   * Every location in START instead of its region, as upstream's logic tests
   * read a location: its requirement alone (Location.CanAccess), the regions
   * it may `reach()` still in the graph.
   */
  readonly locationsAtStart?: boolean;
}

/** The engine's graph of the modules, under a logic. */
export function buildWorld(
  modules: readonly RegionModule[],
  { hard, locationsAtStart = false }: BuildOptions,
): World {
  const exits = new Map<string, { req: string; to: string }[]>();
  for (const { region } of modules) {
    for (const { from, req } of region.entrances) {
      const list = exits.get(from) ?? [];
      list.push({ req: pick(req, hard), to: region.id });
      exits.set(from, list);
    }
  }
  const location = ({ id, req }: LocationDef): Location => ({
    id,
    req: pick(req, hard),
  });
  const node = (id: string, locations: readonly LocationDef[]): Region => ({
    exits: exits.get(id) ?? [],
    id,
    locations: locations.map(location),
  });
  const all = modules.flatMap(({ region }) => region.locations);
  return {
    regions: [
      node(START, locationsAtStart ? all : []),
      ...modules.map(({ region }) =>
        node(region.id, locationsAtStart ? [] : region.locations),
      ),
    ],
    start: START,
  };
}

/**
 * A module's builders: `location(name, line, req)` and `enter(line, req,
 * from)` with the file's sources filled in.
 */
export function moduleOf(file: RegionModule["file"]) {
  const source = (line: number): Source => `${file}:${line}`;
  return {
    enter: (line: number, req: Rule, from: string = START): Entrance => ({
      from,
      req,
      source: source(line),
    }),
    location: (
      name: string,
      line: number,
      req: Rule = "true",
    ): LocationDef => ({
      id: locationId(name),
      name,
      req,
      source: source(line),
    }),
  };
}

/** `Config.Keysanity ? yes : no`, as a requirement. */
export const ifKeysanity = (yes: string, no: string): string =>
  `(setting(keysanity) & (${yes}) | !setting(keysanity) & (${no}))`;

/** The way into a region that keeps Region.CanEnter's `return true`. */
export const OPEN: Entrance = {
  from: START,
  req: "true",
  source: "Randomizer.SMZ3/Region.cs:90",
};
