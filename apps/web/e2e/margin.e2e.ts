import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { auditPage, WIDTHS } from "./support";

/** The browser tests' end of a run: every item, every boss beaten. */
const END_GAME = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/end-game.json"), "utf8"),
);

/**
 * The end of a run under basic placement with 11 hearts on screen (the
 * cell holds the hearts less 2): Misery Mire's and Turtle Rock's bosses
 * alive, or every boss beaten for the go mode.
 */
const basicRun = (bossesAlive: boolean) =>
  JSON.stringify({
    ...END_GAME,
    state: {
      ...END_GAME.state,
      items: {
        ...END_GAME.state.items,
        hearts: 9,
        ...(bossesAlive ? { boss8: 0, boss9: 0 } : {}),
      },
      settings: { ...END_GAME.state.settings, itemPlacement: "basic" },
    },
  });

/** Load the tracker with a localStorage save. */
const openTracker = async (page: Page, saved: string) => {
  await page.goto("./");
  await page.evaluate((value) => {
    localStorage.clear();
    localStorage.setItem("alltp-tracker-state", value);
  }, saved);
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

const MARGIN = "out of logic, doable outside Basic's safety margin";

test.describe("basic placement's safety margin", () => {
  test("marks a dungeon only the margin holds back, with its legend", async ({
    page,
  }) => {
    await openTracker(page, basicRun(true));

    const boss = page.getByTestId("boss-marker-misery-mire");
    await expect(boss).toHaveAccessibleName(
      new RegExp(`: boss ${MARGIN}, \\d+ chests? left \\(${MARGIN}\\)$`),
    );
    await expect(boss).toHaveClass(/\bmargin\b/);
    await expect(page.getByTestId("dungeon-marker-turtle-rock")).toHaveClass(
      /\bmargin\b/,
    );
    await expect(page.getByTestId("map-legend")).toContainText(
      "Doable, outside Basic's safety margin",
    );

    await boss.hover();
    const tooltip = page.getByTestId("tooltip");
    await expect(tooltip).toContainText(
      "Doable now, outside Basic's safety margin; Basic placement waits for 12 hearts (you have 11 hearts) before the seed relies on entering Misery Mire",
    );
  });

  test("reads an advanced run as before", async ({ page }) => {
    await openTracker(
      page,
      JSON.stringify({
        ...END_GAME,
        state: {
          ...END_GAME.state,
          items: { ...END_GAME.state.items, boss8: 0, boss9: 0, hearts: 9 },
        },
      }),
    );
    await expect(page.getByTestId("boss-marker-misery-mire")).toHaveClass(
      /\bavailable\b/,
    );
    await expect(page.getByTestId("map-legend")).not.toContainText("margin");
  });

  test("names a boss's margin: Arrghus waits for the Master Sword", async ({
    page,
  }) => {
    await openTracker(
      page,
      JSON.stringify({
        ...END_GAME,
        state: {
          ...END_GAME.state,
          items: { ...END_GAME.state.items, boss4: 0, hearts: 13, sword: 1 },
          settings: { ...END_GAME.state.settings, itemPlacement: "basic" },
        },
      }),
    );
    const boss = page.getByTestId("boss-marker-swamp-palace");
    await expect(boss).toHaveClass(/\bmargin\b/);
    await boss.hover();
    await expect(page.getByTestId("tooltip")).toContainText(
      "before the seed relies on beating Arrghus",
    );
  });

  test("says the go mode the margin alone holds back", async ({ page }) => {
    await openTracker(page, basicRun(false));

    const goMode = page.getByTestId("go-mode");
    await expect(goMode).toHaveAccessibleName(
      "Go mode: outside Basic's margin",
    );
    await goMode.click();
    const panel = page.getByTestId("go-mode-panel");
    await expect(panel.getByTestId("go-mode-margin")).toBeVisible();
    await expect(panel.getByTestId("go-mode-left")).toContainText("12 hearts");
  });
});

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("shows the margin state on the map and in Checks, accessibly", async ({
      page,
    }) => {
      await openTracker(page, basicRun(true));
      await expect(page.getByTestId("boss-marker-misery-mire")).toHaveClass(
        /\bmargin\b/,
      );
      await auditPage(page, ".mapspan");

      await page.getByTestId("map-view-tab-checks").click();
      await page.getByTestId("checks-filter-margin").check();
      // One dungeon: a list scrolled mid-zone leaves a row half under the
      // next zone's sticky heading, which axe reads as an obscured target
      await page.getByTestId("checks-zone").selectOption("Misery Mire");
      const row = page.getByTestId("check-row-misery-mire/big-chest");
      await expect(row).toContainText("Outside margin");
      await page.getByTestId("check-why-misery-mire/big-chest").click();
      await expect(row.getByTestId("missing-margin")).toHaveText(
        "Doable now, outside Basic's safety margin: Basic placement waits for 12 hearts (you have 11 hearts) before the seed relies on entering Misery Mire.",
      );
      await page.getByTestId("zone-why-misery-mire").click();
      await expect(page.getByTestId("zone-missing-misery-mire")).toContainText(
        "Doable now, outside Basic's safety margin; Basic placement waits for 12 hearts (you have 11 hearts) before the seed relies on entering Misery Mire",
      );
      await auditPage(page, ".mapspan");
    });
  });
}
