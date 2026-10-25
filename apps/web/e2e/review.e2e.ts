import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { auditDialog, auditPage, WIDTHS } from "./support";

const T0 = new Date("2026-10-25T12:00:00Z");
const SPOILERS = join(
  import.meta.dirname,
  "../../../packs/alttpr/test/spoilers",
);
const HASH = "9MQ9gO1wMD";
const NAME = `alttpr - NoGlitches-open-ganon_${HASH}.txt`;

/** Where the screenshots go when asked for (a scratch directory, never the repo). */
const SHOTS = process.env.REVIEW_SHOTS;
const shot = async (page: Page, name: string, width: number) => {
  if (SHOTS) {
    await page.screenshot({
      fullPage: true,
      path: join(SHOTS, `${name}-${width}.png`),
    });
  }
};

/** A run tracked by hand: a few finds, the timer started. */
const playRun = async (page: Page) => {
  await page.clock.install({ time: T0 });
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-start").click();
  await page.keyboard.press("Escape");
  await page.clock.fastForward(30_000);
  await page.getByTestId("item-boots").click();
  await page.clock.fastForward(90_000);
  await page.getByTestId("item-hookshot").click();
  await page.getByTestId("map-view-tab-run").click();
};

const spoiler = (hash: string, name: string) => ({
  buffer: readFileSync(join(SPOILERS, `${hash}.txt`)),
  mimeType: "text/plain",
  name,
});

test.describe("reviewing a finished run", () => {
  test("opens only once the run is over, and never leaves the page", async ({
    page,
  }) => {
    const requests: string[] = [];
    await playRun(page);
    page.on("request", (request) => requests.push(request.url()));

    // Counting: no way in
    await expect(page.getByTestId("review-open")).toHaveCount(0);
    await expect(page.getByTestId("review-import")).toHaveCount(0);
    await expect(page.getByTestId("review-gate-note")).toContainText(
      "once the run is over",
    );

    // End run asks first, on Cancel
    await page.getByTestId("run-timer").click();
    await page.getByTestId("run-timer-end").click();
    const ending = page.getByRole("dialog", { name: "End this run?" });
    await expect(ending.getByRole("button", { name: "Cancel" })).toBeFocused();
    await ending.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("review-open")).toHaveCount(0);
    await page.getByTestId("run-timer").click();
    await page.getByTestId("run-timer-end").click();
    await ending.getByRole("button", { name: "End run" }).click();
    await expect(page.getByTestId("run-timer")).toHaveAccessibleName(
      /^Run timer: 2:0\d, stopped$/,
    );
    await expect(page.getByTestId("review-open")).toBeVisible();

    // Import: the real worker reads the file
    await page.getByTestId("review-import").click();
    await page.getByTestId("review-file").setInputFiles(spoiler(HASH, NAME));
    await expect(page.getByTestId("review-notice")).toBeVisible();
    await expect(page.getByTestId("review-binding")).toContainText(
      "Not verified: this run does not know its seed",
    );
    await expect(page.getByTestId("review-caption")).toContainText(
      "required items",
    );
    await expect(page.getByTestId("review-playthrough")).toBeVisible();

    // The file stayed on the device
    expect(
      requests.filter(
        (url) => !new URL(url).pathname.startsWith("/alltp-tracker/"),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage })),
    ).not.toContain("playthrough");

    // Close review, then reload: nothing is left
    await page.getByTestId("review-close").click();
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
    await page.getByTestId("review-import").click();
    await page.getByTestId("review-file").setInputFiles(spoiler(HASH, NAME));
    await expect(page.getByTestId("review-notice")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
  });

  test("refuses a file that is not the log of a run, with the reason", async ({
    page,
  }) => {
    await playRun(page);
    await page.getByTestId("run-timer").click();
    await page.getByTestId("run-timer-end").click();
    await page
      .getByRole("dialog", { name: "End this run?" })
      .getByRole("button", { name: "End run" })
      .click();
    await page.getByTestId("review-open").click();

    await page.getByTestId("review-file").setInputFiles({
      buffer: Buffer.from([0, 1, 2, 3, 255]),
      mimeType: "application/octet-stream",
      name: "game.sfc",
    });
    await expect(page.getByTestId("review-error")).toContainText("ROM");
    await page
      .getByTestId("review-file")
      .setInputFiles(spoiler("eM43RgZ4Gj", "alttpr - daily_eM43RgZ4Gj.txt"));
    await expect(page.getByTestId("review-error")).toContainText("withheld");
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
  });
});

for (const width of WIDTHS) {
  test.describe(`the review at ${width}px`, () => {
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

      await page.getByTestId("run-timer").click();
      await page.getByTestId("run-timer-end").click();
      const ending = page.getByRole("dialog", { name: "End this run?" });
      await auditDialog(page, ending, width);
      await shot(page, "end-run", width);
      await ending.getByRole("button", { name: "End run" }).click();
      await expect(page.getByTestId("review-open")).toBeVisible();
      await auditPage(page);

      await page.getByTestId("review-open").click();
      const dialog = page.getByRole("dialog", { name: "Review this run" });
      await auditDialog(page, dialog, width);
      await shot(page, "import", width);

      await page.getByTestId("review-file").setInputFiles(spoiler(HASH, NAME));
      await expect(page.getByTestId("review-notice")).toBeVisible();
      await expect(page.getByTestId("review-playthrough")).toBeVisible();
      await auditPage(page);
      await shot(page, "run-tab", width);
    });
  });
}
