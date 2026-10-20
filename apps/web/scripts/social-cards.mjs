// Draws the link preview image of each game (public/social/<id>.png, 1200 x 630,
// what Open Graph and X's large card use): a real screenshot of the tracker,
// a few items found, never a stock graphic.
//
// Usage, with the site's production build served (pnpm preview):
//   pnpm --filter @alltp/web exec node scripts/social-cards.mjs <site url> [out dir]
//   e.g. http://localhost:4173/alltp-tracker/
// The screenshot is then cut to 128 colours with ImageMagick (`magick`): the
// board has fewer, and the file drops from about 500 kB to 170 kB.
import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const run = promisify(execFile);
const [site, out = "public/social"] = process.argv.slice(2);
if (!site) throw new Error("Usage: social-cards.mjs <site url> [out dir]");

/**
 * What each game's board shows: the clicks of a run a little way in, and the
 * page's zoom. A board that fills 1200 px (A Link to the Past's and SMZ3's
 * maps) is shot as is; Super Metroid's, with no map, is shot at half the
 * width and twice the pixel density, so it fills the card as large.
 */
const RUNS = {
  alttpr: {
    clicks: [
      ...["boots", "hookshot", "lantern", "mirror", "flute", "hammer", "bow"],
      ...["glove", "sword", "sword", "item-boss0", "item-boss1"],
    ],
    scale: 1,
  },
  sm: {
    clicks: [
      ...["morph", "varia", "bombs", "missile", "missile", "missile"],
      ...["missile", "missile", "missile"],
      ...["sm-objective-kraid", "sm-objective-phantoon"],
    ],
    scale: 1.5,
  },
  smz3: {
    clicks: ["morph", "varia", "missile", "glove", "hammer", "moonPearl"],
    scale: 1,
  },
};

const WIDTH = 1200;
const HEIGHT = 630;

const PREFIX = { alttpr: "item", sm: "sm-item", smz3: "smz3-item" };

const browser = await chromium.launch();
await mkdir(out, { recursive: true });
for (const [game, { clicks, scale }] of Object.entries(RUNS)) {
  const context = await browser.newContext({
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: HEIGHT / scale, width: WIDTH / scale },
  });
  await context.addInitScript(
    (id) => localStorage.setItem("alltp-tracker-game", id),
    game,
  );
  const page = await context.newPage();
  await page.goto(site);
  await page.getByTestId("toolbar").waitFor();
  for (const click of clicks) {
    const testId = click.includes("-") ? click : `${PREFIX[game]}-${click}`;
    await page.getByTestId(testId).click();
  }
  // Nothing hovered or focused: no tooltip, no focus ring
  await page.mouse.move(WIDTH / scale - 1, HEIGHT / scale - 1);
  await page.evaluate(() => document.activeElement?.blur());
  const file = join(out, `${game}.png`);
  await page.screenshot({ path: file });
  await run("magick", [
    file,
    ...["-colors", "128", "-dither", "None"],
    ...["-define", "png:compression-level=9", file],
  ]);
  await context.close();
}
await browser.close();
