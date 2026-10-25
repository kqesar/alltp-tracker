import { expect, type Page, test } from "@playwright/test";
import { auditPage, WIDTHS } from "./support";

const T0 = new Date("2026-10-18T12:00:00Z");

/**
 * A run on the board: the hookshot before the timer, then the boots at
 * 1:35 and the Armos Knights at 10:00 of the timer.
 */
const playRun = async (page: Page) => {
  await page.clock.install({ time: T0 });
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByTestId("item-hookshot").click();
  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-start").click();
  await page.keyboard.press("Escape");
  await page.clock.fastForward(95_000);
  await page.getByTestId("item-boots").click();
  await page.clock.fastForward(505_000);
  await page.getByTestId("item-boss0").click();
  await page.getByTestId("map-view-tab-run").click();
};

/** The timeline's rows, as text. */
const findRows = (page: Page) =>
  page.getByRole("list", { name: "Timeline" }).getByRole("listitem");

test.describe("the Run tab", () => {
  test("times each find, splits at each boss, and keeps both through a reload", async ({
    page,
  }) => {
    await playRun(page);

    await expect(findRows(page)).toHaveText([
      "10:00Armos Knights beaten",
      "1:35Pegasus Boots",
      "–before the timerHookshot",
    ]);
    await expect(page.getByTestId("split-item:boss0:2")).toHaveText(
      "Eastern Palace10:0010:00",
    );

    // Undoing the boss takes its time and its split away
    await page.getByTestId("undo").click();
    await expect(findRows(page)).toHaveCount(2);
    await expect(page.getByTestId("run-splits")).toContainText(
      "Each boss beaten splits the run here.",
    );
    await page.getByTestId("redo").click();

    await page.reload();
    await expect(findRows(page)).toHaveCount(3);
    await expect(page.getByTestId("split-item:boss0:2")).toBeVisible();
  });
});

for (const width of WIDTHS) {
  test.describe(`the Run tab at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("fits the page, passes axe and is keyboard-reachable", async ({
      page,
    }) => {
      await playRun(page);
      await expect(findRows(page)).toHaveCount(3);

      await auditPage(page);
    });

    test("opens the timer's clock choice, which passes axe and is reachable", async ({
      page,
    }) => {
      await playRun(page);
      await page.getByTestId("run-timer").click();
      const clock = page.getByRole("group", { name: "Clock" });
      await expect(clock).toBeVisible();
      await page.getByRole("radio", { name: "Game time" }).check();
      await expect(page.getByTestId("run-timer-clock-hint")).toHaveText(
        "Counts real time until autotracking reads a game with a file loaded.",
      );
      await expect(
        page.getByRole("radio", { name: "Game time" }),
      ).toBeFocused();
      // The arrow keys move between the two radios
      await page.keyboard.press("ArrowUp");
      await expect(
        page.getByRole("radio", { name: "Real time" }),
      ).toBeChecked();

      await auditPage(page);
    });
  });
}
