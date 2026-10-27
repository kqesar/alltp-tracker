// The dark room map: what a dungeon room looks like to the game's collision
// (its 64 x 64 attribute table, one byte per 8 x 8 px tile), classified into a
// handful of kinds a schematic can draw, with Link's place in it.
//
// Pure and total, like the other decoders: any bytes decode, none throw. Not a
// reading of the run (`readMemory` never calls it): the app keeps it apart, in
// memory, and shows it while the room is dark and Link has no Lamp. In Race
// Mode it is null before any range is asked for: the ranges' category,
// `navigation`, is not permitted (`race-profile.ts`).
//
// Every address and value is read from the game's decompilation
// (MEMORY_SOURCES.zelda3), cited where it is used. `g_ram + N` is $7E:0000 + N.

import { darkRoomHeld } from "./dark-room-gate";
import type { MemoryView } from "./decode";
import { MEMORY_RANGE } from "./memory";

/** The kinds of tile the schematic draws. */
export const TILE = {
  bigKeyLock: 11,
  block: 14,
  chest: 9,
  chestOpen: 10,
  conveyor: 13,
  door: 18,
  doorBomb: 20,
  doorKey: 19,
  doorShutter: 21,
  doorway: 17,
  exit: 22,
  floor: 0,
  hazard: 3,
  ice: 4,
  ledge: 8,
  object: 16,
  peg: 12,
  pit: 7,
  pot: 15,
  slope: 5,
  stairs: 6,
  torchLit: 23,
  torchUnlit: 24,
  unknown: 25,
  wall: 1,
  water: 2,
} as const;

export type TileKind = (typeof TILE)[keyof typeof TILE];

/** Tiles to a side: a room is 512 px, 64 tiles of 8. */
export const ROOM_TILES = 64;

/** A box of tiles, ends included. */
export interface TileBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** The way Link faces ($2F: 0, 2, 4, 6). */
export type Facing = "up" | "down" | "left" | "right";

/**
 * The sword's charge while B is held ($79, player.c:2197-2242): it counts up
 * from the swing, and at 48 a spin attack is ready.
 */
export type SwordCharge = "none" | "charging" | "charged";

/** The count at which the spin attack is ready (player.c:2240). */
export const SPIN_READY = 48;

/** Where Link is and how he stands. */
export interface LinkPlace {
  /** His footprint's top left, in tiles. */
  readonly x: number;
  readonly y: number;
  /** Null while its byte is unread. */
  readonly facing: Facing | null;
  readonly charge: SwordCharge;
}

/** A closed chest: the box of its tiles. */
export interface ChestSpot extends TileBox {
  /** The big chest, which is wider than the others. */
  readonly big: boolean;
}

export interface DarkRoomReading {
  /** The room's id (dungeon_room_index). */
  readonly room: number;
  /** The attribute table the tiles come from: Link's layer in a layered room. */
  readonly layer: 0 | 1;
  /** Link's footprint, the 2 x 2 tiles he collides with, and his stance. */
  readonly link: LinkPlace;
  /** Each tile's kind (`TILE`), row by row. */
  readonly kinds: Uint8Array;
  /** The attribute bytes as the game holds them, for a value no kind names. */
  readonly raw: Uint8Array;
  /** What is worth drawing: the tiles that are not wall, and Link, margin kept. */
  readonly bounds: TileBox;
  /** Chests not opened yet, in the order of the game's chest list. */
  readonly chests: readonly ChestSpot[];
  /** Torches in the room, and how many are not lit. */
  readonly torches: { readonly total: number; readonly unlit: number };
}

/** The bytes of a navigation range, by A-bus address. */
function reader(view: MemoryView, id: keyof typeof MEMORY_RANGE) {
  if (!view.has(id)) return null;
  const bytes = view.bytes(id);
  const { bus } = MEMORY_RANGE[id];
  const byte = (at: number) => bytes[at - bus] ?? 0;
  return { byte, word: (at: number) => byte(at) | (byte(at + 1) << 8) };
}

