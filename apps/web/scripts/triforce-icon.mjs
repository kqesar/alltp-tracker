#!/usr/bin/env node
// Cuts the Triforce hunt cell's icon, triforce.png, from the randomizer's
// own art: the Triforce piece of z3randomizer's data/customitems.png (MIT,
// KatDevsGames/z3randomizer at dcb0a2b42d14445f7994a0e9e4d63cbecf4b98d3,
// the commit vt pins), the sheet the ROM's item receipts are built from
// ("the second 16x16 is the triforce piece", itemdatatables.asm:37). The
// 16 px sprite at (16, 0) is stored at 2x like the other cells' art (each
// sprite pixel a 2 x 2 block), its own dark outline kept. The sheet is not
// kept in the repository: give the script a copy of it.
//
//   node scripts/triforce-icon.mjs <path to customitems.png>
//
// Decoding and encoding go through Chromium's canvas (the Playwright browser
// already installed for the e2e suite), so no image library is needed.
// Running it again writes the same file.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/assets",
);

/** The Triforce piece's 16 x 16 box in the sheet. */
const PIECE = { size: 16, x: 16, y: 0 };
const SCALE = 2;

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/triforce-icon.mjs <customitems.png>");
  process.exit(1);
}
const sheet = `data:image/png;base64,${readFileSync(source).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const png = await page.evaluate(
  async ({ sheet, piece, scale }) => {
    const image = new Image();
    image.src = sheet;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = piece.size * scale;
    canvas.height = piece.size * scale;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.drawImage(
      image,
      piece.x,
      piece.y,
      piece.size,
      piece.size,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return canvas.toDataURL("image/png").split(",")[1];
  },
  { piece: PIECE, scale: SCALE, sheet },
);
writeFileSync(join(ASSETS, "triforce.png"), Buffer.from(png, "base64"));
await browser.close();
