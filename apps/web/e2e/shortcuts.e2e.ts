import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { tabTo, unreachableClickables, WCAG_AA, WIDTHS } from "./support";

/**
 * What a French AZERTY keyboard types, key by key, as Chromium's layout map
 * reports it. The machine's own layout would change every label; this one
 * makes them known, and shows labels follow the layout: KeyW reads Z.
 */
const AZERTY: [string, string][] = [
  ..."azertyuiop"
    .split("")
    .map((key, index): [string, string] => [`Key${"QWERTYUIOP"[index]}`, key]),
  ..."qsdfghjkl"
    .split("")
    .map((key, index): [string, string] => [`Key${"ASDFGHJKL"[index]}`, key]),
  ..."wxcvbn"
    .split("")
    .map((key, index): [string, string] => [`Key${"ZXCVBN"[index]}`, key]),
  ["Semicolon", "m"],
  ["KeyM", ","],
  ["Comma", ";"],
  ["Period", ":"],
  ["Slash", "!"],
  ["BracketLeft", "^"],
  ["BracketRight", "$"],
  ..."&é\"'(-è_çà"
    .split("")
    .map((key, index): [string, string] => [`Digit${(index + 1) % 10}`, key]),
];

/** Load the tracker with nothing tracked and the default shortcuts. */
const openTracker = async (page: Page) => {
  await page.addInitScript((entries) => {
    const keyboard = (navigator as Navigator & { keyboard?: object }).keyboard;
    if (!keyboard) return;
    Object.defineProperty(keyboard, "getLayoutMap", {
      value: async () => new Map(entries),
    });
  }, AZERTY);
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

/**
 * Open the shortcuts dialog from the toolbar with the keyboard alone: its own
 * button where the toolbar has room for it, else the More menu's last item.
 */
const openShortcuts = async (page: Page) => {
  if (await page.getByTestId("shortcuts-button").isVisible()) {
    await tabTo(page, "shortcuts-button");
  } else {
    await tabTo(page, "toolbar-more");
    await page.keyboard.press("Enter");
    await page.keyboard.press("End");
  }
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toBeVisible();
  return dialog;
};

/** axe over the open dialogs: the page behind them is inert. */
const auditDialogs = async (page: Page) => {
  // A dialog fades in: contrast measured mid-fade would be wrong
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll("dialog[open]")].flatMap((dialog) =>
        dialog.getAnimations({ subtree: true }).map((run) => run.finished),
      ),
    ),
  );
  const { violations } = await new AxeBuilder({ page })
    .include("dialog[open]")
    .withTags(WCAG_AA)
    .analyze();
  return violations.map(({ id, nodes }) => `${id} ×${nodes.length}`);
};

