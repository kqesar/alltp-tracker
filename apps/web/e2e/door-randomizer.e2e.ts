import { expect, type Page, test } from "@playwright/test";
import { auditPage, WIDTHS } from "./support";

/** A Door Randomizer run on an empty board, its key pots shuffled. */
const openDoorRun = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByRole("button", { name: /^Mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a run type" });
  await dialog.getByRole("button", { name: /^Door Randomizer/ }).click();
  await page.getByRole("button", { name: "Switch & reset" }).click();
  await page.getByRole("button", { name: /^Mode/ }).click();
  await dialog.getByRole("combobox", { name: "Pottery" }).selectOption("keys");
  return dialog;
};

test("a Door Randomizer run lists its key pots, checked in place, the map saying whose logic", async ({
  page,
}) => {
  const dialog = await openDoorRun(page);
  await expect(
    dialog.getByRole("combobox", { name: "Door shuffle" }),
  ).toHaveValue("vanilla");
  await auditPage(page);
  await dialog.getByRole("button", { name: "Close" }).first().click();

  await expect(page.getByTestId("logic-note-door")).toHaveText(
    /Door Randomizer seed: dungeon logic from alttpr\.com's v31 until DR's own is ported\./,
  );
  await page.getByTestId("map-view-tab-checks").click();
  const row = page.getByTestId("check-row-eastern-palace/dark-square-pot-key");
  await expect(row).toBeVisible();
  await expect(row).toContainText("maybe", { ignoreCase: true });
  // Done rows shown, so the row stays as it is ticked
  await page.getByTestId("checks-filter-opened").check();
  await row.getByRole("checkbox").check();
  await expect(row.getByRole("checkbox")).toBeChecked();
  await auditPage(page);

  // Kept across a reload, with the run
  await page.reload();
  await page.getByTestId("map-view-tab-checks").click();
  await page.getByTestId("checks-filter-opened").check();
  await expect(
    page
      .getByTestId("check-row-eastern-palace/dark-square-pot-key")
      .getByRole("checkbox"),
  ).toBeChecked();
});

test("a door shuffle is named and every check left maybe", async ({ page }) => {
  const dialog = await openDoorRun(page);
  await dialog
    .getByRole("combobox", { name: "Door shuffle" })
    .selectOption("crossed");
  await dialog.getByRole("button", { name: "Close" }).first().click();
  await expect(page.getByTestId("logic-note")).toHaveText(
    "The tracker has no logic for Crossed door shuffle yet: every check shows as maybe.",
  );
});

for (const width of WIDTHS) {
  test(`a Door Randomizer run's settings fit the Mode dialog at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    const dialog = await openDoorRun(page);
    const pottery = dialog.getByRole("combobox", { name: "Pottery" });
    await pottery.scrollIntoViewIfNeeded();
    const [box, select] = await Promise.all([
      dialog.boundingBox(),
      pottery.boundingBox(),
    ]);
    if (!(box && select)) throw new Error("no box");
    expect(select.x).toBeGreaterThanOrEqual(box.x);
    expect(select.x + select.width).toBeLessThanOrEqual(box.x + box.width);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}
