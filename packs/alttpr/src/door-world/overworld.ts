// The Overworld Randomizer's overworld (codemann8's fork of DR, at the
// release upstream.json pins as doorRandomizer.overworld): how its world
// links where DR's does otherwise, read from its own files (owr: paths).
// An OWR seed runs OWR's rules and links even on a vanilla overworld:
// link_overworld (OverworldShuffle.py:21-584) links each screen as it
// stands or flipped (ow_connections), the save-and-quit points by the
// screens they stand on, the vanilla edges, whirlpools and flute spots;
// link_entrances_new (source/overworld/EntranceShuffle2.py:48-185) has no
// Inverted swap table: an Inverted world is every screen flipped
// (is_tile_swapped, BaseClasses.py:331-332), Agahnim's and Ganon's towers
// trading doors once both their screens are (:69-71).
//
// Shuffled whirlpools and flute spots are linked as the player notes them
// (`OwrNotes`): a whirlpool or a spot not noted leads nowhere. Not modelled
// yet: Mixed's flips (each screen flipped as noted), crossed or shuffled
// edges; an Inverted run flips every screen, any other none.
import type { Settings } from "@alltp/engine";
import type { DrData, DrMode, OwrOverworld } from "./data";
import { and } from "./text";

/** is_tile_swapped (BaseClasses.py:331-332), Mixed aside: Inverted's. */
export const isTileSwapped = (mode: DrMode, _screen: number): boolean =>
  mode === "inverted";

/** A screen's id as rules.json's settings name it (`tileSwapped_1b`). */
const screenName = (screen: number) => screen.toString(16).padStart(2, "0");

/**
 * The settings OWR's rules read of the overworld: each light world
 * screen's flip (`tileSwapped_<id>`) and whether the run starts at the
 * Dark Chapel (is_dark_chapel_start, :353-356: Inverted, Mixed aside).
 */
export function owrSettings(mode: DrMode): Settings {
  const found: Record<string, boolean> = {
    darkChapelStart: mode === "inverted",
  };
  for (let screen = 0; screen < 0x40; screen++)
    found[`tileSwapped_${screenName(screen)}`] = isTileSwapped(mode, screen);
  return found;
}

/**
 * The exits relocate_pyramid_entrances moves (EntranceShuffle2.py:2034-
 * 2055): the pyramid's hole and door stand on Hyrule Castle's ledge once
 * the pyramid's screen (0x1b) is flipped.
 */
export function owrMovedExits(
  data: DrData,
  mode: DrMode,
): ReadonlyMap<string, string> {
  if (data.flavor !== "owr" || !isTileSwapped(mode, 0x1b)) return new Map();
  return new Map([
    ["Pyramid Hole", "Hyrule Castle Ledge"],
    ["Pyramid Entrance", "Hyrule Castle Ledge"],
  ]);
}

/** The overworld of an OWR bundle; throws for DR's. */
export function overworldOf(data: DrData): OwrOverworld {
  if (data.overworld === undefined)
    throw new RangeError(`No overworld in the ${data.flavor} data`);
  return data.overworld;
}

/**
 * What a player notes of an OWR seed's shuffled overworld, each a shuffle's
 * own: absent while that shuffle is off (its vanilla links), and while on,
 * only what is noted is linked.
 */
export interface OwrNotes {
  /**
   * Shuffled whirlpools (`ow_whirlpool`, OverworldShuffle.py:359-413): each
   * noted whirlpool by name, the whirlpool it leads into (connect_whirlpool
   * links a pair both ways, so a note holds both).
   */
  readonly whirlpools?: Readonly<Record<string, string>>;
  /**
   * Moved flute spots (`ow_fluteshuffle` balanced or random, FluteShuffle.
   * py:52-185): the screens (flute_data's light world ids) a spot is noted
   * on, at most eight.
   */
  readonly flute?: readonly number[];
}

/** The whirlpools by name: their screen and the region they stand in. */
export const whirlpoolsOf = (
  data: DrData,
): ReadonlyMap<string, { readonly screen: number; readonly region: string }> =>
  new Map(
    (
      data.tableOf<unknown>(
        "OverworldShuffle.py",
        "default_whirlpool_connections",
      ) as unknown as readonly (readonly [Whirlpool, Whirlpool])[]
    ).flatMap((pair) =>
      pair.map(([screen, name, region]) => [name, { region, screen }] as const),
    ),
  );

