import { expect, type Page, test } from "@playwright/test";

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
});
