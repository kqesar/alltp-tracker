import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

const openTracker = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

const runTypes = (page: Page) =>
  page.getByRole("dialog", { name: "Choose a run type" });

test("tunes a setting in place: the run stays, one undo takes it back", async ({
  page,
}) => {
  await openTracker(page);
  const hookshot = page.getByTestId("item-hookshot");
  await hookshot.click();

  await page.getByRole("button", { name: /^Mode/ }).click();
  const pool = runTypes(page).getByRole("combobox", { name: "Item pool" });
  await pool.selectOption("hard");
  await expect(pool).toHaveValue("hard");
  await runTypes(page).getByRole("button", { name: "Close" }).click();

  await expect(hookshot).toHaveAccessibleName(/^Hookshot, obtained\./);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("alltp-tracker-state") ?? "{}").state,
  );
  expect(saved.settings.itemPool).toBe("hard");

  await page.getByTestId("undo").click();
  await page.getByRole("button", { name: /^Mode/ }).click();
  await expect(pool).toHaveValue("normal");
  await expect(hookshot).toHaveAccessibleName(/^Hookshot, obtained\./);
});

test("a Mystery run finds its settings as it goes, the run kept", async ({
  page,
}) => {
  await openTracker(page);
  await page.getByRole("button", { name: /^Mode/ }).click();
  await runTypes(page)
    .getByRole("button", { name: /^Mystery/ })
    .click();
  await page.getByRole("button", { name: "Switch & reset" }).click();

  // Nothing known yet: the go mode cannot say, Ganon's Tower may only be open
  await expect(page.getByTestId("go-mode")).toHaveText(/Go mode: goal unknown/);
  // Eastern Palace: 2 of its 3 items found
  const eastern = page.getByTestId("chest-overlay-0");
  await eastern.click();
  await eastern.click();
  await page.getByTestId("item-hookshot").click();

  await page.getByRole("button", { name: /^Mode/ }).click();
  const summary = runTypes(page);
  await expect(summary.getByRole("combobox", { name: "Goal" })).toHaveValue(
    "?",
  );
  await summary.getByRole("combobox", { name: "Goal" }).selectOption("ganon");
  await summary
    .getByRole("combobox", { name: "Dungeon items" })
    .selectOption("full");
  await summary.getByRole("button", { name: "Close" }).click();

  // The run kept, Eastern Palace's 2 items found out of its 6 locations now
  await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
    /^Hookshot, obtained\./,
  );
  await expect(eastern).toHaveAccessibleName(/chests: 4 left/);
  await expect(page.getByTestId("go-mode")).toHaveAccessibleName(
    "Go mode: not yet",
  );
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("alltp-tracker-state") ?? "{}").state,
  );
  expect(saved.settings.hidden).not.toContain("goal");
  expect(saved.settings.hidden).toContain("crystalsTower");
});

test("a Retro run lays its shops on the grid, and buying arrows lets the bow shoot", async ({
  page,
}) => {
  await openTracker(page);
  await page.getByRole("button", { name: /^Mode/ }).click();
  const retro = runTypes(page).getByRole("button", { name: /^Retro/ });
  // Its logic is modelled: no "logic soon" badge
  await expect(retro).not.toContainText("logic soon");
  await retro.click();
  await page.getByRole("button", { name: "Switch & reset" }).click();

  await expect(page.getByTestId("logic-note")).toHaveCount(0);
  const arrows = page.getByTestId("item-shoparrow");
  await expect(arrows).toHaveAccessibleName(/^Arrow shop, not found\./);
  await expect(page.getByTestId("item-shopkey")).toBeVisible();
  // A bow without arrows bought: Eastern Palace's boss is out of logic
  await page.getByTestId("item-bow").click();
  await page.getByTestId("item-bow").click();
  await page.getByTestId("item-lantern").click();
  const boss = page.getByTestId("boss-marker-eastern-palace");
  await expect(boss).toHaveAccessibleName(/boss out of logic/);
  await arrows.click();
  await expect(arrows).toHaveAccessibleName(/^Arrow shop, found\./);
  await expect(boss).not.toHaveAccessibleName(/boss out of logic/);
  const { violations } = await new AxeBuilder({ page })
    .include("[data-testid=item-grid]")
    .withTags(WCAG_AA)
    .analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);
});

