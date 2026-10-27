// The dark room in the game's own graphics: the room as the game would draw
// it lit, rebuilt from the running game's tilemaps and palettes (WRAM) and the
// tile sheets of the player's own ROM, with Link as the game draws him (his
// sprites in the OAM buffer, from the graphics the NMI copies each frame).
//
// Pure and total: functions over bytes the app read, none of which ships with
// the tracker. Nothing here reads memory or keeps state (dark-room-art-loader
// does both); every address is read from the game's decompilation
// (MEMORY_SOURCES.zelda3) or, for the ROM's tables, from the JP 1.0 ROM's code
// that ALttPR is built on, and cited where it is used.

import { ROOM_TILES } from "./dark-room";

/** A room is 64 tiles of 8 px a side. */
export const ROOM_PX = ROOM_TILES * 8;

/**
 * The ROM's tables the game rebuilds a room's graphics from, as A-bus
 * addresses of the JP 1.0 ROM (zelda3 names them from the US ROM, whose bank
 * $00 is laid out otherwise). The base patch reads the same three pointer
 * tables (z3 decompresseditemgraphics.asm:251-253).
 */
export const ART_ROM = {
  /** Aux blocksets, 4 sheets a row, rows 0-80 (zelda3 kAuxTilesets). */
  auxTilesets: 0x00_ddd7,
  /** The code that reads the pointer tables (`$00:E7CF`, Decomp_bg). */
  guard: 0x00_e7cf,
  /** Main blocksets, 8 sheets a row, rows 0-34 (zelda3 kMainTilesets). */
  mainTilesets: 0x00_e0b3,
  /** The sheets' pointers: banks, then high bytes, then low bytes. */
  sheetPointers: 0x00_cfc0,
} as const;

/** Entries of each pointer table: BG sheets $00-$72, sprite sheets after. */
export const SHEETS = 223;
export const AUX_ROWS = 81;
export const MAIN_ROWS = 35;

/**
 * The guard: `LDA $CFC0,Y : STA $CA : LDA $D09F,Y : STA $C9 : LDA $D17E,Y :
 * STA $C8`, the game's own reads of the pointer tables. Other bytes there mean
 * another base patch, whose tables may lie elsewhere: the plan is shown then.
 */
export const GUARD = Uint8Array.of(
  0xb9,
  0xc0,
  0xcf,
  0x85,
  0xca,
  0xb9,
  0x9f,
  0xd0,
  0x85,
  0xc9,
  0xb9,
  0x7e,
  0xd1,
  0x85,
  0xc8,
);

/**
 * Bytes read for one compressed sheet. A BG sheet unpacks to 0x600 bytes;
 * its stream, even as literals alone, is at most 0x600 bytes plus a command
 * byte per 32 and the end mark (0x631).
 */
export const SHEET_WINDOW = 0x640;

/** What a BG sheet unpacks to: 64 tiles of 3 bpp. */
export const SHEET_BYTES = 0x600;

/**
 * Unpacks the game's LZ format (Decompress, load_gfx.c:1007-1055): a command
 * byte, length in its low 5 bits (or 10 with the $E0 form), then a literal
 * run, a byte fill, a word fill, an incrementing fill or a copy from an
 * earlier offset of the output (16 bits, little-endian); $FF ends it. Null
 * when the stream runs off `src`, copies from ahead, or grows past `limit`.
 */
