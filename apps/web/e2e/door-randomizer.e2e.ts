import { expect, type Page, test } from "@playwright/test";
import { auditPage, WIDTHS } from "./support";

/** A Door Randomizer run on an empty board, its key pots shuffled. */
const openDoorRun = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByRole("button", { name: /^Mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a run type" });
  await dialog.getByRole("button", { name: /^Door Randomizer/ }).click();
  await page.getByRole("button", { name: "Switch & reset" }).click();
  await page.getByRole("button", { name: /^Mode/ }).click();
  // The bomb bag not known until set (read as on, its upgrade not known)
  const bag = dialog.getByRole("combobox", { name: "Bomb bag" });
  await expect(bag).toHaveValue("?");
  await bag.selectOption("false");
  await dialog.getByRole("combobox", { name: "Pottery" }).selectOption("keys");
  return dialog;
};

test("a Door Randomizer run lists its key pots in DR's logic, checked in place", async ({
  page,
}) => {
  const dialog = await openDoorRun(page);
  await expect(
    dialog.getByRole("combobox", { name: "Door shuffle" }),
  ).toHaveValue("vanilla");
  await auditPage(page);
  await dialog.getByRole("button", { name: "Close" }).first().click();

  await expect(page.getByTestId("logic-note-door")).toHaveText(
    /Door Randomizer seed: the logic is DR's own \(1\.5\.8\)\./,
  );
  await page.getByTestId("map-view-tab-checks").click();
  // DR's world, loaded on demand: the dark square's pot wants the lamp
  await page.getByTestId("checks-filter-unavailable").check();
  const row = page.getByTestId("check-row-eastern-palace/dark-square-pot-key");
  await expect(row).toContainText("out of logic", { ignoreCase: true });
  await page.getByTestId("item-lantern").click();
  await expect(row).not.toContainText("out of logic", { ignoreCase: true });
  await expect(row).toContainText("available", { ignoreCase: true });
  // Done rows shown, so the row stays as it is ticked
  await page.getByTestId("checks-filter-opened").check();
  await row.getByRole("checkbox").check();
  await expect(row.getByRole("checkbox")).toBeChecked();
  await auditPage(page);

  // Kept across a reload, with the run
  await page.reload();
  await page.getByTestId("map-view-tab-checks").click();
  await page.getByTestId("checks-filter-opened").check();
  await expect(
    page
      .getByTestId("check-row-eastern-palace/dark-square-pot-key")
      .getByRole("checkbox"),
  ).toBeChecked();
});

/** A crossed door shuffle's run, its intensity not known, on the Doors tab. */
const openDoorShuffle = async (page: Page) => {
  const dialog = await openDoorRun(page);
  await dialog
    .getByRole("combobox", { name: "Door shuffle" })
    .selectOption("crossed");
  await expect(
    dialog.getByRole("combobox", { name: "Door intensity" }),
  ).toHaveValue("?");
  await dialog.getByRole("button", { name: "Close" }).first().click();
  await page.getByRole("tab", { name: "Doors" }).click();
  await expect(page.getByTestId("doors-panel")).toBeVisible();
};

test("a door shuffle is noted by hand, door by door, in DR's world", async ({
  page,
}) => {
  await openDoorShuffle(page);
  await expect(page.getByTestId("logic-note-door")).toContainText(
    "Its doors are shuffled: the logic follows the doors you note",
  );
  await page.getByTestId("doors-dungeon").selectOption("Eastern Palace");
  // Intensity not known reads as 3: Eastern's lobby is asked
  const lobby = page.getByRole("combobox", {
    name: "Eastern entrance: opens on",
  });
  await lobby.selectOption("eastern-lobby-s");
  const link = page.getByTestId("door-link-eastern-lobby-bridge-n");
  await link.selectOption("eastern-cannonball-s");
  await expect(page.getByTestId("door-link-eastern-cannonball-s")).toHaveValue(
    "eastern-lobby-bridge-n",
  );
  await expect(page.getByTestId("doors-summary")).toContainText(
    "2 of 31 doors of Eastern Palace noted",
  );
  // A link notes no kind: the linked door's stays unknown until noted, by
  // the quick control, from the keyboard
  const kind = page.getByTestId("door-kind-eastern-cannonball-s");
  await expect(kind).toHaveValue("");
  const plain = page.getByRole("button", {
    name: /^Note the \d+ linked doors? of Eastern Palace plain$/,
  });
  await plain.focus();
  await page.keyboard.press("Enter");
  await expect(kind).toHaveValue("normal");
  await expect(plain).toHaveCount(0);
  await page
    .getByRole("spinbutton", { name: "Small keys in Eastern Palace, in all" })
    .fill("2");
  await auditPage(page);
  // One undo step a note
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Small keys in Eastern Palace, in all",
    }),
  ).toHaveValue("");
  // The notes are the run's: kept across a reload
  await page.reload();
  await page.getByTestId("doors-dungeon").selectOption("Eastern Palace");
  await expect(page.getByTestId("door-link-eastern-cannonball-s")).toHaveValue(
    "eastern-lobby-bridge-n",
  );
});

