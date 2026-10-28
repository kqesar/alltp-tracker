#!/usr/bin/env node
// Draws the hearts cell's icon, heart.png: our own pixel heart, a 16 px
// sprite stored at 2x like the other cells' art (each sprite pixel a 2 x 2
// block), in a black outline with a highlight and a shaded edge.
//
//   node scripts/heart-icon.mjs
//
// The PNG is written by hand (Node's zlib, no image library): RGBA, 8 bits
// a channel, no filter. Running it again writes the same file.
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
  K: [0x10, 0x10, 0x10, 0xff],
  P: [0xf8, 0xc0, 0xb0, 0xff],
  R: [0xe8, 0x30, 0x28, 0xff],
};

const SCALE = 2;
const size = SPRITE.length * SCALE;

/** One PNG chunk: its length, type, data and CRC. */
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};

const rows = [];
for (const line of SPRITE) {
  const row = [0];
  for (const pixel of line) {
    const colour = COLOURS[pixel];
    if (colour === undefined) throw new Error(`No colour for "${pixel}"`);
    for (let i = 0; i < SCALE; i++) row.push(...colour);
  }
  for (let i = 0; i < SCALE; i++) rows.push(...row);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8; // bits a channel
header[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(Buffer.from(rows), { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "assets",
  "heart.png",
);
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes)`);
