#!/usr/bin/env node
// Draws the hearts counter's icons: heart.png, our own pixel heart, a 16 px
// sprite stored at 2x like the other cells' art (each sprite pixel a 2 x 2
// block), in a black outline with a highlight and a shaded edge; and
// heart0.png to heart3.png, the same heart filled by quarters as the game's
// pause menu draws the pieces toward the next heart (zelda3 src/hud.c:
// 1258-1267, kHudItemHeartPieces): four 8 x 8 quadrants, filled top left,
// then bottom left, then top right. An empty quadrant keeps the outline
// over a dark inside, which reads on the dark board and hides the tunic
// beneath it.
//
//   node scripts/heart-icon.mjs
//
// The PNGs are written by hand (Node's zlib, no image library): RGBA, 8 bits
// a channel, no filter. Running it again writes the same files.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const SPRITE = `
................
................
...KKK....KKK...
..KRRRK..KRRRK..
.KRPPRRKKRRRRDK.
.KRPRRRRRRRRRDK.
.KRRRRRRRRRRRDK.
.KRRRRRRRRRRRDK.
..KRRRRRRRRRDK..
...KRRRRRRRDK...
....KRRRRRDK....
.....KRRRDK.....
......KRDK......
.......KK.......
................
................
`
  .trim()
  .split("\n");

const COLOURS = {
  ".": [0, 0, 0, 0],
  D: [0x98, 0x10, 0x10, 0xff],
  // An empty quadrant's inside, and its shaded edge
  E: [0x58, 0x50, 0x58, 0xff],
  F: [0x38, 0x30, 0x38, 0xff],
  K: [0x10, 0x10, 0x10, 0xff],
  P: [0xf8, 0xc0, 0xb0, 0xff],
  R: [0xe8, 0x30, 0x28, 0xff],
};

/** What an empty quadrant draws for each of the full heart's pixels. */
const EMPTY = { D: "F", P: "E", R: "E" };

const SCALE = 2;
const HALF = SPRITE.length / 2;

/**
 * The quadrants each count of pieces fills, in the menu's tile order (top
 * left, top right, bottom left, bottom right: hud.c:1258-1263).
 */
const PIECES = [
  [false, false, false, false],
  [true, false, false, false],
  [true, false, true, false],
  [true, true, true, false],
];

/** One PNG chunk: its length, type, data and CRC. */
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};

/** The heart as a PNG, each quadrant filled or not as `filled` says. */
const draw = (filled) => {
  const rows = [];
  SPRITE.forEach((line, y) => {
    const row = [0];
    [...line].forEach((pixel, x) => {
      const quadrant = (y < HALF ? 0 : 2) + (x < HALF ? 0 : 1);
      const shown = filled[quadrant] ? pixel : (EMPTY[pixel] ?? pixel);
      const colour = COLOURS[shown];
      if (colour === undefined) throw new Error(`No colour for "${pixel}"`);
      for (let i = 0; i < SCALE; i++) row.push(...colour);
    });
    for (let i = 0; i < SCALE; i++) rows.push(...row);
  });

  const size = SPRITE.length * SCALE;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits a channel
  header[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const assets = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "assets",
);
const write = (name, png) => {
  writeFileSync(join(assets, name), png);
  console.log(`Wrote ${join(assets, name)} (${png.length} bytes)`);
};

write("heart.png", draw([true, true, true, true]));
PIECES.forEach((filled, pieces) => {
  write(`heart${pieces}.png`, draw(filled));
});