/**
 * The flute spots by number (shuffle_flute_spots, FluteShuffle.py:36-50,
 * :178-182): the spots' screens sorted by slot (sort_flute_spots,
 * :655-657; Death Mountain's slot is 0x04 once its screen flips), each
 * spot's region as its screen stands or flipped. The spots are
 * default_flute_connections unless the player's noted ones are given.
 */
export function fluteSpots(
  data: DrData,
  mode: DrMode,
  noted?: readonly number[],
): readonly string[] {
  const { flute } = overworldOf(data);
  const spots = [
    ...(noted ??
      (data.tableOf<number>(
        "FluteShuffle",
        "default_flute_connections",
      ) as unknown as readonly number[])),
  ];
  const slot = (screen: number) =>
    screen === 0x03 && isTileSwapped(mode, 0x03)
      ? 0x04
      : (flute[String(screen)]?.slot ?? screen);
  spots.sort((a, b) => slot(a) - slot(b));
  return spots.map((screen) => {
    const regions = flute[String(screen)]?.regions;
    if (regions === undefined) throw new RangeError(`No flute spot ${screen}`);
    return regions[isTileSwapped(mode, screen) ? 1 : 0];
  });
}

type Pair = readonly [string, string];
type Whirlpool = readonly [number, string, string];

/**
 * link_overworld with a vanilla layout (OverworldShuffle.py:21-584): the
 * mandatory connections, the save-and-quit points (:183-196: Link's House
 * or the Bomb Shop by screen 0x2c, Sanctuary or the Dark Chapel, the
 * pyramid or the castle's ledge by screen 0x1b), each screen's own links
 * as it stands or flipped (:198-205), the whirlpools (:355-358), every
 * edge with its vanilla partner both ways (:419-431, connect_two_way
 * :702-725), the flute spots (FluteShuffle.py:36-50).
 */
export function linkOwrOverworld(
  data: DrData,
  c: Map<string, string>,
  mode: DrMode,
  notes: OwrNotes = {},
): void {
  for (const [exit, region] of data.pairsOf(
    "OverworldShuffle.py",
    "mandatory_connections",
  ))
    c.set(exit, region);
  c.set(
    "Links House S&Q",
    isTileSwapped(mode, 0x2c) ? "Big Bomb Shop" : "Links House",
  );
  c.set(
    "Sanctuary S&Q",
    mode === "inverted" ? "Dark Sanctuary Hint" : "Sanctuary",
  );
  c.set(
    "Other World S&Q",
    isTileSwapped(mode, 0x1b) ? "Hyrule Castle Ledge" : "Pyramid Area",
  );
  const screens = data.tableOf<readonly [readonly Pair[], readonly Pair[]]>(
    "OverworldShuffle.py",
    "ow_connections",
  );
  for (const [screen, [stands, flipped]] of Object.entries(screens))
    for (const [exit, region] of isTileSwapped(mode, Number(screen))
      ? flipped
      : stands)
      c.set(exit, region);
  if (notes.whirlpools === undefined) {
    const whirlpools = data.tableOf<unknown>(
      "OverworldShuffle.py",
      "default_whirlpool_connections",
    ) as unknown as readonly (readonly [Whirlpool, Whirlpool])[];
    for (const [[, from, fromRegion], [, to, toRegion]] of whirlpools) {
      c.set(from, toRegion);
      c.set(to, fromRegion);
    }
  } else {
    // Shuffled: a noted whirlpool into its partner's region (connect_
    // whirlpool, OverworldShuffle.py:359-367), one not noted nowhere
    const known = whirlpoolsOf(data);
    for (const [from, to] of Object.entries(notes.whirlpools)) {
      const target = known.get(to);
      if (!known.has(from) || target === undefined)
        throw new RangeError(`No whirlpool "${known.has(from) ? to : from}"`);
      c.set(from, target.region);
    }
  }
  for (const [a, b] of data.pairsOf(
    "OverworldShuffle.py",
    "default_connections",
  )) {
    c.set(a, data.parentOf(b));
    c.set(b, data.parentOf(a));
  }
  fluteSpots(data, mode, notes.flute).forEach((region, i) => {
    c.set(`Flute Spot ${i + 1}`, region);
  });
}