for (const width of WIDTHS) {
  test(`the Doors tab fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width });
    await openDoorShuffle(page);
    await page.getByTestId("doors-dungeon").selectOption("Ganons Tower");
    await page
      .getByTestId("door-link-gt-lobby-left-down-stairs")
      .selectOption({ index: 1 });
    // A door with a kind linked: the quick plain control shows
    await page.getByTestId("door-link-gt-lobby-s").selectOption({ index: 1 });
    await expect(page.getByTestId("doors-plain")).toBeVisible();
    await auditPage(page);
    if (process.env.DOOR_SHOTS !== undefined)
      await page.screenshot({
        fullPage: false,
        path: `${process.env.DOOR_SHOTS}/doors-${width}.png`,
      });
    if (process.env.DOOR_SHOTS !== undefined)
      await page.getByTestId("doors-panel").screenshot({
        path: `${process.env.DOOR_SHOTS}/doors-panel-${width}.png`,
      });
  });
}

for (const width of WIDTHS) {
  test(`a Door Randomizer run's settings fit the Mode dialog at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    const dialog = await openDoorRun(page);
    const pottery = dialog.getByRole("combobox", { name: "Pottery" });
    await pottery.scrollIntoViewIfNeeded();
    const [box, select] = await Promise.all([
      dialog.boundingBox(),
      pottery.boundingBox(),
    ]);
    if (!(box && select)) throw new Error("no box");
    expect(select.x).toBeGreaterThanOrEqual(box.x);
    expect(select.x + select.width).toBeLessThanOrEqual(box.x + box.width);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("a DR Crosskeys run notes its entrances in DR's own pool and logic", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^Mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a run type" });
  await dialog.getByRole("button", { name: /^DR Crosskeys/ }).click();
  await page.getByRole("button", { name: "Switch & reset" }).click();
  await page.getByRole("button", { name: /^Mode/ }).click();
  // The shuffle's own settings, while entrances are shuffled: not known
  // until set, so each may be moved
  await expect(
    dialog.getByRole("combobox", { name: "Back of Tavern" }),
  ).toHaveValue("?");
  await expect(
    dialog.getByRole("combobox", { name: "Link's House" }),
  ).toHaveValue("?");
  // Crosskeys races roll no bomb bag
  await expect(dialog.getByRole("combobox", { name: "Bomb bag" })).toHaveValue(
    "false",
  );
  await auditPage(page);
  await dialog.getByRole("button", { name: "Close" }).first().click();

  // DR's crossed pool: the entrance randomizer's doors, Link's House and
  // the Tavern's back
  await expect(page.getByTestId(/^entrance-/)).toHaveCount(140);
  await expect(page.getByTestId("logic-note")).toContainText(
    "The logic follows the entrances you noted",
  );
  await expect(page.getByTestId("logic-note-door")).toHaveText(
    /the logic is DR's own/,
  );
  await page.getByTestId("entrance-tavern-north").click();
  await page.keyboard.type("tavern");
  await page.getByTestId("entrance-option-tavern").click();
  await expect(page.getByTestId("entrance-tavern-north")).toHaveAccessibleName(
    "Tavern North: leads to Tavern",
  );
  // Map pins: WCAG 2.5.8's exception, as in a Crosskeys run
  await auditPage(page, ".mapspan");
});

test("a Door Randomizer run picks one of DR's own entrance shuffles in its summary", async ({
  page,
}) => {
  const dialog = await openDoorRun(page);
  const entrances = dialog.getByRole("combobox", { name: "Entrances" });
  await expect(entrances).toHaveValue("vanilla");
  await expect(entrances.getByRole("option")).toHaveText([
    "Vanilla",
    "Simple",
    "Restricted",
    "Full",
    "Lite",
    "Lean",
    "Swapped",
    "Crossed",
    "Insanity",
    "Dungeons + Full",
    "Dungeons + Simple",
  ]);
  await entrances.selectOption("dungeonssimple");
  // The shuffle's own settings appear with it, not known until set
  await expect(
    dialog.getByRole("combobox", { name: "Link's House" }),
  ).toHaveValue("?");
  await dialog
    .getByRole("combobox", { name: "Bomb bag" })
    .selectOption("false");
  await auditPage(page);
  await dialog.getByRole("button", { name: "Close" }).first().click();
  // DR's own pool: the dungeons' doors alone, on the Entrances tab
  await page.getByRole("tab", { name: "Entrances" }).click();
  await expect(page.getByTestId(/^entrance-/)).toHaveCount(28);
  await expect(page.getByTestId("logic-note")).toContainText(
    "The logic follows the entrances you noted",
  );
  // Undo takes the shuffle back, as one step
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("tab", { name: "Entrances" })).toHaveCount(0);
});