export function decompress(src: Uint8Array, limit = 0x1000): Uint8Array | null {
  const out = new Uint8Array(limit);
  let n = 0;
  let i = 0;
  const next = () => (i < src.length ? src[i++] : -1);
  for (;;) {
    const c = next();
    if (c < 0) return null;
    if (c === 0xff) return out.slice(0, n);
    let length: number;
    let command: number;
    if ((c & 0xe0) !== 0xe0) {
      length = (c & 0x1f) + 1;
      command = c & 0xe0;
    } else {
      const low = next();
      if (low < 0) return null;
      length = (((c & 3) << 8) | low) + 1;
      command = (c << 3) & 0xe0;
    }
    if (n + length > limit) return null;
    if (command === 0) {
      if (i + length > src.length) return null;
      out.set(src.subarray(i, i + length), n);
      i += length;
      n += length;
    } else if (command & 0x80) {
      const lo = next();
      const hi = next();
      if (hi < 0) return null;
      let from = lo | (hi << 8);
      for (let k = 0; k < length; k++) {
        if (from >= n) return null;
        out[n++] = out[from++];
      }
    } else if (command === 0x20) {
      const value = next();
      if (value < 0) return null;
      out.fill(value, n, n + length);
      n += length;
    } else if (command === 0x40) {
      const lo = next();
      const hi = next();
      if (hi < 0) return null;
      for (let k = 0; k < length; k++) out[n++] = k % 2 === 0 ? lo : hi;
    } else {
      const value = next();
      if (value < 0) return null;
      for (let k = 0; k < length; k++) out[n++] = (value + k) & 0xff;
    }
  }
}

/** Pixels per tile; tiles are kept as 64 colour indices, row by row. */
const TILE_PX = 64;

/**
 * A 3 bpp sheet's 64 tiles as colour indices (Do3To4High/Low,
 * load_gfx.c:938-960): 16 bytes of planes 0 and 1, then 8 of plane 2. A
 * "high" sheet sets plane 3 on every pixel that is not 0, so 1-7 read 9-15.
 */
export function sheetTiles(sheet: Uint8Array, high: boolean): Uint8Array {
  const out = new Uint8Array(64 * TILE_PX);
  for (let t = 0; t < 64; t++) {
    const base = t * 24;
    for (let r = 0; r < 8; r++) {
      const p0 = sheet[base + 2 * r] ?? 0;
      const p1 = sheet[base + 2 * r + 1] ?? 0;
      const p2 = sheet[base + 16 + r] ?? 0;
      for (let c = 0; c < 8; c++) {
        const bit = 7 - c;
        const v =
          ((p0 >> bit) & 1) |
          (((p1 >> bit) & 1) << 1) |
          (((p2 >> bit) & 1) << 2);
        out[t * TILE_PX + r * 8 + c] = high && v !== 0 ? v + 8 : v;
      }
    }
  }
  return out;
}

/** 4 bpp tiles (32 bytes each, as VRAM holds them) as colour indices. */
export function tiles4bpp(data: Uint8Array): Uint8Array {
  const count = data.length >> 5;
  const out = new Uint8Array(count * TILE_PX);
  for (let t = 0; t < count; t++) {
    const base = t * 32;
    for (let r = 0; r < 8; r++) {
      const p0 = data[base + 2 * r];
      const p1 = data[base + 2 * r + 1];
      const p2 = data[base + 16 + 2 * r];
      const p3 = data[base + 17 + 2 * r];
      for (let c = 0; c < 8; c++) {
        const bit = 7 - c;
        out[t * TILE_PX + r * 8 + c] =
          ((p0 >> bit) & 1) |
          (((p1 >> bit) & 1) << 1) |
          (((p2 >> bit) & 1) << 2) |
          (((p3 >> bit) & 1) << 3);
      }
    }
  }
  return out;
}

/** The ROM's tables, as read once per ROM. */
export interface ArtTables {
  /** `SHEETS` banks, then highs, then lows. */
  readonly pointers: Uint8Array;
  readonly aux: Uint8Array;
  readonly main: Uint8Array;
}

/**
 * The eight BG sheets of a room, in VRAM order from word $2000
 * (InitializeTilesets, load_gfx.c:814-844): main 0-2, aux 0-3 where not 0
 * (else main 3-6), main 7. Null for a blockset past the tables.
 */
