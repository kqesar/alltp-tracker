import { expect, type Page, test } from "@playwright/test";
import { auditDialog, auditPage, WIDTHS } from "./support";

/** The tricks the Hobo's waters ask: no Flippers, a fake flipper does. */
const FAKE_FLIPPER = JSON.stringify({
  state: { tricks: { enabled: true, techniques: ["fakeFlipper"] } },
  version: 12,
});

/** Palace of Darkness in reach without a light, every trick known. */
const DARK_ROOMS = JSON.stringify({
  state: {
    items: {
      agahnim: 1,
      boots: true,
      bow: 2,
      flute: true,
      glove: 2,
      hammer: true,
      moonpearl: true,
      sword: 2,
    },
    tricks: {
      enabled: true,
      techniques: ["darkRooms", "fakeFlipper", "waterWalk"],
    },
  },
  version: 12,
});

/** Load the tracker with a localStorage save, or with nothing tracked. */
const openTracker = async (page: Page, saved?: string) => {
  await page.goto("./");
  await page.evaluate((value) => {
    localStorage.clear();
    if (value) localStorage.setItem("alltp-tracker-state", value);
  }, saved);
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

const openTricksDialog = async (page: Page) => {
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page.getByTestId("tricks-button").click();
  return page.getByRole("dialog", { name: "Tricks" });
};

test.describe("the tricks", () => {
  test("mark nothing until they are turned on", async ({ page }) => {
    await openTracker(page);

    await expect(page.getByTestId("marker-hobo")).toHaveAccessibleName(
      "Hobo: out of logic",
    );
    await expect(page.getByTestId("map-legend")).not.toContainText("trick");
  });

  test("turn on from the Mode dialog and mark what a trick opens", async ({
    page,
  }) => {
    await openTracker(page);

    const dialog = await openTricksDialog(page);
    await dialog
      .getByRole("checkbox", { name: "Mark checks these tricks open" })
      .check();
    await dialog.getByRole("button", { name: "Done" }).click();
    await page
      .getByRole("dialog", { name: "Choose a run type" })
      .press("Escape");

    await expect(page.getByTestId("marker-hobo")).toHaveAccessibleName(
      "Hobo: out of logic, doable with a trick",
    );
    await expect(page.getByTestId("map-legend")).toContainText(
      "Out of logic, doable with a trick",
    );
    // Kept on the device, and not in the run
    await page.reload();
    await expect(page.getByTestId("marker-hobo")).toHaveClass(/\btrick\b/);
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("alltp-tracker-state") ?? "{}"),
    );
    expect(saved.state.tricks.enabled).toBe(true);
    expect(saved.state.checked).toEqual({});
  });

  test("learns one trick at a time and lists the Trick filter", async ({
    page,
  }) => {
    await openTracker(page, FAKE_FLIPPER);
    await page.getByTestId("map-view-tab-checks").click();
    const filter = page.getByTestId("checks-filter-trick");
    await expect(filter).not.toBeChecked();
    await filter.check();
    await expect(page.getByTestId("check-row-hobo")).toContainText("Trick");

    const dialog = await openTricksDialog(page);
    await dialog.getByRole("checkbox", { name: "Fake flipper" }).uncheck();
    await dialog.getByRole("button", { name: "Done" }).click();
    await page
      .getByRole("dialog", { name: "Choose a run type" })
      .press("Escape");

    // Nothing else opens the Hobo's waters: the filter has nothing to list
    await expect(page.getByTestId("check-row-hobo")).toHaveCount(0);
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

    test("shows the Tricks dialog within the page, accessibly", async ({
      page,
    }) => {
      await openTracker(page, FAKE_FLIPPER);

      const dialog = await openTricksDialog(page);

      await expect(dialog.getByRole("link").first()).toHaveAttribute(
        "target",
        "_blank",
      );
      for (const link of await dialog.getByRole("link").all()) {
        await expect(link).toHaveAttribute("href", /^https:\/\//);
      }
      await auditDialog(page, dialog, width);
    });

    test("says which trick opens a check in Why?, linked and accessibly", async ({
      page,
    }) => {
      await openTracker(page, FAKE_FLIPPER);
      await page.getByTestId("map-view-tab-checks").click();
      await page.getByTestId("checks-filter-trick").check();

      const row = page.getByTestId("check-row-hobo");
      // Named under the check without opening Why?, inside the row
      const chip = page.getByTestId("check-trick-hobo");
      await expect(chip).toHaveText(", doable with Fake flipper");
      await expect(row.getByRole("checkbox")).toHaveAccessibleName(
        // The flex items read apart: "Hobo , doable with"
        /^Hobo ?, doable with Fake flipper$/,
      );
      const chipBox = await chip.boundingBox();
      const rowBox = await row.boundingBox();
      expect(chipBox && rowBox).not.toBeNull();
      if (chipBox && rowBox) {
        expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(
          rowBox.x + rowBox.width,
        );
      }

      await page.getByTestId("check-why-hobo").click();

      await expect(row).toContainText("Doable now with: Fake flipper");
      await expect(row).toContainText("Missing: Zora's Flippers");
      await expect(
        row.getByRole("link", { name: /^Fake flipper/ }),
      ).toHaveAttribute("href", /youtube\.com\/watch\?v=0YzkiaY3eys&t=874s$/);
      await auditPage(page, ".mapspan");

      await page.getByTestId("check-about-tricks-hobo").click();
      const dialog = page.getByRole("dialog", { name: "Tricks" });
      await auditDialog(page, dialog, width);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId("check-about-tricks-hobo")).toBeFocused();
    });

    test("leads a dungeon's tooltip with the trick, within the screen", async ({
      page,
    }) => {
      await openTracker(page, DARK_ROOMS);

      await page.getByTestId("item-boss3").hover();

      const tooltip = page.getByTestId("tooltip");
      await expect(tooltip).toContainText("Palace of Darkness");
      await expect(tooltip).toContainText("Doable now with Dark rooms");
      const box = await tooltip.boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewport?.width ?? 0,
      );
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        viewport?.height ?? 0,
      );
    });

    test("names the trick in a tooltip, with no link", async ({ page }) => {
      await openTracker(page, FAKE_FLIPPER);
      const hobo = page.getByTestId("marker-hobo");
      await hobo.scrollIntoViewIfNeeded();

      await hobo.hover();

      await expect(page.getByTestId("missing-tricks")).toHaveText(
        "Doable now with: Fake flipper",
      );
      await expect(page.getByTestId("tooltip").getByRole("link")).toHaveCount(
        0,
      );
    });

    test("marks a trick on the map, in its tooltip, accessibly", async ({
      page,
    }) => {
      await openTracker(page, FAKE_FLIPPER);

      const hobo = page.getByTestId("marker-hobo");
      await hobo.scrollIntoViewIfNeeded();
      await hobo.hover();

      await expect(page.getByTestId("tooltip")).toContainText(
        "Doable with a trick",
      );
      await expect(hobo).toHaveClass(/\btrick\b/);
      await expect(page.getByTestId("map-legend")).toContainText("trick");
      await auditPage(page, ".mapspan");
    });
  });
}
