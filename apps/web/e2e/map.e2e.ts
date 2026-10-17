import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { clickToolbarAction } from "./support";

/** The old saves the store's migration tests read, as a player kept them. */
const FIXTURES = join(import.meta.dirname, "../src/stores/fixtures");

/** Load the tracker with nothing tracked, or with an old localStorage save. */
const openTracker = async (page: Page, saved?: string) => {
  await page.goto("./");
  await page.evaluate((value) => {
    localStorage.clear();
    if (value) localStorage.setItem("alltp-tracker-state", value);
  }, saved);
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

/** The glyph a marker draws on screen, besides its colour. */
const glyphOf = (marker: Locator) =>
  marker.evaluate((element) => getComputedStyle(element, "::after").content);

test.describe("the map", () => {
  test("turns a marker from out of logic to available when an item is given", async ({
    page,
  }) => {
    await openTracker(page);
    const kingsTomb = page.getByTestId("marker-kings-tomb");
    await expect(kingsTomb).toHaveAccessibleName("King's Tomb: out of logic");
    expect(await glyphOf(kingsTomb)).toBe('"✕"');

    await page.getByTestId("item-boots").click();
    await page.getByTestId("item-glove").click();
    await page.getByTestId("item-glove").click();

    await expect(kingsTomb).toHaveAccessibleName("King's Tomb: available");
    expect(await glyphOf(kingsTomb)).toBe('"✓"');
    await page.mouse.move(0, 0);
    await expect(kingsTomb).toHaveClass(/\bavailable\b/);
  });

  test("shows the Pedestal seen with the Book, available with the three pendants", async ({
    page,
  }) => {
    await openTracker(page);
    const pedestal = page.getByTestId("marker-master-sword-pedestal");
    await expect(pedestal).toHaveAccessibleName(
      "Master Sword Pedestal: out of logic",
    );

    await page.getByTestId("item-book").click();

    await expect(pedestal).toHaveAccessibleName(
      "Master Sword Pedestal: visible, not reachable yet",
    );
    await page.mouse.move(0, 0);
    // Its own colour, and an eye drawn over the ink rather than a letter
    await expect(pedestal).toHaveCSS("background-color", "rgb(127, 219, 255)");
    const glyph = await pedestal.evaluate((element) => {
      const after = getComputedStyle(element, "::after");
      return { content: after.content, mask: after.maskImage };
    });
    expect(glyph.content).toBe('""');
    expect(glyph.mask).toContain("svg");

    // The three pendants: Eastern Palace's green, Desert Palace's and Tower
    // of Hera's other two
    for (const [index, clicks] of [
      [0, 1],
      [1, 2],
      [2, 2],
    ] as const) {
      await page.getByTestId(`item-boss${index}`).click();
      for (let click = 0; click < clicks; click++) {
        await page.getByTestId(`reward-overlay-${index}`).click();
      }
    }

    await expect(pedestal).toHaveAccessibleName(
      "Master Sword Pedestal: available",
    );
  });

  test("restores the checks of a version 5 save left in localStorage", async ({
    page,
  }) => {
    await openTracker(
      page,
      readFileSync(join(FIXTURES, "v5-local-storage.json"), "utf8"),
    );

    // Its opened chest markers: Link's House, Sahasrahla's Hut, Hyrule Castle
    for (const id of ["links-house", "sahasrahlas-hut", "hyrule-castle"]) {
      await expect(page.getByTestId(`marker-${id}`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await expect(page.getByTestId("marker-kings-tomb")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.getByTestId("item-hammer")).toHaveAccessibleName(
      /^Hammer, obtained\./,
    );
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("alltp-tracker-state") ?? "{}"),
    );
    expect(stored.version).toBe(8);
    expect(stored.state.game).toBe("alttpr");
  });

  for (const [file, opened] of [
    ["v1-export.json", ["kings-tomb", "dam", "kakariko-well", "pegasus-rocks"]],
    ["v5-keysanity-export.json", ["kings-tomb", "paradox-cave"]],
  ] as const) {
    test(`imports an old export, ${file}, with its checks`, async ({
      page,
    }) => {
      await openTracker(page);

      await page.getByTestId("import-file").setInputFiles(join(FIXTURES, file));
      await page.getByRole("button", { name: "Replace progress" }).click();

      await expect(page.getByTestId("controls-status")).toHaveText(
        "Save imported.",
      );
      for (const id of opened) {
        await expect(page.getByTestId(`marker-${id}`)).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
      await expect(page.getByTestId("marker-links-house")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
  }

  test("exports the checks and reads them back", async ({ page }, testInfo) => {
    await openTracker(page);
    await page.getByTestId("marker-kakariko-well").click();
    const downloading = page.waitForEvent("download");
    await clickToolbarAction(
      page,
      page.getByRole("button", { name: "Export" }),
      "toolbar-more-export",
    );
    const file = testInfo.outputPath("save.json");
    await (await downloading).saveAs(file);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(saved).toMatchObject({ game: "alttpr", version: 8 });
    expect(Object.keys(saved.progress.checked)).toHaveLength(5);

    await page.getByTestId("marker-kakariko-well").click();
    await page.getByTestId("import-file").setInputFiles(file);
    await page.getByRole("button", { name: "Replace progress" }).click();

    await expect(page.getByTestId("marker-kakariko-well")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
