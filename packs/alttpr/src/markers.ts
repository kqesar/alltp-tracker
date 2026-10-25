// The map markers: where each check sits on the tracker's map, and what a
// marker shows for the locations it stands for.
//
// The coordinate space is the legacy map's (apps/web/public/assets/map.webp,
// 884 x 442): `x` and `y` are percents of the whole image's width and
// height, the Light World on its left half (x 0 to 50), the Dark World on
// its right half (50 to 100). The legacy chests.ts and dungeons.ts wrote
// them as "30.8%"; here they are numbers.
import {
  DUNGEONS,
  type DungeonId,
  dungeon,
  dungeonLocations,
} from "./dungeons";
import { LEGACY_CHESTS, LEGACY_DUNGEONS } from "./legacy";
import { locationId, type Source } from "./location";
import { type AlttprSettings, STANDARD } from "./settings";

/** One marker on the map. */
export interface MapMarker {
  /** Its id, the slug of its name. */
  readonly id: string;
  /** Its label, as text. */
  readonly name: string;
  /** Percent of the map's width: the Light World is 0-50, the Dark 50-100. */
  readonly x: number;
  /** Percent of the map's height. */
  readonly y: number;
  /** The locations it stands for. */
  readonly locations: readonly string[];
  /** A dungeon marker's dungeon, whose item locations it stands for. */
  readonly dungeon?: DungeonId;
  /**
   * Where its position comes from: the legacy map's marker of that index,
   * or, for a marker the legacy map lacked, where it was read and why.
   */
  readonly position:
    | { readonly legacy: "chest" | "dungeon"; readonly index: number }
    | { readonly source: Source; readonly why: string };
}

/** The legacy chests.ts positions, by marker index: [x, y]. */
export const LEGACY_CHEST_POSITIONS: readonly (readonly [number, number])[] = [
  [30.8, 29.6],
  [23.4, 93.4],
  [27.4, 67.9],
  [39.9, 9.3],
  [42.6, 9.3],
  [8.1, 57.8],
  [4.4, 54.2],
  [55.4, 57.8],
  [60.8, 47.9],
  [10, 82.6],
  [51.7, 79.5],
  [92.8, 14.7],
  [40.7, 41.4],
  [78.6, 14.9],
  [1.7, 41],
  [6.4, 41],
  [80, 77.1],
  [41.4, 17.1],
  [19.5, 29.3],
  [32.6, 93.4],
  [44.7, 76.9],
  [91.6, 8.6],
  [91.6, 3.4],
  [52.1, 46.4],
  [4.5, 46.8],
  [40.7, 46.7],
  [65.5, 68.6],
  [7.8, 52.1],
  [65.2, 52.2],
  [35.4, 69.7],
  [21, 3],
  [11, 92.2],
  [96, 17.2],
  [47.5, 12.1],
  [20.8, 20.4],
  [40.8, 32.5],
  [9.4, 13],
  [15.1, 7.6],
  [24.3, 14.8],
  [14.1, 84.1],
  [28.1, 27],
  [8.8, 77.3],
  [65.8, 60.1],
  [7.7, 65.9],
  [6.2, 8.6],
  [25.4, 8.5],
  [40.2, 3],
  [1.8, 69.8],
  [1.5, 91],
  [36.1, 82.9],
  [67.1, 15.2],
  [79, 43.5],
  [52.9, 69.2],
  [47.5, 17.3],
  [14.4, 66.2],
  [26.8, 32.4],
  [29.8, 41.8],
  [24.9, 44.1],
  [23, 28],
  [16, 58],
  [15.2, 51.8],
  [73.5, 48.5],
  [2.5, 3.2],
  [24.9, 57.1],
];

/** The legacy dungeons.ts positions, by dungeon index: [x, y]. */
export const LEGACY_DUNGEON_POSITIONS: readonly (readonly [number, number])[] =
  [
    [46.8, 38.8],
    [3.8, 78.4],
    [31, 5.5],
    [97, 40],
    [73.5, 91],
    [53.3, 5.4],
    [56.4, 47.9],
    [89.8, 85.8],
    [55.8, 82.9],
    [96.9, 7],
  ];

/**
 * The name of each legacy chest marker, by index, as the map labels it now:
 * the place, without the icons of what it needs. "Bridge" (63) stands for
 * no location and gets no marker.
 */