/**
 * link_entrances_new with `shuffle` vanilla (EntranceShuffle2.py:48-185):
 * the mandatory connections, then do_vanilla_connections (:188-200) over
 * the pool (every entrance not named Inverted): a cave's or dungeon's door
 * both ways to its exit, the towers traded once both screens flip
 * (is_atgt_swapped, :69-71), a hole or single cave one way; the Bomb Shop's
 * and the Dark Chapel's ways out to their own areas where Link starts
 * there (:195-200); Chris Houlihan's room back to the area of the house
 * Link starts in (:157-160, connect_exit :2115-2129).
 */
export function linkOwrEntrances(
  data: DrData,
  c: Map<string, string>,
  mode: DrMode,
): void {
  for (const [exit, region] of data.pairsOf(
    "EntranceShuffle2",
    "mandatory_connections",
  ))
    c.set(exit, region);
  const map = (name: string) => data.tableOf<string>("EntranceShuffle2", name);
  const drops = map("drop_map");
  const twoWays: Record<string, string> = { ...map("entrance_map") };
  const singles = map("single_entrance_map");
  if (isTileSwapped(mode, 0x03) && isTileSwapped(mode, 0x1b)) {
    twoWays["Ganons Tower"] = "Agahnims Tower Exit";
    twoWays["Agahnims Tower"] = "Ganons Tower Exit";
  }
  const oneWay: Record<string, string> = { ...drops, ...singles };
  // The pyramid's door stands on the castle's ledge once its screen flips
  const moved = owrMovedExits(data, mode);
  const parentOf = (exit: string) => moved.get(exit) ?? data.parentOf(exit);
  const pool = [
    ...[...Object.keys(drops), ...Object.keys(map("entrance_map"))].filter(
      (name) => !name.startsWith("Inverted"),
    ),
    ...Object.keys(singles),
  ].sort();
  for (const entrance of pool) {
    const exit = twoWays[entrance];
    if (exit !== undefined) {
      c.set(entrance, parentOf(exit));
      c.set(exit, parentOf(entrance));
    }
    const region = oneWay[entrance];
    if (region !== undefined) c.set(entrance, region);
  }
  const bombShop = isTileSwapped(mode, 0x2c);
  if (bombShop) c.set("Big Bomb Shop Exit", "Big Bomb Shop Area");
  if (mode === "inverted")
    c.set("Dark Sanctuary Hint Exit", "Dark Chapel Area");
  if (!c.has("Chris Houlihan Room Exit"))
    c.set(
      "Chris Houlihan Room Exit",
      data.parentOf(bombShop ? "Big Bomb Shop" : "Links House"),
    );
}

/**
 * OWR's options its rules read, at their defaults (CLI.py, resources/app/
 * cli/args.json): bonk drops unshuffled, Ganon's goal not fast, the bomb
 * check not overridden (only OWR's test harness overrides it, TestBase.py:
 * 102: a real run farms or holds its bombs), the entrances vanilla.
 */
export const OWR_DEFAULTS: Settings = {
  bonkDrops: false,
  fastGanonGoal: false,
  overrideBombCheck: false,
  shuffle_crossed: false,
  shuffle_district: false,
  shuffle_full: false,
  shuffle_insanity: false,
  shuffle_lean: false,
  shuffle_lite: false,
  shuffle_restricted: false,
  shuffle_swapped: false,
};

/** A location OWR makes in code, its event's fact and its rule. */
export interface OwrDynamicEvent {
  readonly name: string;
  readonly region: string;
  readonly req: string;
  /** The fact its event gives (`farmableBombs`, `ocarinaActivated`). */
  readonly fact: string;
}

/** An item's name as a fact (`Farmable Bombs`: `farmableBombs`). */
export const factOf = (item: string): string =>
  item
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");

/**
 * The locations OWR adds in code, as rules.json read them
 * (`dynamicEvents`): the flute's activation at Kakariko while its screen
 * stands (ItemList.py:256-266), the farms of create_farm_locations, each
 * kept where its condition (`when`, a setting or its negation) holds.
 */
