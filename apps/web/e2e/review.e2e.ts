import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { auditDialog, auditPage, openOnGame, WIDTHS } from "./support";

const T0 = new Date("2026-10-25T12:00:00Z");
const SPOILERS = join(
  import.meta.dirname,
  "../../../packs/alttpr/test/spoilers",
);
const HASH = "9MQ9gO1wMD";
const NAME = `alttpr - NoGlitches-open-ganon_${HASH}.txt`;

/** Where the screenshots go when asked for (a scratch directory, never the repo). */
const SHOTS = process.env.REVIEW_SHOTS;
const shot = async (
  page: Page,
  name: string,
  width: number,
  fullPage = true,
) => {
  if (SHOTS) {
    await page.screenshot({
      fullPage,
      path: join(SHOTS, `${name}-${width}.png`),
    });
  }
};

/** A run tracked by hand: a few finds, the timer started. */
const playRun = async (page: Page) => {
  await page.clock.install({ time: T0 });
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-start").click();
  await page.keyboard.press("Escape");
  await page.clock.fastForward(30_000);
  await page.getByTestId("item-boots").click();
  await page.clock.fastForward(90_000);
  await page.getByTestId("item-hookshot").click();
  await page.getByTestId("map-view-tab-run").click();
};

/**
 * A run played as autotracking records one, on the seed whose log the pack
 * keeps: each place checked and the item it held at one instant (the clock
 * stands still between clicks), the playthrough's first steps a minute
 * apart, then a break of 35 minutes and the Hookshot, which Eastern Palace
 * held from the start, last (a dungeon's chest, so it is matched by item).
 */
const playWaitedRun = async (page: Page) => {
  await page.clock.install({ time: T0 });
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-start").click();
  await page.keyboard.press("Escape");
  await page.getByTestId("map-view-tab-map").click();
  // Time stands still between the clicks of one find, as in one reading
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  const finds: readonly (readonly [string, ...string[]])[] = [
    ["sanctuary", "boots"],
    ["blinds-hideout", "moonpearl", "glove", "powder"],
    ["chicken-house", "sword"],
    ["sahasrahlas-hut", "glove"],
    ["chest-game", "mirror"],
    ["graveyard-ledge", "flute"],
    ["magic-bat", "hammer"],
    ["stumpy", "sword"],
  ];
  for (const [marker, ...items] of finds) {
    await page.clock.fastForward(60_000);
    await page.getByTestId(`marker-${marker}`).click();
    for (const item of items) await page.getByTestId(`item-${item}`).click();
  }
  await page.clock.fastForward(35 * 60_000);
  await page.getByTestId("item-hookshot").click();
  await page.clock.fastForward(60_000);
  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-end").click();
  await page
    .getByRole("dialog", { name: "End this run?" })
    .getByRole("button", { name: "End run" })
    .click();
  // The review's sweep runs in slices of the page's timers
  await page.clock.resume();
  await page.getByTestId("map-view-tab-run").click();
};

const spoiler = (hash: string, name: string) => ({
  buffer: readFileSync(join(SPOILERS, `${hash}.txt`)),
  mimeType: "text/plain",
  name,
});

