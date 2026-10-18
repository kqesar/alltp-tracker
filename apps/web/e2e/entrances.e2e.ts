import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

/** A fresh Crosskeys run: its entrances are shuffled. */
const openCrosskeys = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page
    .getByRole("dialog", { name: "Choose a run type" })
    .getByRole("button", { name: /^Crosskeys/ })
    .click();
  await page.getByRole("button", { name: "Switch & reset" }).click();
  await expect(page.getByTestId("entrance-kakariko-shop")).toBeVisible();
};

test("notes where an entrance leads, from the map and from the list", async ({
  page,
}) => {
  await openCrosskeys(page);
  await expect(page.getByTestId(/^entrance-/)).toHaveCount(138);

  await page.getByTestId("entrance-kakariko-shop").click();
  const picker = page.getByRole("dialog", {
    name: "Where does Kakariko Shop lead?",
  });
  await expect(picker).toBeVisible();
  // The search takes the focus as the picker opens
  await expect(picker.getByRole("searchbox")).toBeFocused();
  const { violations } = await new AxeBuilder({ page })
    .include("dialog[open]")
    .withTags(WCAG_AA)
    .analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);
  await page.keyboard.type("elder east");
  await picker.getByRole("button", { name: /Elder House \(East\)/ }).click();
  await expect(page.getByTestId("entrance-kakariko-shop")).toHaveAccessibleName(
    "Kakariko Shop: leads to Elder House (East)",
  );

  // The list says it too, and opens the same picker
  await page.getByRole("tab", { name: "Entrances" }).click();
  await expect(page.getByTestId("entrances-summary")).toHaveText(
    "1 of 138 entrances noted",
  );
  await page
    .getByRole("button", { name: /^Blind's Hideout: not known yet/ })
    .click();
  await page
    .getByRole("dialog", { name: "Where does Blind's Hideout lead?" })
    .getByRole("button", { name: /Elder House \(East\)/ })
    .click();
  // A target leads from one entrance only: it moved
  await expect(page.getByTestId("entrances-summary")).toHaveText(
    "1 of 138 entrances noted",
  );
  await expect(page.getByTestId("entrance-row-blinds-hideout")).toContainText(
    "Elder House (East)",
  );
});

for (const width of WIDTHS) {
  test(`the entrances fit, pass axe and are keyboard-reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await openCrosskeys(page);
    // Map pins sit closer than 24 px: WCAG 2.5.8's exception (tracker.e2e.ts)
    const map = await new AxeBuilder({ page })
      .include(".map-panel")
      .exclude(".mapspan")
      .withTags(WCAG_AA)
      .analyze();
    expect(map.violations.map(({ id }) => id)).toEqual([]);

    await page.getByRole("tab", { name: "Entrances" }).click();
    await expect(page.getByTestId("entrances-panel")).toBeVisible();
    const list = await new AxeBuilder({ page })
      .include("[data-testid=entrances-panel]")
      .withTags(WCAG_AA)
      .analyze();
    expect(list.violations.map(({ id }) => id)).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await unreachableClickables(page, "[data-testid=entrances-panel]"),
    ).toEqual([]);
  });
}