export function owrDynamicEvents(
  data: DrData,
  settings: Settings,
): readonly OwrDynamicEvent[] {
  const events = (
    data.rules as unknown as {
      readonly dynamicEvents?: readonly {
        readonly item: string;
        readonly name: string;
        readonly region: string;
        readonly req: string;
        readonly when?: string;
      }[];
    }
  ).dynamicEvents;
  return (events ?? []).flatMap(({ item, name, region, req, when }) => {
    if (when !== undefined) {
      const read = /^(!?)setting\((\w+)\)$/.exec(when);
      if (read === null) throw new RangeError(`No condition "${when}"`);
      if ((settings[read[2] ?? ""] === true) === (read[1] === "!")) return [];
    }
    return [{ fact: factOf(item), name, region, req }];
  });
}

/** The facts OWR's dynamic events give, whatever the settings. */
export const owrDynamicFacts = (data: DrData): readonly string[] => [
  ...new Set(
    (
      (data.rules as unknown as { dynamicEvents?: { item: string }[] })
        .dynamicEvents ?? []
    ).map((e) => factOf(e.item)),
  ),
];

/** An exit, as the world builder holds it. */
interface TerrainExit {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  req: string;
}

/**
 * ow_terrain_rules (Rules.py:1417-1429): an edge into water asks the
 * flippers from land (set, its rule replaced) and the pearl into the
 * other world, as a whirlpool from Link's world into the other does. An
 * edge's partner is its vanilla one (default_connections).
 */
export function owrTerrainRules(
  data: DrData,
  exits: readonly TerrainExit[],
  marked: {
    readonly light: ReadonlySet<string>;
    readonly dark: ReadonlySet<string>;
  },
  mode: DrMode,
): void {
  const edges = new Map(overworldOf(data).edges.map((e) => [e.name, e]));
  const partner = new Map<string, string>();
  for (const [a, b] of data.pairsOf(
    "OverworldShuffle.py",
    "default_connections",
  )) {
    partner.set(a, b);
    partner.set(b, a);
  }
  const whirlpools = new Set(
    (
      data.tableOf<unknown>(
        "OverworldShuffle.py",
        "default_whirlpool_connections",
      ) as unknown as readonly (readonly [Whirlpool, Whirlpool])[]
    ).flatMap(([[, a], [, b]]) => [a, b]),
  );
  const own = mode !== "inverted";
  for (const exit of exits) {
    const edge = edges.get(exit.name);
    const dest = edges.get(partner.get(exit.name) ?? "");
    if (edge !== undefined && dest?.terrain === "water") {
      if (edge.terrain === "land") exit.req = "flippers";
      if (marked.dark.has(exit.to) === own)
        exit.req = and(exit.req, "moonPearl");
    }
    if (
      whirlpools.has(exit.name) &&
      marked.light.has(exit.from) === own &&
      marked.dark.has(exit.to) === own
    )
      exit.req = and(exit.req, "moonPearl");
  }
}

/**
 * What a seed's JSON spoiler tells of its shuffled overworld, as a player
 * who walked it notes it: its whirlpools (`Whirlpools`, set_whirlpool's
 * pairs, OverworldShuffle.py:368) both ways and its flute spots (`Maps`'
 * flute entry, whose `data` is the sorted spots, FluteShuffle.py:652), for
 * the shuffles its meta names alone.
 */
export function owrNotesFromSpoiler(json: {
  readonly meta: Readonly<Record<string, unknown>>;
  readonly Whirlpools?: readonly {
    readonly entrance: string;
    readonly exit: string;
  }[];
  readonly Maps?: readonly { readonly type: string; readonly data?: unknown }[];
}): OwrNotes {
  const { meta } = json;
  const whirlpools: Record<string, string> = {};
  for (const { entrance, exit } of json.Whirlpools ?? []) {
    whirlpools[entrance] = exit;
    whirlpools[exit] = entrance;
  }
  const flute = json.Maps?.find((map) => map.type === "flute")?.data;
  return {
    ...(meta.ow_whirlpool === true ? { whirlpools } : {}),
    ...(meta.ow_fluteshuffle !== undefined && meta.ow_fluteshuffle !== "vanilla"
      ? { flute: (flute ?? []) as readonly number[] }
      : {}),
  };
}