test("a run type whose logic is not modelled says so, every check maybe", async ({
  page,
}) => {
  await openTracker(page);
  await page.getByRole("button", { name: /^Mode/ }).click();
  await runTypes(page)
    .getByRole("button", { name: /^Crosskeys/ })
    .click();
  await page.getByRole("button", { name: "Switch & reset" }).click();
  // Its keys kept in their dungeons: the entrance randomizer keeps them
  // there, which the tracker does not track
  await page.getByRole("button", { name: /^Mode/ }).click();
  await runTypes(page)
    .getByRole("combobox", { name: "Dungeon items" })
    .selectOption("mcs");
  await runTypes(page).getByRole("button", { name: "Close" }).click();

  await expect(page.getByTestId("logic-note")).toHaveText(
    "The tracker has no logic for Crossworld entrances with dungeon items kept in their dungeons yet: every check shows as maybe.",
  );
  // No marker says available or out of logic: the Open logic would be wrong
  const markers = page.getByTestId(/^marker-/);
  await expect(markers.first()).toBeVisible();
  for (const name of await markers.evaluateAll((all) =>
    all.map((marker) => marker.getAttribute("aria-label") ?? ""),
  )) {
    expect(name).not.toMatch(/(: |boss )available|out of logic|not reachable/);
  }
  await expect(page.getByTestId("go-mode")).toHaveCount(0);
  // Map pins sit closer than 24 px: WCAG 2.5.8's exception (tracker.e2e.ts)
  const { violations } = await new AxeBuilder({ page })
    .include(".map-panel")
    .exclude(".mapspan")
    .withTags(WCAG_AA)
    .analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);
});

test("shows the key cells from the Mode dialog, by keyboard too", async ({
  page,
}) => {
  await openTracker(page);
  // The toolbar has no button for them any more
  await expect(page.getByTestId("big-key-0")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /big keys/i })).toHaveCount(0);

  await page.getByRole("button", { name: /^Mode/ }).click();
  const option = runTypes(page).getByRole("checkbox", {
    name: "Show key cells",
  });
  await expect(option).not.toBeChecked();
  await expect(option).toHaveAccessibleDescription(
    /shown on their own in MC, MCS and Full/i,
  );

  // Reached by Tab after the settings' selects, and set with Space
  await runTypes(page).getByRole("combobox").last().focus();
  await page.keyboard.press("Tab");
  await expect(option).toBeFocused();
  await page.keyboard.press("Space");
  await expect(option).toBeChecked();
  await runTypes(page).getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("big-key-0")).toBeVisible();
  await expect(page.getByTestId("layout")).toHaveClass(/layout--key-rows/);

  // A device pref: it holds across a reload, and the box shows it
  await page.reload();
  await expect(page.getByTestId("big-key-0")).toBeVisible();
  await page.getByRole("button", { name: /^Mode/ }).click();
  await expect(option).toBeChecked();
  await option.uncheck();
  await runTypes(page).getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("big-key-0")).toHaveCount(0);
});

test("a boss shuffle reads each boss as any its dungeon may hold", async ({
  page,
}) => {
  // The browser tests' end of a run, Misery Mire's boss alive, no hookshot:
  // Vitreous needs none, Arrghus does
  const end = JSON.parse(
    readFileSync(join(import.meta.dirname, "fixtures/end-game.json"), "utf8"),
  );
  const saved = JSON.stringify({
    ...end,
    state: {
      ...end.state,
      items: { ...end.state.items, boss8: 1, hookshot: false },
    },
  });
  await page.goto("./");
  await page.evaluate((value) => {
    localStorage.clear();
    localStorage.setItem("alltp-tracker-state", value);
  }, saved);
  await page.reload();
  const boss = page.getByTestId("boss-marker-misery-mire");
  await expect(boss).toHaveAccessibleName(/: boss available/);

  await page.getByRole("button", { name: /^Mode/ }).click();
  const bosses = runTypes(page).getByRole("combobox", { name: "Boss shuffle" });
  await expect(bosses).toHaveValue("none");
  await bosses.selectOption("full");
  await runTypes(page).getByRole("button", { name: "Close" }).click();

  await expect(boss).toHaveAccessibleName(/: boss maybe available/);
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem("alltp-tracker-state") ?? "{}").state,
  );
  expect(state.settings.bossShuffle).toBe("full");
});

for (const width of WIDTHS) {
  test(`the run's tunable settings pass axe and fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await openTracker(page);
    await page.getByRole("button", { name: /^Mode/ }).click();
    const dialog = runTypes(page);
    await expect(dialog.getByRole("combobox")).toHaveCount(10);

    await expect(
      dialog.getByRole("checkbox", { name: "Show key cells" }),
    ).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .include("dialog[open]")
      .withTags(WCAG_AA)
      .analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);
    const summary = await dialog.locator(".run-settings").boundingBox();
    const box = await dialog.boundingBox();
    expect(summary).not.toBeNull();
    expect(box).not.toBeNull();
    if (summary && box) {
      expect(summary.x + summary.width).toBeLessThanOrEqual(box.x + box.width);
    }
    expect(await unreachableClickables(page, "dialog[open]")).toEqual([]);
  });
}
