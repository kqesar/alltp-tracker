import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { FakeUsb2Snes } from "../../../packages/autotrack/test/fake-usb2snes";
import { writeSmz3 } from "../../../packs/smz3/test/smz3-rom";
import {
  auditDialog,
  openOnGame,
  unreachableClickables,
  WCAG_AA,
  WIDTHS,
} from "./support";

test("tracks SMZ3: items, both maps by the logic, a reload keeping the run", async ({
  page,
}) => {
  await openOnGame(page, "smz3");
  await expect(page.getByTestId("link-samus")).toBeVisible();

  // Kakariko's well is open from the start; the Morphing Ball too
  const well = page.getByTestId("marker-kakariko-well");
  await expect(well).toHaveAccessibleName(/: available$/);
  await well.click();
  await expect(well).toHaveAccessibleName(/: checked$/);

  // A mitt and a hammer reach the Dark World: its Hype Cave turns available
  await page.getByTestId("smz3-item-glove").click();
  await page.getByTestId("smz3-item-glove").click();
  await page.getByTestId("smz3-item-moonPearl").click();
  await page.getByTestId("smz3-item-hammer").click();
  await expect(page.getByTestId("marker-hype-cave")).toHaveAccessibleName(
    /: available$/,
  );

  await page.getByRole("tab", { name: "Zebes" }).click();
  const morph = page.getByTestId("marker-morphing-ball");
  await expect(morph).toHaveAccessibleName("Morphing Ball: available");
  // The map of Zebes is drawn: its image arrived
  expect(
    await page
      .getByTestId("map-zebes")
      .evaluate((map) => getComputedStyle(map).backgroundImage),
  ).toContain("smz3/zebes.webp");

  await page.reload();
  await expect(page.getByTestId("smz3-item-hammer")).toHaveAccessibleName(
    /^Hammer, obtained/,
  );
  await expect(page.getByTestId("marker-kakariko-well")).toHaveAccessibleName(
    /: checked$/,
  );
});

test("autotracks an SMZ3 seed through SNI, in both games", async ({ page }) => {
  // A fake usb2snes bridge (SNI on RetroArch) over a real WebSocket, its
  // memory holding an SMZ3 seed in play in Zelda: the moon pearl, Link's
  // House's chest, a missile pack found in Zebes before
  const bridge = await FakeUsb2Snes.start();
  try {
    const played = {
      keysanity: true,
      sm: { 38: 5 },
      zelda: { 520: 0x10, 855: 1 },
    };
    writeSmz3(bridge.memory, played);
    await page.goto(`./?bridge=${new URL(bridge.url).port}`);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("alltp-tracker-game", "smz3");
    });
    await page.reload();

    await page.getByTestId("autotrack-button").click();
    const dialog = page.getByRole("dialog", { name: "Autotracking" });
    await dialog.getByTestId("autotrack-connect").click();
    await expect(dialog.getByTestId("autotrack-headline")).toHaveText(
      "Connected",
    );
    await expect(dialog.getByTestId("smz3-readout")).toContainText(
      "The SMZ3 seed ZSM11.3.2CN1234ABCD, in A Link to the Past.",
    );
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

    // The board follows the game, the seed's keysanity with it
    await expect(page.getByTestId("smz3-item-moonPearl")).toHaveAccessibleName(
      /^Moon Pearl, obtained/,
    );
    await expect(page.getByTestId("smz3-item-missile")).toHaveAccessibleName(
      /^Missile, 1 of 40/,
    );
    await expect(page.getByTestId("marker-links-house")).toHaveAccessibleName(
      /: checked$/,
    );
    await expect(page.getByTestId("smz3-keycards")).toBeVisible();

    // Through a portal: Super Metroid runs, and the Morphing Ball is found
    writeSmz3(bridge.memory, {
      ...played,
      mode: "sm",
      sm: { ...played.sm, 2: 0x04, 179: 0x04 },
    });
    await expect(page.getByTestId("smz3-item-morph")).toHaveAccessibleName(
      /^Morphing Ball, obtained/,
    );
    await page.getByRole("tab", { name: "Zebes" }).click();
    await expect(page.getByTestId("marker-morphing-ball")).toHaveAccessibleName(
      /: checked$/,
    );
  } finally {
    await bridge.stop();
  }
});