const CHEST_NAMES = [
  "King's Tomb",
  "Dam",
  "Link's House",
  "Spiral Cave",
  "Mimic Cave",
  "Kakariko Tavern",
  "Chicken House",
  "Brewery",
  "C-Shaped House",
  "Aginah's Cave",
  "Mire Shed",
  "Superbunny Cave",
  "Sahasrahla's Hut",
  "Spike Cave",
  "Kakariko Well",
  "Blind's Hideout",
  "Hype Cave",
  "Paradox Cave",
  "Pegasus Rocks",
  "Mini Moldorm Cave",
  "Ice Rod Cave",
  "Hookshot Cave Bottom Right",
  "Hookshot Cave",
  "Chest Game",
  "Bottle Merchant",
  "Sahasrahla",
  "Stumpy",
  "Sick Kid",
  "Purple Chest",
  "Hobo",
  "Ether Tablet",
  "Bombos Tablet",
  "Catfish",
  "King Zora",
  "Old Man",
  "Potion Shop",
  "Lost Woods Hideout",
  "Lumberjack Tree",
  "Spectacle Rock Cave",
  "Cave 45",
  "Graveyard Ledge",
  "Checkerboard Cave",
  "Hammer Pegs",
  "Library",
  "Mushroom",
  "Spectacle Rock",
  "Floating Island",
  "Maze Race",
  "Desert Ledge",
  "Lake Hylia Island",
  "Bumper Cave",
  "Pyramid",
  "Digging Game",
  "Zora's Ledge",
  "Flute Spot",
  "Sewers Secret Room",
  "Secret Passage",
  "Hyrule Castle",
  "Sanctuary",
  "Magic Bat",
  "Blacksmith",
  "Pyramid Fairy",
  "Master Sword Pedestal",
] as const;

/**
 * The places the legacy map split into two markers, each now one marker
 * standing for both: the kept marker (the key) takes the locations of the
 * absorbed one and a position of its own, read off the legacy ones. Both
 * are legacy names, so a legacy save, which checks locations by the legacy
 * index (`LEGACY_CHESTS`, untouched), still loads.
 */
const MERGED_PLACES: Readonly<
  Record<
    string,
    { absorbs: string; at: readonly [number, number]; why: string }
  >
> = {
  "Hookshot Cave": {
    absorbs: "Hookshot Cave Bottom Right",
    at: [91.6, 6],
    why: "midway between the legacy cave's two markers, (91.6%, 3.4%) and (91.6%, 8.6%): the cave runs from its north door to its south one",
  },
  "Sahasrahla's Hut": {
    absorbs: "Sahasrahla",
    at: [40.7, 41.4],
    why: "the hut, where the legacy hut marker stood: Sahasrahla gives his item inside it",
  },
};

const ABSORBED: ReadonlySet<string> = new Set(
  Object.values(MERGED_PLACES).map((merge) => merge.absorbs),
);

/** The locations of a legacy chest marker, by its name. */
const legacyLocations = (name: string): readonly string[] =>
  LEGACY_CHESTS[(CHEST_NAMES as readonly string[]).indexOf(name)]?.locations ??
  [];

const fromLegacyChests: readonly MapMarker[] = CHEST_NAMES.flatMap(
  (name, index): MapMarker[] => {
    if (ABSORBED.has(name)) return [];
    const id = locationId(name);
    const merge = MERGED_PLACES[name];
    if (merge !== undefined) {
      const [x, y] = merge.at;
      return [
        {
          id,
          locations: [
            ...legacyLocations(name),
            ...legacyLocations(merge.absorbs),
          ],
          name,
          position: { source: "game", why: merge.why },
          x,
          y,
        },
      ];
    }
    const [x, y] = LEGACY_CHEST_POSITIONS[index] ?? [0, 0];
    return [
      {
        id,
        locations: LEGACY_CHESTS[index]?.locations ?? [],
        name,
        position: { index, legacy: "chest" },
        x,
        y,
      },
    ];
  },
);

const dungeonMarker = (
  id: DungeonId,
  [x, y]: readonly [number, number],
  position: MapMarker["position"],
): MapMarker => ({
  dungeon: id,
  id,
  locations: dungeonLocations(dungeon(id), STANDARD),
  name: dungeon(id).name,
  position,
  x,
  y,
});

/**
 * The markers the legacy map lacked, placed for review. Their positions are
 * the game's, read off the map image and the alttprandohelper tracker the
 * legacy map comes from (crossproduct42/alttprandohelper, style.css), whose
 * worlds each span 0-100%: its Light World x is halved here.
 */