/**
 * An Overworld Randomizer run that shuffles its bonk drops: a DR run whose
 * save is made the fork's, as a seed's import makes it (the summary has no
 * select for the generator).
 */
const openBonkRun = async (page: Page) => {
  const dialog = await openDoorRun(page);
  await dialog.getByRole("button", { name: "Close" }).first().click();
  await page.evaluate(() => {
    const key = "alltp-tracker-state";
    const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
    saved.state.settings = {
      ...saved.state.settings,
      bonkDrops: true,
      customGoals: false,
      prizeShuffle: "none",
      randomizer: "owr",
      shuffleFollowers: false,
    };
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

test("an OWR run is solved in the fork's own world, its bonk drops drawn and checked", async ({
  page,
}) => {
  const bonk = page.waitForResponse(/ondemand-bonk-/);
  await openBonkRun(page);
  await bonk;
  const tree = page
    .getByTestId("map-world-dark")
    .getByRole("button", { name: /^Bonk drop: Pyramid Tree: / });
  // Reached by keyboard, checked with Enter
  await tree.focus();
  await page.keyboard.press("Enter");
  await expect(tree).toHaveAttribute("aria-pressed", "true");
  // Solved in the fork's own world, loaded on demand
  await expect(page.getByTestId("logic-note-door")).toHaveText(
    /Overworld Randomizer seed: the logic is the fork's own \(0\.8\.0\.2, on DR 1\.5\.7\)\./,
  );
  await page.getByTestId("map-view-tab-checks").click();
  await page.getByTestId("checks-filter-opened").check();
  await expect(
    page.getByTestId("check-row-pyramid-tree").getByRole("checkbox"),
  ).toBeChecked();
  // A bonk drop asks the boots (or a sword and Quake)
  await page.getByTestId("checks-filter-unavailable").check();
  const hideout = page.getByTestId("check-row-lost-woods-hideout-tree");
  await expect(hideout).toContainText("out of logic", { ignoreCase: true });
  await page.getByTestId("item-boots").click();
  await expect(hideout).not.toContainText("out of logic", {
    ignoreCase: true,
  });
  await expect(hideout).toContainText("available", { ignoreCase: true });
  await auditPage(page, ".mapspan");
});

for (const width of WIDTHS) {
  test(`an OWR run's bonk drops fit the map at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await openBonkRun(page);
    await expect(page.getByTestId(/^marker-bonk-/).first()).toBeVisible();
    await expect(page.getByTestId(/^marker-bonk-/)).toHaveCount(32);
    // Map pins sit where the game has them: WCAG 2.5.8's "essential"
    // exception (tracker.e2e.ts); the bonk drops' stand clear of the others
    await auditPage(page, ".mapspan");
    if (process.env.DOOR_SHOTS !== undefined)
      await page.getByTestId("map-tracker").screenshot({
        path: `${process.env.DOOR_SHOTS}/bonk-map-${width}.png`,
      });
  });
}

/**
 * An OWR run whose whirlpools are shuffled and flute spots moved, and with
 * `crossed`, its edges crossed, with `mixed`, its screens flipped by Mixed.
 */
const openOverworldRun = async (page: Page, crossed = false, mixed = false) => {
  const dialog = await openDoorRun(page);
  await dialog.getByRole("button", { name: "Close" }).first().click();
  await page.evaluate(
    ([crossed, mixed]) => {
      const key = "alltp-tracker-state";
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
      saved.state.settings = {
        ...saved.state.settings,
        customGoals: false,
        ...(crossed ? { owCrossed: "grouped" } : {}),
        ...(mixed ? { owMixed: true } : {}),
        owFluteShuffle: "random",
        owWhirlpool: true,
        prizeShuffle: "none",
        randomizer: "owr",
        shuffleFollowers: false,
      };
      localStorage.setItem(key, JSON.stringify(saved));
    },
    [crossed, mixed],
  );
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByRole("tab", { name: "Overworld" }).click();
  await expect(page.getByTestId("overworld-panel")).toBeVisible();
};

test("an OWR run's whirlpools and flute spots are noted by hand, from the keyboard", async ({
  page,
}) => {
  await openOverworldRun(page);
  const pool = page.getByRole("combobox", { name: "C Whirlpool: leads to" });
  await pool.focus();
  await pool.selectOption("Zora Whirlpool");
  await expect(
    page.getByRole("combobox", { name: "Zora Whirlpool: leads to" }),
  ).toHaveValue("C Whirlpool");
  const village = page.getByRole("checkbox", { name: "Kakariko Village" });
  await village.focus();
  await page.keyboard.press("Space");
  await expect(village).toBeChecked();
  // The dark world's two whirlpools pair with no note
  await expect(page.getByTestId("overworld-summary")).toHaveText(
    "4 of 8 whirlpools noted, 1 of 8 flute spots noted",
  );
  await auditPage(page);
  // One undo step a note; the notes are the run's, kept across a reload
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(village).not.toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Zora Whirlpool: leads to" }),
  ).toHaveValue("C Whirlpool");
});

test("a crossed OWR run's edge pairs are noted by hand, from the keyboard", async ({
  page,
}) => {
  await openOverworldRun(page, true);
  const pair = page.getByRole("combobox", {
    name: "Lost Woods SW to Lost Woods Pass NW: world",
  });
  await pair.focus();
  await pair.selectOption("crosses");
  await expect(page.getByTestId("overworld-summary")).toContainText(
    "1 of 67 edge pairs noted",
  );
  await auditPage(page);
  await page.reload();
  await expect(
    page.getByRole("combobox", {
      name: "Lost Woods SW to Lost Woods Pass NW: world",
    }),
  ).toHaveValue("crosses");
});

test("a mixed OWR run's screens are noted by hand, a group at a time, from the keyboard", async ({
  page,
}) => {
  await openOverworldRun(page, false, true);
  const group = page.getByRole("combobox", {
    name: "Lost Woods, Stone Bridge, Master Sword Meadow: flipped",
  });
  await group.focus();
  await expect(group).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(group).toHaveValue("flipped");
  // Its whirlpools shuffled: their screens flip apart (31 groups)
  await expect(page.getByTestId("overworld-summary")).toContainText(
    "1 of 31 screen groups noted",
  );
  await auditPage(page);
  await page.reload();
  await expect(
    page.getByRole("combobox", {
      name: "Lost Woods, Stone Bridge, Master Sword Meadow: flipped",
    }),
  ).toHaveValue("flipped");
});

for (const width of WIDTHS) {
  test(`the Overworld tab fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width });
    await openOverworldRun(page, true, true);
    await page
      .getByRole("combobox", { name: "Link's House: flipped" })
      .selectOption("stands");
    await page
      .getByRole("combobox", {
        name: "Lost Woods SC to Lost Woods Pass NE: world",
      })
      .selectOption("stays");
    await page
      .getByRole("combobox", { name: "Lake Hylia Whirlpool: leads to" })
      .selectOption("Octoballoon Whirlpool");
    for (const id of ["00", "02", "03", "05", "07", "0a", "0f", "18"])
      await page.getByTestId(`flute-screen-${id}`).check();
    await expect(page.getByTestId("flute-screen-3f")).toBeDisabled();
    await auditPage(page);
    if (process.env.DOOR_SHOTS !== undefined) {
      await page.screenshot({
        fullPage: false,
        path: `${process.env.DOOR_SHOTS}/overworld-${width}.png`,
      });
      await page.getByTestId("overworld-panel").screenshot({
        path: `${process.env.DOOR_SHOTS}/overworld-panel-${width}.png`,
      });
    }
  });
}
