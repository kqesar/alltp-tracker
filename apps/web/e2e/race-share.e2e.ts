import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { auditPage, clickToolbarAction, tabTo, WIDTHS } from "./support";

// Export and Share carry the places checked and when, which Race Mode keeps
// from the overlay API and live follow: both are off in a race, on again once
// it is off, with no reload. docs/guide.md, "Races".

// The reason the buttons give, read from the app's own source so the two
// cannot drift (the browser tests run outside the app's `@/` aliases)
const WHY = (() => {
  const source = readFileSync(
    join(import.meta.dirname, "../src/share/raceShare.ts"),
    "utf8",
  );
  const reason = /RACE_SHARE_WHY =\s*"([^"]+)"/.exec(source)?.[1];
  if (!reason) throw new Error("RACE_SHARE_WHY not found in raceShare.ts");
  return reason;
})();

/** The tracker with nothing saved but Race Mode set always on. */
const inRace = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "alltp-tracker-autotrack",
      JSON.stringify({ state: { raceChoice: "on" }, version: 1 }),
    );
  });
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

/** The two actions as the page offers them: in the bar, else in More. */
const actions = async (page: Page) => {
  await page.getByTestId("toolbar").waitFor();
  if (await page.getByTestId("share-button").isVisible()) {
    return [
      page.getByRole("button", { name: "Export" }),
      page.getByTestId("share-button"),
    ];
  }
  await page.getByTestId("toolbar-more").click();
  return [
    page.getByTestId("toolbar-more-export"),
    page.getByTestId("toolbar-more-share"),
  ];
};

/**
 * `clickToolbarAction` for an action that is off: Playwright counts an
 * `aria-disabled` button as not enabled and would wait on it, a click being
 * what a player makes anyway.
 */
const clickOff = async (page: Page, button: Locator, item: string) => {
  await page.getByTestId("toolbar").waitFor();
  if (await button.isVisible()) return button.click({ force: true });
  await page.getByTestId("toolbar-more").click();
  await page.getByTestId(item).click({ force: true });
};

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("Export and Share are off in Race Mode, described, and back with it", async ({
      page,
    }) => {
      const downloads: string[] = [];
      page.on("download", (download) =>
        downloads.push(download.suggestedFilename()),
      );
      await inRace(page);

      // Off, yet focusable, with the reason as their description
      for (const action of await actions(page)) {
        await expect(action).toHaveAttribute("aria-disabled", "true");
        await expect(action).toHaveAccessibleDescription(WHY);
      }
      await page.keyboard.press("Escape");

      // Clicking either does nothing but say why
      await clickOff(
        page,
        page.getByRole("button", { name: "Export" }),
        "toolbar-more-export",
      );
      await expect(page.getByTestId("controls-status")).toHaveText(WHY);
      await expect(page.getByTestId("controls-status")).toHaveAttribute(
        "data-tone",
        "refused",
      );
      await clickOff(
        page,
        page.getByTestId("share-button"),
        "toolbar-more-share",
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(downloads).toEqual([]);

      // A keyboard reaches the button and hears the reason
      if (await page.getByTestId("share-button").isVisible()) {
        await tabTo(page, "share-button");
        await expect(page.getByTestId("share-button")).toBeFocused();
      }
      await auditPage(page, ".mapspan");

      // Race Mode back to Auto (no race flag read, nothing connecting): both
      // work again, the page not reloaded
      await clickToolbarAction(
        page,
        page.getByTestId("autotrack-button"),
        "toolbar-more-autotrack",
      );
      const dialog = page.getByRole("dialog", { name: "Autotracking" });
      await dialog
        .getByRole("group", { name: "Race Mode" })
        .getByRole("radio", { name: "Auto" })
        .check();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);

      for (const action of await actions(page)) {
        await expect(action).not.toHaveAttribute("aria-disabled");
      }
      await page.keyboard.press("Escape");
      const download = page.waitForEvent("download");
      await clickToolbarAction(
        page,
        page.getByRole("button", { name: "Export" }),
        "toolbar-more-export",
      );
      expect((await download).suggestedFilename()).toMatch(
        /^alltp-tracker-save-.*\.json$/,
      );
      await clickToolbarAction(
        page,
        page.getByTestId("share-button"),
        "toolbar-more-share",
      );
      await expect(
        page.getByRole("dialog", { name: "Share this run" }),
      ).toBeVisible();
    });
  });
}

test("Super Metroid's Export and Share are off while its Race Mode is on", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("alltp-tracker-game", "sm"),
  );
  await page.goto("./");
  await page.getByTestId("toolbar").waitFor();
  // Map Rando has no race flag: Race Mode is on until the player turns it off
  for (const action of await actions(page)) {
    await expect(action).toHaveAttribute("aria-disabled", "true");
    await expect(action).toHaveAccessibleDescription(WHY);
  }
  await auditPage(page);

  await page.evaluate(() =>
    localStorage.setItem(
      "alltp-tracker-sm-autotrack",
      JSON.stringify({
        state: { connectOnStart: false, raceChoice: "off" },
        version: 0,
      }),
    ),
  );
  await page.reload();
  await page.getByTestId("toolbar").waitFor();
  await expect(page.getByTestId("share-button")).not.toHaveAttribute(
    "aria-disabled",
  );
  await expect(
    page.getByRole("button", { name: "Export" }),
  ).not.toHaveAttribute("aria-disabled");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^alltp-tracker-sm-.*\.json$/,
  );
});
