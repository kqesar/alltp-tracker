import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

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
  // The game renders once its chunk has loaded, its toolbar fitted as it
  // mounts: only then does the button's visibility say where it went
  await page.getByTestId("toolbar").waitFor();
  if (await button.isVisible()) return button.click();
  await page.getByTestId("toolbar-more").click();
  await page.getByTestId(item).click();
};

/**
 * Show or hide ALttPR's key cells, where the choice lives: the checkbox of
 * the Mode dialog, which this opens and closes again.
 */
export const setKeyCells = async (page: Page, shown: boolean) => {
  await page.getByRole("button", { name: /^Mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a run type" });
  await dialog
    .getByRole("checkbox", { name: "Show key cells" })
    .setChecked(shown);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
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

/**
 * The tracker on a game in one page load: the game this device tracks is
 * saved before the page starts (unless a reload finds one saved), where
 * picking it in the Mode dialog loads the page three times.
 * @param game - A game's id
 * @param query - The address's query string, `?bridge=…` for instance
 */
export const openOnGame = async (page: Page, game: string, query = "") => {
  await page.addInitScript((id) => {
    if (!localStorage.getItem("alltp-tracker-game")) {
      localStorage.setItem("alltp-tracker-game", id);
    }
  }, game);
  await page.goto(`./${query}`);
  await page.getByTestId("toolbar").waitFor();
};

/**
 * Super Metroid's Race Mode off, as a device that chose Off: Map Rando's ROMs
 * carry no race flag, so it is on by default, and a spec of what only a
 * casual run reads (the seed's objectives, the game's clock, the review)
 * turns it off first. Kept once the page has saved a choice.
 */
export const smRaceModeOff = async (page: Page) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("alltp-tracker-sm-autotrack")) {
      localStorage.setItem(
        "alltp-tracker-sm-autotrack",
        JSON.stringify({
          state: { connectOnStart: false, raceChoice: "auto" },
          version: 1,
        }),
      );
    }
  });
};

/**
 * What every page state is held to: no axe violation, no sideways scroll,
 * and every clickable thing reachable by keyboard.
 * @param exclude - A selector axe leaves out, where a WCAG exception applies
 */
export const auditPage = async (page: Page, exclude?: string) => {
  const axe = new AxeBuilder({ page }).withTags(WCAG_AA);
  const { violations } = await (exclude ? axe.exclude(exclude) : axe).analyze();
  expect(violations.map(({ id, nodes }) => `${id} ×${nodes.length}`)).toEqual(
    [],
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect(await unreachableClickables(page)).toEqual([]);
};

/**
 * An open dialog's checks: axe once its opening animation has ended (its
 * contrast changes as it fades in), and its right edge inside the viewport.
 */
export const auditDialog = async (
  page: Page,
  dialog: Locator,
  width: number,
) => {
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element) =>
    Promise.all(
      element.getAnimations({ subtree: true }).map((a) => a.finished),
    ),
  );
  const { violations } = await new AxeBuilder({ page })
    .include("dialog[open]")
    .withTags(WCAG_AA)
    .analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);
  const box = await dialog.boundingBox();
  expect(box && box.x + box.width).toBeLessThanOrEqual(width);
};
