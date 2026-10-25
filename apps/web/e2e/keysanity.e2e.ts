import { expect, type Page, test } from "@playwright/test";
import { auditPage, setKeyCells, WIDTHS } from "./support";

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

      // Map pins: WCAG 2.5.8's exception, as on the tracker's own audit
      await auditPage(page, ".mapspan");

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

  test("records the castle dungeons' keys on their own row", async ({
    page,
  }) => {
    for (const [id, short] of [
      ["hyrule-castle", "HC"],
      ["ganons-tower", "GT"],
    ]) {
      await expect(page.getByTestId(`key-label-${id}`)).toHaveText(short);
    }
    // Castle Tower's keys are headed by Agahnim, where its label would be
    await expect(page.getByTestId("item-agahnim")).toBeVisible();
    await expect(page.getByTestId("big-key-12")).toHaveAccessibleName(
      "Ganon's Tower big key: not obtained",
    );
    await expect(page.getByTestId("big-key-10")).toHaveCount(0);

    // Through the barrier with the cape, a sword for Agahnim, the lamp for
    // the dark maze: Agahnim wants Castle Tower's two keys too
    await page.getByTestId("item-cape").click();
    await page.getByTestId("item-sword").click();
    await page.getByTestId("item-lantern").click();
    const agahnim = page.getByTestId("boss-marker-castle-tower");
    await expect(agahnim).toHaveAccessibleName(
      /^Castle Tower: boss out of logic,/,
    );

    const keys = page.getByTestId("small-key-11");
    await keys.click();
    await keys.click();
    await expect(keys).toHaveAccessibleName("Castle Tower small keys: 2 of 2");
    await expect(agahnim).toHaveAccessibleName(
      /^Castle Tower: boss available,/,
    );

    // The keys and labels go with the key cells; Agahnim and Ganon's Tower's
    // cell stay
    await setKeyCells(page, false);
    await expect(page.getByTestId("key-label-hyrule-castle")).toBeEmpty();
    await expect(page.getByTestId("item-agahnim")).toBeVisible();
    await expect(page.getByTestId("small-key-11")).toHaveCount(0);
    await expect(page.getByTestId("item-boss12")).toBeVisible();
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
