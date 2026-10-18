import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { type BrowserType, expect, type Page, test } from "@playwright/test";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

/**
 * A page whose microphone says one thing over and over: a browser of its
 * own, where Chromium plays a WAV of e2e/fixtures/voice in a loop and grants
 * the permission without asking. The speech model must be beside the build
 * (scripts/fetch-voice-model.mjs).
 */
const pageHearing = async (
  browserType: BrowserType,
  baseURL: string | undefined,
  file: string,
) => {
  const browser = await browserType.launch({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${join(import.meta.dirname, "fixtures/voice", file)}`,
    ],
    // The project's browser: the runner's Chrome on CI
    channel: test.info().project.use.channel,
  });
  const page = await browser.newPage({ baseURL });
  return { browser, page };
};

/** Open the tracker afresh and start listening, from the voice dialog. */
const startListening = async (page: Page) => {
  await page.goto("./");
  await page.getByTestId("voice-button").click();
  await page.getByTestId("voice-start").click();
  // The model loads from the server the first time, from IndexedDB after
  await expect(page.getByTestId("voice-status")).toHaveText("Listening.", {
    timeout: 60_000,
  });
  await page.keyboard.press("Escape");
};

const hookshot = (page: Page) => page.getByTestId("item-hookshot");

test.describe("voice commands", () => {
  test.setTimeout(90_000);

  test("mark what was said, say it back, and listen again after a reload", async ({
    baseURL,
    playwright,
  }) => {
    const { browser, page } = await pageHearing(
      playwright.chromium,
      baseURL,
      "tracker-hook-shot.wav",
    );
    await startListening(page);

    await expect(hookshot(page)).toHaveAccessibleName(/^Hookshot, obtained\./, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("voice-live")).toHaveText("Voice: Hookshot");
    // One undo step, as a click: Undo takes the hookshot back
    await page.getByTestId("undo").click();
    await expect(hookshot(page)).toHaveAccessibleName(
      /^Hookshot, not obtained\./,
    );

    await page.reload();
    await expect(page.getByTestId("voice-button")).toHaveAccessibleName(
      "Voice commands: listening",
      { timeout: 60_000 },
    );

    // The model's storage, freed from the dialog
    const databases = () =>
      page.evaluate(async () =>
        (await indexedDB.databases()).map(({ name }) => name),
      );
    expect(await databases()).toContain("/vosk");
    await page.getByTestId("voice-button").click();
    await page.getByTestId("voice-stop").click();
    await page.getByTestId("voice-remove-model").click();
    await expect(page.getByTestId("voice-remove-status")).toHaveText(
      /^Removed: about 60 MB freed\./,
    );
    expect(await databases()).not.toContain("/vosk");
    await browser.close();
  });

  test("mark nothing said without the wake word", async ({
    baseURL,
    playwright,
  }) => {
    const { browser, page } = await pageHearing(
      playwright.chromium,
      baseURL,
      "talk-about-the-hook-shot.wav",
    );
    await startListening(page);

    // The phrase lasts about 3 s with its pause: hear it three times over
    await page.waitForTimeout(10_000);
    await expect(hookshot(page)).toHaveAccessibleName(
      /^Hookshot, not obtained\./,
    );
    await expect(page.getByTestId("voice-live")).toHaveText("");
    await browser.close();
  });
});

for (const width of WIDTHS) {
  test.describe(`the voice dialog at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("fits, passes axe and is keyboard-reachable", async ({ page }) => {
      await page.goto("./");
      await page.getByTestId("voice-button").click();
      const dialog = page.getByRole("dialog", { name: "Voice commands" });
      await expect(dialog).toBeVisible();
      await page.getByText("What to say").click();

      const box = await dialog.boundingBox();
      expect(box).toBeTruthy();
      if (!box) return;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      const { violations } = await new AxeBuilder({ page })
        .include("dialog")
        .withTags(WCAG_AA)
        .analyze();
      expect(
        violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
      ).toEqual([]);
      expect(await unreachableClickables(page)).toEqual([]);
    });
  });
}
