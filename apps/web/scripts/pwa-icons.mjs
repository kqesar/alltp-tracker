#!/usr/bin/env node
// Draws the tracker's icons from one piece of pixel art, a 16 x 16 Triforce:
// the favicon (public/zelda-triforce.ico) and the install icons (web app
// manifest and iOS home screen).
//
//   node scripts/pwa-icons.mjs [--check]
//
// The Triforce is drawn below as text, one character per pixel, in the gold
// the game gives its treasures. Every icon scales it up by a whole number, so
// each pixel stays a crisp square block. The install icons set it on the page
// background (--color-bg, read from the design tokens): the "any" icons as a
// tile whose rounded corners step in the same blocks, the maskable and iOS
// icons as full-bleed squares, since the platform cuts their shape, with the
// Triforce inside the maskable safe zone (the centre circle, 80 % wide). The
// favicon keeps a transparent background, at 1x and 2x.
//
// Encoding goes through Chromium's canvas (the Playwright browser already
// installed for the e2e suite), so no image library is needed; the ICO file
// is assembled here, around PNG frames.
//
// --check only compares the pixels of the committed icons with freshly drawn
// ones, and exits 1 if any differs or is missing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const TOKENS = join(ROOT, "src/styles/variables.css");

/**
 * The Triforce, lit from the top left like the game's sprites: a pale edge
 * facing the light, the gold body, a shaded edge and base.
 */
const TRIFORCE = [
  "................",
  ".......YS.......",
  "......YGGS......",
  "......YGGS......",
  ".....YGGGGS.....",
  ".....YGGGGS.....",
  "....YGGGGGGS....",
  "....SSSSSSSS....",
  "...YS......YS...",
  "..YGGS....YGGS..",
  "..YGGS....YGGS..",
  ".YGGGGS..YGGGGS.",
  ".YGGGGS..YGGGGS.",
  "YGGGGGGSYGGGGGGS",
  "SSSSSSSSSSSSSSSS",
  "................",
];

/**
 * The game's gold, as its treasure sprites in public/assets use it: the body
 * and the shade of the big key, the book and the medallions (#f8d038,
 * #b88820), and the highlight of the golden sword (sword4, #f8f8c8).
 */
const PALETTE = { G: "#f8d038", S: "#b88820", Y: "#f8f8c8" };

/**
 * Each install icon: its file under public/, its size, the whole-number scale
 * of the 16 px Triforce, and its shape. Scales keep the Triforce about two
 * thirds of a tile, and its farthest corner inside the maskable safe circle.
 */
const ICONS = [
  { file: "icons/icon-192.png", scale: 8, shape: "tile", size: 192 },
  { file: "icons/icon-512.png", scale: 22, shape: "tile", size: 512 },
  {
    file: "icons/icon-maskable-512.png",
    scale: 19,
    shape: "square",
    size: 512,
  },
  { file: "apple-touch-icon.png", scale: 8, shape: "square", size: 180 },
];

/** The favicon and its frames: the Triforce at 1x and 2x, no background. */
const FAVICON = "zelda-triforce.ico";
const FAVICON_SIZES = [16, 32];

/** Blocks each tile corner steps in, row by row from the edge. */
const CORNER_STEPS = [2, 1];

const check = process.argv.includes("--check");

/** The page background token, so the icons sit on the app's own colour. */
const background = (() => {
  const match = readFileSync(TOKENS, "utf8").match(
    /--color-bg:\s*(#[0-9a-f]{6})\s*;/i,
  );
  if (!match) throw new Error(`--color-bg not found in ${TOKENS}`);
  return match[1];
})();

const browser = await chromium.launch();
const page = await browser.newPage();

/** One icon as a PNG data URL. */
const draw = ({ scale, shape, size }) =>
  page.evaluate(
    ({ art, background, palette, scale, shape, size, steps }) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.fillStyle = background;
      if (shape === "square") {
        context.fillRect(0, 0, size, size);
      } else if (shape === "tile") {
        // The full-width middle, then each block row of the top and bottom
        // edges, inset by its corner step
        const edge = steps.length * scale;
        context.fillRect(0, edge, size, size - 2 * edge);
        steps.forEach((step, row) => {
          const inset = step * scale;
          context.fillRect(inset, row * scale, size - 2 * inset, scale);
          context.fillRect(
            inset,
            size - (row + 1) * scale,
            size - 2 * inset,
            scale,
          );
        });
      }

      // Each pixel of the art, as a block of scale x scale pixels
      const offset = Math.round((size - art.length * scale) / 2);
      art.forEach((line, y) => {
        [...line].forEach((pixel, x) => {
          if (!palette[pixel]) return;
          context.fillStyle = palette[pixel];
          context.fillRect(
            offset + x * scale,
            offset + y * scale,
            scale,
            scale,
          );
        });
      });
      return canvas.toDataURL("image/png");
    },
    {
      art: TRIFORCE,
      background,
      palette: PALETTE,
      scale,
      shape,
      size,
      steps: CORNER_STEPS,
    },
  );

const pngOf = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");

/** An ICO file holding these PNG frames, each with its square size. */
const icoOf = (frames) => {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ png, size }, index) => {
    const entry = 6 + 16 * index;
    header[entry] = size % 256; // 0 stands for 256
    header[entry + 1] = size % 256;
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map(({ png }) => png)]);
};

/** The PNG frames of an ICO file written by icoOf. */
const framesOf = (ico) =>
  Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + 16 * index;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    return ico.subarray(offset, offset + length);
  });

/**
 * Whether two PNG images hold the same pixels, whatever their encoding. A
 * file that is no PNG (an older favicon frame) holds other pixels.
 */
const samePixels = (a, b) =>
  page.evaluate(
    async ([a, b]) => {
      const pixels = async (source) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      try {
        const [left, right] = await Promise.all([pixels(a), pixels(b)]);
        return (
          left.length === right.length &&
          left.every((value, index) => value === right[index])
        );
      } catch {
        return false;
      }
    },
    [a, b].map((png) => `data:image/png;base64,${png.toString("base64")}`),
  );

// Every file to write: its path, its PNG images, and how to encode them
const outputs = [
  ...(await Promise.all(
    ICONS.map(async (icon) => ({
      file: icon.file,
      images: [pngOf(await draw(icon))],
    })),
  )),
  {
    encode: (images) =>
      icoOf(images.map((png, index) => ({ png, size: FAVICON_SIZES[index] }))),
    file: FAVICON,
    images: await Promise.all(
      FAVICON_SIZES.map(async (size) =>
        pngOf(
          await draw({ scale: size / TRIFORCE.length, shape: "none", size }),
        ),
      ),
    ),
    read: framesOf,
  },
];

const stale = [];
for (const { encode = ([png]) => png, file, images, read } of outputs) {
  const path = join(PUBLIC, file);
  if (check) {
    const current = existsSync(path)
      ? (read ?? ((png) => [png]))(readFileSync(path))
      : [];
    const same =
      current.length === images.length &&
      (
        await Promise.all(
          images.map((png, index) => samePixels(current[index], png)),
        )
      ).every(Boolean);
    if (!same) stale.push(file);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, encode(images));
  }
}

await browser.close();

for (const file of stale) console.log(`out of date: ${file}`);
if (stale.length > 0) process.exit(1);
console.log(`${outputs.length} icons ${check ? "up to date" : "drawn"}`);
