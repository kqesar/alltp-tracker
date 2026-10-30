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
// Shuffled whirlpools and flute spots, a crossed overworld's edges and
// Mixed's flips are linked as the player notes them (`OwrNotes`): a
// whirlpool, a spot or an edge not noted leads nowhere; a screen whose
// flip is not known links neither way of what its flip decides, and its
// regions' world is either (`OwrScreens`). Not modelled yet: a shuffled
// layout.
import type { Settings } from "@alltp/engine";
import type { DrData, DrMode, DrRegion, OwrOverworld } from "./data";
import { and } from "./text";

/**
 * A run's screens as far as it knows them: Mixed's own flips (owswaps,
 * update_world_regions), and is_tile_swapped (BaseClasses.py:331-332:
 * Inverted unless Mixed flipped it back), each undefined while not known.
 * A screen is its light world id (0x80 and 0x81 the pedestal's and
 * Zora's); a dark world one (0x40-0x7f) reads its light twin's, as
 * define_tile_groups flips each with its twin (OverworldShuffle.py:972).
 */
export interface OwrScreens {
  readonly flipped: (screen: number) => boolean | undefined;
  readonly swapped: (screen: number) => boolean | undefined;
}

/** A screen's light world id: a dark world one's twin. */
const lightOf = (screen: number) =>
  screen >= 0x40 && screen < 0x80 ? screen - 0x40 : screen;

/** The screens of a world without Mixed: every one flipped in Inverted. */
export const screensOf = (mode: DrMode): OwrScreens => ({
  flipped: () => false,
  swapped: () => mode === "inverted",
});

/** is_tile_swapped, without Mixed: Inverted's. */
export const isTileSwapped = (mode: DrMode, screen: number): boolean =>
  screensOf(mode).swapped(screen) === true;

/** The entrance shuffle a run's settings name (`shuffle_<mode>`). */
export const owrShuffleOf = (settings: Settings): string =>
  Object.keys(settings)
    .find((name) => name.startsWith("shuffle_") && settings[name] === true)
    ?.slice("shuffle_".length) ?? "vanilla";

/** A group of screens Mixed flips together, and whether it may flip. */
export interface OwrFlipGroup {
  readonly screens: readonly number[];
  readonly canFlip: boolean;
}

/**
 * The groups Mixed flips screens in (define_tile_groups, OverworldShuffle.
 * py:971-1056, a vanilla layout and no customizer): each screen with its
 * twin, merged where entrances, non-parallel edges, the special screens or
 * unshuffled whirlpools tie screens together (:1009-1039); a group holding
 * the sanctuary's screen never flips where its save point must stay
 * (can_shuffle_group, :989-999, `allow_flip_sanc` false outside the
 * customizer, :746), nor, in Standard, the escape's screens.
 * @param o.crossed - `ow_crossed`: none or not (Polar, grouped and
 *   unrestricted alike keep the edges' screens apart, :1025-1039)
 * @param o.doorsCrossed - A partitioned or crossed door shuffle of
 *   intensity 3 or more
 */
