import type { Locator, Page } from "@playwright/test";

/** Phone, tablet, laptop and desktop: the widths every layout must hold at. */
export const WIDTHS = [390, 820, 1440, 1920] as const;

/** The accessibility standard every page state is held to. */
export const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Click a secondary toolbar action: its own button where the toolbar has room
 * for it, else its item in the More menu.
 * @param button - The action's toolbar button
 * @param item - The data-testid of its More menu item
 */
export const clickToolbarAction = async (
  page: Page,
  button: Locator,
  item: string,
) => {
  if (await button.isVisible()) return button.click();
  await page.getByTestId("toolbar-more").click();
  await page.getByTestId(item).click();
};

/** The data-testid of the element that has focus. */
export const focusedTestId = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("data-testid"));

/** Whether the focused element draws the focus ring. */
export const focusRinged = (page: Page) =>
  page.evaluate(
    () =>
      getComputedStyle(document.activeElement as Element).boxShadow !== "none",
  );

/**
 * Press Tab until the element `testId` has focus; fail if it never does.
 * @param presses - How many presses to try first
 */
export const tabTo = async (page: Page, testId: string, presses = 400) => {
  for (let press = 0; press < presses; press++) {
    if ((await focusedTestId(page)) === testId) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${testId}`);
};

/**
 * Clickable-looking elements a keyboard can never reach.
 * @param within - Where to look: the page, or an open dialog
 */
export const unreachableClickables = (page: Page, within = "body") =>
  page.evaluate(
    (root) =>
      [...document.querySelectorAll(`${root} *`)]
        .filter(
          (element) =>
            getComputedStyle(element).cursor === "pointer" &&
            (element as HTMLElement).tabIndex < 0 &&
            !element.closest("button, a, label, summary, input, select"),
        )
        .map(
          (element) => element.getAttribute("data-testid") ?? element.className,
        ),
    within,
  );

/** A region of the page as rendered, one RGBA quadruple per pixel. */
export const pixelsIn = async (
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
) => {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    return Array.from({ length: data.length / 4 }, (_, index) => [
      ...data.subarray(index * 4, index * 4 + 4),
    ]);
  }, png.toString("base64"));
};
