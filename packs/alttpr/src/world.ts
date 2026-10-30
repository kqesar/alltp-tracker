// The world model: how upstream's regions become the engine's graph.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31),
// app/Region.php. A region has a can_enter rule, which every access to its
// locations starts with (Location.php:96-111) and which may call another
// region's canEnter; a can_complete rule, which its prize location takes
// (Region.php:125-141, 201-207); and the dungeon items it keeps (canFill,
// 232-246). README.md, "The world model", explains the mapping.

import type { Location, Region, World } from "@alltp/engine";
import type { LocationDef, Refusal, Source } from "./location";
import type { AlttprSettings } from "./settings";
import { unknownCountRequirement } from "./unknown-counts";

/**
 * The root of the graph. Upstream has no start region: a region whose
 * can_enter calls no other region's is entered from anywhere, which is an
 * entrance from here. The start holds no location.
 */
export const START = "start";

/**
 * One way into a region: a branch of its can_enter. A branch that calls
 * another region's canEnter comes `from` that region; any other comes from
 * START. An OR of several such branches is several entrances.
 */
export interface Entrance {
  /** The region it is taken from: START, or a region id. */
  readonly from: string;
  /** What it needs beyond being in `from`. It cannot use `reach()`. */
  readonly req: string;
  readonly source: Source;
}

/** The dungeon items a region keeps: `Region::$region_items`. */
export interface RegionItems {
  /** Upstream item names, as the region lists them. */
  readonly items: readonly string[];
  readonly source: Source;
}

/** A region of the graph, which a region module defines. */
export interface RegionDef {
  /**
   * The engine id: `regionId(name)` for a region upstream names, so other
   * modules can come from it and `reach()` it; a camelCase id of the
   * module's choosing for a part of one it splits off.
   */
  readonly id: string;
  /**
   * The upstream region's key in World/Standard.php ('Eastern Palace',
   * 'Escape'), which getRegion() and the upstream tests use. A part split
   * off a region has none.
   */
  readonly name?: string;
  /** Its can_enter, as entrances. A region without any is unreachable. */
  readonly entrances: readonly Entrance[];
  readonly locations: readonly LocationDef[];
  /**
   * The id of its prize location, whose rule is the region's can_complete:
   * the pendant or crystal of a dungeon, Zelda, Agahnim.
   */
  readonly prize?: string;
  readonly regionItems?: RegionItems;
}

/**
 * The port of one upstream region file: the regions it defines. A module
 * still pending has its upstream regions with no entrance and no location,
 * so that the worlds list every module and other modules can name its
 * regions.
 */
export interface RegionModule {
  readonly file: `app/Region/${string}.php`;
  readonly regions: readonly RegionDef[];
}

/** What a region class sets again after its parent's initalize. */
export interface RegionChanges {
  /** Its new can_enter, which replaces the parent's whole. */
  readonly entrances?: readonly Entrance[];
  /**
   * By location id: the parts of a location it sets again. Its `fill` is
   * merged into the parent's, part by part: a new rule changes `holding`,
   * while setFillRules and setAlwaysAllow stay the parent's unless set
   * again. A prize whose can_complete reads its boss takes the boss's new
   * `req` and keeps its source.
   */
  readonly locations?: Readonly<Record<string, Partial<LocationDef>>>;
}

/**
 * The module of a region class that calls `parent::initalize()`, then sets
 * some rules again: its parent's regions, by id, with those changes. What it
 * does not set keeps the parent's rule and source, the parent's file. A
 * change for a region or location the parent lacks throws, so a typo cannot
 * pass for a port.
 */
export function extendModule(
  parent: RegionModule,
  file: RegionModule["file"],
  changes: Readonly<Record<string, RegionChanges>>,
): RegionModule {
  const ids = new Set(parent.regions.map((region) => region.id));
  for (const id of Object.keys(changes)) {
    if (!ids.has(id)) throw new RangeError(`${file}: no region ${id}`);
  }
  const regions = parent.regions.map((region) => {
    const change = changes[region.id];
    if (change === undefined) return region;
    const located = change.locations ?? {};
    const held = new Set(region.locations.map((location) => location.id));
    for (const id of Object.keys(located)) {
      if (!held.has(id)) throw new RangeError(`${file}: no location ${id}`);
    }
    return {
      ...region,
      entrances: change.entrances ?? region.entrances,
      locations: region.locations.map((location) => {
        const change = located[location.id];
        if (change === undefined) return location;
        const fill =
          change.fill === undefined
            ? location.fill
            : { ...location.fill, ...change.fill };
        return { ...location, ...change, ...(fill ? { fill } : {}) };
      }),
    };
  });
  return { file, regions };
}

/**
 * A region whose can_enter has a branch that needs two regions at once
 * (`$this->world->getRegion(...)->canEnter()` beside the one its way comes
 * from), which an entrance cannot say: it reads one region only. The way
 * comes `from` one of them, and every location of the region (its rule, what
 * it needs holding an item, what seeing it needs) also asks `guard`, which
 * names the others through `reach()`: the guard holds whenever the region's
 * other ways do, so it changes nothing reached through them. A guard folds
 * to true where the branch's setting is off, so the region reads as before.
 */
