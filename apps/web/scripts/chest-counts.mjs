#!/usr/bin/env node
// Draws the dungeon counter icons past the original art's 6: chest7.png to
// chest14.png, the counts keysanity reaches (Palace of Darkness holds 14
// items there).
//
//   node scripts/chest-counts.mjs
//
// The original icons are a 16 px sprite stored at 2x: a chest frame around a
// white digit drawn on a grid of 2 x 2 sprite pixels, five cells by five, in
// a black outline. Each new icon keeps chest5.png's frame, blacks out the
// panel inside it, and draws its count in the same white: one digit in the
// same 5 x 5 cells as 1 to 6, two digits as a narrow 1 beside a 3 x 5 digit,
// since two of the wide ones do not fit in the panel. Running it again
// writes the same files.
//
// Decoding and encoding go through Chromium's canvas (the Playwright browser
// already installed for the e2e suite), so no image library is needed.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/assets",
);

/** One digit across the panel: 5 x 5 cells of 2 x 2 sprite pixels. */
const WIDE = {
  7: ["#####", "...##", "..##.", ".##..", ".##.."],
  8: [".###.", "##.##", ".###.", "##.##", ".###."],
  9: [".###.", "##.##", ".####", "...##", ".###."],
};

/** The second digit of 10 to 14: 3 x 5 cells. */
const NARROW = {
  0: ["###", "#.#", "#.#", "#.#", "###"],
  1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["###", "..#", "###", "#..", "###"],
  3: ["###", "..#", ".##", "..#", "###"],
  4: ["#.#", "#.#", "###", "..#", "..#"],
};

/**
 * The tens' 1, in sprite pixels (3 wide, 10 tall): a stem with a flag,
 * like the original 1 without its foot.
 */
const TENS = [
  ".##",
  ".##",
  "###",
  "###",
  ".##",
  ".##",
  ".##",
  ".##",
  ".##",
  ".##",
];

/**
 * The sprite pixels `rows` light, as [x, y] in the 16 x 16 sprite: each "#"
 * is a square of `size` pixels, the first row's first at (left, 3).
 */
function* lights(rows, left, size) {
  for (const [y, row] of rows.entries()) {
    for (const [x, on] of [...row].entries()) {
      if (on !== "#") continue;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          yield [left + size * x + dx, 3 + size * y + dy];
        }
      }
    }
  }
}

/** Sprite pixels lit for a count, as [x, y] in the 16 x 16 sprite. */
const litPixels = (count) =>
  count < 10
    ? [...lights(WIDE[count], 3, 2)]
    : [...lights(TENS, 3, 1), ...lights(NARROW[count - 10], 7, 2)];

const frame = `data:image/png;base64,${readFileSync(join(ASSETS, "chest5.png")).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (let count = 7; count <= 14; count++) {
  const png = await page.evaluate(
    async ({ frame, lit }) => {
      const image = new Image();
      image.src = frame;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0);
      // The panel inside the frame: sprite pixels 2 to 13 both ways
      context.fillStyle = "rgb(24, 24, 24)";
      context.fillRect(4, 4, 24, 24);
      context.fillStyle = "rgb(248, 248, 248)";
      for (const [x, y] of lit) context.fillRect(2 * x, 2 * y, 2, 2);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { frame, lit: litPixels(count) },
  );
  writeFileSync(join(ASSETS, `chest${count}.png`), Buffer.from(png, "base64"));
}
await browser.close();
