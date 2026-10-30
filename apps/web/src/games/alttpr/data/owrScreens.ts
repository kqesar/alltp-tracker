// The screens an Overworld Randomizer seed's flute spots may stand on, by
// the name of the region the bird lands in: flute_data's (FluteShuffle.py:
// 683-726) light world region, then its region once the screen is flipped
// (an Inverted world's), each less its " Area", which the player reads by
// the names the rest of the tracker gives places (`fluteScreenName`).
// Loaded with the Overworld tab only; its spec holds it to the pack's data
// and to OWR_FLUTE_SCREENS.

/** Each flute screen: its id, its name as it stands, its name flipped. */
export const FLUTE_SCREENS: readonly (readonly [number, string, string])[] = [
  [0x00, "Lost Woods East", "Skull Woods Forest"],
  [0x02, "Lumberjack", "Dark Lumberjack"],
  [0x03, "West Death Mountain (Bottom)", "West Dark Death Mountain (Top)"],
  [0x05, "East Death Mountain (Bottom)", "East Dark Death Mountain (Bottom)"],
  [0x07, "Death Mountain TR Pegs", "Turtle Rock"],
  [0x0a, "Mountain Pass", "Bumper Cave"],
  [0x0f, "Zora Waterfall", "Catfish"],
  [0x10, "Lost Woods Pass West", "Skull Woods Pass West"],
  [0x11, "Kakariko Fortune", "Dark Fortune"],
  [0x12, "Kakariko Pond", "Outcast Pond"],
  [0x13, "Sanctuary", "Dark Chapel"],
  [0x14, "Graveyard", "Dark Graveyard"],
  [0x15, "River Bend East Bank", "Qirn Jump East Bank"],
  [0x16, "Potion Shop", "Dark Witch"],
  [0x17, "Zora Approach Ledge", "Catfish Approach Ledge"],
  [0x18, "Kakariko Village", "Village of Outcasts"],
  [0x1a, "Forgotten Forest", "Shield Shop Fence"],
  [0x1b, "Hyrule Castle Courtyard", "Pyramid"],
  [0x1d, "Wooden Bridge", "Broken Bridge Northeast"],
  [0x1e, "Eastern Palace", "Palace of Darkness"],
  [0x22, "Blacksmith", "Hammer Pegs"],
  [0x25, "Sand Dunes", "Dark Dunes"],
  [0x28, "Maze Race", "Dig Game"],
  [0x29, "Kakariko Suburb", "Frog"],
  [0x2a, "Flute Boy", "Stumpy"],
  [0x2b, "Central Bonk Rocks", "Dark Bonk Rocks"],
  [0x2c, "Links House", "Big Bomb Shop"],
  [0x2d, "Stone Bridge South", "Hammer Bridge South"],
  [0x2e, "Tree Line", "Dark Tree Line"],
  [0x2f, "Eastern Nook", "Darkness Nook"],
  [0x30, "Desert Teleporter Ledge", "Mire Teleporter Ledge"],
  [0x32, "Flute Boy Approach", "Stumpy Approach"],
  [0x33, "C Whirlpool Outer", "Dark C Whirlpool Outer"],
  [0x34, "Statues", "Hype Cave"],
  [0x35, "Lake Hylia South Shore", "Ice Lake Southeast Ledge"],
  [0x37, "Ice Cave", "Shopping Mall"],
  [0x3a, "Desert Pass", "Swamp Nook"],
  [0x3b, "Dam", "Swamp"],
  [0x3c, "South Pass", "Dark South Pass"],
  [0x3f, "Octoballoon", "Bomber Corner"],
];

/**
 * The name a player knows each flute screen's region by, where it is not
 * the fork's: the tracker's own place names (Link's House, the Digging
 * Game), the side of a screen in brackets.
 */
const NAMES: Readonly<Record<string, string>> = {
  "Broken Bridge Northeast": "Broken Bridge (Northeast)",
  "C Whirlpool Outer": "C Whirlpool (Outer)",
  "Catfish Approach Ledge": "Catfish Approach (Ledge)",
  "Central Bonk Rocks": "Bonk Rocks",
  "Dark C Whirlpool Outer": "Dark C Whirlpool (Outer)",
  "Dark Fortune": "Dark Fortune Teller",
  "Dark Lumberjack": "Dark Lumberjacks",
  "Dark Witch": "Dark Witch's Hut",
  "Death Mountain TR Pegs": "Turtle Rock Pegs",
  "Dig Game": "Digging Game",
  "East Dark Death Mountain (Bottom)": "East Dark Death Mountain (Lower)",
  "East Death Mountain (Bottom)": "East Death Mountain (Lower)",
  "Hammer Bridge South": "Hammer Bridge (South)",
  "Ice Cave": "Ice Rod Cave",
  "Ice Lake Southeast Ledge": "Ice Lake (Southeast Ledge)",
  "Kakariko Fortune": "Kakariko Fortune Teller",
  "Lake Hylia South Shore": "Lake Hylia (South Shore)",
  "Links House": "Link's House",
  "Lost Woods East": "Lost Woods (East)",
  "Lost Woods Pass West": "Lost Woods Pass (West)",
  Lumberjack: "Lumberjacks",
  "Outcast Pond": "Village of Outcasts Pond",
  "Qirn Jump East Bank": "Qirn Jump (East Bank)",
  "River Bend East Bank": "River Bend (East Bank)",
  "Shield Shop Fence": "Shield Shop (Fence)",
  "Skull Woods Forest": "Skull Woods (Forest)",
  "Skull Woods Pass West": "Skull Woods Pass (West)",
  "Stone Bridge South": "Stone Bridge (South)",
  "West Dark Death Mountain (Top)": "West Dark Death Mountain (Upper)",
  "West Death Mountain (Bottom)": "West Death Mountain (Lower)",
  "Zora Approach Ledge": "Zora's Approach (Ledge)",
  "Zora Waterfall": "Zora's Waterfall",
};

