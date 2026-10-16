import { inflateSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

/** OBS-typical browser source sizes, a very wide strip last. */
const SOURCES = [
  [300, 260],
  [400, 350],
  [800, 700],
  [1920, 1080],
  [1920, 200],
] as const;

/** Open the stream view with nothing tracked. */
const openObsView = async (page: Page) => {
  await page.goto("./?view=obs");
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

/**
 * The alpha of one pixel of the page, rendered as OBS composites it: over
 * nothing. A 1×1 PNG holds a single scanline, which every PNG filter leaves
 * unchanged when there is no pixel before or above it.
 */
const alphaAt = async (page: Page, x: number, y: number) => {
  const png = await page.screenshot({
    clip: { height: 1, width: 1, x, y },
    omitBackground: true,
  });
  const colourType = png[25];
  let idat = Buffer.alloc(0);
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    if (png.toString("latin1", at + 4, at + 8) === "IDAT") {
      idat = Buffer.concat([idat, png.subarray(at + 8, at + 8 + length)]);
    }
    at += length + 12;
  }
  // [filter type, R, G, B, A]: colour type 6 is RGBA, anything else opaque
  return colourType === 6 ? inflateSync(idat)[4] : 255;
};

/** The cell size the view applied, in CSS px. */
const cellOf = (page: Page) =>
  page
    .getByTestId("obs-view")
    .evaluate((stage) =>
      Number.parseFloat(getComputedStyle(stage).getPropertyValue("--cell")),
    );

test.describe("the stream view", () => {
  test("draws only the grid, on a transparent page, and passes axe", async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        problems.push(`${response.status()} ${response.url()}`);
      }
    });
    await openObsView(page);

    // The page and everything in the grid but its controls paint nothing
    const painted = await page.evaluate(() =>
      [
        document.documentElement,
        document.body,
        ...document.querySelectorAll(
          "[data-testid='obs-view'], [data-testid='item-grid'], [data-testid='item-grid'] *:not(button, button *)",
        ),
      ]
        .map((element) => ({
          element,
          style: getComputedStyle(element),
        }))
        .filter(
          ({ style }) =>
            style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
            style.backgroundImage !== "none",
        )
        .map(({ element }) => `${element.tagName}.${element.className}`),
    );
    expect(painted).toEqual([]);
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("toolbar")).toHaveCount(0);
    await expect(page.getByTestId("map-tracker")).toHaveCount(0);

    // A half cell at the grid's side, and the corner of an item not held:
    // the app's dimming veil would paint that one dark
    const grid = await page.getByTestId("item-grid").boundingBox();
    const hammer = await page.getByTestId("item-hammer").boundingBox();
    expect(grid && hammer).toBeTruthy();
    if (!grid || !hammer) return;
    const cell = await cellOf(page);
    expect(await alphaAt(page, grid.x + cell / 4, grid.y + cell / 2)).toBe(0);
    expect(await alphaAt(page, hammer.x + 2, hammer.y + 2)).toBe(0);
    // ...while the icon itself is drawn
    expect(
      await alphaAt(
        page,
        hammer.x + hammer.width / 2,
        hammer.y + hammer.height / 2,
      ),
    ).toBe(255);

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_AA)
      .analyze();
    expect(violations.map(({ id, nodes }) => `${id} ×${nodes.length}`)).toEqual(
      [],
    );
    expect(await unreachableClickables(page)).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("paints a valid bg colour, and ignores anything else", async ({
    page,
  }) => {
    await page.goto("./?view=obs&bg=00ff00");
    await expect(page.getByTestId("obs-view")).toHaveCSS(
      "background-color",
      "rgb(0, 255, 0)",
    );

    await page.goto("./?view=obs&bg=red;background-image:url(x)");
    await expect(page.getByTestId("item-grid")).toBeVisible();
    await expect(page.getByTestId("obs-view")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(page.getByTestId("obs-view")).toHaveCSS(
      "background-image",
      "none",
    );
  });

  test("fills every source size, whole-pixel, centred and unscrolled", async ({
    page,
  }) => {
    await openObsView(page);

    for (const [width, height] of SOURCES) {
      await page.setViewportSize({ height, width });
      // The resize event fires in the next rendering update: wait two frames
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

      const cell = await cellOf(page);
      const rows = await page.getByTestId("grid-row").count();
      const grid = await page.getByTestId("item-grid").boundingBox();
      const flute = await page.getByTestId("item-flute").boundingBox();
      const scroll = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - window.innerWidth,
        y: document.documentElement.scrollHeight - window.innerHeight,
      }));
      const where = `at ${width}×${height}`;
      expect(grid && flute, where).toBeTruthy();
      if (!grid || !flute) return;

      expect(Number.isInteger(cell), where).toBe(true);
      expect(flute.width, where).toBe(cell);
      expect(grid.height, where).toBe(rows * cell);
      // Inside the source, centred to the pixel, with no scrollbar
      expect(grid.x, where).toBeGreaterThanOrEqual(0);
      expect(grid.y, where).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(grid.x) && Number.isInteger(grid.y), where).toBe(
        true,
      );
      expect(
        Math.abs(grid.x - (width - grid.x - grid.width)),
        where,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(grid.y - (height - grid.y - grid.height)),
        where,
      ).toBeLessThanOrEqual(1);
      expect(scroll, where).toEqual({ x: 0, y: 0 });
      // As large as it can be, short of an eighth given up for crispness
      const room = Math.min(width / 8, height / rows);
      expect(cell, where).toBeGreaterThanOrEqual(Math.floor(room * (7 / 8)));
    }
  });

  test("follows the tracker live, and the tracker follows it", async ({
    context,
    page,
  }) => {
    await openObsView(page);
    const tracker = await context.newPage();
    await tracker.goto("./");

    await tracker.getByTestId("item-hammer").click();
    await expect(page.getByTestId("item-hammer")).toHaveAccessibleName(
      /^Hammer, obtained\./,
    );

    // A click through OBS's Interact window reaches the dock the same way
    await page.getByTestId("item-hookshot").click();
    await expect(tracker.getByTestId("item-hookshot")).toHaveAccessibleName(
      /^Hookshot, obtained\./,
    );

    // The key cells add a row: the view refits to keep it on screen
    const before = await cellOf(page);
    await tracker.getByTestId("key-cells-toggle").click();
    await expect(page.getByTestId("grid-row")).toHaveCount(7);
    const after = await cellOf(page);
    const grid = await page.getByTestId("item-grid").boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    expect(after).toBeLessThan(before);
    expect(grid && grid.y + grid.height).toBeLessThanOrEqual(height);
  });
});

for (const width of WIDTHS) {
  test.describe(`the stream view dialog at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("fits, passes axe and is keyboard-reachable", async ({ page }) => {
      await page.goto("./");
      await page.getByTestId("stream-view-button").click();
      const dialog = page.getByRole("dialog", { name: "Stream view" });
      await expect(dialog).toBeVisible();

      const box = await dialog.boundingBox();
      expect(box).toBeTruthy();
      if (!box) return;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);

      const { violations } = await new AxeBuilder({ page })
        .include("dialog")
        .withTags(WCAG_AA)
        .analyze();
      expect(
        violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
      ).toEqual([]);
      expect(await unreachableClickables(page)).toEqual([]);
    });
  });
}

test.describe("the stream view dialog", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies the view's address and links to it", async ({
    baseURL,
    page,
  }) => {
    const url = `${baseURL}?view=obs`;
    await page.goto("./");
    await page.getByTestId("stream-view-button").click();

    await expect(page.getByTestId("stream-view-url")).toHaveValue(url);
    await page.getByTestId("stream-view-copy").click();

    await expect(page.getByTestId("stream-view-status")).toHaveText("Copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
    await expect(page.getByTestId("stream-view-open")).toHaveAttribute(
      "href",
      url,
    );
  });
});
