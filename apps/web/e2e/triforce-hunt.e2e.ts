import { expect, type Page, test } from "@playwright/test";
import { auditPage, WIDTHS } from "./support";

/** A Triforce Hunt run on an empty board. */
const openHunt = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page
    .getByRole("dialog", { name: "Choose a run type" })
    .getByRole("button", { name: /^Triforce Hunt/ })
    .click();
  await page.getByRole("button", { name: "Switch & reset" }).click();
};

test("a regular run has no Triforce cell", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await expect(page.getByTestId("item-triforce")).toHaveCount(0);
});

test("a Triforce Hunt counts its pieces and tells when the goal is in reach", async ({
  page,
}) => {
  await openHunt(page);
  const cell = page.getByTestId("item-triforce");
  await expect(cell).toHaveAccessibleName(
    "Triforce pieces: 0/20. Click to add a piece.",
  );
  await expect(cell).toHaveText("0/20");
  await expect(page.getByTestId("go-mode")).toHaveText(
    /Go mode: 20 pieces left/,
  );

  // A click a piece, a right-click one off, never past none
  await cell.click();
  await cell.click();
  await expect(cell).toHaveText("2/20");
  await cell.click({ button: "right" });
  await expect(cell).toHaveText("1/20");
  await cell.click({ button: "right" });
  await cell.click({ button: "right" });
  await expect(cell).toHaveText("0/20");

  // By keyboard from the cell itself, to the pieces asked for
  await cell.focus();
  for (let step = 0; step < 19; step++) await page.keyboard.press("Space");
  await expect(cell).toHaveText("19/20");
  await expect(page.getByTestId("go-mode")).toHaveText(/Go mode: 1 piece left/);
  await page.keyboard.press("Space");
  await expect(cell).toHaveText("20/20");
  await expect(page.getByTestId("go-mode")).toHaveText(/Go mode: in logic/);

  // Kept across a reload, with the run
  await page.reload();
  await expect(page.getByTestId("item-triforce")).toHaveText("20/20");
});

for (const width of WIDTHS) {
  test(`a Triforce Hunt's cell fits the grid at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await openHunt(page);
    await page.getByTestId("item-triforce").click();

    const [grid, cell, count] = await Promise.all([
      page.getByTestId("item-grid").boundingBox(),
      page.getByTestId("item-triforce").boundingBox(),
      page.locator(".pieces-cell__count").boundingBox(),
    ]);
    if (!(grid && cell && count)) throw new Error("no box");
    // In the grid, under its last row, and the count inside its cell
    expect(cell.x).toBeGreaterThanOrEqual(grid.x);
    expect(cell.x + cell.width).toBeLessThanOrEqual(grid.x + grid.width + 0.5);
    expect(cell.y + cell.height).toBeLessThanOrEqual(
      grid.y + grid.height + 1.5,
    );
    expect(count.x).toBeGreaterThanOrEqual(cell.x - 0.5);
    expect(count.x + count.width).toBeLessThanOrEqual(
      cell.x + cell.width + 0.5,
    );
    expect(count.y + count.height).toBeLessThanOrEqual(
      cell.y + cell.height + 0.5,
    );

    await auditPage(page, ".mapspan");
  });
}
