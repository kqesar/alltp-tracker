#!/usr/bin/env node
// Draws the install icons (web app manifest and iOS home screen) from the
// tracker's favicon, the 32 px Triforce in public/zelda-triforce.ico.
//
//   node scripts/pwa-icons.mjs [--check]
//
// The Triforce is scaled up by a whole number with nearest-neighbour sampling,
// so each of its pixels becomes a crisp square block, and set on the page
// background (--color-bg, read from the design tokens). The "any" icons are a
// tile whose rounded corners are stepped in the same blocks; the maskable and
// iOS icons are full-bleed squares, since the platform cuts their shape, with
// the Triforce inside the maskable safe zone (the centre circle, 80 % wide).
// Decoding and encoding go through Chromium's canvas (the Playwright browser
// already installed for the e2e suite), so no image library is needed.
//
// --check only compares the pixels of the committed icons with freshly drawn
// ones, and exits 1 if any differs or is missing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const SOURCE = join(PUBLIC, "zelda-triforce.ico");
const TOKENS = join(ROOT, "src/styles/variables.css");

/** The ICO frame drawn from: its largest, 32 × 32. */
const FRAME_SIZE = 32;

/**
 * Each icon: its file under public/, its size, the whole-number scale of the
 * 32 px Triforce, and its shape. Scales keep the Triforce about two thirds of
 * a tile, and its farthest corner inside the maskable safe circle.
 */
const ICONS = [
  { file: "icons/icon-192.png", scale: 4, shape: "tile", size: 192 },
  { file: "icons/icon-512.png", scale: 11, shape: "tile", size: 512 },
  { file: "icons/icon-maskable-512.png", scale: 9, shape: "square", size: 512 },
  { file: "apple-touch-icon.png", scale: 4, shape: "square", size: 180 },
];

/** Blocks each tile corner steps in, row by row from the edge. */
const CORNER_STEPS = [4, 2, 1, 1];

const check = process.argv.includes("--check");

/** The page background token, so the icons sit on the app's own colour. */
const background = (() => {
  const match = readFileSync(TOKENS, "utf8").match(
    /--color-bg:\s*(#[0-9a-f]{6})\s*;/i,
  );
  if (!match) throw new Error(`--color-bg not found in ${TOKENS}`);
  return match[1];
})();

/** One frame of an ICO file, rewrapped as an ICO holding only that frame. */
const extractFrame = (ico, size) => {
  const count = ico.readUInt16LE(4);
  for (let index = 0; index < count; index++) {
    const entry = 6 + 16 * index;
    if ((ico[entry] || 256) !== size) continue;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2); // type: icon
    header.writeUInt16LE(1, 4); // one image
    ico.copy(header, 6, entry, entry + 12);
    header.writeUInt32LE(22, 18); // its data follows this header
    return Buffer.concat([header, ico.subarray(offset, offset + length)]);
  }
  throw new Error(`no ${size} px frame in ${SOURCE}`);
};

const frame = extractFrame(readFileSync(SOURCE), FRAME_SIZE);

const browser = await chromium.launch();
const page = await browser.newPage();

const draw = (icon) =>
  page.evaluate(
    async ({ background, icon, source, steps }) => {
      const image = new Image();
      image.src = source;
      await image.decode();

      const { scale, shape, size } = icon;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.fillStyle = background;
      if (shape === "square") {
        context.fillRect(0, 0, size, size);
      } else {
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

      const art = image.width * scale;
      const offset = Math.round((size - art) / 2);
      context.imageSmoothingEnabled = false;
      context.drawImage(image, offset, offset, art, art);
      return canvas.toDataURL("image/png");
    },
    {
      background,
      icon,
      source: `data:image/x-icon;base64,${frame.toString("base64")}`,
      steps: CORNER_STEPS,
    },
  );

/** Whether two PNG files hold the same pixels, whatever their encoding. */
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
      const [left, right] = await Promise.all([pixels(a), pixels(b)]);
      return (
        left.length === right.length &&
        left.every((value, index) => value === right[index])
      );
    },
    [a, b],
  );

const stale = [];
for (const icon of ICONS) {
  const file = join(PUBLIC, icon.file);
  const png = await draw(icon);
  if (check) {
    const current = existsSync(file)
      ? `data:image/png;base64,${readFileSync(file).toString("base64")}`
      : null;
    if (!current || !(await samePixels(current, png))) stale.push(icon.file);
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(png.split(",")[1], "base64"));
  }
}

await browser.close();

for (const file of stale) console.log(`out of date: ${file}`);
if (stale.length > 0) process.exit(1);
console.log(`${ICONS.length} icons ${check ? "up to date" : "drawn"}`);