test.describe("reviewing a finished run", () => {
  test("opens only once the run is over, and never leaves the page", async ({
    page,
  }) => {
    const requests: string[] = [];
    await playRun(page);
    page.on("request", (request) => requests.push(request.url()));

    // Counting: no way in
    await expect(page.getByTestId("review-open")).toHaveCount(0);
    await expect(page.getByTestId("review-import")).toHaveCount(0);
    await expect(page.getByTestId("review-gate-note")).toContainText(
      "once the run is over",
    );

    // End run asks first, on Cancel
    await page.getByTestId("run-timer").click();
    await page.getByTestId("run-timer-end").click();
    const ending = page.getByRole("dialog", { name: "End this run?" });
    await expect(ending.getByRole("button", { name: "Cancel" })).toBeFocused();
    await ending.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("review-open")).toHaveCount(0);
    await page.getByTestId("run-timer").click();
    await page.getByTestId("run-timer-end").click();
    await ending.getByRole("button", { name: "End run" }).click();
    await expect(page.getByTestId("run-timer")).toHaveAccessibleName(
      /^Run timer: 2:0\d, stopped$/,
    );
    await expect(page.getByTestId("review-open")).toBeVisible();

    // Import: the real worker reads the file
    await page.getByTestId("review-import").click();
    await page.getByTestId("review-file").setInputFiles(spoiler(HASH, NAME));
    await expect(page.getByTestId("review-notice")).toBeVisible();
    await expect(page.getByTestId("review-binding")).toContainText(
      "Not verified: this run does not know its seed",
    );
    await expect(page.getByTestId("review-caption")).toContainText(
      "needed items",
    );
    await expect(page.getByTestId("review-playthrough")).toBeVisible();

    // The file stayed on the device
    expect(
      requests.filter(
        (url) => !new URL(url).pathname.startsWith("/alltp-tracker/"),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage })),
    ).not.toContain("playthrough");

    // Close review, then reload: nothing is left
    await page.getByTestId("review-close").click();
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
    await page.getByTestId("review-import").click();
    await page.getByTestId("review-file").setInputFiles(spoiler(HASH, NAME));
    await expect(page.getByTestId("review-notice")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
  });

  test("refuses a file that is not the log of a run, with the reason", async ({
    page,
  }) => {
    await playRun(page);
    await page.getByTestId("run-timer").click();
    await page.getByTestId("run-timer-end").click();
    await page
      .getByRole("dialog", { name: "End this run?" })
      .getByRole("button", { name: "End run" })
      .click();
    await page.getByTestId("review-open").click();

    await page.getByTestId("review-file").setInputFiles({
      buffer: Buffer.from([0, 1, 2, 3, 255]),
      mimeType: "application/octet-stream",
      name: "game.sfc",
    });
    await expect(page.getByTestId("review-error")).toContainText("ROM");
    await page
      .getByTestId("review-file")
      .setInputFiles(spoiler("eM43RgZ4Gj", "alttpr - daily_eM43RgZ4Gj.txt"));
    await expect(page.getByTestId("review-error")).toContainText("withheld");
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
  });
});

test.describe("the waits of a reviewed run", () => {
  test("say what waited, from when, and what holding it earlier would have opened", async ({
    page,
  }) => {
    await playWaitedRun(page);
    await page.getByTestId("review-import").click();
    await page.getByTestId("review-file").setInputFiles(spoiler(HASH, NAME));
    await expect(page.getByTestId("review-notice")).toBeVisible();

    const tiles = page.getByTestId("review-tiles");
    await expect(tiles).toContainText("1 break (35 min) left out");
    await expect(tiles).toContainText("Hookshot, in logic from the start");
    const hookshot = page.getByTestId("wait-eastern-palace/map-chest");
    await expect(hookshot).toContainText(
      "Hookshot · Eastern Palace - Map Chest",
    );
    await expect(hookshot).toContainText(
      "Matched by the item, not by its place.",
    );
    await expect(hookshot).toContainText(/Trade-off\. .*Hookshot Cave/);
    await expect(page.getByTestId("review-dungeons")).toContainText(
      "Eastern Palace",
    );
    await expect(page.getByTestId("review-waits")).not.toContainText(/late/i);
    // The playthrough is folded, and opens
    const steps = page.getByTestId("review-playthrough");
    await expect(steps.getByRole("table")).toBeHidden();
    await steps.locator("summary").click();
    await expect(steps.getByRole("table")).toBeVisible();
  });
});