export function sheetSlots(
  tables: ArtTables,
  main: number,
  aux: number,
): number[] | null {
  if (main >= MAIN_ROWS || aux >= AUX_ROWS) return null;
  const m = tables.main.subarray(main * 8, main * 8 + 8);
  const a = tables.aux.subarray(aux * 4, aux * 4 + 4);
  if (m.length < 8 || a.length < 4) return null;
  return [
    m[0],
    m[1],
    m[2],
    a[0] || m[3],
    a[1] || m[4],
    a[2] || m[5],
    a[3] || m[6],
    m[7],
  ];
}

/**
 * A sheet's A-bus address from the pointer tables, or null outside the ROM's
 * upper half of a bank. The bank byte carries the base patch's FastROM bit
 * ($80), which the address keeps: it reads the same ROM.
 */
export function sheetAddress(tables: ArtTables, sheet: number): number | null {
  if (sheet >= SHEETS) return null;
  const { pointers } = tables;
  const address =
    (pointers[sheet] << 16) |
    (pointers[SHEETS + sheet] << 8) |
    pointers[2 * SHEETS + sheet];
  return (address & 0x8000) !== 0 && (address & 0x7f_0000) < 0x40_0000
    ? address
    : null;
}

/**
 * Whether VRAM sheet `slot` (0-7) is expanded "high": in a dungeon (main
 * blockset below $20) the first four (LoadBackgroundGraphics,
 * load_gfx.c:971-977).
 */
export function highSlot(slot: number, main: number): boolean {
  const from = 7 - slot;
  return main >= 0x20 ? [7, 2, 3, 4].includes(from) : from >= 4;
}

/** The 256 colours of a BGR555 palette buffer, as 0xAABBGGRR words. */
export function paletteColours(bytes: Uint8Array): Uint32Array {
  const out = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const w = (bytes[2 * i] ?? 0) | ((bytes[2 * i + 1] ?? 0) << 8);
    const r = w & 31;
    const g = (w >> 5) & 31;
    const b = (w >> 10) & 31;
    const r8 = (r << 3) | (r >> 2);
    const g8 = (g << 3) | (g >> 2);
    const b8 = (b << 3) | (b >> 2);
    out[i] = (0xff << 24) | (b8 << 16) | (g8 << 8) | r8;
  }
  return out;
}

/** The first BG tile of the animated frame (VRAM word $3B00: tile 432). */
export const ANIMATED_TILE = (0x3b00 - 0x2000) / 16;
/** Bytes of the animated frame: 32 tiles of 4 bpp. */
export const ANIMATED_BYTES = 0x400;

/**
 * The 512 BG tiles a room's tilemap names: the eight sheets, then the
 * animated frame over tiles 432-463 (load_gfx.c:501-516, nmi.c:204).
 */
export function backgroundTiles(
  sheets: readonly Uint8Array[],
  main: number,
  animated: Uint8Array | null,
): Uint8Array {
  const out = new Uint8Array(512 * TILE_PX);
  sheets.forEach((sheet, slot) => {
    const tiles =
      sheet.length >= SHEET_BYTES
        ? sheetTiles(sheet, highSlot(slot, main))
        : tiles4bpp(sheet.subarray(0, 0x800)).subarray(0, 64 * TILE_PX);
    out.set(tiles.subarray(0, 64 * TILE_PX), slot * 64 * TILE_PX);
  });
  if (animated !== null) {
    out.set(tiles4bpp(animated), ANIMATED_TILE * TILE_PX);
  }
  return out;
}

/**
 * Draws one priority of a tilemap (64 x 64 SNES entries `vhopppcc
 * cccccccc`, row-major) into `into`, 512 x 512 0xAABBGGRR pixels: colour 0 is
 * transparent, a tile past the 512 loaded draws nothing.
 */