/**
 * Link's footprint: x from X to X + 15, y from Y + 8 to Y + 23, in the room's
 * own pixels (X and Y are absolute in the dungeon's grid; & $1FF is inside
 * the room: dungeon.c:6436-6437, tile_detect.c:7-10).
 */
export function linkTile(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min((x & 0x1ff) >> 3, ROOM_TILES - 2),
    y: Math.min(((y & 0x1ff) + 8) >> 3, ROOM_TILES - 2),
  };
}

const FACINGS: readonly Facing[] = ["up", "down", "left", "right"];

/** The way Link faces, from $2F, or null for a value it never holds. */
export function facingOf(value: number): Facing | null {
  return (value & 1) === 0 && value < 8 ? FACINGS[value >> 1] : null;
}

/** The sword's charge, from $79. */
export function chargeOf(value: number): SwordCharge {
  return value === 0 ? "none" : value >= SPIN_READY ? "charged" : "charging";
}

/** What a closed door (F0-FF) is, from its type (dungeon.h:6-36). */
function doorKind(type: number): TileKind {
  switch (type) {
    case 0x1c: // kDoorType_SmallKeyDoor
      return TILE.doorKey;
    case 0x28: // BreakableWall
    case 0x30: // LgExplosion
      return TILE.doorBomb;
    case 0x18: // ShuttersTwoWay
    case 0x44: // Shutter
    case 0x48: // ShutterTrapUR
    case 0x4a: // ShutterTrapDL
      return TILE.doorShutter;
    default:
      return TILE.door;
  }
}

/** How a value of the attribute table reads (tile_detect.c:256-500, dungeon.c). */
interface Objects {
  /** A replaceable object (70-7F)'s kind, by its slot (dungeon.c:3999-4006). */
  object(slot: number): TileKind;
  /** Whether a torch (C0-CF) is lit, by its slot (misc.c:470-480). */
  lit(slot: number): boolean;
  /** A closed door's (F0-FF) kind, by its slot (dungeon.c:4120-4135). */
  door(slot: number): TileKind;
  /** Whether chest `index` (58-5D) is in fact a big key lock (dungeon.c:4020-4048). */
  lock(index: number): boolean;
}

export function tileKind(value: number, objects: Objects): TileKind {
  if (value >= 0xf0) return objects.door(value & 0xf);
  if (value >= 0xc0 && value <= 0xcf) {
    return objects.lit(value & 0xf) ? TILE.torchLit : TILE.torchUnlit;
  }
  if (value >= 0xb0 && value <= 0xbd) return TILE.pit;
  if (value === 0x8e || value === 0x8f) return TILE.exit;
  if (value >= 0x80 && value <= 0xaf) return TILE.doorway;
  if (value >= 0x70 && value <= 0x7f) return objects.object(value & 0xf);
  switch (value) {
    case 0x00:
    case 0x1c: // the overlay mask: junk in a single-layer room
    case 0x48: // diggable ground
    case 0x4a:
    case 0x60: // a rupee tile
    case 0x66: // a crystal peg, down
      return TILE.floor;
    case 0x08:
    case 0x09:
      return TILE.water;
    case 0x0d:
    case 0x44:
      return TILE.hazard;
    case 0x0e:
    case 0x0f:
      return TILE.ice;
    case 0x20:
      return TILE.pit;
    case 0x22:
      return TILE.stairs;
    case 0x27:
      return TILE.chestOpen;
    case 0x63:
      return TILE.chest;
    case 0x67:
      return TILE.peg;
    default:
  }
  if (value >= 0x58 && value <= 0x5d) {
    return objects.lock(value - 0x58) ? TILE.bigKeyLock : TILE.chest;
  }
  if (value === 0x5e || value === 0x5f) return TILE.stairs;
  if (value >= 0x68 && value <= 0x6b) return TILE.conveyor;
  if (value >= 0x28 && value <= 0x2f) return TILE.ledge;
  if ((value >= 0x10 && value <= 0x13) || (value >= 0x18 && value <= 0x1b)) {
    return TILE.slope;
  }
  if (
    (value >= 0x1d && value <= 0x1f) ||
    (value >= 0x30 && value <= 0x39) ||
    (value >= 0x3d && value <= 0x3f)
  ) {
    return TILE.stairs;
  }
  if (
    (value >= 0x01 && value <= 0x04) ||
    value === 0x0b ||
    value === 0x26 ||
    value === 0x43 ||
    value === 0x46 ||
    (value >= 0x50 && value <= 0x57) ||
    (value >= 0x6c && value <= 0x6f)
  ) {
    return TILE.wall;
  }
  return TILE.unknown;
}

