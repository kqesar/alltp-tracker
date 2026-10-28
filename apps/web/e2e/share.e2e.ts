import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  auditDialog,
  clickToolbarAction,
  focusedTestId,
  smRaceModeOff,
  tabTo,
  unreachableClickables,
  WCAG_AA,
  WIDTHS,
} from "./support";

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
    format: "alltp-tracker-link",
    item: "item-hookshot",
    name: "A Link to the Past",
    open: fresh,
    status: "controls-status",
  },
  sm: {
    format: "alltp-tracker-save",
    item: "sm-item-morph",
    name: "Super Metroid",
    open: async (page: Page) => {
      // Race Mode is on by default there, and a race shares no link
      await smRaceModeOff(page);
      await fresh(page);
      await pick(page, "sm");
    },
    status: "sm-status",
  },
  smz3: {
    format: "alltp-tracker-link",
    item: "smz3-item-hammer",
    name: "SMZ3",
    open: async (page: Page) => {
      await fresh(page);
      await pick(page, "smz3");
    },
    status: "smz3-status",
  },
} as const;

/**
 * What a link of the first format holds, rebuilt here with no help from the
 * app: a real export (`fixtures/`, as version 2.33 wrote it) minified,
 * deflated and base64url'd, which is all that format ever was.
 */
const plainLink = (fixture: string) => {
  const save = JSON.stringify(
    JSON.parse(
      readFileSync(join(import.meta.dirname, "fixtures", fixture), "utf8"),
    ),
  );
  return `./#run=${deflateRawSync(save).toString("base64url")}`;
};

/** The JSON a link's payload inflates to, read in the page like the app does. */
const inflated = (page: Page, payload: string) =>
  page.evaluate(async (text) => {
    const bytes = Uint8Array.from(
      atob(text.replace(/-/g, "+").replace(/_/g, "/")),
      (char) => char.charCodeAt(0),
    );
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).text();
  }, payload);

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
    const dialog = page.getByRole("dialog", { name: "Share this run" });
    await expect(dialog.getByRole("status")).toHaveText(
      /^Link copied\. The run stays in the link, never sent to a server\.$/,
    );
    await expect(dialog.getByTestId("share-qr")).toBeVisible();
    // Sharing says nothing in the toolbar's status
    await expect(page.getByTestId(game.status)).toBeEmpty();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/alltp-tracker\/#run=[A-Za-z0-9_-]+$/);
    // ALttPR and SMZ3 write the packed format, Super Metroid the plain one
    expect(
      JSON.parse(await inflated(page, link.split("#run=")[1])).format,
    ).toBe(game.format);
    // Sharing changed neither the run nor the address
    await expect(page.getByTestId(game.item)).toHaveAccessibleName(OBTAINED);
    expect(page.url()).not.toContain("#run=");
    // Copy again puts the same link back
    await page.evaluate(() => navigator.clipboard.writeText("elsewhere"));
    await dialog.getByTestId("share-copy-again").click();
    await expect(dialog.getByRole("status")).toContainText("Link copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      link,
    );
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

test("the share dialog is keyboard-driven and accessible", async ({
  browser,
}) => {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await fresh(page);
  await page.getByTestId("toolbar").waitFor();
  const viaMore = !(await page.getByTestId("share-button").isVisible());
  const opener = viaMore ? "toolbar-more" : "share-button";

  await tabTo(page, opener);
  await page.keyboard.press("Enter");
  if (viaMore) {
    await page.getByTestId("toolbar-more-share").focus();
    await page.keyboard.press("Enter");
  }
  const dialog = page.getByRole("dialog", { name: "Share this run" });
  await expect(dialog.getByTestId("share-qr")).toBeVisible();
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest("dialog[open]"),
    ),
  ).toBe(true);
  expect(await unreachableClickables(page, "dialog[open]")).toEqual([]);

  const axe = await new AxeBuilder({ page })
    .include("dialog[open]")
    .withTags(WCAG_AA)
    .analyze();
  expect(axe.violations.map(({ id }) => id)).toEqual([]);

  // Escape closes it and focus goes back to what opened it
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await focusedTestId(page)).toBe(opener);
  await context.close();
});

