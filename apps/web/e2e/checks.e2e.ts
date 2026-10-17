import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  focusedTestId,
  unreachableClickables,
  WCAG_AA,
  WIDTHS,
} from "./support";

/** Load the tracker with nothing tracked, or with a localStorage save. */
const openTracker = async (page: Page, saved?: string) => {
  await page.goto("./");
  await page.evaluate((value) => {
    localStorage.clear();
    if (value) localStorage.setItem("alltp-tracker-state", value);
  }, saved);
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

/** Open the Checks view with every state shown. */
const showAllChecks = async (page: Page) => {
  await page.getByTestId("map-view-tab-checks").click();
  for (const state of ["seen", "unavailable", "opened"]) {
    await page.getByTestId(`checks-filter-${state}`).check();
  }
};

test.describe("the Checks panel", () => {
  test("moves the Library to available once the boots are held", async ({
    page,
  }) => {
    await openTracker(page);
    await showAllChecks(page);
    const library = page.getByTestId("check-row-library");
    await expect(library).toContainText("Out of logic");

    await page.getByTestId("item-boots").click();

    await expect(library).toContainText("Available");
    await expect(page.getByTestId("check-why-library")).toHaveCount(0);
  });

  test("says why the Library is out of logic", async ({ page }) => {
    await openTracker(page);
    await showAllChecks(page);
    const why = page.getByTestId("check-why-library");
    await expect(why).toHaveAccessibleName("Why? Library");

    await why.click();

    await expect(why).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("check-row-library")).toContainText(
      "Missing: Pegasus Boots",
    );
  });

  test("checks a location on the map too, and hands the focus on", async ({
    page,
  }) => {
    await openTracker(page);
    await page.getByTestId("map-view-tab-checks").click();
    const first = page
      .getByTestId("check-row-sahasrahlas-hut/left")
      .getByRole("checkbox");
    const next = page
      .getByTestId("check-row-sahasrahlas-hut/middle")
      .getByRole("checkbox");

    await first.focus();
    await page.keyboard.press("Space");

    // Checked, the row leaves the list shown: its neighbour takes the focus
    await expect(
      page.getByTestId("check-row-sahasrahlas-hut/left"),
    ).toHaveCount(0);
    await expect(next).toBeFocused();
    await expect(page.getByTestId("checks-filter-opened")).not.toBeChecked();
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("alltp-tracker-state") ?? "{}").state,
    );
    expect(saved.checked).toEqual({ "sahasrahlas-hut/left": true });
  });

  test("keeps the view, and shows a cleared dungeon's checks done", async ({
    page,
  }) => {
    await openTracker(page);
    await showAllChecks(page);
    await page.getByTestId("checks-zone").selectOption("Eastern Palace");
    // Its counter down to 0: every chest found
    for (let item = 0; item < 3; item++) {
      await page.getByTestId("chest-overlay-0").click();
    }

    const boxes = page.getByTestId("checks-panel").getByRole("checkbox", {
      name: /Chest/,
    });
    await expect(boxes.first()).toBeChecked();
    await expect(boxes.first()).toBeDisabled();
    await page.reload();
    await expect(page.getByTestId("checks-panel")).toBeVisible();
  });

  test("skips to the checks from the keyboard", async ({ page }) => {
    await openTracker(page);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to checks" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("checks-panel")).toBeVisible();
    await expect(page.locator("#map-view")).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await focusedTestId(page)).toBe("checks-filter-available");
  });
});

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("shows every check within the page, accessibly", async ({ page }) => {
      await openTracker(page);
      await showAllChecks(page);
      await page.getByTestId("check-why-library").click();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      const { violations } = await new AxeBuilder({ page })
        .withTags(WCAG_AA)
        .analyze();

      expect(overflow).toBeLessThanOrEqual(0);
      expect(
        violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
      ).toEqual([]);
      expect(await unreachableClickables(page)).toEqual([]);
    });

    test("switches the view with the arrow keys", async ({ page }) => {
      await openTracker(page);
      await page.getByTestId("map-view-tab-map").focus();

      await page.keyboard.press("ArrowRight");

      await expect(page.getByTestId("map-view-tab-checks")).toBeFocused();
      await expect(page.getByTestId("map-view-tab-checks")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.getByTestId("checks-panel")).toBeVisible();
    });
  });
}
