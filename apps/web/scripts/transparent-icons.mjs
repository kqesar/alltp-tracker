#!/usr/bin/env node
// Makes the opaque black backdrop of every image transparent, so it sits on
// whatever surface shows it (tooltip, grid, map, a stream over footage)
// instead of in a black square.
//
//   node scripts/transparent-icons.mjs [--check]
//
// For each PNG of public/assets but the map, the backdrop is the near-black
// region flooded in from the image's corners: a backdrop is a rectangle behind
// the sprite, so it holds the corners. It becomes transparent, except the
// pixels touching a coloured one: that ring is kept as a 1 px black outline,
// as the sprites have in the game, so the art stays crisp on a light surface.
// Black inside the sprite is never touched, nor black that reaches the border
// between transparent corners: the disc behind a reward glyph, the dark panes
// of Kholdstare's shell. Neither is a translucent badge (the chest counts),
// whose pixels are never near-black and opaque. Decoding and encoding go
// through Chromium's canvas (the Playwright browser already installed for the
// e2e suite), so no image library is needed.
//
// --check only reports which files still have a backdrop, and exits 1 if any
// does.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/assets",
);

// Every image but the map, which is a scene, not a sprite on a backdrop
const ICONS = readdirSync(ASSETS)
  .filter((file) => file.endsWith(".png") && file !== "map.png")
  .map((file) => file.slice(0, -".png".length))
  .sort();

// The digit of bottle1-4 breaks the bottle's outline, so a flood from the
// border would leak into the bottle. The empty bottle has the same outline:
// its transparent pixels bound the flood instead, so it is processed first.
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
// Bounded icons last, once the icon bounding them has been processed
for (const name of [
  ...ICONS.filter((icon) => !(icon in BOUNDED_BY)),
  ...Object.keys(BOUNDED_BY),
]) {
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

      // Flood the backdrop in from the corners through near-black pixels
      const inBackdrop = new Uint8Array(width * height);
      const stack = [0, width - 1, (height - 1) * width, height * width - 1];
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