test("a late run shares short, and its full link with the timeline is a keyboard away", async ({
  browser,
}) => {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  // Every place checked, each on the game's clock and its reading set anew
  // at every one, minutes apart: a timeline too long for a chat message
  // even as link 3 packs it
  const t0 = Date.UTC(2026, 9, 28, 9, 30);
  const places = [...MAP_LOCATIONS];
  let at = t0;
  let paused = 0;
  const timeline = Object.fromEntries(
    places.map((id, index) => {
      at += 1000 + ((index * 104_729) % 299_000);
      paused += 200 + ((index * 7919) % 59_000);
      return [`check:${id}`, { at, ms: at - t0 - paused }];
    }),
  );
  await page.goto("./");
  await page.evaluate(
    (state) => {
      localStorage.clear();
      localStorage.setItem(
        "alltp-tracker-state",
        JSON.stringify({ state, version: 12 }),
      );
    },
    {
      checked: Object.fromEntries(places.map((id) => [id, true])),
      timeline,
    },
  );
  await page.reload();
  await page.getByTestId("toolbar").waitFor();

  await clickToolbarAction(
    page,
    page.getByTestId("share-button"),
    "toolbar-more-share",
  );
  const dialog = page.getByRole("dialog", { name: "Share this run" });
  await expect(dialog.getByRole("status")).toHaveText(
    "Link copied without the timeline, to keep it short.",
  );
  const short = await page.evaluate(() => navigator.clipboard.readText());
  expect(short.length).toBeLessThanOrEqual(2000);
  expect(
    JSON.parse(await inflated(page, short.split("#run=")[1])).progress,
  ).toMatchObject({ timeline: "AA" });

  const copyFull = dialog.getByTestId("share-copy-full");
  await expect(copyFull).toHaveAccessibleName(
    "Copy the full link (with the timeline)",
  );
  await expect(copyFull).toHaveAccessibleDescription(
    /The full link keeps it, in \d{4,} characters, which some chat apps cut\./,
  );
  expect(await unreachableClickables(page, "dialog[open]")).toEqual([]);
  for (const width of WIDTHS) {
    await page.setViewportSize({ height: width < 600 ? 844 : 900, width });
    await auditDialog(page, dialog, width);
    const box = await copyFull.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(width);
  }

  // From the keyboard: the full link, every stamp in it
  await copyFull.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("status")).toContainText(
    "Full link copied, with the timeline (",
  );
  const full = await page.evaluate(() => navigator.clipboard.readText());
  expect(full.length).toBeGreaterThan(2000);
  const viewer = await context.newPage();
  await viewer.goto(full);
  await viewer.getByTestId("shared-run-open").click();
  await expect(viewer.getByTestId("map-view-tab-run")).toBeVisible();
  const opened = await viewer.evaluate(
    () =>
      Object.keys(
        JSON.parse(localStorage.getItem("alltp-tracker-state") ?? "{}").state
          .timeline,
      ).length,
  );
  expect(opened).toBe(places.length);
  await context.close();
});

test("a link of the first format still opens, ALttPR's and SMZ3's", async ({
  page,
}) => {
  await fresh(page);
  await page.goto(plainLink("share-v1-alttpr.json"));
  await expect(page.getByTestId("shared-run-prompt")).toContainText(
    "Open this shared run?",
  );
  await page.getByTestId("shared-run-open").click();
  await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
    OBTAINED,
  );
  await expect(page.getByTestId("item-lantern")).toHaveAccessibleName(
    NOT_OBTAINED,
  );

  // A SMZ3 run, laid in its own store, then the page loads again on it
  await page.goto(plainLink("share-v1-smz3.json"));
  await expect(page.getByTestId("shared-run-prompt")).toContainText(
    "It switches to SMZ3.",
  );
  await page.getByTestId("shared-run-open").click();
  await expect(page.getByTestId("smz3-item-hammer")).toHaveAccessibleName(
    OBTAINED,
  );
});