export function owrFlipGroups(
  data: DrData,
  o: {
    readonly shuffle: string;
    readonly mode: DrMode;
    readonly crossed: boolean;
    readonly whirlpools: boolean;
    readonly doorsCrossed?: boolean;
  },
): readonly OwrFlipGroup[] {
  const screens = [
    ...new Set(
      Object.values(overworldOf(data).tiles).filter(
        (screen) => screen < 0x40 || screen >= 0x80,
      ),
    ),
  ].sort((a, b) => a - b);
  let groups = screens.map((screen) => [screen]);
  const merge = (...links: readonly (readonly number[])[]) => {
    for (const link of links) {
      const merged = groups.filter((g) => g.some((s) => link.includes(s)));
      groups = [
        ...groups.filter((g) => !merged.includes(g)),
        merged.flat().sort((a, b) => a - b),
      ];
    }
  };
  const { shuffle, mode, crossed } = o;
  const among = (...modes: readonly string[]) => modes.includes(shuffle);
  // hyrule castle and sanctuary connector (:1009-1011)
  if (
    among("vanilla", "district") ||
    (mode === "standard" && among("dungeonssimple", "dungeonsfull"))
  )
    merge([0x13, 0x14, 0x1b]);
  // sanctuary and grave connector (:1013-1015)
  if (
    among(
      "dungeonssimple",
      "dungeonsfull",
      "simple",
      "restricted",
      "full",
      "lite",
      "district",
    )
  )
    merge([0x13, 0x14]);
  // cross-screen connector (:1017-1019)
  if (among("vanilla", "dungeonssimple", "dungeonsfull", "simple", "district"))
    merge([0x03, 0x0a], [0x28, 0x29]);
  // turtle rock connector (:1021-1023)
  if (among("vanilla", "dungeonssimple", "simple", "restricted", "district"))
    merge([0x05, 0x07]);
  if (!crossed) {
    // special screens, remaining non-parallel edges (:1025-1031)
    merge([0x00, 0x2d, 0x80], [0x0f, 0x81]);
    merge([0x1a, 0x1b], [0x28, 0x29], [0x30, 0x3a]);
    // whirlpool screens (:1037-1039)
    if (!o.whirlpools) merge([0x0f, 0x35], [0x12, 0x15, 0x33, 0x3f]);
  }
  // is_dark_chapel_start without allow_flip_sanc: Inverted (:353-356)
  const darkChapel = mode === "inverted";
  const canFlip = (group: readonly number[]) => {
    if (
      mode === "standard" &&
      group.some((s) => s === 0x1b || s === 0x2b || s === 0x2c)
    )
      return false;
    if (!group.includes(0x13)) return true;
    return !(
      (among("vanilla", "dungeonssimple", "dungeonsfull", "district") &&
        (mode === "standard" ||
          mode === "inverted" ||
          o.doorsCrossed !== true)) ||
      (among("lite", "lean") && darkChapel)
    );
  };
  return groups
    .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))
    .map((group) => ({ canFlip: canFlip(group), screens: group }));
}

/**
 * A run's screens (`OwrScreens`) from its notes: without Mixed (`flips`
 * absent) none flips but in Inverted; with it, a screen is flipped as any
 * screen of its group is noted (each flips with its group, owrFlipGroups),
 * never where its group may not flip, unknown while none of its group is
 * noted or its notes disagree.
 */
export function owrScreensOf(
  data: DrData,
  mode: DrMode,
  notes: OwrNotes = {},
  settings: Settings = {},
): OwrScreens {
  const { flips } = notes;
  if (flips === undefined || data.flavor !== "owr") return screensOf(mode);
  const groups = owrFlipGroups(data, {
    crossed:
      notes.polar === true ||
      notes.crossings !== undefined ||
      notes.edges !== undefined,
    mode,
    shuffle: owrShuffleOf(settings),
    whirlpools: notes.whirlpools !== undefined,
  });
  const flipOf = new Map<number, boolean | undefined>();
  for (const { canFlip, screens } of groups) {
    const noted = new Set(
      screens.flatMap((s) => {
        const flip = flips[String(s)];
        return flip === undefined ? [] : [flip];
      }),
    );
    const flip = !canFlip
      ? false
      : noted.size === 1
        ? [...noted][0]
        : undefined;
    for (const screen of screens) flipOf.set(screen, flip);
  }
  // A large screen's other ids are in no group (OverworldShuffle.py:1002-
  // 1005), so never in owswaps: never flipped
  const flipped = (screen: number) => {
    const light = lightOf(screen);
    return flipOf.has(light) ? flipOf.get(light) : false;
  };
  return {
    flipped,
    swapped: (screen) => {
      const flip = flipped(screen);
      return flip === undefined ? undefined : (mode === "inverted") !== flip;
    },
  };
}

/**
 * Whether an OWR run's notes tell its whole overworld: each shuffle's
 * notes whole (every whirlpool, the eight flute spots, every crossable
 * pair, every screen Mixed may flip), or a spoiler's edges.
 */
export function owrNotesComplete(
  data: DrData,
  notes: OwrNotes,
  screens: OwrScreens,
): boolean {
  const { crossings, flips, flute, whirlpools } = notes;
  const forced = forcedWhirlpoolsOf(data, notes, screens);
  return (
    (whirlpools === undefined ||
      [...whirlpoolsOf(data).keys()].every(
        (w) => whirlpools[w] !== undefined || forced.has(w),
      )) &&
    (flute === undefined || flute.length === 8) &&
    (notes.edges !== undefined ||
      crossings === undefined ||
      crossablePairsOf(data).every(([a]) => crossings[a] !== undefined)) &&
    (flips === undefined ||
      Object.values(overworldOf(data).tiles).every(
        (screen) => screens.flipped(screen) !== undefined,
      ))
  );
}

