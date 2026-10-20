#!/usr/bin/env node
// Draws the tracker's icons from one piece of pixel art, a folded map with a
// gold check mark (Rando Atlas): the favicon (public/zelda-triforce.ico, the
// file keeps its old name) and the install icons (web app manifest and iOS
// home screen), and the three PNGs of the desktop app (its other icons, the
// .icns and .ico, come from `pnpm --filter @alltp/desktop tauri icon
// ../web/public/icons/icon-512.png`).
//
//   node scripts/pwa-icons.mjs [--check]
//
// The map is drawn below as text, one character per pixel: a 32 x 32 grid for
// every size from 32 px up, and a 16 x 16 grid redrawn by hand for the favicon
// (not downscaled). Every icon scales the 32 grid by a whole number, so each
// pixel stays a crisp square block. The install icons set it on the page
// background (--color-bg, read from the design tokens): the "any" icons as a
// tile whose rounded corners step in the same blocks, the maskable and iOS
// icons as full-bleed squares, since the platform cuts their shape, with the
// map inside the maskable safe zone (the centre circle, 80 % wide). The
// favicon keeps a transparent background.
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
const DESKTOP = "../../desktop/src-tauri/icons";
const TOKENS = join(ROOT, "src/styles/variables.css");

/** The map, lit from the top left like the game's sprites; 32 x 32. */
const ART = [
  "................................",
  "................................",
  ".........kkkk................kk.",
  "......kkkggddkkk..........kkkggk",
  "...kkkgggggddddBkkk....kkkgggggk",
  ".kkggggggggddddBBBdkkkkggggggggk",
  "kggggggggggdddBBBddddggggkkkgggk",
  "kggggggggggdddBBBddddgggkYGGkggk",
  "kggggggggggddBBBdddddggkYGGGkggk",
  "kgggdggggggddddBBBdddgkYGGGokggk",
  "kggggggggggddddBBBdddkYGGGokgggk",
  "kgggggdggggdddBBBdddkYGGGokggggk",
  "kggggggggggdddBBBddkYGGGokgggggk",
  "kgggggkkkggddBBBddkYGGGokggggggk",
  "kggggkYGGkgddBBBdkYGGGokgggggggk",
  "kggggkGGGGkdBBBdkYGGGokggggggggk",
  "kggggkoGGGGkBddkYGGGokgggdgggggk",
  "kgggggkoGGGGkdkYGGGokggggggggggk",
  "kggggggkoGGGGkYGGGokdggggggggggk",
  "kgggggggkoGGGGGGGokddggggggdgggk",
  "kgggggggbkoGGGGGokdddggggggggggk",
  "kgggggggbbkoGGGokddddgggdggggggk",
  "kgggggggbbbkoookdddddggggggggggk",
  "kggggggbbbgdkkkddddddggggggggggk",
  "kggggggbbbgdddddDddddggggggggggk",
  "kgggggbbbggddddddddddggggggggggk",
  "kgggggbbbkkkkdddddDddggggggggkk.",
  "kggggbkkk....kkkdddddgggggkkk...",
  "kggkkk..........kkkddggkkk......",
  ".kk................kkkk.........",
  "................................",
  "................................",
];

/** The same map redrawn for the 16 px favicon. */
const ART_SMALL = [
  ".....kk.......k.",
  "..kkkgdkk..kkkgk",
  ".kggggdBBkkkkggk",
  "kgggggbBddkGGkgk",
  "kgggggBBdkGGGkgk",
  "kggggcBdkGGGkggk",
  "kggkkbBkGGGkgggk",
  "kgkGGkkGGGkggggk",
  "kgkGGGGGGkgggggk",
  "kggkGGGGkdgggggk",
  "kgggkGGkddgggggk",
  "kggggkkdddgggggk",
  "kgggggddddgggggk",
  "kgggkkkdddgggkk.",
  "kggk...kkdggk...",
  ".kk......kkk....",
];

/**
 * The colours: the app's own tokens (variables.css) and the gold the game
 * gives its treasures (the big key, the medallions, the golden sword).
 */
const PALETTE = {
  a: "#2ecc40",
  B: "#3a78b8",
  b: "#5aa9f0",
  c: "#7fdbff",
  D: "#1d7032",
  d: "#2a9944",
  G: "#f8d038",
  g: "#3fb950",
  h: "#6fd27a",
  k: "#0b0b0f",
  N: "#c2a463",
  n: "#e8d49a",
  o: "#b88820",
  r: "#f0506e",
  S: "#8a8fa5",
  s: "#d8dbe6",
  w: "#f4f5fb",
  Y: "#f8f8c8",
};

/**
 * Each install icon: its file under public/, its size, the whole-number scale
 * of the 32 px art, and its shape. Scales keep the map about two thirds of a
 * tile, and its farthest corner inside the maskable safe circle.
 */
const ICONS = [
  { file: "icons/icon-192.png", scale: 4, shape: "tile", size: 192 },
  { file: "icons/icon-512.png", scale: 11, shape: "tile", size: 512 },
  {
    file: "icons/icon-maskable-512.png",
    scale: 9,
    shape: "square",
    size: 512,
  },
  { file: "apple-touch-icon.png", scale: 4, shape: "square", size: 180 },
  // The PNGs the desktop app installs in the Linux menu (launcher.rs): drawn
  // here, not resized by the Tauri CLI, so the pixels stay whole blocks
  { file: `${DESKTOP}/32x32.png`, scale: 1, shape: "none", size: 32 },
  { file: `${DESKTOP}/128x128.png`, scale: 3, shape: "tile", size: 128 },
  { file: `${DESKTOP}/128x128@2x.png`, scale: 6, shape: "tile", size: 256 },
];

/** The favicon and its frames: the 16 px art at 1x, the 32 px art at 1x. */
const FAVICON = "zelda-triforce.ico";
const FAVICON_FRAMES = [
  { art: ART_SMALL, size: 16 },
  { art: ART, size: 32 },
];

/** Corner radius of a tile, in blocks of `scale` pixels. */
const CORNER_RADIUS = 6;

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
const draw = ({ art, scale, shape, size }) =>
  page.evaluate(
    ({ art, background, palette, radius, scale, shape, size }) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.fillStyle = background;
      if (shape === "square") {
        context.fillRect(0, 0, size, size);
      } else if (shape === "tile") {
        // Block by block, dropping the blocks outside a rounded corner
        const blocks = Math.ceil(size / scale);
        for (let by = 0; by < blocks; by++) {
          for (let bx = 0; bx < blocks; bx++) {
            const cx = Math.min(bx, blocks - 1 - bx);
            const cy = Math.min(by, blocks - 1 - by);
            if (cx < radius && cy < radius) {
              const dx = radius - cx - 0.5;
              const dy = radius - cy - 0.5;
              if (dx * dx + dy * dy > radius * radius) continue;
            }
            context.fillRect(bx * scale, by * scale, scale, scale);
          }
        }
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
      art,
      background,
      palette: PALETTE,
      radius: CORNER_RADIUS,
      scale,
      shape,
      size,
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
      images: [pngOf(await draw({ ...icon, art: ART }))],
    })),
  )),
  {
    encode: (images) =>
      icoOf(
        images.map((png, index) => ({ png, size: FAVICON_FRAMES[index].size })),
      ),
    file: FAVICON,
    images: await Promise.all(
      FAVICON_FRAMES.map(async ({ art, size }) =>
        pngOf(await draw({ art, scale: 1, shape: "none", size })),
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