function drawLayer(
  into: Uint32Array,
  tilemap: Uint8Array,
  tiles: Uint8Array,
  colours: Uint32Array,
  priority: 0 | 1,
): void {
  for (let ty = 0; ty < ROOM_TILES; ty++) {
    for (let tx = 0; tx < ROOM_TILES; tx++) {
      const at = 2 * (ty * ROOM_TILES + tx);
      const entry = tilemap[at] | (tilemap[at + 1] << 8);
      if (((entry >> 13) & 1) !== priority) continue;
      const tile = entry & 0x3ff;
      if (tile >= 512) continue;
      const base = ((entry >> 10) & 7) * 16;
      const flipX = (entry & 0x4000) !== 0;
      const flipY = (entry & 0x8000) !== 0;
      const from = tile * TILE_PX;
      for (let r = 0; r < 8; r++) {
        const row = (flipY ? 7 - r : r) * 8;
        const line = (ty * 8 + r) * ROOM_PX + tx * 8;
        for (let c = 0; c < 8; c++) {
          const v = tiles[from + row + (flipX ? 7 - c : c)];
          if (v !== 0) into[line + c] = colours[base + v];
        }
      }
    }
  }
}

/**
 * The room as the game would draw it lit: the backdrop colour, then BG2 and,
 * when the main screen shows it, BG1, in mode 1's order (BG2 low, BG1 low,
 * BG2 high, BG1 high). 512 x 512 pixels, 0xAABBGGRR. BG1 is drawn opaque, not
 * blended: a translucent layer is approximated.
 */
export function renderBackground(input: {
  readonly bg2: Uint8Array;
  readonly bg1: Uint8Array | null;
  readonly tiles: Uint8Array;
  readonly colours: Uint32Array;
}): Uint32Array {
  const { bg1, bg2, colours, tiles } = input;
  const into = new Uint32Array(ROOM_PX * ROOM_PX).fill(colours[0]);
  drawLayer(into, bg2, tiles, colours, 0);
  if (bg1 !== null) drawLayer(into, bg1, tiles, colours, 0);
  drawLayer(into, bg2, tiles, colours, 1);
  if (bg1 !== null) drawLayer(into, bg1, tiles, colours, 1);
  return into;
}

/**
 * What the NMI copies to sprite VRAM each frame for Link (NMI_DoUpdates,
 * nmi.c:172-199): the source's word in `dark-room-art-sprites`, from $0AA1
 * range ($0AA1 on; null for a fixed WRAM source), the fixed source, the VRAM
 * word it lands at and its size. Body parts come from ROM (the bank at $BC),
 * the rest from WRAM.
 */
export const LINK_UPLOADS: readonly {
  readonly word: number | null;
  readonly fixed: number;
  readonly vram: number;
  readonly size: number;
  readonly rom: boolean;
}[] = [
  // Link's body: ROM (kLinkGraphics, the bank the base patch keeps at $BC)
  { fixed: 0, rom: true, size: 0x40, vram: 0x4100, word: 0x0ace },
  { fixed: 0, rom: true, size: 0x40, vram: 0x4120, word: 0x0ad2 },
  { fixed: 0, rom: true, size: 0x20, vram: 0x4140, word: 0x0ad6 },
  { fixed: 0, rom: true, size: 0x40, vram: 0x4000, word: 0x0acc },
  { fixed: 0, rom: true, size: 0x40, vram: 0x4020, word: 0x0ad0 },
  { fixed: 0, rom: true, size: 0x20, vram: 0x4040, word: 0x0ad4 },
  // His sword, shield and items: WRAM, decompressed there on load
  { fixed: 0, rom: false, size: 0x40, vram: 0x4050, word: 0x0ac0 },
  { fixed: 0, rom: false, size: 0x40, vram: 0x4070, word: 0x0ac4 },
  { fixed: 0, rom: false, size: 0x40, vram: 0x4090, word: 0x0ac8 },
  { fixed: 0, rom: false, size: 0x20, vram: 0x40b0, word: 0x0ae0 },
  { fixed: 0, rom: false, size: 0x40, vram: 0x40c0, word: 0x0ad8 },
  { fixed: 0, rom: false, size: 0x40, vram: 0x4150, word: 0x0ac2 },
  { fixed: 0, rom: false, size: 0x40, vram: 0x4170, word: 0x0ac6 },
  { fixed: 0, rom: false, size: 0x40, vram: 0x4190, word: 0x0aca },
  { fixed: 0, rom: false, size: 0x20, vram: 0x41b0, word: 0x0ae2 },
  { fixed: 0, rom: false, size: 0x40, vram: 0x41c0, word: 0x0ada },
  { fixed: 0, rom: false, size: 0x40, vram: 0x4200, word: 0x0aec },
  { fixed: 0, rom: false, size: 0x40, vram: 0x4220, word: 0x0af0 },
  { fixed: 0xbd40, rom: false, size: 0x40, vram: 0x4240, word: null },
  { fixed: 0, rom: false, size: 0x40, vram: 0x4300, word: 0x0aee },
  { fixed: 0, rom: false, size: 0x40, vram: 0x4320, word: 0x0af2 },
  { fixed: 0xbd80, rom: false, size: 0x40, vram: 0x4340, word: null },
];