/**
 * The box of the tiles that are not wall and join Link's footprint (or the
 * walkable tile nearest to it when he stands in wall), or null when the
 * whole table is wall.
 */
function reachable(
  kinds: Uint8Array,
  link: { readonly x: number; readonly y: number },
): TileBox | null {
  const seen = new Uint8Array(kinds.length);
  const stack: number[] = [];
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const i = (link.y + dy) * ROOM_TILES + link.x + dx;
    if (kinds[i] !== TILE.wall && seen[i] === 0) {
      seen[i] = 1;
      stack.push(i);
    }
  }
  if (stack.length === 0) {
    // Link stands in wall (the bed, a doorway's frame): start from the
    // walkable tile nearest to him
    let nearest = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < kinds.length; i++) {
      if (kinds[i] === TILE.wall) continue;
      const d = Math.abs((i & 63) - link.x) + Math.abs((i >> 6) - link.y);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    if (nearest < 0) return null;
    seen[nearest] = 1;
    stack.push(nearest);
  }
  let x0 = ROOM_TILES;
  let y0 = ROOM_TILES;
  let x1 = -1;
  let y1 = -1;
  for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
    const x = top & 63;
    const y = top >> 6;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    const around = [
      x > 0 ? top - 1 : -1,
      x < ROOM_TILES - 1 ? top + 1 : -1,
      y > 0 ? top - ROOM_TILES : -1,
      y < ROOM_TILES - 1 ? top + ROOM_TILES : -1,
    ];
    for (const next of around) {
      if (next < 0 || seen[next] === 1 || kinds[next] === TILE.wall) continue;
      seen[next] = 1;
      stack.push(next);
    }
  }
  return { x0, x1, y0, y1 };
}

/**
 * Decodes the room, or null when it is not to be shown: Race Mode, or the
 * conditions of `darkRoomHeld` do not hold (not a dark room, the Lamp held, out
 * of a dungeon), or a range is unread. A menu or a text box over the room
 * leaves it as it was.
 */