const NEW_MARKERS: readonly MapMarker[] = [
  {
    id: "waterfall-fairy",
    locations: ["waterfall-fairy/left", "waterfall-fairy/right"],
    name: "Waterfall Fairy",
    position: {
      source: "game",
      why: "the Waterfall of Wishing, up Zora's River: alttprandohelper's fairy-lw (89.8%, 14.7%)",
    },
    x: 44.9,
    y: 14.7,
  },
  dungeonMarker("castle-tower", [25, 52.6], {
    source: "game",
    why: "Hyrule Castle's gate, below the legacy castle marker: alttprandohelper's agahnim (50%, 52.6%)",
  }),
  dungeonMarker("ganons-tower", [78.2, 4], {
    source: "game",
    why: "the tower atop the Dark World's Death Mountain, read off the map image",
  }),
];

/**
 * Every marker of the map: the legacy map's 63 chest markers that stand for
 * a location (in their legacy order, the two places it split merged into
 * one marker each), the 10 legacy dungeons, and the markers the legacy map
 * lacked. Each check of the world is on exactly one.
 */
export const MARKERS: readonly MapMarker[] = [
  ...fromLegacyChests,
  ...LEGACY_DUNGEONS.map((id, index) =>
    dungeonMarker(id, LEGACY_DUNGEON_POSITIONS[index] ?? [0, 0], {
      index,
      legacy: "dungeon",
    }),
  ),
  ...NEW_MARKERS,
];

/** One of MARKERS, by id. */
const markerAt = (id: string): MapMarker => {
  const found = MARKERS.find((marker) => marker.id === id);
  if (found === undefined) throw new RangeError(`No marker "${id}"`);
  return found;
};

/** A marker moved to another's place, with where that place was read. */
const movedTo = (
  marker: MapMarker,
  [x, y]: readonly [number, number],
  position: MapMarker["position"],
): MapMarker => ({ ...marker, position, x, y });

/**
 * An Inverted world's markers: Open's and Standard's, but for the doors the
 * Inverted world moves. Link's House is the Dark World's Bomb Shop
 * (Inverted/DarkWorld/South.php:31), which sits where Link's House does in
 * the Light World, and the Bomb Merchant, the event that sells the big bomb,
 * takes Link's House (Inverted/LightWorld/South.php:27). Castle Tower and
 * Ganon's Tower trade doors: Castle Tower opens atop the Dark World's Death
 * Mountain (Inverted/HyruleCastleTower.php:24), Ganon's Tower at Hyrule
 * Castle (Inverted/GanonsTower.php:490).
 */
export const INVERTED_MARKERS: readonly MapMarker[] = MARKERS.flatMap(
  (marker): MapMarker[] => {
    const castle = markerAt("castle-tower");
    const tower = markerAt("ganons-tower");
    switch (marker.id) {
      case "links-house": {
        const home = movedTo(marker, [marker.x + 50, marker.y], {
          source: "app/Region/Inverted/DarkWorld/South.php:31",
          why: "the Dark World's Bomb Shop, where Link's House is in the Light World",
        });
        const merchant: MapMarker = {
          id: "bomb-merchant",
          locations: ["bomb-merchant"],
          name: "Bomb Merchant",
          position: {
            source: "app/Region/Inverted/LightWorld/South.php:27",
            why: "Link's House, which the Bomb Shop takes in Inverted",
          },
          x: marker.x,
          y: marker.y,
        };
        return [home, merchant];
      }
      case "castle-tower":
        return [
          movedTo(marker, [tower.x, tower.y], {
            source: "app/Region/Inverted/HyruleCastleTower.php:24",
            why: "Ganon's Tower's door atop the Dark World's Death Mountain",
          }),
        ];
      case "ganons-tower":
        return [
          movedTo(marker, [castle.x, castle.y], {
            source: "app/Region/Inverted/GanonsTower.php:490",
            why: "Castle Tower's door at Hyrule Castle",
          }),
        ];
      default:
        return [marker];
    }
  },
);

/** The markers of a run's world. */
export const markersOf = (settings: AlttprSettings): readonly MapMarker[] =>
  settings.invertedMode ? INVERTED_MARKERS : MARKERS;

/**
 * Every location a marker of some world stands for: what the player may
 * check, in a save of any run. Its order is the order shared links index
 * their locations by (apps/web/src/games/alttpr/share.ts: append-only), so
 * it starts with the legacy markers' locations as they stood before two
 * places merged, which a merge must not move.
 */
export const MAP_LOCATIONS: ReadonlySet<string> = new Set([
  ...CHEST_NAMES.flatMap(legacyLocations),
  ...[...MARKERS, ...INVERTED_MARKERS].flatMap((marker) => marker.locations),
]);

/** The dungeons with a marker: every one but Hyrule Castle's escape. */
export const MARKED_DUNGEONS: readonly DungeonId[] = DUNGEONS.map(
  (d) => d.id,
).filter((id) => MARKERS.some((m) => m.dungeon === id));
