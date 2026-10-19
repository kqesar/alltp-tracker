import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { FakeUsb2Snes } from "../../../packages/autotrack/test/fake-usb2snes";
import { writeSmz3 } from "../../../packs/smz3/test/smz3-rom";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

/** The tracker with nothing saved, then SMZ3 picked in its dialog. */
const openSmz3 = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page
    .getByRole("dialog", { name: "Choose a run type" })
    .getByTestId("game-smz3")
    .click();
  await expect(page.getByTestId("smz3-item-morph")).toBeVisible();
};

test("tracks SMZ3: items, both maps by the logic, a reload keeping the run", async ({
  page,
}) => {
  await openSmz3(page);
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
  ).toContain("smz3/zebes.png");

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

test("the stream view follows the SMZ3 tracker", async ({ context, page }) => {
  await openSmz3(page);
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

for (const width of WIDTHS) {
  test(`the SMZ3 board fits, passes axe and is keyboard-reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await openSmz3(page);
    for (const map of ["Hyrule", "Zebes"]) {
      await page.getByRole("tab", { name: map }).click();
      await auditBoard(page);
    }

    // The run type dialog
    await page.getByRole("button", { name: /^Mode/ }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a run type" });
    await expect(dialog).toBeVisible();
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

    // Keysanity: the dungeons' key cells and Super Metroid's keycards
    await dialog.getByLabel("Keysanity (keys and keycards anywhere)").check();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("smz3-keycards")).toBeVisible();
    await expect(page.getByTestId("smz3-item-bigKeyGT")).toBeVisible();
    await auditBoard(page);
  });
}