for (const width of WIDTHS) {
  test.describe(`the review at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("fits the page, passes axe and is keyboard-reachable", async ({
      page,
    }) => {
      await playRun(page);

      await page.getByTestId("run-timer").click();
      await page.getByTestId("run-timer-end").click();
      const ending = page.getByRole("dialog", { name: "End this run?" });
      await auditDialog(page, ending, width);
      await shot(page, "end-run", width);
      await ending.getByRole("button", { name: "End run" }).click();
      await expect(page.getByTestId("review-open")).toBeVisible();
      await auditPage(page);

      await page.getByTestId("review-open").click();
      const dialog = page.getByRole("dialog", { name: "Review this run" });
      await auditDialog(page, dialog, width);
      await shot(page, "import", width);

      await page.getByTestId("review-file").setInputFiles(spoiler(HASH, NAME));
      await expect(page.getByTestId("review-notice")).toBeVisible();
      await expect(page.getByTestId("review-playthrough")).toBeVisible();
      // A run tracked by hand: the waits say why they are not shown
      await expect(page.getByTestId("review-hidden")).toContainText(
        "tracked by hand",
      );
      await auditPage(page);
      await shot(page, "run-tab", width);

      // The map: each marker says what it held, and the ring says if it was checked
      await page.getByTestId("map-view-tab-map").click();
      const held = page.locator("[data-review][data-held]");
      await expect(held.first()).toBeVisible();
      expect(await held.count()).toBeGreaterThan(20);
      await expect(page.locator('[data-review="found"]')).toHaveCount(0);
      await expect(page.locator("[data-review]").first()).toHaveAccessibleName(
        /Held: .*; not all checked$/,
      );
      // Markers keep WCAG 2.5.8's map-pin exception (docs: components.md)
      await auditPage(page, ".mapspan");
      await shot(page, "map", width);

      // The Checks list names the item of each check, and keeps the missed ones
      await page.getByTestId("map-view-tab-checks").click();
      await expect(page.getByTestId("checks-missed-only")).toBeVisible();
      await page.getByTestId("checks-missed-only").check();
      await expect(
        page.locator('[data-testid^="check-held-"]').first(),
      ).toBeVisible();
      await auditPage(page);
      await shot(page, "checks", width, false);

      // Out of the review, nothing of it is left on the board
      await page.getByTestId("review-close").click();
      await page.getByTestId("map-view-tab-map").click();
      await expect(page.locator("[data-review], [data-places]")).toHaveCount(0);
      await expect(page.locator("[data-held]")).toHaveCount(0);
    });
  });
}

for (const width of WIDTHS) {
  test.describe(`the waits at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("fit the page, pass axe and are keyboard-reachable", async ({
      page,
    }) => {
      await playWaitedRun(page);
      await page.getByTestId("review-import").click();
      await page.getByTestId("review-file").setInputFiles(spoiler(HASH, NAME));
      await expect(page.getByTestId("review-waits")).toBeVisible();
      await auditPage(page);
      await shot(page, "waits", width);
      await page.getByTestId("review-waits-all").click();
      await page.getByTestId("review-playthrough").locator("summary").click();
      await page.getByTestId("review-how").locator("summary").click();
      await auditPage(page);
      await shot(page, "waits-all", width);
    });
  });
}

// SMZ3: the pack's recorded samus.link log (the Download's text, rebuilt from
// the API with the site's own code), bound by the guid the run carries
const SMZ3_SPOILERS = join(
  import.meta.dirname,
  "../../../packs/smz3/test/spoilers",
);
const SMZ3_SLUG = "hQa77ywrRDKvN4tXHGyRMw";
const GUID = "8506bbef2c2b4432af378b571c6c9133";
const SMZ3_NAME = `Super Metroid & A Link to the Past Combo Randomizer v11.3.2 - ${SMZ3_SLUG} - Spoiler.txt`;

const smz3Log = () => ({
  buffer: readFileSync(join(SMZ3_SPOILERS, `${SMZ3_SLUG}.txt`)),
  mimeType: "text/plain",
  name: SMZ3_NAME,
});

/** An SMZ3 run tracked by hand, a few finds and checks, over; its seed set when given. */
const playSmz3 = async (page: Page, seed: string | null) => {
  await openOnGame(page, "smz3");
  await page.evaluate(
    ([key, guid]) => {
      localStorage.removeItem(key);
      if (guid !== null) {
        localStorage.setItem(
          key,
          JSON.stringify({
            state: {
              checked: [],
              items: {},
              pads: { mire: "unknown", turtleRock: "unknown" },
              seed: guid,
              settings: {
                ganonCrystals: 7,
                keysanity: false,
                smLogic: "normal",
                tourianBosses: 4,
                towerCrystals: 7,
              },
            },
            version: 1,
          }),
        );
      }
    },
    ["alltp-tracker-smz3", seed] as const,
  );
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByTestId("smz3-item-hookshot").click();
  await page.getByTestId("marker-links-house").click();
  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-start").click();
  await page.keyboard.press("Escape");
  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-end").click();
  await page
    .getByRole("dialog", { name: "End this run?" })
    .getByRole("button", { name: "End run" })
    .click();
  await expect(page.getByTestId("run-timer")).toHaveAccessibleName(/stopped$/);
};

