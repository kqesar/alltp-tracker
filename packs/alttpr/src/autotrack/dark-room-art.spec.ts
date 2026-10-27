// The dark room's picture, over synthetic bytes only: hand-built streams,
// sheets, tilemaps and palettes, never a byte of the game's graphics.
import { describe, expect, it } from "vitest";
import {
  ANIMATED_TILE,
  type ArtTables,
  AUX_ROWS,
  backgroundTiles,
  decompress,
  GFX_BASE,
  highSlot,
  LINK_UPLOADS,
  linkTiles,
  MAIN_ROWS,
  oamSprites,
  paletteColours,
  ROOM_PX,
  renderBackground,
  renderLink,
  SHEETS,
  sheetAddress,
  sheetSlots,
  sheetTiles,
  tiles4bpp,
  uploadSource,
} from "./dark-room-art";

const bytes = (...values: number[]) => Uint8Array.from(values);

describe("decompress", () => {
  it("unpacks each command: literal, byte, word, incrementing fills, copy", () => {
    const stream = bytes(
      0x02, // literal of 3
      0x0a,
      0x0b,
      0x0c,
      0x23, // byte fill of 4
      0x77,
      0x44, // word fill of 5
      0x01,
      0x02,
      0x62, // incrementing fill of 3
      0xfe,
      0x83, // copy 4 from offset 1 (little-endian)
      0x01,
      0x00,
      0xff,
    );
    expect(Array.from(decompress(stream) ?? [])).toEqual([
      0x0a, 0x0b, 0x0c, 0x77, 0x77, 0x77, 0x77, 0x01, 0x02, 0x01, 0x02, 0x01,
      0xfe, 0xff, 0x00, 0x0b, 0x0c, 0x77, 0x77,
    ]);
  });

  it("reads the long form's 10-bit length and its command from bits 2-4", () => {
    // $E0 | command << 2 | high length bits: a byte fill ($20) of 0x101
    const unpacked = decompress(bytes(0xe4 | 0x01, 0x00, 0x5a, 0xff));
    expect(unpacked?.length).toBe(0x101);
    expect(unpacked?.every((b) => b === 0x5a)).toBe(true);
  });

  it("copies over what it is writing, as the game does", () => {
    // 1 byte, then a copy of 5 from offset 0: a run of it
    expect(
      Array.from(decompress(bytes(0x00, 9, 0x84, 0, 0, 0xff)) ?? []),
    ).toEqual([9, 9, 9, 9, 9, 9]);
  });

  it("refuses a stream that runs off its window, copies from ahead or grows too big", () => {
    expect(decompress(bytes(0x05, 1, 2))).toBeNull();
    expect(decompress(bytes(0x00))).toBeNull();
    expect(decompress(bytes(0x80, 0x05, 0x00, 0xff))).toBeNull();
    expect(decompress(bytes(0x23, 1, 0x23, 1, 0xff), 6)).toBeNull();
    expect(decompress(bytes(0xff))?.length).toBe(0);
  });
});

/** A 3 bpp sheet whose tile `t` is all colour `(t % 7) + 1`. */
function flatSheet(): Uint8Array {
  const sheet = new Uint8Array(0x600);
  for (let t = 0; t < 64; t++) {
    const v = (t % 7) + 1;
    for (let r = 0; r < 8; r++) {
      sheet[t * 24 + 2 * r] = v & 1 ? 0xff : 0;
      sheet[t * 24 + 2 * r + 1] = v & 2 ? 0xff : 0;
      sheet[t * 24 + 16 + r] = v & 4 ? 0xff : 0;
    }
  }
  return sheet;
}

