#!/usr/bin/env node
// Draws what a bottle holds, for the bottle cells: bottle-red.png,
// bottle-green.png, bottle-blue.png, bottle-fairy.png, bottle-bee.png and
// bottle-goodbee.png. Each is the empty bottle the board already has
// (bottle0.png, a 16 px sprite stored at 4x: its glass a white outline
// over dark grey, in a black edge) with its body filled. The game draws a
// sprite of its own for each (the pause menu's kHudItemBottles, zelda3
// src/hud.c:49-59), but no licence-clean copy of them exists, and nothing
// is extracted from a ROM: these are ours, drawn the way the menu shows the
// contents, the potions as a liquid filling the bottle's lower body, the
// fairy and the bees inside it.
//
//   node scripts/bottle-icons.mjs
//
// Decoding and encoding go through Chromium's canvas (the Playwright browser
// already installed for the e2e suite), so no image library is needed.
// Running it again writes the same files.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/assets",
);

/** The sprite pixels inside the glass, row by row: [y, first x, last x]. */
const BODY = [
  [6, 4, 11],
  [7, 3, 12],
  [8, 3, 12],
  [9, 3, 12],
  [10, 3, 12],
  [11, 3, 12],
  [12, 4, 11],
  [13, 6, 9],
];

/** A potion: its light, its body and its shade, filling rows 9 to 13. */
const potion = (light, body, shade) => (pixel) => {
  const [x, y] = pixel;
  if (y < 9) return null;
  if (y === 9) return light;
  if (y === 13 || x === 3 || x === 12) return shade;
  return body;
};

/**
 * Each content's pixels, by name: given a pixel inside the glass, its
 * colour, or null to keep the empty bottle's.
 */
const CONTENTS = {
  bee: (pixel) => bee(pixel, "#f0c818", "#a07000"),
  blue: potion("#88b0ff", "#3060f0", "#1c3098"),
  fairy: ([x, y]) => {
    // A pink glow, the fairy white in its middle with her wings
    if (y < 7) return null;
    if ((x === 7 || x === 8) && (y === 9 || y === 10)) return "#ffffff";
    if ((x === 5 || x === 10) && (y === 8 || y === 9)) return "#fff0fa";
    return y > 11 ? "#d870b8" : "#f8b0e0";
  },
  goodbee: (pixel) => bee(pixel, "#ffe870", "#d89000"),
  green: potion("#88e878", "#30b038", "#186820"),
  red: potion("#ff8868", "#e03020", "#902010"),
};

/** A bee in the bottle: wings over a striped body, on the glass. */
function bee([x, y], body, stripe) {
  if ((x === 6 || x === 9) && (y === 7 || y === 8)) return "#f8f8f8";
  if (y >= 9 && y <= 11 && x >= 5 && x <= 10) {
    return x === 7 || x === 9 ? stripe : body;
  }
  if (y === 10 && x === 11) return "#202020";
  return null;
}

const empty = `data:image/png;base64,${readFileSync(join(ASSETS, "bottle0.png")).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, paint] of Object.entries(CONTENTS)) {
  const pixels = BODY.flatMap(([y, first, last]) =>
    Array.from({ length: last - first + 1 }, (_, index) => {
      const x = first + index;
      const colour = paint([x, y]);
      return colour ? [[x, y, colour]] : [];
    }).flat(),
  );
  const png = await page.evaluate(
    async ({ empty, pixels }) => {
      const image = new Image();
      image.src = empty;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0);
      // Each sprite pixel is a 4 x 4 block at the stored scale
      const scale = image.width / 16;
      for (const [x, y, colour] of pixels) {
        context.fillStyle = colour;
        context.fillRect(x * scale, y * scale, scale, scale);
      }
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { empty, pixels },
  );
  writeFileSync(join(ASSETS, `bottle-${name}.png`), Buffer.from(png, "base64"));
}
await browser.close();