test("a short link made before the tables grew still opens", async ({
  page,
}) => {
  // Written by the tracker before the half magic cell, as it wrote links then
  // (src/share/fixtures/): its item table was one shorter, its link no sizes
  const packed = (fixture: string) =>
    `./#run=${deflateRawSync(
      JSON.stringify(
        JSON.parse(
          readFileSync(
            join(import.meta.dirname, "../src/share/fixtures", fixture),
            "utf8",
          ),
        ),
      ),
    ).toString("base64url")}`;
  await fresh(page);
  await page.goto(packed("link-alttpr-before-sizes.json"));
  await expect(page.getByTestId("shared-run-prompt")).toContainText(
    "Open this shared run?",
  );
  await page.getByTestId("shared-run-open").click();
  await expect(page.getByTestId("item-lantern")).toHaveAccessibleName(OBTAINED);
  await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
    OBTAINED,
  );
  // The item added since is as a fresh run has it
  await expect(page.getByTestId("item-magic")).toHaveAccessibleName(
    NOT_OBTAINED,
  );

  await page.goto(packed("link-smz3-before-sizes.json"));
  await expect(page.getByTestId("shared-run-prompt")).toContainText(
    "It switches to SMZ3.",
  );
});

test("a link from another version of the tracker says so and changes nothing", async ({
  page,
}) => {
  await fresh(page);
  await page.getByTestId("item-hookshot").click();
  const save = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "fixtures", "share-v1-alttpr.json"),
      "utf8",
    ),
  );
  // The packed format against a table digest this build does not have
  const link = JSON.stringify({
    ...save,
    format: "alltp-tracker-link",
    link: 2,
    table: "AAAAAA",
  });
  await page.goto(`./#run=${deflateRawSync(link).toString("base64url")}`);

  await expect(page.getByTestId("shared-run-refused")).toHaveText(
    "This link comes from another version of the tracker. Nothing was changed.",
  );
  await expect(page.getByTestId("shared-run-open")).toHaveCount(0);
  await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
    OBTAINED,
  );
});

test("a link a newer tracker wrote says so, and Reload keeps it in the address", async ({
  page,
}) => {
  await fresh(page);
  await page.getByTestId("item-hookshot").click();
  const save = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "fixtures", "share-v1-alttpr.json"),
      "utf8",
    ),
  );
  // A layout version past any this build reads
  const link = JSON.stringify({
    ...save,
    format: "alltp-tracker-link",
    link: 99,
    table: "AAAAAA",
  });
  await page.goto(`./#run=${deflateRawSync(link).toString("base64url")}`);

  const refused = page.getByTestId("shared-run-refused");
  await expect(refused).toHaveText(
    "This link comes from a newer version of the tracker: reload to update. Nothing was changed.",
  );
  await expect(page.getByTestId("shared-run-open")).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .exclude(".mapspan")
    .withTags(WCAG_AA)
    .analyze();
  expect(axe.violations.map(({ id }) => id)).toEqual([]);

  // Reload keeps the link: the page loads again on it, and asks again
  await Promise.all([
    page.waitForEvent("load"),
    page.getByTestId("shared-run-reload").click(),
  ]);
  expect(await page.evaluate(() => window.location.hash)).toMatch(/^#run=/);
  await expect(refused).toContainText("a newer version of the tracker");
  await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
    OBTAINED,
  );

  // Only the player's dismissal clears it
  await page.getByTestId("shared-run-dismiss").click();
  expect(await page.evaluate(() => window.location.hash)).toBe("");
});

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
  await expect(sharer.getByRole("dialog").getByRole("status")).toContainText(
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
