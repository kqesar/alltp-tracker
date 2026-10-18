import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

const openTracker = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

const runTypes = (page: Page) =>
  page.getByRole("dialog", { name: "Choose a run type" });

test("tunes a setting in place: the run stays, one undo takes it back", async ({
  page,
}) => {
  await openTracker(page);
  const hookshot = page.getByTestId("item-hookshot");
  await hookshot.click();

  await page.getByRole("button", { name: /^Mode/ }).click();
  const pool = runTypes(page).getByRole("combobox", { name: "Item pool" });
  await pool.selectOption("hard");
  await expect(pool).toHaveValue("hard");
  await runTypes(page).getByRole("button", { name: "Close" }).click();

  await expect(hookshot).toHaveAccessibleName(/^Hookshot, obtained\./);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("alltp-tracker-state") ?? "{}").state,
  );
  expect(saved.settings.itemPool).toBe("hard");

  await page.getByTestId("undo").click();
  await page.getByRole("button", { name: /^Mode/ }).click();
  await expect(pool).toHaveValue("normal");
  await expect(hookshot).toHaveAccessibleName(/^Hookshot, obtained\./);
});

for (const width of WIDTHS) {
  test(`the run's tunable settings pass axe and fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await openTracker(page);
    await page.getByRole("button", { name: /^Mode/ }).click();
    const dialog = runTypes(page);
    await expect(dialog.getByRole("combobox")).toHaveCount(6);

    const { violations } = await new AxeBuilder({ page })
      .include(".run-settings")
      .withTags(WCAG_AA)
      .analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);
    const summary = await dialog.locator(".run-settings").boundingBox();
    const box = await dialog.boundingBox();
    expect(summary).not.toBeNull();
    expect(box).not.toBeNull();
    if (summary && box) {
      expect(summary.x + summary.width).toBeLessThanOrEqual(box.x + box.width);
    }
    expect(await unreachableClickables(page, "dialog[open]")).toEqual([]);
  });
}
