// The screens the Overworld Randomizer's Mixed shuffle flips, and the
// groups it flips them in (define_tile_groups, OverworldShuffle.py:971-
// 1056, at the release upstream.json pins as doorRandomizer.overworld): no
// data of the fork's world beside the screens' ids, so the app's Overworld
// tab and the world builder read the same groups. The world's own spec
// holds the ids to the fork's screens (OWTileRegions).

/** The modes of DR's worlds (door-world's `DrMode`). */
type Mode = "open" | "standard" | "inverted";

/**
 * The screens Mixed may flip, by light world id: each screen's own but
 * the three other ids of a large one (OverworldShuffle.py:1002-1005), and
 * the pedestal's and Zora's (0x80, 0x81, :1006-1007).
 */
export const OWR_FLIP_SCREENS: readonly number[] = [
  0x00, 0x02, 0x03, 0x05, 0x07, 0x0a, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15,
  0x16, 0x17, 0x18, 0x1a, 0x1b, 0x1d, 0x1e, 0x22, 0x25, 0x28, 0x29, 0x2a, 0x2b,
  0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x32, 0x33, 0x34, 0x35, 0x37, 0x3a, 0x3b, 0x3c,
  0x3f, 0x80, 0x81,
];

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
export function owrFlipGroups(o: {
  readonly shuffle: string;
  readonly mode: Mode;
  readonly crossed: boolean;
  readonly whirlpools: boolean;
  readonly doorsCrossed?: boolean;
}): readonly OwrFlipGroup[] {
  let groups = OWR_FLIP_SCREENS.map((screen) => [screen]);
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
