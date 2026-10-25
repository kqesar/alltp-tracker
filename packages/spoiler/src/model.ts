/** The games whose spoiler logs the tracker can read. */
export type SpoilerGame = "alttpr" | "sm" | "smz3";

/** The file layouts a pack reads. */
export type SpoilerFormat =
  | "vt"
  | "er"
  | "smz3-yaml"
  | "smz3-api"
  | "map-rando";

/** One location and what it held. */
export interface Placement {
  /** The location's key: the pack's id (alttpr, smz3), `<room_id>:<node_id>` (Map Rando). */
  readonly location: string;
  /** Its name as the randomizer writes it (Map Rando: "<room>: <node>"). */
  readonly locationName: string;
  /** A grouping the file gives (Map Rando's area, SMZ3's region), or null. */
  readonly area: string | null;
  /** The pack's item id, or null for an item the pack has none for (rupees, arrows...). */
  readonly item: string | null;
  /** The item's name as the randomizer writes it, for display. */
  readonly itemName: string;
  /** The playthrough step it sits in (sphere or Map Rando step, from 1), or null. */
  readonly sphere: number | null;
}

/** What a pack's parser returns: one shape for every randomizer. */
export interface SpoilerLog<Extra = unknown> {
  readonly game: SpoilerGame;
  readonly format: SpoilerFormat;
  /** The seed's id where the file states one: in its content, or in its name. */
  readonly seed: {
    readonly id: string | null;
    readonly from: "content" | "file-name" | null;
  };
  readonly placements: readonly Placement[];
  /** How many spheres the playthrough has; 0 when the file has none (a spoiler race's). */
  readonly spheres: number;
  /** Starting items, by name (ALttPR's Equipped). */
  readonly start: readonly string[];
  /** Names in the file the pack does not know and skipped (ALttPR's events), for the dialog. */
  readonly skipped: readonly string[];
  /** The game's own facts, typed by its pack: settings, medallions, prizes, objectives... */
  readonly extra: Extra;
}
