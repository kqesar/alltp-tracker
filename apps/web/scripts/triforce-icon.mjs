#!/usr/bin/env node
// Draws the Triforce hunt cell's icon, triforce.png: our own pixel piece of
// the Triforce, a 16 px sprite stored at 2x like the other cells' art (each
// sprite pixel a 2 x 2 block), a gold triangle in a black outline with a
// highlight on its left edge and a shaded right edge. Drawn by hand from
// the look of the piece in the game, never copied from a ROM.
//
//   node scripts/triforce-icon.mjs
//
// The PNG is written by hand (Node's zlib, no image library): RGBA, 8 bits
// a channel, no filter. Running it again writes the same file.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const SPRITE = `
................
.......KK.......
......KYDK......
......KYDK......
.....KHYYDK.....
.....KHYYDK.....
....KHYYYYDK....
....KHYYYYDK....
...KHYYYYYYDK...
...KHYYYYYYDK...
..KHYYYYYYYYDK..
..KHYYYYYYYYDK..
.KHYYYYYYYYYYDK.
.KKKKKKKKKKKKKK.
................
................
`
  .trim()
  .split("\n");

const COLOURS = {
  ".": [0, 0, 0, 0],
  D: [0xc0, 0x88, 0x10, 0xff],
  H: [0xff, 0xf0, 0x90, 0xff],
  K: [0x10, 0x10, 0x10, 0xff],
  Y: [0xf8, 0xc8, 0x20, 0xff],
};

const SCALE = 2;

/** One PNG chunk: its length, type, data and CRC. */
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};

const draw = () => {
  const rows = [];
  SPRITE.forEach((line) => {
    const row = [0];
    [...line].forEach((pixel) => {
      const colour = COLOURS[pixel];
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
const png = draw();
writeFileSync(join(assets, "triforce.png"), png);
console.log(`Wrote ${join(assets, "triforce.png")} (${png.length} bytes)`);
