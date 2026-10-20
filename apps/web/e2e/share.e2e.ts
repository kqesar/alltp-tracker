import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { clickToolbarAction, WCAG_AA } from "./support";

/** The tracker with nothing saved. */
const fresh = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
};

/** Pick a game in the run type dialog. */
const pick = async (page: Page, game: "sm" | "smz3") => {
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page
    .getByRole("dialog", { name: "Choose a run type" })
    .getByTestId(`game-${game}`)
    .click();
};

/** What differs from one game to the next: its board, its mark, its status. */
const GAMES = {
  alttpr: {
    item: "item-hookshot",
    name: "A Link to the Past",
    open: fresh,
    status: "controls-status",
  },
  sm: {
    item: "sm-item-morph",
    name: "Super Metroid",
    open: async (page: Page) => {
      await fresh(page);
      await pick(page, "sm");
    },
    status: "sm-status",
  },
  smz3: {
    item: "smz3-item-hammer",
    name: "SMZ3",
    open: async (page: Page) => {
      await fresh(page);
      await pick(page, "smz3");
    },
    status: "smz3-status",
  },
} as const;

const OBTAINED = /, obtained/;
const NOT_OBTAINED = /, not obtained/;

for (const [id, game] of Object.entries(GAMES)) {
  test(`shares a ${game.name} run: the link opens it in a fresh browser`, async ({
    browser,
  }) => {
    const mine = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await mine.newPage();
    await game.open(page);
    await page.getByTestId(game.item).click();
    await expect(page.getByTestId(game.item)).toHaveAccessibleName(OBTAINED);

    await clickToolbarAction(
      page,
      page.getByTestId("share-button"),
      "toolbar-more-share",
    );
    await expect(page.getByTestId(game.status)).toHaveText(
      /^Link copied\. The run stays in the link, never sent to a server\.$/,
    );
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/alltp-tracker\/#run=[A-Za-z0-9_-]+$/);
    // Sharing changed neither the run nor the address
    await expect(page.getByTestId(game.item)).toHaveAccessibleName(OBTAINED);
    expect(page.url()).not.toContain("#run=");
    await mine.close();

    // Someone else, nothing saved on their device, whatever game they track
    const theirs = await browser.newContext();
    const requests: string[] = [];
    theirs.on("request", (request) => requests.push(request.url()));
    const viewer = await theirs.newPage();
    await viewer.goto(link);

    const prompt = viewer.getByTestId("shared-run-prompt");
    await expect(prompt).toContainText(
      "Open this shared run? It replaces the run on this device.",
    );
    if (id !== "alttpr") {
      await expect(prompt).toContainText(`It switches to ${game.name}.`);
    }
    // Nothing is applied before the answer
    expect(await viewer.evaluate(() => window.location.hash)).toMatch(/^#run=/);
    const axe = await new AxeBuilder({ page: viewer })
      .exclude(".mapspan")
      .withTags(WCAG_AA)
      .analyze();
    expect(axe.violations.map(({ id: rule }) => rule)).toEqual([]);

    await viewer.getByTestId("shared-run-open").click();
    // Another game's board loads after the page does
    await expect(viewer.getByTestId(game.item)).toHaveAccessibleName(OBTAINED);
    expect(await viewer.evaluate(() => window.location.hash)).toBe("");
    // The fragment never left the browser
    const payload = link.split("#run=")[1];
    expect(requests.filter((url) => url.includes(payload))).toEqual([]);

    // A reload keeps what was opened
    await viewer.reload();
    await expect(viewer.getByTestId(game.item)).toHaveAccessibleName(OBTAINED);
    await expect(viewer.getByTestId("shared-run-open")).toHaveCount(0);
    await theirs.close();
  });
}

test("Keep mine leaves the run untouched, and a link opened on the board asks", async ({
  browser,
}) => {
  const mine = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const sharer = await mine.newPage();
  await fresh(sharer);
  await sharer.getByTestId("item-hookshot").click();
  await clickToolbarAction(
    sharer,
    sharer.getByTestId("share-button"),
    "toolbar-more-share",
  );
  await expect(sharer.getByTestId("controls-status")).toContainText(
    "Link copied",
  );
  const link = await sharer.evaluate(() => navigator.clipboard.readText());
  await mine.close();

  // A viewer with a run of their own, already on the tracker: the link
  // arrives as an address change, with no page load
  const theirs = await browser.newContext();
  const viewer = await theirs.newPage();
  await fresh(viewer);
  await viewer.getByTestId("item-lantern").click();
  await viewer.goto(link);

  await expect(viewer.getByTestId("shared-run-open")).toBeVisible();
  await viewer.getByTestId("shared-run-keep").click();

  await expect(viewer.getByTestId("shared-run-prompt")).toBeEmpty();
  expect(await viewer.evaluate(() => window.location.hash)).toBe("");
  await expect(viewer.getByTestId("item-lantern")).toHaveAccessibleName(
    OBTAINED,
  );
  await expect(viewer.getByTestId("item-hookshot")).toHaveAccessibleName(
    NOT_OBTAINED,
  );
  await viewer.reload();
  await expect(viewer.getByTestId("item-hookshot")).toHaveAccessibleName(
    NOT_OBTAINED,
  );
  await expect(viewer.getByTestId("shared-run-open")).toHaveCount(0);
  await theirs.close();
});

test("a link that is not a run says so and changes nothing", async ({
  page,
}) => {
  await fresh(page);
  await page.getByTestId("item-hookshot").click();

  for (const payload of ["not%20base64", "AAAAAAAAAAAAAAAA", "S0nMSQYA"]) {
    await page.goto(`./#run=${payload}`);
    const refusal = page.getByTestId("shared-run-refused");
    await expect(refusal).toContainText("Nothing was changed.");
    await expect(page.getByTestId("shared-run-open")).toHaveCount(0);
    const axe = await new AxeBuilder({ page })
      .exclude(".mapspan")
      .withTags(WCAG_AA)
      .analyze();
    expect(axe.violations.map(({ id }) => id)).toEqual([]);

    await page.getByTestId("shared-run-dismiss").click();
    expect(await page.evaluate(() => window.location.hash)).toBe("");
    await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
      OBTAINED,
    );
  }
});

test("the stream view never asks", async ({ page }) => {
  await page.goto("./?view=obs#run=AAAAAAAAAAAAAAAA");

  await expect(page.getByTestId("obs-view")).toBeVisible();
  await expect(page.getByTestId("shared-run-prompt")).toHaveCount(0);
});