describe("sheetTiles and tiles4bpp", () => {
  it("expands 3 bpp planes, adding 8 to a high sheet's colours but 0", () => {
    const sheet = new Uint8Array(24);
    sheet[0] = 0b1000_0001; // plane 0, row 0
    sheet[1] = 0b0000_0001; // plane 1, row 0
    sheet[16] = 0b0100_0001; // plane 2, row 0
    const low = sheetTiles(sheet, false);
    expect(Array.from(low.subarray(0, 8))).toEqual([1, 4, 0, 0, 0, 0, 0, 7]);
    const high = sheetTiles(sheet, true);
    expect(Array.from(high.subarray(0, 8))).toEqual([9, 12, 0, 0, 0, 0, 0, 15]);
    expect(sheetTiles(flatSheet(), false)[64 * 3]).toBe(4);
  });

  it("reads 4 bpp tiles with planes 2 and 3 interleaved after 0 and 1", () => {
    const tile = new Uint8Array(32);
    tile[2] = 0x80; // plane 0, row 1
    tile[17 + 2] = 0x80; // plane 3, row 1
    const out = tiles4bpp(tile);
    expect(out[8]).toBe(9);
    expect(out[0]).toBe(0);
  });
});

/** Tables with sheet `s` at $11:8000 + s * 0x100, FastROM bank bit set. */
function tables(): ArtTables {
  const pointers = new Uint8Array(SHEETS * 3);
  for (let s = 0; s < SHEETS; s++) {
    const address = 0x91_8000 + s * 0x100;
    pointers[s] = address >> 16;
    pointers[SHEETS + s] = (address >> 8) & 0xff;
    pointers[2 * SHEETS + s] = address & 0xff;
  }
  const main = new Uint8Array(MAIN_ROWS * 8);
  main.set([10, 11, 12, 13, 14, 15, 16, 17], 4 * 8);
  const aux = new Uint8Array(AUX_ROWS * 4);
  aux.set([0, 21, 0, 23], 2 * 4);
  return { aux, main, pointers };
}

