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

test("moves a place's checks to its door, and notes a hole with its cave's door", async ({
  page,
}) => {
  await openCrosskeys(page);
  // Nothing noted: Blind's Hideout's checks wait for their door
  await expect(page.getByTestId("marker-blinds-hideout")).toHaveCount(0);
  await page.getByTestId("entrance-big-bomb-shop").click();
  await page.keyboard.type("blind");
  await page.getByTestId("entrance-option-blinds-hideout").click();
  // Now above the Big Bomb Shop's door, in the Dark World
  await expect(
    page.getByTestId("map-world-dark").getByTestId("marker-blinds-hideout"),
  ).toBeVisible();

  await page.getByTestId("entrance-kakariko-well-drop").click();
  await page.getByTestId("entrance-option-bat-cave-right").click();
  await expect(
    page.getByTestId("entrance-kakariko-well-cave"),
  ).toHaveAccessibleName("Kakariko Well Cave: leads to Bat Cave");
  // One step for both
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByTestId("entrance-kakariko-well-cave"),
  ).toHaveAccessibleName("Kakariko Well Cave: not known yet");
});

test("puts a check in logic through the doors noted", async ({ page }) => {
  await openCrosskeys(page);
  await expect(page.getByTestId("logic-note")).toHaveText(
    "The logic follows the entrances you noted: a check behind a door you have not noted stays out of logic.",
  );
  // Blind's Hideout behind Kakariko's shop, in the Light World: in logic
  // with nothing held
  await page.getByTestId("entrance-kakariko-shop").click();
  await page.keyboard.type("blind");
  await page.getByTestId("entrance-option-blinds-hideout").click();
  await expect(page.getByTestId("marker-blinds-hideout")).toHaveAccessibleName(
    "Blind's Hideout (5 checks): available",
  );
  // Behind the Big Bomb Shop, in the Dark World: out of logic. A target
  // leads from one entrance only, so it moves there
  await page.getByTestId("entrance-big-bomb-shop").click();
  await page.keyboard.type("blind");
  await page.getByTestId("entrance-option-blinds-hideout").click();
  await expect(page.getByTestId("marker-blinds-hideout")).toHaveAccessibleName(
    "Blind's Hideout (5 checks): out of logic",
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