/** Where the blocksets and uploads start ($0AA1), inside `dark-room-art-sprites`. */
export const GFX_BASE = 0x0aa1;

/** One upload's A-bus source, or null when it points nowhere it can. */
export function uploadSource(
  upload: (typeof LINK_UPLOADS)[number],
  gfx: Uint8Array,
  bank: number,
): number | null {
  if (upload.word === null) return 0x7e_0000 | upload.fixed;
  const at = upload.word - GFX_BASE;
  const address = (gfx[at] ?? 0) | ((gfx[at + 1] ?? 0) << 8);
  if (!upload.rom) return 0x7e_0000 | address;
  // The base patch sets $BC to $10 at boot (z3 init.asm:54)
  const romBank = bank === 0 ? 0x10 : bank;
  return (address & 0x8000) !== 0 ? (romBank << 16) | address : null;
}

/** The sprite tiles Link's uploads fill, 0-63, as 4 bpp bytes (32 each). */
export const LINK_TILE_COUNT = 64;

/**
 * Sprite VRAM's first 64 tiles (word $4000 on, OBSEL's base) as Link's
 * uploads leave them, and which tiles they filled.
 */
export function linkTiles(pieces: readonly (Uint8Array | null)[]): {
  readonly tiles: Uint8Array;
  readonly filled: Uint8Array;
} {
  const vram = new Uint8Array(LINK_TILE_COUNT * 32);
  const filled = new Uint8Array(LINK_TILE_COUNT);
  LINK_UPLOADS.forEach((upload, k) => {
    const bytes = pieces[k];
    if (bytes === null || bytes === undefined) return;
    const at = (upload.vram - 0x4000) * 2;
    vram.set(bytes.subarray(0, upload.size), at);
    for (let t = at >> 5; t < (at + upload.size) >> 5; t++) filled[t] = 1;
  });
  return { filled, tiles: tiles4bpp(vram) };
}

/** One sprite of the OAM buffer. */
export interface OamSprite {
  readonly index: number;
  /** Screen X, -256 to 255, and Y, 0 to 255 (the line before it shows). */
  readonly x: number;
  readonly y: number;
  readonly tile: number;
  /** The second name table (word $5000 on). */
  readonly table: boolean;
  readonly palette: number;
  readonly priority: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
  /** 16 x 16, else 8 x 8 (OBSEL 0: zelda3 snes/ppu.c:64-66). */
  readonly large: boolean;
}