test.describe("reviewing a finished SMZ3 run", () => {
  test("is bound by the guid, reads on the device and leaves nothing behind", async ({
    page,
  }) => {
    const requests: string[] = [];
    await playSmz3(page, GUID);
    page.on("request", (request) => requests.push(request.url()));

    await page.getByTestId("review-open").click();
    await page.getByTestId("review-file").setInputFiles(smz3Log());
    await expect(page.getByTestId("review-notice")).toBeVisible();
    await expect(page.getByTestId("review-binding")).toContainText(
      `Seed ${GUID}: the log's seed is this run's (matched by its guid)`,
    );
    await expect(page.getByTestId("review-result")).toBeVisible();
    await expect(page.getByTestId("review-note")).toContainText("no times");
    await expect(page.getByTestId("review-summary")).toContainText(
      "You checked 1 of 316 places",
    );

    // The maps give what each place held
    await page.getByTestId("smz3-map-tab-hyrule").click();
    await expect(page.getByTestId("marker-links-house")).toHaveAttribute(
      "data-review",
      "found",
    );
    await expect(page.getByTestId("marker-links-house")).toHaveAccessibleName(
      /Held: .+; all checked$/,
    );

    expect(
      requests.filter(
        (url) => !new URL(url).pathname.startsWith("/alltp-tracker/"),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage })),
    ).not.toContain("Playthrough");

    // Close review gives the maps back; reload leaves nothing
    await page.getByTestId("review-close").click();
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
    await expect(page.getByTestId("smz3-map-tab-review")).toHaveCount(0);
    await page.getByTestId("review-open").click();
    await page.getByTestId("review-file").setInputFiles(smz3Log());
    await expect(page.getByTestId("review-notice")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
  });

  test("refuses another seed's log, and another game's, with the reason", async ({
    page,
  }) => {
    await playSmz3(page, "f".repeat(32));
    await page.getByTestId("review-open").click();
    await page.getByTestId("review-file").setInputFiles(smz3Log());
    await expect(page.getByTestId("review-error")).toContainText(
      `This spoiler log is for seed ${GUID}; your run is seed ${"f".repeat(32)}.`,
    );
    await page.getByTestId("review-file").setInputFiles(spoiler(HASH, NAME));
    await expect(page.getByTestId("review-error")).toContainText(
      "alttpr.com spoiler log",
    );
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
  });
});

for (const width of WIDTHS) {
  test.describe(`the SMZ3 review at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("fits the page, passes axe and is keyboard-reachable", async ({
      page,
    }) => {
      await playSmz3(page, GUID);
      // Map markers keep their pin exception (WCAG 2.5.8), as the SMZ3 board's own audit
      await auditPage(page, ".mapspan");

      await page.getByTestId("review-open").click();
      const dialog = page.getByRole("dialog", { name: "Review this run" });
      await auditDialog(page, dialog, width);
      await shot(page, "smz3-import", width);

      await page.getByTestId("review-file").setInputFiles(smz3Log());
      await expect(page.getByTestId("review-result")).toBeVisible();
      // Map markers keep their pin exception (WCAG 2.5.8), as the SMZ3 board's own audit
      await auditPage(page, ".mapspan");
      await shot(page, "smz3-review-tab", width);

      await page.getByTestId("smz3-map-tab-hyrule").click();
      // Markers whose place held an item the board has art for draw it
      await expect(page.locator("[data-held]").first()).toBeVisible();
      // Map markers keep their pin exception (WCAG 2.5.8), as the SMZ3 board's own audit
      await auditPage(page, ".mapspan");
      await shot(page, "smz3-hyrule", width);

      await page.getByTestId("smz3-map-tab-zebes").click();
      // Map markers keep their pin exception (WCAG 2.5.8), as the SMZ3 board's own audit
      await auditPage(page, ".mapspan");
      await shot(page, "smz3-zebes", width);
    });
  });
}