test("starts the run timer with the game, follows both games' time and stops at the credits", async ({
  page,
}) => {
  const bridge = await FakeUsb2Snes.start();
  try {
    // Super Metroid's file select; Zelda's counter holds 1 000 frames already
    writeSmz3(bridge.memory, {
      clock: { sm: 5_000, zelda: 1_000 },
      mode: "sm",
      state: 0x04,
    });
    await openOnGame(page, "smz3", `?bridge=${new URL(bridge.url).port}`);
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
    // 60 fps): the first reading in play starts the timer, on the sum of the
    // games' counters (6 000 frames: 1:40)
    let smFrames = 5_000;
    const running = setInterval(() => {
      smFrames += 15;
      writeSmz3(bridge.memory, {
        clock: { sm: smFrames, zelda: 1_000 },
        mode: "sm",
        state: 0x08,
      });
    }, 250);
    try {
      await expect(timer).toHaveAccessibleName(
        /^Run timer: 1:(39|4\d), running$/,
      );
    } finally {
      clearInterval(running);
    }
    // The emulator pauses: the counters stand still and so does the timer
    await expect(timer).toHaveAccessibleName(/^Run timer: 1:\d\d, paused$/);

    // A portal to Zelda, which has run to 7 000 frames while Super Metroid's
    // count stays saved: the sum goes on, the timer is set on it
    writeSmz3(bridge.memory, {
      clock: { sm: smFrames, zelda: 7_000 },
      mode: "zelda",
      state: 0x09,
    });
    await expect(timer).toHaveAccessibleName(
      /^Run timer: 3:(2\d|3\d), (running|paused)$/,
    );
    await timer.click();
    await expect(page.getByTestId("run-timer-clock-hint")).toHaveText(
      "The timer follows the game's clock.",
    );
    await page.keyboard.press("Escape");

    // The credits: both counters saved, their total is the time
    writeSmz3(bridge.memory, {
      clock: { sm: smFrames, zelda: 7_000 },
      mode: "credits",
    });
    await expect(timer).toHaveAccessibleName(
      /^Run timer: 3:(2\d|3\d), stopped at the goal$/,
    );
  } finally {
    await bridge.stop();
  }
});

test("the stream view draws the run timer under the grid", async ({
  context,
  page,
}) => {
  await openOnGame(page, "smz3");
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

test("the stream view follows the SMZ3 tracker", async ({ context, page }) => {
  await openOnGame(page, "smz3");
  const stream = await context.newPage();
  await stream.goto("./?view=obs");
  await expect(stream.getByTestId("obs-view")).toBeVisible();
  await expect(stream.getByTestId("smz3-item-varia")).toHaveAccessibleName(
    /^Varia Suit, not obtained/,
  );
  await page.getByTestId("smz3-item-varia").click();
  await expect(stream.getByTestId("smz3-item-varia")).toHaveAccessibleName(
    /^Varia Suit, obtained/,
  );
});

/** The board's checks: axe, no sideways scroll, every control on the keyboard. */
const auditBoard = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .disableRules(["target-size"])
    .analyze();
  // Map markers sit where the location is in the game, some closer than
  // 24 px apart: WCAG 2.5.8's "essential" exception for map pins. Every
  // other target must meet the size rule.
  const { violations: smallTargets } = await new AxeBuilder({ page })
    .withRules(["target-size"])
    .exclude(".mapspan")
    .analyze();
  expect([...violations, ...smallTargets].map(({ id }) => id)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(await unreachableClickables(page)).toEqual([]);
};

// Two tests per width, not one: each opens the tracker and runs several axe
// analyses of a board with hundreds of markers, which is CPU the browser
// shares with the other workers. One test doing it all spent 5 s of the 30 s
// it has, so a loaded machine ran it out of time.
for (const width of WIDTHS) {
  test(`the SMZ3 maps fit, pass axe and are keyboard-reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await openOnGame(page, "smz3");
    for (const map of ["Hyrule", "Zebes"]) {
      await page.getByRole("tab", { name: map }).click();
      await auditBoard(page);
    }
  });

  test(`the SMZ3 run type dialog and keysanity board pass axe and fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await openOnGame(page, "smz3");

    // The timer's panel, open
    await page.getByTestId("run-timer").click();
    await expect(page.getByTestId("run-timer-clock")).toBeVisible();
    await auditBoard(page);
    await page.keyboard.press("Escape");

    // The run type dialog
    await page.getByRole("button", { name: /^Mode/ }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a run type" });
    await auditDialog(page, dialog, width);

    // Keysanity: the dungeons' key cells and Super Metroid's keycards
    await dialog.getByLabel("Keysanity (keys and keycards anywhere)").check();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("smz3-keycards")).toBeVisible();
    await expect(page.getByTestId("smz3-item-bigKeyGT")).toBeVisible();
    await auditBoard(page);
  });
}