test.describe("item shortcuts", () => {
  test.beforeEach(({ page }) => openTracker(page));

  test("step an item, and follow a rebinding across a reload", async ({
    page,
  }) => {
    const hookshot = page.getByTestId("item-hookshot");
    const binding = page.getByTestId("shortcut-advance-hookshot");

    await page.keyboard.press("KeyW");
    await expect(hookshot).toHaveAccessibleName(/^Hookshot, obtained\./);

    const dialog = await openShortcuts(page);
    await tabTo(page, "shortcut-advance-hookshot");
    await page.keyboard.press("Enter");
    await expect(binding).toHaveAccessibleName("Hookshot forward: press a key");
    await page.keyboard.press("BracketLeft");
    await expect(binding).toHaveAccessibleName("Hookshot forward: ^");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // W first: had it still toggled the hookshot, [ would toggle it back
    await page.keyboard.press("KeyW");
    await page.keyboard.press("BracketLeft");
    await expect(hookshot).toHaveAccessibleName(/^Hookshot, not obtained\./);

    await page.reload();
    await expect(hookshot).toHaveAccessibleName(/^Hookshot, not obtained\./);
    await page.keyboard.press("KeyW");
    await page.keyboard.press("BracketLeft");
    await expect(hookshot).toHaveAccessibleName(/^Hookshot, obtained\./);
  });

  test("show their key in the tooltip and to assistive technology", async ({
    page,
  }) => {
    const hookshot = page.getByTestId("item-hookshot");

    await hookshot.hover();

    await expect(page.getByTestId("tooltip-keys")).toHaveText(
      /^Z\s*back\s*Shift\+Z$/,
    );
    await expect(hookshot).toHaveAttribute("aria-keyshortcuts", "Z Shift+Z -");
  });

  test("fetch their dialog's code after the page loads, before any click", async ({
    page,
  }) => {
    const chunk = /\/ShortcutsDialog-[\w-]+\.js$/;
    // Fetched when the page is idle (or sooner, on hover or focus)
    await expect
      .poll(() =>
        page.evaluate(
          (source) =>
            performance
              .getEntriesByType("resource")
              .some((entry) => new RegExp(source).test(entry.name)),
          chunk.source,
        ),
      )
      .toBe(true);
    const timing = await page.evaluate((source) => {
      const [navigation] = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      const entry = performance
        .getEntriesByType("resource")
        .find((resource) => new RegExp(source).test(resource.name));
      return { chunk: entry?.startTime ?? 0, loaded: navigation.loadEventEnd };
    }, chunk.source);
    // Not part of the first load: the page was done before it was asked for
    expect(timing.chunk).toBeGreaterThanOrEqual(timing.loaded);

    const refetches: string[] = [];
    page.on("request", (request) => {
      if (chunk.test(request.url())) refetches.push(request.url());
    });
    await page.getByTestId("shortcuts-button").click();

    await expect(
      page.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeVisible();
    expect(refetches).toEqual([]);
  });
});

for (const width of WIDTHS) {
  test.describe(`the shortcuts dialog at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("passes axe and works from the keyboard alone", async ({ page }) => {
      // Three axe audits of the dialog's long table and dozens of Tab
      // presses, each a round trip: on CI's four workers it runs past 30 s
      test.slow();
      await openTracker(page);
      const dialog = await openShortcuts(page);
      const binding = page.getByTestId("shortcut-advance-hookshot");

      expect(await auditDialogs(page)).toEqual([]);
      expect(await unreachableClickables(page, "dialog[open]")).toEqual([]);
      const overflow = await dialog.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      // Capturing: Escape cancels the capture, not the dialog
      await tabTo(page, "shortcut-advance-hookshot");
      await page.keyboard.press("Enter");
      await expect(binding).toHaveAccessibleName(
        "Hookshot forward: press a key",
      );
      expect(await auditDialogs(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(binding).toHaveAccessibleName("Hookshot forward: Z");
      await expect(dialog).toBeVisible();

      // A key in use: the conflict dialog starts on Cancel; Swap from Tab
      await page.keyboard.press("Enter");
      await page.keyboard.press("KeyK");
      const conflict = page.getByRole("dialog", {
        name: "K is already in use",
      });
      await expect(conflict).toBeVisible();
      await expect(page.getByTestId("shortcut-conflict-cancel")).toBeFocused();
      expect(await auditDialogs(page)).toEqual([]);
      await tabTo(page, "shortcut-conflict-swap");
      await page.keyboard.press("Enter");
      await expect(conflict).toBeHidden();
      await expect(binding).toHaveAccessibleName("Hookshot forward: K");
      await expect(binding).toBeFocused();
      await expect(
        page.getByTestId("shortcut-advance-mirror"),
      ).toHaveAccessibleName("Magic Mirror forward: Z");

      // The master switch, from the keyboard
      await tabTo(page, "shortcuts-enabled");
      await page.keyboard.press("Space");
      await expect(page.getByTestId("shortcuts-enabled")).toHaveAttribute(
        "aria-checked",
        "false",
      );
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await page.keyboard.press("KeyK");
      await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
        /^Hookshot, not obtained\./,
      );
    });
  });
}