/** The 128 sprites of an OAM buffer (4 bytes each, then 2 high bits each). */
export function oamSprites(oam: Uint8Array): OamSprite[] {
  const out: OamSprite[] = [];
  for (let index = 0; index < 128; index++) {
    const at = index * 4;
    const high = (oam[0x200 + (index >> 2)] >> ((index & 3) * 2)) & 3;
    const x9 = oam[at] | ((high & 1) << 8);
    const attr = oam[at + 3];
    out.push({
      flipX: (attr & 0x40) !== 0,
      flipY: (attr & 0x80) !== 0,
      index,
      large: (high & 2) !== 0,
      palette: (attr >> 1) & 7,
      priority: (attr >> 4) & 3,
      table: (attr & 1) !== 0,
      tile: oam[at + 2],
      x: x9 >= 256 ? x9 - 512 : x9,
      y: oam[at + 1],
    });
  }
  return out;
}

/** The 8 x 8 tiles a sprite is made of: [tile, dx, dy] before flips. */
function parts(sprite: OamSprite): [number, number, number][] {
  if (!sprite.large) return [[sprite.tile, 0, 0]];
  const out: [number, number, number][] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      // A 16 x 16 sprite takes the tile to its right and the one below,
      // wrapping inside the row of 16 and the table of 256
      const tile =
        (((sprite.tile >> 4) + r) & 0xf) * 16 + ((sprite.tile + c) & 0xf);
      out.push([tile, c * 8, r * 8]);
    }
  }
  return out;
}

/** Link drawn: pixels around him, placed in the room's 512 x 512 space. */
export interface SpriteImage {
  /** Top left, in room pixels (may sit past an edge). */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** 0xAABBGGRR, transparent where no sprite draws. */
  readonly pixels: Uint32Array;
}

/**
 * Link and what he holds, as the game draws them: every sprite on screen
 * whose tiles are all ones his uploads filled (his body, sword, shield and
 * held items; his shadow and the sword's sparkles use other sheets), the
 * lower OAM index on top, placed in the room by BG2's scroll (screen line L
 * shows the tilemap's line L + VOFS, a sprite of Y the lines after Y). Null
 * when none is on screen.
 */
export function renderLink(input: {
  readonly oam: Uint8Array;
  readonly tiles: Uint8Array;
  readonly filled: Uint8Array;
  readonly colours: Uint32Array;
  readonly scrollX: number;
  readonly scrollY: number;
}): SpriteImage | null {
  const { colours, filled, oam, scrollX, scrollY, tiles } = input;
  const mine = oamSprites(oam).filter((sprite) => {
    if (sprite.table || sprite.y >= 0xe0) return false;
    const size = sprite.large ? 16 : 8;
    if (sprite.x + size <= 0 || sprite.x >= 256) return false;
    return parts(sprite).every(
      ([tile]) => tile < LINK_TILE_COUNT && filled[tile] === 1,
    );
  });
  if (mine.length === 0) return null;
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const sprite of mine) {
    const size = sprite.large ? 16 : 8;
    x0 = Math.min(x0, sprite.x);
    y0 = Math.min(y0, sprite.y);
    x1 = Math.max(x1, sprite.x + size);
    y1 = Math.max(y1, sprite.y + size);
  }
  const width = x1 - x0;
  const height = y1 - y0;
  const pixels = new Uint32Array(width * height);
  // Higher indices first, so the lower ones end on top
  for (let k = mine.length - 1; k >= 0; k--) {
    const sprite = mine[k];
    const size = sprite.large ? 16 : 8;
    const base = 128 + sprite.palette * 16;
    for (const [tile, dx, dy] of parts(sprite)) {
      const from = tile * TILE_PX;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const v = tiles[from + r * 8 + c];
          if (v === 0) continue;
          const px = sprite.flipX ? size - 1 - (dx + c) : dx + c;
          const py = sprite.flipY ? size - 1 - (dy + r) : dy + r;
          pixels[(sprite.y - y0 + py) * width + sprite.x - x0 + px] =
            colours[base + v];
        }
      }
    }
  }
  return {
    height,
    pixels,
    width,
    x: (((x0 + scrollX) % ROOM_PX) + ROOM_PX) % ROOM_PX,
    y: (((y0 + 1 + scrollY) % ROOM_PX) + ROOM_PX) % ROOM_PX,
  };
}
