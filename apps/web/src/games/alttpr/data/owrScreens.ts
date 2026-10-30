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
