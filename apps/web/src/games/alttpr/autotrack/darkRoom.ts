// The dark room plan's words and shapes, pure: what each tile kind is called,
// the sentence that says where the nearest chest is, and the SVG path that
// draws every tile of a kind. The decoding is the pack's (`decodeDarkRoom`);
// nothing here reads memory.

import {
  ROOM_TILES,
  TILE,
  type TileBox,
  type TileKind,
} from "@alltp/pack-alttpr";

/** What each kind of tile is called, in the legend and in the words. */
export const KIND_NAMES: Readonly<Record<TileKind, string>> = {
  [TILE.block]: "Block",
  [TILE.bigKeyLock]: "Big key lock",
  [TILE.chest]: "Chest",
  [TILE.chestOpen]: "Opened chest",
  [TILE.conveyor]: "Conveyor",
  [TILE.door]: "Closed door",
  [TILE.doorBomb]: "Bombable wall",
  [TILE.doorKey]: "Key door",
  [TILE.doorShutter]: "Shutter door",
  [TILE.doorway]: "Open doorway",
  [TILE.exit]: "Exit",
  [TILE.floor]: "Floor",
  [TILE.hazard]: "Spikes",
  [TILE.ice]: "Ice",
  [TILE.ledge]: "Ledge",
  [TILE.object]: "Liftable object",
  [TILE.peg]: "Peg",
  [TILE.pit]: "Pit",
  [TILE.pot]: "Pot",
  [TILE.slope]: "Diagonal wall",
  [TILE.stairs]: "Stairs",
  [TILE.torchLit]: "Lit torch",
  [TILE.torchUnlit]: "Unlit torch",
  [TILE.unknown]: "Other",
  [TILE.wall]: "Wall",
  [TILE.water]: "Water",
};

/** The legend's order: the room's shape, then what is in it. */
export const LEGEND_ORDER: readonly TileKind[] = [
  TILE.floor,
  TILE.wall,
  TILE.slope,
  TILE.doorway,
  TILE.exit,
  TILE.stairs,
  TILE.pit,
  TILE.water,
  TILE.ice,
  TILE.hazard,
  TILE.ledge,
  TILE.conveyor,
  TILE.chest,
  TILE.bigKeyLock,
  TILE.chestOpen,
  TILE.door,
  TILE.doorKey,
  TILE.doorBomb,
  TILE.doorShutter,
  TILE.torchUnlit,
  TILE.torchLit,
  TILE.pot,
  TILE.block,
  TILE.object,
  TILE.peg,
  TILE.unknown,
];

/** The kinds that appear inside `bounds`, in the legend's order. */
export function kindsIn(kinds: Uint8Array, bounds: TileBox): TileKind[] {
  const seen = new Set<number>();
  for (let y = bounds.y0; y <= bounds.y1; y++) {
    for (let x = bounds.x0; x <= bounds.x1; x++) {
      seen.add(kinds[y * ROOM_TILES + x]);
    }
  }
  return LEGEND_ORDER.filter((kind) => seen.has(kind));
}

/**
 * The path that fills every tile of `kind` inside `bounds`, one rectangle per
 * horizontal run, in tile units: a few dozen segments instead of a thousand
 * elements.
 */
export function pathOf(
  kinds: Uint8Array,
  bounds: TileBox,
  kind: TileKind,
): string {
  const parts: string[] = [];
  for (let y = bounds.y0; y <= bounds.y1; y++) {
    let x = bounds.x0;
    while (x <= bounds.x1) {
      if (kinds[y * ROOM_TILES + x] !== kind) {
        x++;
        continue;
      }
      const start = x;
      while (x <= bounds.x1 && kinds[y * ROOM_TILES + x] === kind) x++;
      parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
    }
  }
  return parts.join("");
}

const tiles = (count: number) => `${count} ${count === 1 ? "tile" : "tiles"}`;

/** "6 tiles left, 3 up", or where Link already stands. */
export function directionWords(dx: number, dy: number): string {
  const parts: string[] = [];
  if (dx !== 0)
    parts.push(`${tiles(Math.abs(dx))} ${dx < 0 ? "left" : "right"}`);
  if (dy !== 0) parts.push(`${tiles(Math.abs(dy))} ${dy < 0 ? "up" : "down"}`);
  return parts.length === 0 ? "right where you stand" : parts.join(", ");
}

/**
 * The room in a sentence: the nearest chest not opened yet, as tiles to the
 * left or right and up or down from Link, and how many torches are not lit.
 * Distances are between the middle of Link's footprint and the middle of the
 * chest's, in 8-pixel tiles.
 */
export function roomWords(
  room: {
    readonly chests: readonly TileBox[];
    readonly torches: { readonly total: number; readonly unlit: number };
  },
  link: { readonly x: number; readonly y: number },
): string {
  const cx = link.x + 1;
  const cy = link.y + 1;
  let best: { dx: number; dy: number } | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const chest of room.chests) {
    const dx = (chest.x0 + chest.x1 + 1) / 2 - cx;
    const dy = (chest.y0 + chest.y1 + 1) / 2 - cy;
    const d = dx * dx + dy * dy;
    if (d < distance) {
      distance = d;
      best = { dx: Math.round(dx), dy: Math.round(dy) };
    }
  }
  const chest =
    best === null
      ? "No unopened chest in this room."
      : `Nearest unopened chest: ${directionWords(best.dx, best.dy)}.`;
  const { total, unlit } = room.torches;
  if (total === 0) return chest;
  let torches: string;
  if (unlit > 0) {
    torches = `${unlit} of ${total} ${total === 1 ? "torch" : "torches"} not lit.`;
  } else {
    torches =
      total === 1 ? "The torch is lit." : `All ${total} torches are lit.`;
  }
  return `${chest} ${torches}`;
}