/** Every region a flute screen names, by the fork's name. */
export const FLUTE_REGIONS: readonly string[] = FLUTE_SCREENS.flatMap(
  ([, stands, flipped]) => [stands, flipped],
);

/** The regions renamed for the player: none but a flute screen's. */
export const RENAMED_REGIONS: readonly string[] = Object.keys(NAMES);

/**
 * A flute screen's name for the player.
 * @param region - The fork's region the bird lands in (less " Area")
 */
export const fluteScreenName = (region: string): string =>
  NAMES[region] ?? region;

/** The screens Mixed flips that hold no flute spot: the pedestal's, Zora's. */
const OTHER_SCREENS: Readonly<Record<number, string>> = {
  128: "Master Sword Meadow",
  129: "Zora's Domain",
};

/**
 * A screen's name for the player, by its light world id: its flute
 * region's, less the side in brackets (the whole screen), or the
 * pedestal's and Zora's.
 */
export const screenNameOf = (screen: number): string => {
  const found = FLUTE_SCREENS.find(([id]) => id === screen);
  if (found === undefined) return OTHER_SCREENS[screen] ?? `Screen ${screen}`;
  return fluteScreenName(found[1]).replace(/ \(.*\)$/, "");
};

/**
 * The light world screen each edge of a crossable pair stands on, by the
 * fork's area name (its edge's name less the side and place letters:
 * "Kakariko Fortune" of "Kakariko Fortune ES", OWEdges.py's screen id).
 * Its spec holds it to the pack's data.
 */
export const EDGE_SCREENS: Readonly<Record<string, number>> = {
  Blacksmith: 0x22,
  "C Whirlpool": 0x33,
  "Central Bonk Rocks": 0x2b,
  Dam: 0x3b,
  "Death Mountain TR Pegs": 0x07,
  "Desert Pass": 0x3a,
  "East Death Mountain": 0x05,
  "Eastern Nook": 0x2f,
  "Eastern Palace": 0x1e,
  "Flute Boy": 0x2a,
  "Flute Boy Approach": 0x32,
  "Forgotten Forest": 0x1a,
  Graveyard: 0x14,
  "Hyrule Castle": 0x1b,
  "Ice Cave": 0x37,
  Kakariko: 0x18,
  "Kakariko Fortune": 0x11,
  "Kakariko Pond": 0x12,
  "Kakariko Suburb": 0x29,
  "Lake Hylia": 0x35,
  "Links House": 0x2c,
  "Lost Woods": 0x00,
  "Lost Woods Pass": 0x10,
  Lumberjack: 0x02,
  "Maze Race": 0x28,
  "Mountain Pass": 0x0a,
  Octoballoon: 0x3f,
  "Potion Shop": 0x16,
  "River Bend": 0x15,
  Sanctuary: 0x13,
  "Sand Dunes": 0x25,
  "South Pass": 0x3c,
  Statues: 0x34,
  "Stone Bridge": 0x2d,
  "Tree Line": 0x2e,
  "West Death Mountain": 0x03,
  "Wooden Bridge": 0x1d,
  "Zora Approach": 0x17,
  "Zora Waterfall": 0x0f,
};

/** Where along its side an edge's place letter stands, in reading order. */
const PLACE_ORDER = "NWCSE";

/** The words for two or three edges along a side, by the side's axis. */
const ALONG: Readonly<Record<string, readonly (readonly string[])[]>> = {
  across: [
    ["west", "east"],
    ["west", "middle", "east"],
  ],
  down: [
    ["north", "south"],
    ["north", "middle", "south"],
  ],
};

/** An edge's area and its side and place letters ("ES"). */
const partsOf = (edge: string): readonly [string, string] => {
  const at = edge.lastIndexOf(" ");
  return [edge.slice(0, at), edge.slice(at + 1)];
};

/** A crossing's name as a row shows it, and as its select is labelled. */
export type CrossingName = { readonly shown: string; readonly label: string };

/**
 * Each crossing's name for the player, by its first edge: the two screens
 * it joins, by the names the tracker gives them, and where they meet more
 * than once, where along the edge (north, middle or south of an east or
 * west edge; west, middle or east of a north or south one).
 */
export const crossingNamesOf = (
  crossings: readonly (readonly [string, string])[],
): ReadonlyMap<string, CrossingName> => {
  const screensOf = ([edge, partner]: readonly [string, string]) =>
    [edge, partner].map((e) => {
      const screen = EDGE_SCREENS[partsOf(e)[0]];
      return screen === undefined ? partsOf(e)[0] : screenNameOf(screen);
    }) as [string, string];
  const byScreens = new Map<string, (readonly [string, string])[]>();
  for (const crossing of crossings) {
    const key = screensOf(crossing).join("/");
    byScreens.set(key, [...(byScreens.get(key) ?? []), crossing]);
  }
  const names = new Map<string, CrossingName>();
  for (const group of byScreens.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        PLACE_ORDER.indexOf(partsOf(a[0])[1].charAt(1)) -
        PLACE_ORDER.indexOf(partsOf(b[0])[1].charAt(1)),
    );
    sorted.forEach((crossing, i) => {
      const [one, two] = screensOf(crossing);
      const side = partsOf(crossing[0])[1].charAt(0);
      const words =
        ALONG[side === "E" || side === "W" ? "down" : "across"]?.[
          sorted.length - 2
        ];
      const where = words === undefined ? "" : ` (${words[i]})`;
      names.set(crossing[0], {
        label: `${one} to ${two}${where}`,
        shown: `${one} – ${two}${where}`,
      });
    });
  }
  return names;
};
