#!/usr/bin/env node
// Makes the opaque black backdrop of item icons transparent, so they sit on
// whatever surface shows them (tooltip, grid, light themes) instead of in a
// black square.
//
//   node scripts/transparent-icons.mjs [--check]
//
// For each listed PNG, the near-black pixels connected to the image border
// are the backdrop. They become transparent, except those touching a coloured
// pixel: that ring is kept as a 1 px black outline, as the sprites have in the
// game, so the art stays crisp on a light surface. Black inside the sprite
// (not connected to the border) is never touched. Decoding and encoding go
// through Chromium's canvas (the Playwright browser already installed for the
// e2e suite), so no image library is needed.
//
// --check only reports which listed files still have a backdrop, and exits 1
// if any does.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/assets",
);

// Item and requirement icons only. Counter overlays (chest*, dungeon*), boss
// portraits, the map and the marker frame keep their backdrop on purpose.
const ICONS = [
  "bombos",
  "book",
  "boomerang0",
  "boomerang1",
  "boomerang2",
  "boomerang3",
  "boots",
  "bottle0",
  "bow0",
  "bow1",
  "bow2",
  "bow3",
  "byrna",
  "cape",
  "crystal0",
  "ether",
  "firerod",
  "flippers",
  "flute",
  "glove0",
  "glove1",
  "glove2",
  "hammer",
  "hookshot",
  "icerod",
  "lantern",
  "mirror",
  "mushroom",
  "net",
  "pendant0",
  "pendant1",
  "pendant2",
  "powder",
  "quake",
  "shovel",
  "somaria",
];

// The digit of bottle1-4 breaks the bottle's outline, so a flood from the
// border would leak into the bottle. The empty bottle has the same outline:
// its transparent pixels bound the flood instead. Listed after bottle0, which
// must be processed first.
const BOUNDED_BY = {
  bottle1: "bottle0",
  bottle2: "bottle0",
  bottle3: "bottle0",
  bottle4: "bottle0",
};

const check = process.argv.includes("--check");

/** A PNG of the assets folder as a data URL. */
const dataUrlOf = (name) =>
  `data:image/png;base64,${readFileSync(join(ASSETS, `${name}.png`)).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const results = [];
for (const name of [...ICONS, ...Object.keys(BOUNDED_BY)]) {
  const file = join(ASSETS, `${name}.png`);
  const source = dataUrlOf(name);
  const bound = BOUNDED_BY[name] ? dataUrlOf(BOUNDED_BY[name]) : null;

  const { backdrop, png } = await page.evaluate(
    async ([dataUrl, boundUrl]) => {
      const decode = async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      };
      const image = await decode(dataUrl);
      const { width, height } = image;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      // The bounding icon's alpha first, then the icon itself over it
      let outside = null;
      if (boundUrl) {
        context.drawImage(await decode(boundUrl), 0, 0);
        outside = context.getImageData(0, 0, width, height).data;
        context.clearRect(0, 0, width, height);
      }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, width, height);
      const { data } = pixels;

      const isBlack = (index) =>
        data[index * 4 + 3] > 240 &&
        data[index * 4] < 16 &&
        data[index * 4 + 1] < 16 &&
        data[index * 4 + 2] < 16 &&
        (!outside || outside[index * 4 + 3] === 0);
      const isVisible = (index) => data[index * 4 + 3] > 16;

      // Flood the backdrop in from the border through near-black pixels
      const inBackdrop = new Uint8Array(width * height);
      const stack = [];
      for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
      for (let y = 0; y < height; y++)
        stack.push(y * width, y * width + width - 1);
      while (stack.length > 0) {
        const index = stack.pop();
        if (inBackdrop[index] || !isBlack(index)) continue;
        inBackdrop[index] = 1;
        const x = index % width;
        const y = (index - x) / width;
        if (x > 0) stack.push(index - 1);
        if (x < width - 1) stack.push(index + 1);
        if (y > 0) stack.push(index - width);
        if (y < height - 1) stack.push(index + width);
      }

      // Keep the backdrop pixels that touch the sprite as its outline
      const touchesSprite = (index) => {
        const x = index % width;
        const y = (index - x) / width;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const neighbour = ny * width + nx;
            if (!inBackdrop[neighbour] && isVisible(neighbour)) return true;
          }
        }
        return false;
      };

      let cleared = 0;
      for (let index = 0; index < width * height; index++) {
        if (inBackdrop[index] && !touchesSprite(index)) {
          data[index * 4 + 3] = 0;
          cleared++;
        }
      }
      context.putImageData(pixels, 0, 0);
      return { backdrop: cleared, png: canvas.toDataURL("image/png") };
    },
    [source, bound],
  );

  results.push({ backdrop, name });
  if (!check && backdrop > 0) {
    writeFileSync(file, Buffer.from(png.split(",")[1], "base64"));
  }
}

await browser.close();

const remaining = results.filter((result) => result.backdrop > 0);
for (const { name, backdrop } of remaining) {
  console.log(`${check ? "backdrop" : "cleared"} ${name}.png: ${backdrop} px`);
}
if (check && remaining.length > 0) process.exit(1);
console.log(
  `${results.length} icons ${check ? "checked" : "processed"}, ${remaining.length} ${check ? "with a backdrop" : "changed"}`,
);
