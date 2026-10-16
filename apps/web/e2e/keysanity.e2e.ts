import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

/** A keysanity run, its key cells shown, as localStorage keeps it. */
const KEYSANITY = JSON.stringify({
  state: {
    bigKeysVisible: true,
    game: "alttpr",
    presetId: "keysanity",
    settings: {
      entranceShuffle: "none",
      goal: "ganon",
      keysanity: true,
      mode: "open",
    },
  },
  version: 7,
});

/** Load the tracker on a fresh keysanity run. */
const openKeysanity = async (page: Page) => {
  await page.goto("./");
  await page.evaluate((value) => {
    localStorage.clear();
    localStorage.setItem("alltp-tracker-state", value);
  }, KEYSANITY);
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

for (const width of WIDTHS) {
  test.describe(`a keysanity grid at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("passes axe, fits, and lets a keyboard reach its key cells", async ({
      page,
    }) => {
      await openKeysanity(page);
      await expect(page.getByTestId("map-9")).toBeVisible();

      const { violations } = await new AxeBuilder({ page })
        .withTags(WCAG_AA)
        // Map pins: WCAG 2.5.8's exception, as on the tracker's own audit
        .exclude(".mapspan")
        .analyze();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );

      expect(
        violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
      ).toEqual([]);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(await unreachableClickables(page)).toEqual([]);

      // The arrow keys walk a key cell's four controls, in reading order
      await page.getByTestId("map-3").focus();
      const walked = [];
      for (let step = 0; step < 4; step++) {
        walked.push(
          await page.evaluate(() =>
            document.activeElement?.getAttribute("data-testid"),
          ),
        );
        await page.keyboard.press("ArrowRight");
      }
      expect(walked).toEqual([
        "map-3",
        "compass-3",
        "small-key-3",
        "big-key-3",
      ]);
    });
  });
}

test.describe("a keysanity run", () => {
  test.beforeEach(({ page }) => openKeysanity(page));

  test("gives Eastern Palace, which has no small key in v31, no small key cell", async ({
    page,
  }) => {
    await expect(page.getByTestId("big-key-0")).toHaveAccessibleName(
      "Eastern Palace big key: not obtained",
    );
    await expect(page.getByTestId("small-key-0")).toHaveCount(0);
    await expect(page.getByTestId("small-key-1")).toHaveAccessibleName(
      "Desert Palace small keys: 0 of 1",
    );
  });

  test("turns a boss from maybe to yes with its dungeon's map and compass", async ({
    page,
  }) => {
    // The bow (its second step), the lamp and Eastern Palace's big key
    await page.getByTestId("item-bow").click();
    await page.getByTestId("item-bow").click();
    await page.getByTestId("item-lantern").click();
    await page.getByTestId("big-key-0").click();
    const boss = page.getByTestId("boss-marker-eastern-palace");
    await expect(boss).toHaveAccessibleName(
      /^Eastern Palace: boss maybe available,/,
    );

    const map = page.getByTestId("map-0");
    await expect(map).toHaveAccessibleName("Eastern Palace map: not obtained");
    await map.click();
    await expect(map).toHaveAccessibleName("Eastern Palace map: obtained");
    await expect(boss).toHaveAccessibleName(
      /^Eastern Palace: boss maybe available,/,
    );

    await page.getByTestId("compass-0").click();
    await expect(page.getByTestId("compass-0")).toHaveAccessibleName(
      "Eastern Palace compass: obtained",
    );
    await expect(boss).toHaveAccessibleName(/^Eastern Palace: boss available,/);
  });
});
