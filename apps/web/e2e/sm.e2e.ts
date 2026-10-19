import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { FakeUsb2Snes } from "../../../packages/autotrack/test/fake-usb2snes";
import { writeMapRando } from "../../../packs/sm/test/sm-rom";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

/** The tracker with nothing saved, then Super Metroid picked in its dialog. */
const openSuperMetroid = async (page: Page, query = "") => {
  await page.goto(`./${query}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page
    .getByRole("dialog", { name: "Choose a run type" })
    .getByTestId("game-sm")
    .click();
  await expect(page.getByTestId("sm-item-morph")).toBeVisible();
};

test("switches to Super Metroid and back, each game keeping its run", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // An ALttPR run: the hookshot found
  await page.getByTestId("item-hookshot").click();
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page
    .getByRole("dialog", { name: "Choose a run type" })
    .getByTestId("game-sm")
    .click();

  const morph = page.getByTestId("sm-item-morph");
  await expect(morph).toHaveAccessibleName(
    "Morphing Ball, not obtained. Click to change state.",
  );
  await morph.click();
  await page.getByTestId("sm-item-missile").click({ button: "right" });
  await expect(page.getByTestId("sm-item-missile")).toHaveAccessibleName(
    "Missile, 46 of 46. Click to change state.",
  );
  await page.getByTestId("sm-objective-phantoon").click();
  await expect(page.getByTestId("sm-objectives-summary")).toHaveText(
    "1 of 4 done.",
  );

  // A reload keeps the run and the game
  await page.reload();
  await expect(page.getByTestId("sm-item-morph")).toHaveAccessibleName(
    "Morphing Ball, obtained. Click to change state.",
  );

  // Back to A Link to the Past: its run as it was
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page
    .getByRole("dialog", { name: "Choose a run type" })
    .getByTestId("game-alttpr")
    .click();
  await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
    /^Hookshot, obtained/,
  );
});

test("autotracks a Map Rando seed through SNI", async ({ page }) => {
  // A fake usb2snes bridge (SNI on RetroArch) over a real WebSocket, its
  // memory holding a Map Rando seed in play
  const bridge = await FakeUsb2Snes.start();
  try {
    const MORPH = 0x0004;
    const BOMBS = 0x1000;
    const game = {
      done: ["kraid"],
      items: MORPH,
      maxMissiles: 10,
      name: "Zebes42",
      objectives: ["kraid", "phantoon", "draygon", "ridley"],
    };
    writeMapRando(bridge.memory, game);
    await openSuperMetroid(page, `?bridge=${new URL(bridge.url).port}`);

    await page.getByTestId("autotrack-button").click();
    const dialog = page.getByRole("dialog", { name: "Autotracking" });
    await dialog.getByTestId("autotrack-connect").click();
    await expect(dialog.getByTestId("autotrack-headline")).toHaveText(
      "Connected",
    );
    const seedLink = dialog.getByRole("link", { name: /Zebes42/ });
    await expect(seedLink).toHaveAttribute(
      "href",
      "https://maprando.com/seed/Zebes42/",
    );
    // A link in running text says so by more than its colour
    await expect(seedLink).toHaveCSS("text-decoration-line", "underline");
    // The dialog, connected, once its opening animation has ended
    await dialog.evaluate((element) =>
      Promise.all(
        element.getAnimations({ subtree: true }).map((a) => a.finished),
      ),
    );
    const axe = await new AxeBuilder({ page })
      .include("dialog[open]")
      .withTags(WCAG_AA)
      .analyze();
    expect(axe.violations.map(({ id }) => id)).toEqual([]);
    await page.keyboard.press("Escape");

    // The board follows the game
    await expect(page.getByTestId("sm-item-morph")).toHaveAccessibleName(
      /^Morphing Ball, obtained/,
    );
    await expect(page.getByTestId("sm-item-missile")).toHaveAccessibleName(
      /^Missile, 2 of 46/,
    );
    await expect(page.getByTestId("sm-objectives-summary")).toHaveText(
      "1 of 4 done.",
    );
    writeMapRando(bridge.memory, {
      ...game,
      done: ["kraid", "ridley"],
      items: MORPH | BOMBS,
    });
    await expect(page.getByTestId("sm-item-bombs")).toHaveAccessibleName(
      /^Bombs, obtained/,
    );
    await expect(page.getByTestId("sm-objectives-summary")).toHaveText(
      "2 of 4 done.",
    );
    await expect(page.getByTestId("autotrack-button")).toHaveAccessibleName(
      "Autotracking, Connected",
    );
  } finally {
    await bridge.stop();
  }
});

test("the stream view follows the Super Metroid tracker", async ({
  context,
  page,
}) => {
  await openSuperMetroid(page);
  const stream = await context.newPage();
  await stream.goto("./?view=obs");
  await expect(stream.getByTestId("obs-view")).toBeVisible();
  await expect(stream.getByTestId("sm-item-varia")).toHaveAccessibleName(
    /^Varia Suit, not obtained/,
  );
  await page.getByTestId("sm-item-varia").click();
  await expect(stream.getByTestId("sm-item-varia")).toHaveAccessibleName(
    /^Varia Suit, obtained/,
  );
  expect(
    await stream.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    ),
  ).toBe("rgba(0, 0, 0, 0)");
});

for (const width of WIDTHS) {
  test(`the Super Metroid board fits, passes axe and is keyboard-reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await openSuperMetroid(page);
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_AA)
      .analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(await unreachableClickables(page)).toEqual([]);

    // The run type dialog, its objectives and the items a seed adds
    await page.getByRole("button", { name: /^Mode/ }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a run type" });
    await expect(dialog).toBeVisible();
    // Its contrast, once its opening animation has ended
    await dialog.evaluate((element) =>
      Promise.all(
        element.getAnimations({ subtree: true }).map((a) => a.finished),
      ),
    );
    const dialogAxe = await new AxeBuilder({ page })
      .include("dialog[open]")
      .withTags(WCAG_AA)
      .analyze();
    expect(dialogAxe.violations.map(({ id }) => id)).toEqual([]);
    const box = await dialog.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(width);
  });
}
