// Takes the README's screenshots (docs/screenshots/*.webp): the production
// build in Chromium, a run a little way in, nothing hovered.
//
// Usage, with the site's production build served (pnpm preview):
//   pnpm --filter @alltp/web exec node scripts/readme-screenshots.mjs <site url> [out dir]
//   e.g. http://localhost:4173/alltp-tracker/ ../../docs/screenshots
// Each PNG is then written as WebP at quality 92 with ImageMagick (`magick`):
// half the size of lossless, and the pixel art keeps its edges.
import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const run = promisify(execFile);
const [site, out = "../../docs/screenshots"] = process.argv.slice(2);
if (!site)
  throw new Error("Usage: readme-screenshots.mjs <site url> [out dir]");

const ALTTPR_ITEMS = [
  ...["boots", "hookshot", "lantern", "mirror", "flute", "hammer", "bow"],
  ...["glove", "sword", "sword", "moonpearl", "firerod", "item-boss0"],
  ...["item-boss1", "item-boss2"],
];

/**
 * Each shot: the game, the viewport (as tall as the board, never a full-page
 * capture: Chromium stretches the page's fixed background in those), the
 * clicks of its run, the map tab to show and how many markers in logic to
 * mark done.
 */
const SHOTS = [
  {
    checks: 12,
    clicks: ALTTPR_ITEMS,
    game: "alttpr",
    name: "alttpr",
    viewport: { height: 660, width: 1440 },
  },
  {
    checks: 6,
    clicks: ALTTPR_ITEMS,
    game: "alttpr",
    name: "phone",
    scale: 2,
    viewport: { height: 1020, width: 390 },
  },
  {
    clicks: [
      ...["morph", "varia", "bombs", "missile", "missile", "missile"],
      ...["missile", "superMissile", "charge", "hiJump", "energyTank", "wave"],
      ...["sm-objective-kraid", "sm-objective-phantoon"],
    ],
    game: "sm",
    name: "sm",
    scale: 1.5,
    viewport: { height: 490, width: 820 },
  },
  {
    checks: 6,
    clicks: [
      ...["morph", "varia", "missile", "bombs", "charge", "super"],
      ...["glove", "hammer", "moonPearl", "sword", "boots"],
    ],
    game: "smz3",
    name: "smz3",
    tab: "Zebes",
    viewport: { height: 1030, width: 1440 },
  },
];

const PREFIX = { alttpr: "item", sm: "sm-item", smz3: "smz3-item" };

const browser = await chromium.launch();
await mkdir(out, { recursive: true });
for (const shot of SHOTS) {
  const { checks = 0, clicks, game, name, scale = 1, tab, viewport } = shot;
  const context = await browser.newContext({
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport,
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
    const target = page.getByTestId(testId);
    if ((await target.count()) === 0) {
      console.warn(`${name}: no ${testId}`);
      continue;
    }
    await target.click();
  }
  if (tab) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForLoadState("networkidle");
  }
  // A few checks done, so the map shows the grey of a run under way
  const available = page.locator('[data-testid^="marker-"].available');
  for (let done = 0; done < checks && (await available.count()) > 0; done++) {
    await available.first().click();
  }
  await page.mouse.move(viewport.width - 1, viewport.height - 1);
  await page.evaluate(() => document.activeElement?.blur());
  const png = join(out, `${name}.png`);
  await page.screenshot({ path: png });
  await run("magick", [
    png,
    ...["-quality", "92", "-define", "webp:method=6"],
    join(out, `${name}.webp`),
  ]);
  await rm(png);
  await context.close();
}
await browser.close();
