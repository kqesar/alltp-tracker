import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { unreachableClickables, WCAG_AA, WIDTHS } from "./support";

/** alttpr.com's file for the Daily Challenge of Oct 16 (test/seed-files). */
const DAILY = readFileSync(
  new URL(
    "../../../packs/alttpr/test/seed-files/eM43RgZ4Gj.json",
    import.meta.url,
  ),
  "utf8",
);

const SEED_FILES = "https://alttpr-patch-data.s3.us-east-2.amazonaws.com/*";

/** alttpr.com's bucket, answering the Daily's file and a 403 for any other. */
const serveSeedFiles = async (page: Page) => {
  const asked: string[] = [];
  await page.route(SEED_FILES, (route) => {
    const url = route.request().url();
    asked.push(url);
    return url.endsWith("/eM43RgZ4Gj.json")
      ? route.fulfill({
          body: DAILY,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
        })
      : route.fulfill({
          body: "<Error><Code>AccessDenied</Code></Error>",
          headers: { "Access-Control-Allow-Origin": "*" },
          status: 403,
        });
  });
  return asked;
};

const openRunTypes = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^Mode/ }).click();
  return page.getByRole("dialog", { name: "Choose a run type" });
};

const load = async (page: Page, text: string) => {
  await page.getByTestId("seed-import-input").fill(text);
  await page.getByTestId("seed-import-load").click();
};

test("starts a run from a seed's link, once the reset is confirmed", async ({
  page,
}) => {
  const asked = await serveSeedFiles(page);
  await openRunTypes(page);

  await load(page, "https://alttpr.com/en/h/eM43RgZ4Gj");

  const confirm = page.getByRole("dialog", { name: "Switch run type?" });
  await expect(confirm).toContainText(
    'Switching to "Inverted (Inverted, Fast Ganon, 4/7, Basic placement, Hard pool, Hard functionality)" will reset your current progress.',
  );
  await confirm.getByRole("button", { name: "Switch & reset" }).click();

  await expect(
    page.getByRole("button", { name: /^Mode/ }),
  ).toHaveAccessibleName("Mode Inverted");
  expect(asked).toEqual([
    "https://alttpr-patch-data.s3.us-east-2.amazonaws.com/eM43RgZ4Gj.json",
  ]);
});

test("says when alttpr.com has no such seed, or the text is no seed", async ({
  page,
}) => {
  const asked = await serveSeedFiles(page);
  await openRunTypes(page);
  const status = page.getByTestId("seed-import-status");

  await load(page, "a seed please");
  await expect(status).toHaveText(
    "Paste the seed's link from alttpr.com (or its hash), avianart.games or Hyrule Town Hall.",
  );
  await load(page, "9MQ9gO1wMD");
  await expect(status).toHaveText("alttpr.com has no seed with this hash.");
  expect(asked).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: /^Mode/ }),
  ).toHaveAccessibleName("Mode Open");
});

test("starts a glitched seed's run with no logic, every check maybe", async ({
  page,
}) => {
  // The Open seed's file, as alttpr.com writes an Overworld Glitches one
  const file = JSON.parse(
    readFileSync(
      new URL(
        "../../../packs/alttpr/test/seed-files/9MQ9gO1wMD.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  file.spoiler.meta.logic = "OverworldGlitches";
  await page.route(SEED_FILES, (route) =>
    route.fulfill({
      body: JSON.stringify(file),
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  const dialog = await openRunTypes(page);

  await load(page, "9MQ9gO1wMD");
  const confirm = page.getByRole("dialog", { name: "Switch run type?" });
  await expect(confirm).toContainText(
    'Switching to "Open (Open, Ganon, 7/7, Overworld Glitches)"',
  );
  await confirm.getByRole("button", { name: "Switch & reset" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("logic-note")).toHaveText(
    "The tracker has no logic for Overworld Glitches yet: every check shows as maybe.",
  );
  await expect(page.getByTestId("marker-sahasrahlas-hut")).toHaveAccessibleName(
    /: maybe available$/,
  );
  await page.getByRole("button", { name: /^Mode/ }).click();
  await expect(dialog.getByLabel("Current run settings")).toContainText(
    "GlitchesOverworld Glitches",
  );
});

for (const width of WIDTHS) {
  test(`the run types' seed form passes axe and fits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await serveSeedFiles(page);
    const dialog = await openRunTypes(page);
    await load(page, "9MQ9gO1wMD");
    await expect(page.getByTestId("seed-import-status")).not.toBeEmpty();

    const { violations } = await new AxeBuilder({ page })
      .include('[data-testid="seed-import"]')
      .withTags(WCAG_AA)
      .analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);
    const form = await page.getByTestId("seed-import").boundingBox();
    const box = await dialog.boundingBox();
    expect(form).not.toBeNull();
    expect(box).not.toBeNull();
    if (form && box) {
      expect(form.x + form.width).toBeLessThanOrEqual(box.x + box.width);
    }
    expect(await unreachableClickables(page, "dialog[open]")).toEqual([]);

    // Race Mode set always on: a note in the form's place, read by axe too
    await page.evaluate(() =>
      localStorage.setItem(
        "alltp-tracker-autotrack",
        JSON.stringify({ state: { raceChoice: "on" }, version: 1 }),
      ),
    );
    await page.reload();
    await page.getByRole("button", { name: /^Mode/ }).click();
    await expect(page.getByTestId("seed-import-race")).toBeVisible();
    const race = await new AxeBuilder({ page })
      .include('[data-testid="seed-import"]')
      .withTags(WCAG_AA)
      .analyze();
    expect(race.violations.map(({ id }) => id)).toEqual([]);
    const note = await page.getByTestId("seed-import").boundingBox();
    expect(note && box && note.x + note.width <= box.x + box.width).toBe(true);
  });
}