describe("the ROM's tables", () => {
  it("lay out a room's eight sheets, an aux sheet replacing main 3-6 unless 0", () => {
    expect(sheetSlots(tables(), 4, 2)).toEqual([
      10, 11, 12, 13, 21, 15, 23, 17,
    ]);
    expect(sheetSlots(tables(), MAIN_ROWS, 0)).toBeNull();
    expect(sheetSlots(tables(), 0, AUX_ROWS)).toBeNull();
  });

  it("point at a sheet by bank, high and low bytes, the FastROM bit kept", () => {
    expect(sheetAddress(tables(), 3)).toBe(0x91_8300);
    expect(sheetAddress(tables(), SHEETS)).toBeNull();
    const low = tables();
    low.pointers[SHEETS + 5] = 0x12; // $91:1200: not ROM
    expect(sheetAddress(low, 5)).toBeNull();
  });

  it("expands a dungeon's first four sheets high, the rest low", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((s) => highSlot(s, 4))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    // Outdoors (main $20 on), slots 0 and 3-5 (load_gfx.c:971-977)
    expect([0, 3, 4, 5, 7].map((s) => highSlot(s, 0x20))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});

describe("paletteColours", () => {
  it("turns BGR555 into RGBA words, scaling 31 to 255", () => {
    const palette = new Uint8Array(512);
    palette.set([0x1f, 0x00], 2); // red 31
    palette.set([0x00, 0x7c], 4); // blue 31
    const colours = paletteColours(palette);
    expect(colours[0]).toBe(0xff00_0000);
    expect(colours[1] >>> 0).toBe(0xff00_00ff);
    expect(colours[2] >>> 0).toBe(0xffff_0000);
  });
});

/** A tilemap with `entry` at (x, y), the rest naming tile 0 (colour 1). */
function tilemap(entries: [x: number, y: number, entry: number][]): Uint8Array {
  const map = new Uint8Array(0x2000);
  for (const [x, y, entry] of entries) {
    map[2 * (y * 64 + x)] = entry & 0xff;
    map[2 * (y * 64 + x) + 1] = entry >> 8;
  }
  return map;
}

describe("renderBackground", () => {
  const colours = Uint32Array.from({ length: 256 }, (_, i) => 0xff00_0000 + i);

  it("draws each tile in its palette, flipped as asked, with BG1 over BG2", () => {
    const tiles = new Uint8Array(512 * 64);
    // Tile 5: colour 3 in the top left pixel only
    tiles[5 * 64] = 3;
    const bg2 = tilemap([
      [1, 0, 5 | (2 << 10)], // palette 2
      [2, 0, 5 | 0x4000], // flipped horizontally
      [3, 0, 5 | 0x8000], // flipped vertically
    ]);
    const out = renderBackground({ bg1: null, bg2, colours, tiles });
    expect(out.length).toBe(ROOM_PX * ROOM_PX);
    expect(out[8] - 0xff00_0000).toBe(2 * 16 + 3);
    expect(out[16 + 7] - 0xff00_0000).toBe(3);
    expect(out[7 * ROOM_PX + 24] - 0xff00_0000).toBe(3);
    // Colour 0 shows the backdrop
    expect(out[9] - 0xff00_0000).toBe(0);
    const bg1 = tilemap([[1, 0, 5 | (4 << 10)]]);
    const both = renderBackground({ bg1, bg2, colours, tiles });
    expect(both[8] - 0xff00_0000).toBe(4 * 16 + 3);
  });

  it("puts BG2's high priority tiles over BG1's low ones", () => {
    const tiles = new Uint8Array(512 * 64);
    tiles[5 * 64] = 3;
    const bg2 = tilemap([[0, 0, 5 | (1 << 10) | 0x2000]]);
    const bg1 = tilemap([[0, 0, 5 | (2 << 10)]]);
    const out = renderBackground({ bg1, bg2, colours, tiles });
    expect(out[0] - 0xff00_0000).toBe(16 + 3);
  });

  it("draws nothing for a tile past the 512 loaded", () => {
    const tiles = new Uint8Array(512 * 64).fill(1);
    const out = renderBackground({
      bg1: null,
      bg2: tilemap([[0, 0, 600]]),
      colours,
      tiles,
    });
    expect(out[0] - 0xff00_0000).toBe(0);
    expect(out[8] - 0xff00_0000).toBe(1);
  });
});

describe("backgroundTiles", () => {
  it("places sheet i at tile 64 i and the animated frame at 432", () => {
    const sheets = Array.from({ length: 8 }, () => flatSheet());
    const animated = new Uint8Array(0x400).fill(0xff);
    const tiles = backgroundTiles(sheets, 4, animated);
    // Sheet 0 is high: tile 3's colour 4 reads 12; sheet 4 is low
    expect(tiles[3 * 64]).toBe(12);
    expect(tiles[(4 * 64 + 3) * 64]).toBe(4);
    expect(tiles[ANIMATED_TILE * 64]).toBe(15);
  });
});

/** OAM with the given sprites; the rest hidden at Y $F0. */
function oam(
  sprites: {
    x: number;
    y: number;
    tile: number;
    attr: number;
    large: boolean;
  }[],
): Uint8Array {
  const bytes = new Uint8Array(0x220);
  for (let i = 0; i < 128; i++) bytes[i * 4 + 1] = 0xf0;
  sprites.forEach((s, i) => {
    bytes.set([s.x & 0xff, s.y, s.tile, s.attr], i * 4);
    const bits = ((s.x >> 8) & 1) | (s.large ? 2 : 0);
    bytes[0x200 + (i >> 2)] |= bits << ((i & 3) * 2);
  });
  return bytes;
}

describe("oamSprites", () => {
  it("reads position, tile, flips, palette and size, X's ninth bit signed", () => {
    const [first, second] = oamSprites(
      oam([
        { attr: 0b1100_1110, large: true, tile: 0x22, x: 0x1f8, y: 40 },
        { attr: 0x01, large: false, tile: 7, x: 100, y: 50 },
      ]),
    );
    expect(first).toMatchObject({
      flipX: true,
      flipY: true,
      large: true,
      palette: 7,
      table: false,
      tile: 0x22,
      x: -8,
      y: 40,
    });
    expect(second).toMatchObject({ large: false, table: true, x: 100 });
  });
});

describe("Link's uploads", () => {
  it("take the body from ROM in the sprite bank, the rest from WRAM", () => {
    const gfx = new Uint8Array(0x59);
    const put = (word: number, value: number) => {
      gfx[word - GFX_BASE] = value & 0xff;
      gfx[word - GFX_BASE + 1] = value >> 8;
    };
    put(0x0ace, 0x8140);
    put(0x0ac0, 0x9040);
    const body = LINK_UPLOADS[0];
    expect(uploadSource(body, gfx, 0x32)).toBe(0x32_8140);
    // The base patch's boot value when the byte is still 0
    expect(uploadSource(body, gfx, 0)).toBe(0x10_8140);
    expect(uploadSource(LINK_UPLOADS[6], gfx, 0x32)).toBe(0x7e_9040);
    const fixed = LINK_UPLOADS.find((u) => u.word === null);
    expect(fixed && uploadSource(fixed, gfx, 0x32)).toBe(0x7e_bd40);
    // A body source below $8000 is no ROM address
    put(0x0ace, 0x1234);
    expect(uploadSource(body, gfx, 0x32)).toBeNull();
  });

  it("fill sprite tiles 0-13, 16-29, 32-37 and 48-53", () => {
    const { filled } = linkTiles(
      LINK_UPLOADS.map((u) => new Uint8Array(u.size)),
    );
    const tiles = [...filled.keys()].filter((t) => filled[t] === 1);
    const range = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => from + i);
    expect(tiles).toEqual([
      ...range(0, 13),
      ...range(16, 29),
      ...range(32, 37),
      ...range(48, 53),
    ]);
  });
});

describe("renderLink", () => {
  /** Tiles 0-63, tile t all colour (t % 15) + 1. */
  const tiles = Uint8Array.from(
    { length: 64 * 64 },
    (_, i) => ((i >> 6) % 15) + 1,
  );
  const filled = new Uint8Array(64).fill(1);
  filled[40] = 0;
  const colours = Uint32Array.from({ length: 256 }, (_, i) => 0xff00_0000 + i);

  it("draws Link's sprites, the lower index on top, placed by BG2's scroll", () => {
    const image = renderLink({
      colours,
      filled,
      oam: oam([
        // On top: an 8 x 8 at (108, 60), palette 7
        { attr: 7 << 1, large: false, tile: 4, x: 108, y: 60 },
        // Under it: a 16 x 16 at (100, 60), palette 1
        { attr: 1 << 1, large: true, tile: 0, x: 100, y: 60 },
      ]),
      scrollX: 0x1000 + 30,
      scrollY: 0x0e00 + 20,
      tiles,
    });
    expect(image).not.toBeNull();
    if (image === null) return;
    expect(image).toMatchObject({ height: 16, width: 16, x: 130, y: 81 });
    const at = (x: number, y: number) => image.pixels[y * 16 + x] - 0xff00_0000;
    // The 16 x 16's four tiles: 0 top left, 1 top right, 16 and 17 below
    expect(at(0, 0)).toBe(128 + 16 + 1);
    expect(at(0, 8)).toBe(128 + 16 + 2);
    expect(at(15, 15)).toBe(128 + 16 + 3);
    // The 8 x 8 drawn over tile 1's place
    expect(at(8, 0)).toBe(128 + 7 * 16 + 5);
  });

  it("leaves out sprites of tiles Link's uploads do not fill, or off screen", () => {
    const image = renderLink({
      colours,
      filled,
      oam: oam([
        { attr: 0, large: false, tile: 40, x: 10, y: 10 },
        { attr: 1, large: false, tile: 2, x: 10, y: 10 },
        { attr: 0, large: false, tile: 2, x: 10, y: 0xf0 },
      ]),
      scrollX: 0,
      scrollY: 0,
      tiles,
    });
    expect(image).toBeNull();
  });

  it("flips a 16 x 16 sprite as a whole", () => {
    const image = renderLink({
      colours,
      filled,
      oam: oam([{ attr: 0x40, large: true, tile: 0, x: 0, y: 0 }]),
      scrollX: 0,
      scrollY: 0,
      tiles,
    });
    // Mirrored: tile 1 on the left
    expect(image && image.pixels[0] - 0xff00_0000).toBe(128 + 2);
  });
});
