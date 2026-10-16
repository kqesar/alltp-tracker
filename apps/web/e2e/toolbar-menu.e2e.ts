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
 * are: every toolbar label takes more room, on any machine. CI's Ubuntu
 * font with 0.08em already broke the bar at 360 px; 0.16em is harsher than
 * any real system font.
 */
const wideFont = (spacing: string) =>
  `.toolbar, .toolbar * { letter-spacing: ${spacing} !important; }`;

/** A larger default font size, as a reader may set it: rem grows with it. */
const largeText = (px: number) => `:root { font-size: ${px}px !important; }`;

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
  for (let width = 320; width <= 1920; width += 40) {
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
  ["a wider font", wideFont("0.08em")],
  ["a much wider font", wideFont("0.16em")],
  // The browser's default text size at 150 %, an accessibility setting
  ["a 150 % text size", largeText(24)],
] as const) {
  test(`the toolbar holds from 320 to 1920 px with ${name}`, async ({
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

test("the More menu opens on screen wherever its button wraps", async ({
  page,
}) => {
  await openTracker(page);
  const off: string[] = [];
  for (const [name, css] of [
    ["system font", ""],
    ["0.16em", wideFont("0.16em")],
    ["175 % text", largeText(28)],
  ] as const) {
    const style = css ? await page.addStyleTag({ content: css }) : null;
    for (const width of [320, 360, 390, 640]) {
      await page.setViewportSize({ height: 800, width });
      await settle(page);
      await page.getByTestId("toolbar-more").click();
      const box = await page.getByRole("menu", { name: "More" }).boundingBox();
      if (!box || box.x < 0 || box.x + box.width > width) {
        off.push(`${name} at ${width}px: ${box?.x} + ${box?.width}`);
      }
      await page.keyboard.press("Escape");
    }
    await style?.evaluate((tag) => (tag as Element).remove());
  }

  expect(off).toEqual([]);
});

test.describe("the narrowest bar, with the largest text", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 640, width: 320 },
  });
  test.beforeEach(async ({ page }) => {
    await openTracker(page);
    // Text at 175 %: even the map layout and key cells fold into More
    await page.addStyleTag({ content: largeText(28) });
    await settle(page);
  });

  test("folds settings into More as choices, and New game to an icon", async ({
    page,
  }) => {
    const layout = await toolbarLayout(page);
    expect(layout.fit).toBe("compact");
    expect(layout.rows).toBeLessThanOrEqual(2);
    expect(layout.overflow).toBeLessThanOrEqual(0.5);
    // Undo, Redo and New game stay in view; New game keeps its name
    await expect(page.getByTestId("undo")).toBeVisible();
    await expect(page.getByTestId("redo")).toBeVisible();
    await expect(
      page.getByRole("button", { exact: true, name: "New game" }),
    ).toBeVisible();
    await expect(page.getByTestId("map-layout")).toBeHidden();
    await expect(page.getByTestId("key-cells-toggle")).toBeHidden();

    await page.getByTestId("toolbar-more").click();
    const menu = page.getByRole("menu", { name: "More" });
    const map = menu.getByRole("group", { name: "Map" });
    await expect(map.getByRole("menuitemradio")).toHaveCount(3);
    await expect(
      map.getByRole("menuitemradio", { name: "Auto" }),
    ).toHaveAttribute("aria-checked", "true");
    const keys = menu.getByRole("menuitemcheckbox", { name: "Big keys" });
    await expect(keys).toHaveAttribute("aria-checked", "false");
    const { violations } = await new AxeBuilder({ page })
      .include('[data-testid="toolbar"]')
      .withTags(WCAG_AA)
      .analyze();
    expect(violations.map(({ id, nodes }) => `${id} ×${nodes.length}`)).toEqual(
      [],
    );

    // A choice sets the layout; the check shows the key cells
    await map.getByRole("menuitemradio", { name: "Stack" }).click();
    await expect(page.getByTestId("layout")).toHaveClass(/layout--stacked/);
    await page.getByTestId("toolbar-more").click();
    await expect(
      menu.getByRole("menuitemradio", { name: "Stack" }),
    ).toHaveAttribute("aria-checked", "true");
    await keys.click();
    await expect(page.getByTestId("big-key-0")).toBeVisible();
  });

  test("reaches every item from the keyboard, the folded settings included", async ({
    page,
  }) => {
    await tabTo(page, "toolbar-more");
    await page.keyboard.press("Enter");
    const reached: string[] = [];
    for (let press = 0; press < 9; press++) {
      reached.push((await focusedTestId(page)) ?? "");
      expect(await focusRinged(page)).toBe(true);
      await page.keyboard.press("ArrowDown");
    }

    expect(reached).toEqual([
      "toolbar-more-export",
      "toolbar-more-import",
      "toolbar-more-stream-view",
      "toolbar-more-shortcuts",
      "toolbar-more-map-auto",
      "toolbar-more-map-side-by-side",
      "toolbar-more-map-stacked",
      "toolbar-more-big-keys",
      // Down from the last item wraps to the first
      "toolbar-more-export",
    ]);
  });
});