export function enteredAlsoFrom(
  module: RegionModule,
  id: string,
  entrance: Entrance,
  guard: string,
): RegionModule {
  const and = (req: string) => `(${guard}) & (${req})`;
  let found = false;
  const regions = module.regions.map((region) => {
    if (region.id !== id) return region;
    found = true;
    return {
      ...region,
      entrances: [...region.entrances, entrance],
      locations: region.locations.map((location) => {
        const holding = location.fill?.holding;
        return {
          ...location,
          req: and(location.req),
          ...(location.visible?.req === undefined
            ? {}
            : {
                visible: {
                  ...location.visible,
                  req: and(location.visible.req),
                },
              }),
          ...(holding === undefined || location.fill === undefined
            ? {}
            : {
                fill: {
                  ...location.fill,
                  holding: {
                    ...holding,
                    items: Object.fromEntries(
                      Object.entries(holding.items).map(([item, req]) => [
                        item,
                        and(req),
                      ]),
                    ),
                    ...(holding.otherwise === undefined
                      ? {}
                      : { otherwise: and(holding.otherwise) }),
                  },
                },
              }),
        };
      }),
    };
  });
  if (!found) throw new RangeError(`${module.file}: no region ${id}`);
  return { ...module, regions };
}

/** 'North East Light World' is northEastLightWorld, 'Ganons Tower' ganonsTower. */
export function regionId(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter((word) => word !== "");
  return words
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join("");
}

/**
 * The engine's graph for a list of modules: START, then every region in
 * order, each entrance an exit of the region it comes from. Every rule reads
 * a count a tracker may not know as maybe while it is not (unknown-counts.ts).
 */
export function buildWorld(modules: readonly RegionModule[]): World {
  const regions = modules.flatMap((module) => module.regions);
  const exits = new Map<string, { req: string; to: string }[]>();
  for (const region of regions) {
    for (const { from, req } of region.entrances) {
      const list = exits.get(from) ?? [];
      list.push({ req: unknownCountRequirement(req), to: region.id });
      exits.set(from, list);
    }
  }
  const node = (id: string, locations: readonly LocationDef[]): Region => ({
    exits: exits.get(id) ?? [],
    id,
    locations: locations.map(engineLocation),
  });
  return {
    regions: [
      node(START, []),
      ...regions.map((region) => node(region.id, region.locations)),
    ],
    start: START,
  };
}

/** A location of the engine's graph, its rules read for unknown counts. */
function engineLocation({ id, req: rule, visible }: LocationDef): Location {
  const req = unknownCountRequirement(rule);
  if (visible === undefined) return { id, req };
  const { from, req: seen } = visible;
  return {
    id,
    req,
    visible: {
      ...(from === undefined ? {} : { from }),
      ...(seen === undefined ? {} : { req: unknownCountRequirement(seen) }),
    },
  };
}

/** The classes of dungeon item Region::canFill keeps in their dungeon. */
export type DungeonItemClass = "bigKey" | "compass" | "key" | "map";

/**
 * The class of an upstream item, if it is a dungeon item: Key, KeyH2 and
 * KeyGK are keys, BigKey and BigKeyP1 big keys, and so on (Item.php:129-253).
 * The ShopKey alias is no Item\Key.
 */
export function dungeonItemClass(item: string): DungeonItemClass | undefined {
  if (/^BigKey(?:[A-Z][A-Z0-9]*)?$/.test(item)) return "bigKey";
  if (/^Key(?:[A-Z][A-Z0-9]*)?$/.test(item)) return "key";
  if (/^Map(?:[A-Z][A-Z0-9]*)?$/.test(item)) return "map";
  if (/^Compass(?:[A-Z][A-Z0-9]*)?$/.test(item)) return "compass";
  return undefined;
}

/**
 * The fill rules of a location outside the dungeons that refuses their items
 * as Region::canFill does, class by class, unless the class is wild: Link's
 * Uncle and the Secret Passage (Standard/HyruleCastleEscape.php:101-114,
 * Open/HyruleCastleEscape.php:58-71). `source` is the rule's line.
 */
export function refuseKeptDungeonItems(source: Source): readonly Refusal[] {
  return [
    { refuse: { classes: ["key"] }, source, when: "!setting(wildKeys)" },
    { refuse: { classes: ["bigKey"] }, source, when: "!setting(wildBigKeys)" },
    { refuse: { classes: ["map"] }, source, when: "!setting(wildMaps)" },
    {
      refuse: { classes: ["compass"] },
      source,
      when: "!setting(wildCompasses)",
    },
  ];
}

/**
 * Region::canFill (Region.php:232-246): whether the item may be placed in
 * the region. A dungeon item stays in its own dungeon unless its class is
 * wild, and the sewers key stays in the escape of a Standard world; a
 * region's own items are always welcome. No Logic lets the sewers key
 * out (Region.php:238).
 */
export function canFill(
  region: RegionDef,
  item: string,
  settings: AlttprSettings,
): boolean {
  const own = region.regionItems?.items ?? [];
  if (own.includes(item)) return true;
  const kind = dungeonItemClass(item);
  return !(
    (kind === "key" && !settings.wildKeys) ||
    (kind === "bigKey" && !settings.wildBigKeys) ||
    (item === "KeyH2" && settings.standardMode && !settings.noLogic) ||
    (kind === "map" && !settings.wildMaps) ||
    (kind === "compass" && !settings.wildCompasses)
  );
}
