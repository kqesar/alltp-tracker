import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { FakeUsb2Snes } from "../../../packages/autotrack/test/fake-usb2snes";
import { writeMapRando } from "../../../packs/sm/test/sm-rom";
import {
  auditDialog,
  auditPage,
  openOnGame,
  smRaceModeOff,
  WCAG_AA,
  WIDTHS,
} from "./support";

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
    // Outside Race Mode, on by default for Map Rando: the seed's objectives,
    // its settings and the game's clock are read then alone
    await smRaceModeOff(page);
    await openOnGame(page, "sm", `?bridge=${new URL(bridge.url).port}`);

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

test("starts the run timer with the game, follows its clock and stops at the ship", async ({
  page,
}) => {
  const bridge = await FakeUsb2Snes.start();
  let emulator: ReturnType<typeof setInterval> | undefined;
  try {
    // The file select; the console's RTA clock already holds 50 000 frames
    writeMapRando(bridge.memory, {
      clock: { pending: 0, saved: 50_000 },
      state: 0x04,
    });
    // Outside Race Mode, on by default for Map Rando: the seed's objectives,
    // its settings and the game's clock are read then alone
    await smRaceModeOff(page);
    await openOnGame(page, "sm", `?bridge=${new URL(bridge.url).port}`);
    const timer = page.getByTestId("run-timer");
    await expect(timer).toHaveAccessibleName("Run timer: 0:00, not started");
    await timer.click();
    await page.getByRole("radio", { name: "Game time" }).check();
    await page.keyboard.press("Escape");

    await page.getByTestId("autotrack-button").click();
    const dialog = page.getByRole("dialog", { name: "Autotracking" });
    await dialog.getByTestId("autotrack-connect").click();
    await expect(dialog.getByTestId("autotrack-headline")).toHaveText(
      "Connected",
    );
    await page.keyboard.press("Escape");
    await expect(timer).toHaveAccessibleName("Run timer: 0:00, not started");

    // The file loads and the game runs (15 frames every 250 ms, a real
    // 60 fps): the first reading in play starts the timer. The clock keeps
    // moving until the timer has been seen running, as one jump and then
    // stillness would show "running" for a single read, about half a second,
    // which a slow runner's polling of the name can miss.
    let saved = 53_000;
    const play = () =>
      writeMapRando(bridge.memory, {
        clock: { pending: 0, saved },
        state: 0x08,
      });
    play();
    emulator = setInterval(() => {
      saved += 15;
      play();
    }, 250);
    await expect(timer).toHaveAccessibleName(/^Run timer: 0:0\d, running$/);

    // 6 000 frames of the game (99.8 s) in a few seconds of real time: the
    // timer is set on the game's clock
    saved = 59_000;
    play();
    await expect(timer).toHaveAccessibleName(
      /^Run timer: 1:(39|4\d), running$/,
    );
    clearInterval(emulator);
    await timer.click();
    await expect(page.getByTestId("run-timer-clock-hint")).toHaveText(
      "The timer follows the game's clock.",
    );
    await page.keyboard.press("Escape");

    // Mother Brain is dead and Samus is in the ship: the goal
    writeMapRando(bridge.memory, {
      clock: { pending: 0, saved: 59_060 },
      escaping: true,
      state: 0x27,
    });
    await expect(timer).toHaveAccessibleName(/^Run timer: 1:(40|41), stopped$/);
  } finally {
    clearInterval(emulator);
    await bridge.stop();
  }
});

test("the stream view draws the run timer under the grid", async ({
  context,
  page,
}) => {
  await openOnGame(page, "sm");
  const stream = await context.newPage();
  await stream.goto("./?view=obs&timer=1");
  const timer = stream.getByTestId("stream-timer");
  await expect(timer).toHaveAccessibleName("Run timer: 0:00, not started");

  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-start").click();
  await expect(timer).toHaveAccessibleName(/^Run timer: 0:0\d, running$/);
  await page.getByTestId("run-timer-pause").click();
  await expect(timer).toHaveAccessibleName(/^Run timer: 0:0\d, paused$/);
  // The timer sits under the grid, inside the stage
  const grid = await stream.locator(".board-grid").boundingBox();
  const drawn = await timer.boundingBox();
  expect(drawn?.y).toBeGreaterThanOrEqual((grid?.y ?? 0) + (grid?.height ?? 0));
  // Without the option, no timer
  await stream.goto("./?view=obs");
  await expect(stream.getByTestId("obs-view")).toBeVisible();
  await expect(stream.getByTestId("stream-timer")).toHaveCount(0);
});

test("the stream view follows the Super Metroid tracker", async ({
  context,
  page,
}) => {
  await openOnGame(page, "sm");
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
    await openOnGame(page, "sm");
    await auditPage(page);

    // The timer's panel, open
    await page.getByTestId("run-timer").click();
    await expect(page.getByTestId("run-timer-clock")).toBeVisible();
    await auditPage(page);
    await page.keyboard.press("Escape");

    // The run type dialog, its objectives and the items a seed adds
    await page.getByRole("button", { name: /^Mode/ }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a run type" });
    await auditDialog(page, dialog, width);
  });
}
