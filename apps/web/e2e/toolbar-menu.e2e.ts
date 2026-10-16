import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

/** Load the tracker with nothing tracked. */
const openTracker = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

/** How many rows the toolbar's controls take. */
const toolbarRows = (page: Page) =>
  page.getByTestId("toolbar").evaluate((bar) => {
    const controls = [
      ...bar.querySelectorAll("button:not(fieldset button), fieldset"),
    ].filter((control) => control.getBoundingClientRect().width > 0);
    // Controls of one row share their vertical centre (align-items: center)
    const centres = controls.map((control) => {
      const box = control.getBoundingClientRect();
      return Math.round((box.top + box.bottom) / 2);
    });
    return new Set(centres).size;
  });

/** Whether the focused element draws the focus ring. */
const focusRinged = (page: Page) =>
  page.evaluate(
    () =>
      getComputedStyle(document.activeElement as Element).boxShadow !== "none",
  );

const focusedTestId = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("data-testid"));

/** Press Tab until the element `testId` has focus; fail if it never does. */
const tabTo = async (page: Page, testId: string) => {
  for (let press = 0; press < 60; press++) {
    if ((await focusedTestId(page)) === testId) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${testId}`);
};

test("the toolbar keeps to one row from 640 px, and to two on a phone", async ({
  page,
}) => {
  await openTracker(page);
  const rows: Record<number, number> = {};
  for (const width of [360, 390, 640, 768, 820, 1024, 1200, 1280, 1440, 1920]) {
    await page.setViewportSize({ height: 900, width });
    rows[width] = await toolbarRows(page);
  }

  expect(rows).toEqual({
    360: 2,
    390: 2,
    640: 1,
    768: 1,
    820: 1,
    1024: 1,
    1200: 1,
    1280: 1,
    1440: 1,
    1920: 1,
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

    test(
      phone
        ? "folds the secondary actions into the More menu"
        : "shows every action in the toolbar, with no More menu",
      async ({ page }) => {
        await openTracker(page);
        const more = page.getByTestId("toolbar-more");
        const secondary = [
          page.getByRole("button", { name: "Export" }),
          page.getByRole("button", { name: "Import" }),
          page.getByTestId("stream-view-button"),
          page.getByTestId("shortcuts-button"),
        ];

        if (phone) {
          await expect(more).toBeVisible();
          for (const button of secondary) await expect(button).toBeHidden();
        } else {
          await expect(more).toBeHidden();
          for (const button of secondary) await expect(button).toBeVisible();
        }
      },
    );
  });
}

test.describe("the More menu", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  });
  test.beforeEach(({ page }) => openTracker(page));

  test("works from the keyboard alone, its focus always ringed", async ({
    page,
  }) => {
    const more = page.getByTestId("toolbar-more");
    const menu = page.getByRole("menu", { name: "More" });

    await tabTo(page, "toolbar-more");
    expect(await focusRinged(page)).toBe(true);
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    for (const id of [
      "toolbar-more-export",
      "toolbar-more-import",
      "toolbar-more-stream-view",
      "toolbar-more-shortcuts",
    ]) {
      expect(await focusedTestId(page)).toBe(id);
      expect(await focusRinged(page)).toBe(true);
      await page.keyboard.press("ArrowDown");
    }
    // Down from the last item wraps to the first; Home and End jump
    expect(await focusedTestId(page)).toBe("toolbar-more-export");
    await page.keyboard.press("End");
    expect(await focusedTestId(page)).toBe("toolbar-more-shortcuts");
    await page.keyboard.press("Home");
    expect(await focusedTestId(page)).toBe("toolbar-more-export");

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();

    // Tab leaves the menu closed, on the next control
    await page.keyboard.press("ArrowUp");
    expect(await focusedTestId(page)).toBe("toolbar-more-shortcuts");
    await page.keyboard.press("Tab");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("radio", { name: "Auto" })).toBeFocused();
  });

  test("passes axe open, fits the screen and closes on a press outside", async ({
    page,
  }) => {
    await page.getByTestId("toolbar-more").click();
    const menu = page.getByRole("menu", { name: "More" });
    await expect(menu).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .include('[data-testid="toolbar"]')
      .withTags(WCAG_AA)
      .analyze();
    expect(violations.map(({ id, nodes }) => `${id} ×${nodes.length}`)).toEqual(
      [],
    );
    expect(await unreachableClickables(page)).toEqual([]);
    const box = await menu.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);

    await page.getByTestId("item-grid").click({ position: { x: 4, y: 4 } });
    await expect(menu).toBeHidden();
  });

  test("runs each action, focus back on More after a dialog", async ({
    page,
  }) => {
    const more = page.getByTestId("toolbar-more");
    const choose = async (item: string) => {
      await more.click();
      await page.getByTestId(item).click();
    };

    const downloading = page.waitForEvent("download");
    await choose("toolbar-more-export");
    expect((await downloading).suggestedFilename()).toMatch(/\.json$/);

    const picking = page.waitForEvent("filechooser");
    await choose("toolbar-more-import");
    await picking;

    for (const [item, title] of [
      ["toolbar-more-stream-view", "Stream view"],
      ["toolbar-more-shortcuts", "Keyboard shortcuts"],
    ]) {
      await choose(item);
      const dialog = page.getByRole("dialog", { name: title });
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(more).toBeFocused();
    }
  });
});