/**
 * A region's world as Mixed leaves it (update_world_regions, Overworld
 * Shuffle.py:1216-1222): a flipped screen's light world regions (and the
 * pedestal's, Zora's) the dark world's, its dark world ones the light
 * world's; undefined while its screen's flip is not known.
 */
export function regionTypeOf(
  data: DrData,
  screens: OwrScreens,
): (region: DrRegion) => DrRegion["type"] | undefined {
  const tiles = data.overworld?.tiles ?? {};
  return (region) => {
    const screen = tiles[region.name];
    if (screen === undefined) return region.type;
    const flip = screens.flipped(screen);
    if (flip === undefined) return undefined;
    if (!flip) return region.type;
    return screen >= 0x40 && screen < 0x80 ? "lw" : "dw";
  };
}

/** A screen's id as rules.json's settings name it (`tileSwapped_1b`). */
const screenName = (screen: number) => screen.toString(16).padStart(2, "0");

/**
 * The settings OWR's rules read of the overworld: each light world
 * screen's flip (`tileSwapped_<id>`), unknown ones listed, and whether the
 * run starts at the Dark Chapel (is_dark_chapel_start, :353-356: Inverted,
 * as `allow_flip_sanc` is false outside the customizer, :746).
 */
export function owrSettings(
  mode: DrMode,
  screens: OwrScreens = screensOf(mode),
): Settings {
  const found: Record<string, boolean> = {
    darkChapelStart: mode === "inverted",
  };
  for (let screen = 0; screen < 0x40; screen++)
    found[`tileSwapped_${screenName(screen)}`] =
      screens.swapped(screen) === true;
  return found;
}

/** The `tileSwapped_<id>` settings a run does not know yet. */
export const unknownScreenSettings = (screens: OwrScreens): string[] =>
  Array.from({ length: 0x40 }, (_, screen) => screen).flatMap((screen) =>
    screens.swapped(screen) === undefined
      ? [`tileSwapped_${screenName(screen)}`]
      : [],
  );

/**
 * The exits relocate_pyramid_entrances moves (EntranceShuffle2.py:2034-
 * 2055): the pyramid's hole and door stand on Hyrule Castle's ledge once
 * the pyramid's screen (0x1b) is flipped; while its flip is not known,
 * neither is linked (linkOwrEntrances), so none moves.
 */
export function owrMovedExits(
  data: DrData,
  mode: DrMode,
  screens: OwrScreens = screensOf(mode),
): ReadonlyMap<string, string> {
  if (data.flavor !== "owr" || screens.swapped(0x1b) !== true) return new Map();
  return MOVED_FROM;
}

/** Where relocate_pyramid_entrances moves the pyramid's exits. */
const MOVED_FROM: ReadonlyMap<string, string> = new Map([
  ["Pyramid Hole", "Hyrule Castle Ledge"],
  ["Pyramid Entrance", "Hyrule Castle Ledge"],
]);

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
  /**
   * A crossed overworld's edges (`ow_crossed` grouped or unrestricted,
   * OverworldShuffle.py:248-345): each noted edge by name, the edge it
   * leads into (connect_two_way links a pair both ways, :702-725, so a
   * note holds both). Absent, every edge meets its vanilla partner.
   */
  readonly edges?: Readonly<Record<string, string>>;
  /**
   * A crossed overworld's edges as a player notes them, when `edges` is
   * absent: each crossable pair (`crossablePairsOf`) by its light world
   * edge, true where walking across it changes worlds (Link's world into
   * the other, or back), false where it stays; a pair not noted leads
   * nowhere, every other edge to its vanilla partner. With Mixed, a
   * crossing reads its two screens' flips too (`edgePartnersOf`).
   */
  readonly crossings?: Readonly<Record<string, boolean>>;
  /**
   * Mixed's flips (`ow_mixed`, OverworldShuffle.py:156-179): each screen
   * noted by its light world id (0x80 and 0x81 the pedestal's and Zora's),
   * true where flipped, false where it stands; a screen not noted is not
   * known (`owrScreensOf`). Absent while Mixed is off.
   */
  readonly flips?: Readonly<Record<string, boolean>>;
  /**
   * Polar's crossed overworld (`ow_crossed` polar): its edges stay vanilla
   * whatever Mixed flips (shuffle_tiles finds no swapped edge, :945-957,
   * and Polar crosses none of its own, :246-347), and Mixed keeps the
   * edges' screens apart (owrFlipGroups).
   */
  readonly polar?: boolean;
}