export function decodeDarkRoom(
  view: MemoryView,
  options: { readonly race: boolean },
): DarkRoomReading | null {
  if (options.race || !darkRoomHeld(view)) return null;
  if (!view.has("dark-room-map")) return null;
  const mode = reader(view, "dark-room-mode");
  const at = reader(view, "dark-room-link");
  const room = reader(view, "dark-room-room");
  const layerByte = reader(view, "dark-room-layer");
  const lights = reader(view, "dark-room-lights");
  const objects = reader(view, "dark-room-objects");
  const chestWords = reader(view, "dark-room-chests");
  const doors = reader(view, "dark-room-doors");
  if (
    mode === null ||
    at === null ||
    room === null ||
    layerByte === null ||
    lights === null ||
    objects === null ||
    chestWords === null ||
    doors === null
  ) {
    return null;
  }
  // dung_hdr_collision ($046C): 0 is one layer, in the first table; 1 and up
  // make Link collide with both, and $EE says which he stands on
  // (player.c:4033-4045, tile_detect.c:240-251)
  const collision = lights.byte(0x7e_046c);
  const layer = collision !== 0 && layerByte.byte(0x7e_00ee) === 1 ? 1 : 0;
  const map = view.bytes("dark-room-map");
  const size = ROOM_TILES * ROOM_TILES;
  const raw = Uint8Array.from(map.subarray(layer * size, (layer + 1) * size));

  // Where the torches' words start in the objects' arrays ($0478, bytes)
  const torchStart = lights.word(0x7e_0478);
  const state: Objects = {
    door: (slot) => doorKind(doors.byte(0x7e_1980 + slot * 2) & 0xfe),
    lit: (slot) =>
      (objects.word(0x7e_0540 + torchStart + slot * 2) & 0x8000) !== 0,
    lock: (index) =>
      index < 16 && (chestWords.word(0x7e_06e0 + index * 2) & 0x8000) !== 0,
    // $0500: 0000 a block you push, 1111 a pot, anything else another object
    // (a hammer peg, a liftable gray block: dungeon.c:3583-3641)
    object: (slot) => {
      const kind = objects.word(0x7e_0500 + slot * 2);
      return kind === 0 ? TILE.block : kind === 0x1111 ? TILE.pot : TILE.object;
    },
  };

  const kinds = new Uint8Array(size);
  let x0 = ROOM_TILES;
  let y0 = ROOM_TILES;
  let x1 = -1;
  let y1 = -1;
  const torches = new Set<number>();
  const unlit = new Set<number>();
  const chestBoxes = new Map<
    number,
    { -readonly [K in keyof TileBox]: number }
  >();
  for (let i = 0; i < size; i++) {
    const value = raw[i];
    const kind = tileKind(value, state);
    kinds[i] = kind;
    const x = i & 63;
    const y = i >> 6;
    if (kind !== TILE.wall) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (kind === TILE.torchLit || kind === TILE.torchUnlit) {
      torches.add(value);
      if (kind === TILE.torchUnlit) unlit.add(value);
    } else if (kind === TILE.chest) {
      const box = chestBoxes.get(value);
      if (box === undefined)
        chestBoxes.set(value, { x0: x, x1: x, y0: y, y1: y });
      else {
        box.x0 = Math.min(box.x0, x);
        box.x1 = Math.max(box.x1, x);
        box.y0 = Math.min(box.y0, y);
        box.y1 = Math.max(box.y1, y);
      }
    }
  }

  const tile = linkTile(at.word(0x7e_0022), at.word(0x7e_0020));
  // The stance is read with the place; a recording older than its ranges has
  // neither
  const facing = reader(view, "dark-room-facing");
  const charge = reader(view, "dark-room-charge");
  const link: LinkPlace = {
    ...tile,
    charge: charge === null ? "none" : chargeOf(charge.byte(0x7e_0079)),
    facing: facing === null ? null : facingOf(facing.byte(0x7e_002f)),
  };
  // The part of the table worth drawing is what Link can reach through tiles
  // that are not wall: a room is one quadrant of the 64 x 64 space, or two,
  // and the rest holds floor and walls the room never uses. With no way out
  // of walls (Link in the bed), what is not wall at all.
  const region = reachable(kinds, link);
  if (region !== null) {
    x0 = region.x0;
    y0 = region.y0;
    x1 = region.x1;
    y1 = region.y1;
  }
  x0 = Math.min(x0, link.x);
  y0 = Math.min(y0, link.y);
  x1 = Math.max(x1, link.x + 1);
  y1 = Math.max(y1, link.y + 1);
  // A little wall around what can be walked, so the room reads as a room
  const bounds: TileBox = {
    x0: Math.max(0, x0 - 1),
    x1: Math.min(ROOM_TILES - 1, x1 + 1),
    y0: Math.max(0, y0 - 1),
    y1: Math.min(ROOM_TILES - 1, y1 + 1),
  };
  const chests = [...chestBoxes.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, box]) => ({ ...box, big: box.x1 - box.x0 > 1 }));
  return {
    bounds,
    chests,
    kinds,
    layer,
    link,
    raw,
    room: room.word(0x7e_00a0) & 0x1ff,
    torches: { total: torches.size, unlit: unlit.size },
  };
}
