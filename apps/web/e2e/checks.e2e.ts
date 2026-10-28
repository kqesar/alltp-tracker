import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  focusedTestId,
  unreachableClickables,
  WCAG_AA,
  WIDTHS,
} from "./support";

/**
 * A run at its end: every item, the ten dungeons and Agahnim beaten, their
 * prizes and both medallions known (END_GAME in packs/alttpr's goals.spec).
 */
const END_GAME = readFileSync(
  join(import.meta.dirname, "fixtures/end-game.json"),
  "utf8",
);

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

  test("leaves a chest unopened at 0 once the dungeon's checks are ticked", async ({
    page,
  }) => {
    await openTracker(page);
    await showAllChecks(page);
    await page.getByTestId("checks-zone").selectOption("Eastern Palace");
    for (const id of ["cannonball-chest", "map-chest", "big-chest"]) {
      await page
        .getByTestId(`check-row-eastern-palace/${id}`)
        .getByRole("checkbox")
        .check();
    }
    // Its counter down to 0: the compass chest holds a dungeon item only
    for (let item = 0; item < 3; item++) {
      await page.getByTestId("chest-overlay-0").click();
    }

    const compass = page.getByTestId("check-row-eastern-palace/compass-chest");
    await expect(compass).toContainText("Available");
    await expect(compass.getByRole("checkbox")).not.toBeChecked();
    await expect(compass.getByRole("checkbox")).toBeEnabled();
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

test.describe("go mode", () => {
  test("is not yet on a fresh run, and says what it misses", async ({
    page,
  }) => {
    await openTracker(page);
    const goMode = page.getByTestId("go-mode");
    await expect(goMode).toHaveAccessibleName("Go mode: not yet");

    await goMode.click();

    const panel = page.getByTestId("go-mode-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(
      "More than three items away, crystals aside.",
    );
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });

  test("lists the items left, crystals aside, accessibly at every width", async ({
    page,
  }) => {
    // Fast Ganon without Agahnim, the gloves, the Hammer, the Moon Pearl and
    // Turtle Rock's crystal: three ways, the crystal left out of each
    const run = JSON.parse(END_GAME);
    Object.assign(run.state.items, {
      agahnim: 0,
      boss8: 0,
      glove: 0,
      hammer: false,
      moonpearl: false,
    });
    run.state.settings.goal = "fast-ganon";
    await openTracker(page, JSON.stringify(run));
    const goMode = page.getByTestId("go-mode");
    await expect(goMode).toHaveAccessibleName("Go mode: 2 items left");
    await expect(page.getByTestId("go-mode-status")).toHaveText(
      "Go mode: not yet",
    );

    for (const width of WIDTHS) {
      await page.setViewportSize({ height: width < 600 ? 844 : 900, width });
      await goMode.click();
      const panel = page.getByTestId("go-mode-panel");
      await expect(panel).toBeVisible();
      await expect(panel).toContainText(
        "Missing, crystals aside, one of these:",
      );
      const ways = page.getByTestId("go-mode-way");
      await expect(ways).toHaveCount(3);
      for (const [index, items] of [
        ["Agahnim", "Moon Pearl"],
        ["Titan's Mitt", "Moon Pearl"],
        ["Power Glove", "Hammer", "Moon Pearl"],
      ].entries()) {
        await expect(ways.nth(index).getByRole("listitem")).toHaveText(items);
      }
      await expect(panel).not.toContainText("crystals left");
      const box = await panel.boundingBox();
      expect((box?.x ?? -1) >= 0, `${width}`).toBe(true);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);

      // Map pins closer than 24 px fall under WCAG 2.5.8's exception
      const { violations } = await new AxeBuilder({ page })
        .withTags(WCAG_AA)
        .exclude(".mapspan")
        .analyze();
      expect(
        violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
        `${width}`,
      ).toEqual([]);
      expect(await unreachableClickables(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
    }
  });

  test("says only crystals are left, the button too", async ({ page }) => {
    const run = JSON.parse(END_GAME);
    Object.assign(run.state.items, { boss7: 0, boss8: 0, boss9: 0 });
    await openTracker(page, JSON.stringify(run));

    const goMode = page.getByTestId("go-mode");
    await expect(goMode).toHaveAccessibleName("Go mode: crystals left");
    await goMode.click();
    await expect(page.getByTestId("go-mode-panel")).toHaveText(
      "Only crystals left.",
    );
  });

  test("is on at the end of a run", async ({ page }) => {
    await openTracker(page, END_GAME);

    await expect(page.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: in logic",
    );
    await page.getByTestId("go-mode").click();
    await expect(page.getByTestId("go-mode-panel")).toContainText(
      "Every step to the goal is in logic.",
    );
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
      await page.getByTestId("zone-why-eastern-palace").click();
      await expect(
        page.getByTestId("zone-missing-eastern-palace"),
      ).toContainText(": Big Key Chest");
      await page.getByTestId("check-why-library").click();
      await page.getByTestId("go-mode").click();

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

    test("says what a dungeon's checks are missing in a tooltip that fits the screen", async ({
      page,
    }) => {
      await openTracker(page);
      // Ganon's Tower: the longest list, every check out of logic
      await page.getByTestId("item-boss12").hover();

      const tooltip = page.getByTestId("tooltip");
      await expect(tooltip).toContainText("Ganon's Tower");
      await expect(page.getByTestId("tooltip-missing")).toBeVisible();
      await expect(page.getByTestId("tooltip-pending")).toHaveCount(0);
      const groups = page.getByTestId("missing-group");
      expect(await groups.count()).toBeGreaterThan(0);
      const box = await tooltip.boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewport?.width ?? 0,
      );
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        viewport?.height ?? 0,
      );
      // Map pins sit where the location is: WCAG 2.5.8's exception
      const { violations } = await new AxeBuilder({ page })
        .withTags(WCAG_AA)
        .exclude(".mapspan")
        .analyze();
      expect(
        violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
      ).toEqual([]);
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