/**
 * The pairs of edges a crossed overworld may cross, on a vanilla layout
 * without Mixed: each vanilla pair of light world edges (default_
 * connections) whose edges have a dark world twin (parallel_links,
 * OWEdges.py:1323). Crossing one links each edge into its partner's twin,
 * both ways, the twins' pair with it (performSwap moves an edge with its
 * parallel, OverworldShuffle.py:31-58; unrestricted crosses only edges
 * with a twin, :278, and forces their twins, :343-347); an edge with no
 * twin always meets its partner (performSwap moves both ends of such a
 * pair to the other world together, :75-87, and refuses one end alone,
 * :109).
 */
export function crossablePairsOf(
  data: DrData,
): readonly (readonly [string, string])[] {
  const twins = new Set(
    overworldOf(data).edges.flatMap((e) =>
      e.parallel === undefined ? [] : [e.name],
    ),
  );
  return data
    .pairsOf("OverworldShuffle.py", "default_connections")
    .filter(([a, b]) => twins.has(a) && twins.has(b));
}

/** Each edge's twin in the other world, both ways (parallel_links). */
const twinsOf = (data: DrData): ReadonlyMap<string, string> =>
  new Map(
    overworldOf(data).edges.flatMap((e) =>
      e.parallel === undefined
        ? []
        : [
            [e.name, e.parallel],
            [e.parallel, e.name],
          ],
    ),
  );

/** Each edge's screen, by name. */
const edgeScreensOf = (data: DrData): ReadonlyMap<string, number> =>
  new Map(overworldOf(data).edges.map((e) => [e.name, e.screen]));

/**
 * A crossed seed's edges as crossings (`OwrNotes.crossings`): each
 * crossable pair, whether its light world edge leads into its partner's
 * twin, as a player sees it: where Mixed flipped one of the pair's screens
 * and not the other, the twin is the world Link stays in (`edgePartnersOf`).
 */
export function crossingsOf(
  data: DrData,
  edges: Readonly<Record<string, string>>,
  screens?: OwrScreens,
): Readonly<Record<string, boolean>> {
  const twins = twinsOf(data);
  const screen = edgeScreensOf(data);
  return Object.fromEntries(
    crossablePairsOf(data).map(([a, b]) => {
      const crossed = edges[a] === twins.get(b);
      const apart =
        screens !== undefined &&
        screens.flipped(screen.get(a) ?? -1) !==
          screens.flipped(screen.get(b) ?? -1);
      return [a, crossed !== apart];
    }),
  );
}

/**
 * The edge each edge leads into: as noted, or, with no edges noted, its
 * vanilla partner both ways (default_connections, OverworldShuffle.py:
 * 419-431), each crossable pair into its partner's twin (the twins' pair
 * with it) where its edges cross (performSwap, :28-110, over edges_to_swap,
 * :350): Mixed's alone (`flips`, not Polar's: shuffle_tiles swaps the
 * edges of the flipped screens, :945-957) crosses a pair whose two screens
 * flip apart; a crossed overworld's crossings are noted (`crossings`) as
 * the player sees them, which a pair's screens flipped apart turn round.
 * A pair whose crossing or screens are not known leads nowhere.
 * @param screens - The run's screens (owrScreensOf), with Mixed
 */
