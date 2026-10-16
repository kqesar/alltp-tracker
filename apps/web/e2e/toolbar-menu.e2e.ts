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

/**
 * Text metrics wider than macOS's system font, as Linux and Windows fonts
 * can be: every toolbar label takes more room, on any machine.
 */
const WIDE_FONT = ".toolbar, .toolbar * { letter-spacing: 0.08em !important; }";

/** Let the toolbar settle: its observers run before the next frames. */
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );

/**
 * What the toolbar shows: whether the More menu is in use, how many rows the
 * actions take, and how far anything sticks out sideways.
 */
const toolbarLayout = (page: Page) =>
  page.getByTestId("toolbar").evaluate((bar) => {
    const visible = (element: Element) =>
      element.getBoundingClientRect().width > 0;
    const controls = [
      ...bar.querySelectorAll("button:not(fieldset button), fieldset"),
    ].filter((control) => visible(control) && !control.closest("[role=menu]"));
    // Controls of one row share their vertical centre (align-items: center)
    const rows = new Set(
      controls.map((control) => {
        const box = control.getBoundingClientRect();
        return Math.round((box.top + box.bottom) / 2);
      }),
    ).size;
    const right = bar.getBoundingClientRect().right;
    const more = bar.querySelector('[data-testid="toolbar-more"]');
    return {
      fit: (bar as HTMLElement).dataset.fit ?? "none",
      more: Boolean(more && visible(more)),
      overflow: Math.max(
        document.documentElement.scrollWidth - window.innerWidth,
        ...controls.map(
          (control) => control.getBoundingClientRect().right - right,
        ),
      ),
      rows,
    };
  });

/**
 * Sweep the viewport from phone to wide desktop and check, at each width,
 * what must hold on any machine whatever its fonts: the full bar on one row,
 * the bar with its More menu on at most two, nothing sticking out, and no
 * switching back and forth once settled.
 */
const sweep = async (page: Page) => {
  const broken: string[] = [];
  for (let width = 360; width <= 1920; width += 40) {
    await page.setViewportSize({ height: 900, width });
    await settle(page);
    const layout = await toolbarLayout(page);
    await settle(page);
    const later = await toolbarLayout(page);
    const problems = [
      layout.more
        ? layout.rows > 2 && "over 2 rows"
        : layout.rows !== 1 && "full bar wraps",
      layout.overflow > 0.5 &&
        `${Math.round(layout.overflow)} px past the edge`,
      later.fit !== layout.fit && `jitters ${layout.fit} → ${later.fit}`,
    ].filter(Boolean);
    if (problems.length > 0) broken.push(`${width}px: ${problems.join(", ")}`);
  }
  return broken;
};

for (const [name, css] of [
  ["the system font", ""],
  ["a wider font", WIDE_FONT],
] as const) {
  test(`the toolbar holds from 360 to 1920 px with ${name}`, async ({
    page,
  }) => {
    await openTracker(page);
    if (css) await page.addStyleTag({ content: css });

    expect(await sweep(page)).toEqual([]);
    // Measuring the bar never touches its state: a measured copy of a
    // checked radio would uncheck the real one, in the same radio group
    await expect(page.getByRole("radio", { name: "Auto" })).toBeChecked();
    // Folded on a phone, everything in view on a wide desktop
    await page.setViewportSize({ height: 844, width: 390 });
    await settle(page);
    expect((await toolbarLayout(page)).more).toBe(true);
    await page.setViewportSize({ height: 900, width: 1920 });
    await settle(page);
    expect((await toolbarLayout(page)).more).toBe(false);
  });
}

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

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("offers every secondary action once: in the bar or in More", async ({
      page,
    }) => {
      await openTracker(page);
      const more = page.getByTestId("toolbar-more");
      const secondary = [
        page.getByRole("button", { name: "Export" }),
        page.getByRole("button", { name: "Import" }),
        page.getByTestId("stream-view-button"),
        page.getByTestId("shortcuts-button"),
      ];

      if (await more.isVisible()) {
        for (const button of secondary) await expect(button).toBeHidden();
        await more.click();
        await expect(page.getByRole("menuitem")).toHaveCount(4);
      } else {
        for (const button of secondary) await expect(button).toBeVisible();
      }
      // A phone has no room for the full bar, whatever its font
      if (phone) await expect(more).toBeVisible();
    });
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
