// Where the tracker draws each location: Super Metroid's on the Zebes map,
// A Link to the Past's on the ALttPR pack's map, by alias.
//
// Hyrule's markers (markers-hyrule.json) are the ALttPR pack's, an open
// world's, each standing for the SMZ3 locations it holds (ZELDA_ALIASES)
// and placed on its world's half of ALttPR's map. markers.spec.ts derives
// them from the ALttPR pack and holds the file to that, `vitest -u` writing
// it again when ALttPR's markers move: data rather than an import, so the
// SMZ3 board never downloads ALttPR's world.
//
// The Zebes map (apps/web/public/assets/smz3/zebes.png) is VARIA's vanilla
// area maps (theonlydude/RandomMetroidSolver, MIT, its licence in
// markers-zebes.LICENSE; tools/autotracker/vanilla at 5ce97e1) composed as
// its full map places them, cropped and halved. Each location sits on its
// tile as VARIA's tools/autotracker/data.js places it (the room's place on
// VARIA's map plus the item's PLM position / 16), but for Crateria's own
// rooms, which VARIA's data puts one tile right of its map (mapsOffsets
// (6, 0) where the map has (7, 0)). Locations on one tile share a marker.
// Positions are percents of the image.
import HYRULE from "./markers-hyrule.json";
import ZEBES from "./markers-zebes.json";

/** A marker of one of SMZ3's maps: where it sits, what it stands for. */
export interface Smz3Marker {
  /** Zebes's: its first location's id; Hyrule's: the ALttPR marker's. */
  readonly id: string;
  /** Its name: Zebes's, its locations' upstream names, joined. */
  readonly name: string;
  /** Percents of its map's image (of its world's, for Hyrule's). */
  readonly x: number;
  readonly y: number;
  readonly locations: readonly string[];
}

/** Zebes's markers: the locations on each tile. */
export const ZEBES_MARKERS: readonly Smz3Marker[] = ZEBES.map(
  ({ locations, names, x, y }) => ({
    id: locations[0] ?? "",
    locations,
    name: names.join(" · "),
    x,
    y,
  }),
);

/**
 * A Link to the Past's locations SMZ3 names otherwise than the ALttPR pack
 * (its ids are those of vt v31's names): the bosses by their name, Cave 45
 * as South of Grove, Castle Tower's first room as its foyer. Every other
 * Zelda location has the ALttPR pack's id, so its markers and memory flags
 * serve SMZ3 as they are.
 */
export const ZELDA_ALIASES: Readonly<Record<string, string>> = {
  "castle-tower/foyer": "castle-tower/room-03",
  "desert-palace/lanmolas": "desert-palace/boss",
  "eastern-palace/armos-knights": "eastern-palace/boss",
  "ice-palace/kholdstare": "ice-palace/boss",
  "misery-mire/vitreous": "misery-mire/boss",
  "palace-of-darkness/helmasaur-king": "palace-of-darkness/boss",
  "skull-woods/mothula": "skull-woods/boss",
  "south-of-grove": "cave-45",
  "swamp-palace/arrghus": "swamp-palace/boss",
  "thieves-town/blind": "thieves-town/boss",
  "tower-of-hera/moldorm": "tower-of-hera/boss",
  "turtle-rock/trinexx": "turtle-rock/boss",
};

/** Hyrule's markers, by world (markers-hyrule.json). */
export const HYRULE_MARKERS: Readonly<
  Record<"light" | "dark", readonly Smz3Marker[]>
> = HYRULE;