export function edgePartnersOf(
  data: DrData,
  notes: OwrNotes = {},
  screens?: OwrScreens,
): ReadonlyMap<string, string> {
  if (notes.edges !== undefined) return new Map(Object.entries(notes.edges));
  const partner = new Map<string, string>();
  const link = (a: string, b: string) => {
    partner.set(a, b);
    partner.set(b, a);
  };
  for (const [a, b] of data.pairsOf(
    "OverworldShuffle.py",
    "default_connections",
  ))
    link(a, b);
  const { crossings } = notes;
  const mixed = notes.flips !== undefined && notes.polar !== true;
  if (crossings === undefined && !mixed) return partner;
  const twins = twinsOf(data);
  const screen = edgeScreensOf(data);
  const flip = (edge: string): boolean | undefined =>
    notes.flips === undefined
      ? false
      : screens?.flipped(screen.get(edge) ?? -1);
  for (const [a, b] of crossablePairsOf(data)) {
    const [twinA, twinB] = [twins.get(a) ?? "", twins.get(b) ?? ""];
    for (const edge of [a, b, twinA, twinB]) partner.delete(edge);
    const [flipA, flipB] = [flip(a), flip(b)];
    const seen = crossings === undefined ? false : crossings[a];
    const crossed =
      seen === undefined || flipA === undefined || flipB === undefined
        ? undefined
        : seen !== (flipA !== flipB);
    if (crossed === true) {
      link(a, twinB);
      link(twinA, b);
    } else if (crossed === false) {
      link(a, b);
      link(twinA, twinB);
    }
  }
  return partner;
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
 * Links a run may have that its notes do not tell yet, each exit with a
 * region it may lead to (and the region it leaves from, where that may
 * move too): what is linked neither way while a screen's flip is not
 * known. The world reads them for its regions' sides alone, never
 * as a way through (markWorlds' widest reading).
 */
export type OwrPossibleLinks = [exit: string, region: string, from?: string][];

/**
 * The whirlpools a shuffle pairs with no choice (OverworldShuffle.py:
 * 370-413), both ways: Polar with Mixed links the two dark world ones
 * (:376-378); an overworld not crossed (or Polar's without Mixed) shuffles
 * each world's whirlpools apart, by the world their regions are in once
 * Mixed flipped them (:380-391, after update_world_regions), so a pool of
 * two pairs them (the dark world's two without Mixed). Grouped and
 * unrestricted mix them freely: none. Read only while every whirlpool's
 * world is known.
 */
export function forcedWhirlpoolsOf(
  data: DrData,
  notes: OwrNotes,
  screens: OwrScreens,
): ReadonlyMap<string, string> {
  const forced = new Map<string, string>();
  if (notes.whirlpools === undefined) return forced;
  const pair = (a: string, b: string) => {
    forced.set(a, b);
    forced.set(b, a);
  };
  const pools = data.tableOf<unknown>(
    "OverworldShuffle.py",
    "default_whirlpool_connections",
  ) as unknown as readonly (readonly [Whirlpool, Whirlpool])[];
  const mixed = notes.flips !== undefined;
  const crossed = notes.crossings !== undefined || notes.edges !== undefined;
  if (notes.polar === true && mixed) {
    for (const [[owid, from], [, to]] of pools)
      if (owid === 0x55) pair(from, to);
    return forced;
  }
  if (crossed) return forced;
  const typeOf = regionTypeOf(data, screens);
  const byWorld = new Map<DrRegion["type"] | undefined, string[]>();
  for (const [, name, region] of pools.flat()) {
    const type = typeOf(data.regionNamed(region));
    byWorld.set(type, [...(byWorld.get(type) ?? []), name]);
  }
  if (byWorld.has(undefined)) return forced;
  for (const names of byWorld.values())
    if (names.length === 2) pair(names[0] ?? "", names[1] ?? "");
  return forced;
}

/**
 * The flute spots by number (shuffle_flute_spots, FluteShuffle.py:36-50,
 * :178-182): the spots' screens sorted by slot (sort_flute_spots,
 * :655-657; Death Mountain's slot is 0x04 once its screen flips), each
 * spot's regions as its screen may stand or be flipped: one where the run
 * knows it, both (or more, while Death Mountain's slot is not known)
 * otherwise. The spots are default_flute_connections unless the player's
 * noted ones are given.
 */
export function fluteSpotChoices(
  data: DrData,
  screens: OwrScreens,
  noted?: readonly number[],
): readonly (readonly string[])[] {
  const { flute } = overworldOf(data);
  const spots = [
    ...(noted ??
      (data.tableOf<number>(
        "FluteShuffle",
        "default_flute_connections",
      ) as unknown as readonly number[])),
  ];
  const sorted = (deathMountain: boolean) =>
    [...spots].sort((a, b) => {
      const slot = (screen: number) =>
        screen === 0x03 && deathMountain
          ? 0x04
          : (flute[String(screen)]?.slot ?? screen);
      return slot(a) - slot(b);
    });
  const swapped = screens.swapped(0x03);
  const orders =
    swapped === undefined ? [sorted(false), sorted(true)] : [sorted(swapped)];
  return spots.map((_, i) => {
    const found = new Set<string>();
    for (const order of orders) {
      const screen = order[i] ?? -1;
      const regions = flute[String(screen)]?.regions;
      if (regions === undefined)
        throw new RangeError(`No flute spot ${screen}`);
      const flip = screens.swapped(screen);
      for (const side of flip === undefined ? [false, true] : [flip])
        found.add(regions[side ? 1 : 0]);
    }
    return [...found];
  });
}

/**
 * The flute spots' regions by number (fluteSpotChoices), each undefined
 * while the run does not know it.
 */
export function fluteSpots(
  data: DrData,
  mode: DrMode,
  noted?: readonly number[],
  screens: OwrScreens = screensOf(mode),
): readonly (string | undefined)[] {
  return fluteSpotChoices(data, screens, noted).map((regions) =>
    regions.length === 1 ? regions[0] : undefined,
  );
}

type Pair = readonly [string, string];
type Whirlpool = readonly [number, string, string];

/**
 * An exit linked as a screen's flip says: to `standing` while it stands,
 * `flipped` once flipped; while not known, neither (both possible).
 */
function linkBy(
  c: Map<string, string>,
  possible: OwrPossibleLinks,
  swapped: boolean | undefined,
  exit: string,
  standing: string,
  flipped: string,
): void {
  if (swapped === undefined) possible.push([exit, standing], [exit, flipped]);
  else c.set(exit, swapped ? flipped : standing);
}

/**
 * link_overworld with a vanilla layout (OverworldShuffle.py:21-584): the
 * mandatory connections, the save-and-quit points (:183-196: Link's House
 * or the Bomb Shop by screen 0x2c, Sanctuary or the Dark Chapel, the
 * pyramid or the castle's ledge by screen 0x1b), each screen's own links
 * as it stands or flipped (:198-205), the whirlpools (:355-358), every
 * edge with its partner (`edgePartnersOf`: vanilla, as noted in a crossed
 * overworld, or as Mixed's flips cross them; connect_two_way :702-725),
 * the flute spots (FluteShuffle.py:36-50). What a screen whose flip is not
 * known decides is linked neither way, each way `possible`.
 */
export function linkOwrOverworld(
  data: DrData,
  c: Map<string, string>,
  mode: DrMode,
  notes: OwrNotes = {},
  screens: OwrScreens = screensOf(mode),
  possible: OwrPossibleLinks = [],
): void {
  for (const [exit, region] of data.pairsOf(
    "OverworldShuffle.py",
    "mandatory_connections",
  ))
    c.set(exit, region);
  linkBy(
    c,
    possible,
    screens.swapped(0x2c),
    "Links House S&Q",
    "Links House",
    "Big Bomb Shop",
  );
  c.set(
    "Sanctuary S&Q",
    mode === "inverted" ? "Dark Sanctuary Hint" : "Sanctuary",
  );
  linkBy(
    c,
    possible,
    screens.swapped(0x1b),
    "Other World S&Q",
    "Pyramid Area",
    "Hyrule Castle Ledge",
  );
  const tiles = data.tableOf<readonly [readonly Pair[], readonly Pair[]]>(
    "OverworldShuffle.py",
    "ow_connections",
  );
  for (const [screen, [stands, flipped]] of Object.entries(tiles)) {
    const swapped = screens.swapped(Number(screen));
    if (swapped === undefined)
      for (const [exit, region] of [...stands, ...flipped])
        possible.push([exit, region]);
    else
      for (const [exit, region] of swapped ? flipped : stands)
        c.set(exit, region);
  }
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
    // whirlpool, OverworldShuffle.py:359-367), one not noted nowhere, but
    // a pair its pool forces
    const known = whirlpoolsOf(data);
    for (const [from, to] of [
      ...Object.entries(notes.whirlpools),
      ...forcedWhirlpoolsOf(data, notes, screens),
    ]) {
      const target = known.get(to);
      if (!known.has(from) || target === undefined)
        throw new RangeError(`No whirlpool "${known.has(from) ? to : from}"`);
      c.set(from, target.region);
    }
  }
  const edges = new Set(overworldOf(data).edges.map((e) => e.name));
  const partners = edgePartnersOf(data, notes, screens);
  for (const [a, b] of partners) {
    if (!edges.has(a) || !edges.has(b))
      throw new RangeError(`No edge "${edges.has(a) ? b : a}"`);
    c.set(a, data.parentOf(b));
  }
  // A pair not linked may lead into its partner or the partner's twin
  if (notes.edges === undefined) {
    const twins = twinsOf(data);
    for (const [a, b] of crossablePairsOf(data))
      if (!partners.has(a))
        for (const [x, y] of [
          [a, b],
          [a, twins.get(b) ?? ""],
          [twins.get(a) ?? "", b],
          [twins.get(a) ?? "", twins.get(b) ?? ""],
        ] as const)
          possible.push([x, data.parentOf(y)], [y, data.parentOf(x)]);
  }
  fluteSpotChoices(data, screens, notes.flute).forEach((regions, i) => {
    const exit = `Flute Spot ${i + 1}`;
    if (regions.length === 1) c.set(exit, regions[0] ?? "");
    else for (const region of regions) possible.push([exit, region]);
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
 * Link starts in (:157-160, connect_exit :2115-2129). The towers, the
 * pyramid's hole and door (on the castle's ledge once 0x1b flips,
 * relocate_pyramid_entrances :2034-2055) and the start's ways out are
 * linked neither way while the screens they read are not known.
 */
export function linkOwrEntrances(
  data: DrData,
  c: Map<string, string>,
  mode: DrMode,
  screens: OwrScreens = screensOf(mode),
  possible: OwrPossibleLinks = [],
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
  const [deathMountain, pyramid] = [
    screens.swapped(0x03),
    screens.swapped(0x1b),
  ];
  // is_atgt_swapped: unknown while either screen is, unless one stands
  const traded =
    deathMountain === false || pyramid === false
      ? false
      : deathMountain === undefined || pyramid === undefined
        ? undefined
        : true;
  if (traded === true) {
    twoWays["Ganons Tower"] = "Agahnims Tower Exit";
    twoWays["Agahnims Tower"] = "Ganons Tower Exit";
  }
  const oneWay: Record<string, string> = { ...drops, ...singles };
  // The pyramid's door stands on the castle's ledge once its screen flips
  const moved = owrMovedExits(data, mode, screens);
  const parentOf = (exit: string) => moved.get(exit) ?? data.parentOf(exit);
  const unknown = new Set([
    ...(traded === undefined
      ? [
          "Ganons Tower",
          "Agahnims Tower",
          "Ganons Tower Exit",
          "Agahnims Tower Exit",
        ]
      : []),
    ...(pyramid === undefined
      ? ["Pyramid Hole", "Pyramid Entrance", "Pyramid Exit"]
      : []),
  ]);
  const pool = [
    ...[...Object.keys(drops), ...Object.keys(map("entrance_map"))].filter(
      (name) => !name.startsWith("Inverted"),
    ),
    ...Object.keys(singles),
  ].sort();
  for (const entrance of pool) {
    const exit = twoWays[entrance];
    if (exit !== undefined) {
      if (unknown.has(entrance) || unknown.has(exit)) {
        possible.push(
          [entrance, data.parentOf(exit)],
          [exit, data.parentOf(entrance)],
        );
        if (pyramid === undefined && entrance === "Pyramid Entrance")
          possible.push(
            [entrance, data.parentOf(exit), "Hyrule Castle Ledge"],
            [exit, "Hyrule Castle Ledge"],
          );
        if (traded === undefined && entrance.endsWith("s Tower")) {
          const other =
            entrance === "Ganons Tower" ? "Agahnims Tower" : "Ganons Tower";
          possible.push(
            [entrance, data.parentOf(`${other} Exit`)],
            [`${other} Exit`, data.parentOf(entrance)],
          );
        }
      } else {
        c.set(entrance, parentOf(exit));
        c.set(exit, parentOf(entrance));
      }
    }
    const region = oneWay[entrance];
    if (region === undefined) continue;
    if (unknown.has(entrance))
      possible.push(
        [entrance, region],
        [entrance, region, MOVED_FROM.get(entrance) ?? data.parentOf(entrance)],
      );
    else c.set(entrance, region);
  }
  const bombShop = screens.swapped(0x2c);
  if (bombShop === true) c.set("Big Bomb Shop Exit", "Big Bomb Shop Area");
  else if (bombShop === undefined)
    possible.push(["Big Bomb Shop Exit", "Big Bomb Shop Area"]);
  if (mode === "inverted")
    c.set("Dark Sanctuary Hint Exit", "Dark Chapel Area");
  if (!c.has("Chris Houlihan Room Exit")) {
    if (bombShop === undefined)
      possible.push(
        ["Chris Houlihan Room Exit", data.parentOf("Big Bomb Shop")],
        ["Chris Houlihan Room Exit", data.parentOf("Links House")],
      );
    else
      c.set(
        "Chris Houlihan Room Exit",
        data.parentOf(bombShop ? "Big Bomb Shop" : "Links House"),
      );
  }
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
 * kept where its condition (`when`, a setting or its negation) holds, and
 * not where it reads a setting the run does not know (`unknown`: the
 * activation while Kakariko's flip is not known).
 */
export function owrDynamicEvents(
  data: DrData,
  settings: Settings,
  unknown: ReadonlySet<string> = new Set(),
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
      if (unknown.has(read[2] ?? "")) return [];
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

/** The light and dark world's regions (mark_light_dark_world_regions). */
export interface WorldSides {
  readonly light: ReadonlySet<string>;
  readonly dark: ReadonlySet<string>;
}

/**
 * The sides a world's regions surely have (`lower`) and may have
 * (`upper`) while some screens' flips are not known; the same twice
 * otherwise.
 */
export interface SideBounds {
  readonly lower: WorldSides;
  readonly upper: WorldSides;
}

/** Bounds from sides known, or the bounds given. */
export const boundsOf = (marked: WorldSides | SideBounds): SideBounds =>
  "lower" in marked ? marked : { lower: marked, upper: marked };

/**
 * Whether a region may be in a side or not, as asked (`in`): true where
 * the run cannot rule it out.
 */
export const mayBe = (
  bounds: SideBounds,
  side: keyof WorldSides,
  region: string,
  inSide: boolean,
): boolean =>
  inSide ? bounds.upper[side].has(region) : !bounds.lower[side].has(region);

/**
 * ow_terrain_rules (Rules.py:1417-1429): an edge into water asks the
 * flippers from land (set, its rule replaced) and the pearl into the
 * other world, as a whirlpool from Link's world into the other does. An
 * edge's partner is the one it leads into (`edgePartnersOf`). Where a
 * region's side is not known, the pearl is asked if it may be.
 */
export function owrTerrainRules(
  data: DrData,
  exits: readonly TerrainExit[],
  marked: WorldSides | SideBounds,
  mode: DrMode,
  notes: OwrNotes = {},
  screens?: OwrScreens,
): void {
  const bounds = boundsOf(marked);
  const edges = new Map(overworldOf(data).edges.map((e) => [e.name, e]));
  const partner = edgePartnersOf(data, notes, screens);
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
      if (mayBe(bounds, "dark", exit.to, own))
        exit.req = and(exit.req, "moonPearl");
    }
    if (
      whirlpools.has(exit.name) &&
      mayBe(bounds, "light", exit.from, own) &&
      mayBe(bounds, "dark", exit.to, own)
    )
      exit.req = and(exit.req, "moonPearl");
  }
}

/**
 * What a seed's JSON spoiler tells of its shuffled overworld, as a player
 * who walked it notes it: its whirlpools (`Whirlpools`, set_whirlpool's
 * pairs, OverworldShuffle.py:368) both ways, its flute spots (`Maps`'
 * flute entry, whose `data` is the sorted spots, FluteShuffle.py:652) and
 * a crossed overworld's edges (`Overworld`, every pair connect_two_way
 * linked once the layout, Mixed or crossed moved any, :721-722) both ways,
 * Mixed's flipped screens (`Maps`' swaps entry, whose `data` lists them,
 * :179; every other screen stands) and Polar, for the shuffles its meta
 * names alone. Mixed's edges, crossed by its flips alone, are left to the
 * flips, as a player reads them.
 */
export function owrNotesFromSpoiler(json: {
  readonly meta: Readonly<Record<string, unknown>>;
  readonly Whirlpools?: readonly {
    readonly entrance: string;
    readonly exit: string;
  }[];
  readonly Overworld?: readonly {
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
  const edges: Record<string, string> = {};
  for (const { entrance, exit } of json.Overworld ?? []) {
    edges[entrance] = exit;
    edges[exit] = entrance;
  }
  const crossed = meta.ow_crossed !== undefined && meta.ow_crossed !== "none";
  // Mixed's flipped screens, each light world one with its twin and the
  // pedestal's and Zora's alone (owswaps[0], set_map at :179)
  const swaps = json.Maps?.find((map) => map.type === "swaps")?.data;
  const flips =
    meta.ow_mixed === true
      ? Object.fromEntries(
          [...Array.from({ length: 0x40 }, (_, i) => i), 0x80, 0x81].map(
            (screen) => [
              String(screen),
              ((swaps ?? []) as readonly number[]).includes(screen),
            ],
          ),
        )
      : undefined;
  return {
    ...(crossed ? { edges } : {}),
    ...(flips === undefined ? {} : { flips }),
    ...(meta.ow_crossed === "polar" ? { polar: true } : {}),
    ...(meta.ow_whirlpool === true ? { whirlpools } : {}),
    ...(meta.ow_fluteshuffle !== undefined && meta.ow_fluteshuffle !== "vanilla"
      ? { flute: (flute ?? []) as readonly number[] }
      : {}),
  };
}
