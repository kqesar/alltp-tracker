// The followed view (?view=follow): a phone on the player's network watching
// the desktop app's run. The app's relay is faked on the host that serves the
// build (staticHost.ts), as the app serves the page and the stream together;
// the player's runs are made by the real tracker in another page.
import { expect, type Page, test } from "@playwright/test";
import { hostBuild, RELAY_TOKEN, type RelayFrame } from "./staticHost";
import { auditPage, openOnGame } from "./support";

type Host = Awaited<ReturnType<typeof hostBuild>>;

const hosted = test.extend<{ host: Host }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's dependencies from this pattern
  host: async ({}, use) => {
    const host = await hostBuild("/alltp-tracker/");
    await use(host);
    await host.close();
  },
});

const ALTTPR_KEY = "alltp-tracker-state";

/** The followed view, from the link the app's QR code carries. */
const openFollow = (page: Page, host: Host, token = RELAY_TOKEN) =>
  page.goto(`${host.url}?view=follow&token=${token}`);

const status = (page: Page) => page.getByTestId("follow-status");

/** A cell's name, as the board says it. */
const cell = (name: string, state: string) =>
  `${name}, ${state}. Click to change state.`;

/**
 * The player's run after `play`, as the desktop app publishes it: what the
 * tracker saved, made by the real tracker in a page of its own.
 */
const playerRun = async (
  page: Page,
  game: string,
  key: string,
  play: (player: Page) => Promise<void> = async () => {},
): Promise<RelayFrame> => {
  // A computer of its own: its storage starts empty, on the game asked for
  const browser = page.context().browser();
  if (!browser) throw new Error("No browser");
  const computer = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const player = await computer.newPage();
  await openOnGame(player, game);
  await play(player);
  const value = await player.evaluate(
    (name) => localStorage.getItem(name) ?? "",
    key,
  );
  await computer.close();
  return { game, key, sentAt: Date.now(), value };
};

const withHookshot = (page: Page) =>
  playerRun(page, "alttpr", ALTTPR_KEY, (player) =>
    player.getByTestId("item-hookshot").click(),
  );

hosted.describe("the followed view", () => {
  for (const width of [390, 820] as const) {
    hosted(
      `follows the run read-only at ${width} px, and passes axe`,
      async ({ host, page }) => {
        const problems: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") problems.push(message.text());
        });
        await page.setViewportSize({ height: 844, width });
        const run = await withHookshot(page);

        await openFollow(page, host);
        await expect(status(page)).toHaveText(/^Connecting/);
        await expect(page.getByTestId("follow-board")).toHaveCount(0);
        await expect(page).toHaveTitle("Rando Atlas live");

        host.relay.publish(run);
        const board = page.getByTestId("follow-board");
        const hookshot = board.getByTestId("item-hookshot");
        await expect(status(page)).toHaveText(/^Live/);
        await expect(hookshot).toHaveAttribute(
          "aria-label",
          cell("Hookshot", "obtained"),
        );
        await expect(board).toHaveAttribute("inert");
        await expect(board.getByTestId("stream-timer")).toBeVisible();

        // An opaque page: a phone has no scene behind it
        expect(
          await page.evaluate(
            () => getComputedStyle(document.body).backgroundColor,
          ),
        ).not.toBe("rgba(0, 0, 0, 0)");
        // The grid sits under the banner, inside the viewport
        const banner = await page.locator(".follow-banner").boundingBox();
        const grid = await board.getByTestId("item-grid").boundingBox();
        expect(banner && grid).toBeTruthy();
        if (!banner || !grid) return;
        expect(grid.y).toBeGreaterThanOrEqual(banner.y + banner.height);
        expect(grid.x + grid.width).toBeLessThanOrEqual(width);

        // A tap changes nothing: the board is the player's
        const before = await page.evaluate(
          (key) => localStorage.getItem(key),
          ALTTPR_KEY,
        );
        await page.mouse.click(grid.x + grid.width / 2, grid.y + 4);
        const bow = board.getByTestId("item-bow");
        const bowBox = await bow.boundingBox();
        if (!bowBox) throw new Error("No bow cell");
        await page.mouse.click(
          bowBox.x + bowBox.width / 2,
          bowBox.y + bowBox.height / 2,
        );
        await page.keyboard.press("Control+z");
        await expect(bow).toHaveAttribute(
          "aria-label",
          cell("Bow", "not obtained"),
        );
        await expect(hookshot).toHaveAttribute(
          "aria-label",
          cell("Hookshot", "obtained"),
        );
        expect(
          await page.evaluate((key) => localStorage.getItem(key), ALTTPR_KEY),
        ).toBe(before);
        // Nothing in the grid takes the focus
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(
            () => document.activeElement?.closest("[inert]") ?? null,
          ),
        ).toBeNull();

        await auditPage(page);
        await page.screenshot({
          path: test.info().outputPath(`follow-${width}.png`),
        });
        expect(problems).toEqual([]);
      },
    );
  }

  hosted(
    "updates as the player tracks, and reconnects after a drop",
    async ({ host, page }) => {
      host.relay.publish(
        await playerRun(page, "alttpr", ALTTPR_KEY, (player) =>
          player.getByTestId("item-bow").click(),
        ),
      );
      await openFollow(page, host);
      const hookshot = page.getByTestId("item-hookshot");
      await expect(hookshot).toHaveAttribute(
        "aria-label",
        cell("Hookshot", "not obtained"),
      );

      host.relay.publish(await withHookshot(page));
      await expect(hookshot).toHaveAttribute(
        "aria-label",
        cell("Hookshot", "obtained"),
      );

      // The network goes: the last run stays on screen while it retries
      host.relay.drop();
      await expect(status(page)).toHaveText(/^Reconnecting/);
      await expect(hookshot).toHaveAttribute(
        "aria-label",
        cell("Hookshot", "obtained"),
      );
      await page.screenshot({
        path: test.info().outputPath("follow-reconnecting-390.png"),
      });
      // Back after a second, with the run as it is now
      await expect(status(page)).toHaveText(/^Live/);
      expect(host.relay.viewers()).toBe(1);
    },
  );

  hosted(
    "draws the run timer on the player's clock",
    async ({ host, page }) => {
      const run = await withHookshot(page);
      // The player's computer is an hour ahead; its timer started 65 s ago
      const playerNow = Date.now() + 3_600_000;
      const saved = JSON.parse(run.value);
      saved.state.timer = {
        elapsedMs: 0,
        finished: false,
        startedAt: playerNow - 65_000,
      };
      host.relay.publish({
        ...run,
        sentAt: playerNow,
        value: JSON.stringify(saved),
      });

      await openFollow(page, host);

      await expect(page.getByTestId("stream-timer")).toHaveAttribute(
        "aria-label",
        /^Run timer: 1:0[5-7], running$/,
      );
    },
  );

  hosted(
    "switches to the game the player switched to",
    async ({ host, page }) => {
      host.relay.publish(await withHookshot(page));
      await openFollow(page, host);
      await expect(page.getByTestId("item-hookshot")).toBeVisible();

      host.relay.publish(
        await playerRun(page, "sm", "alltp-tracker-sm", (player) =>
          player.getByTestId("sm-item-morph").click(),
        ),
      );

      await expect(page.getByTestId("sm-item-morph")).toHaveAttribute(
        "aria-label",
        /^Morphing Ball, obtained/,
      );
      await expect(status(page)).toHaveText(/^Live/);
    },
  );

  hosted("says when the link is out of date", async ({ host, page }) => {
    await openFollow(page, host, "an-old-token");

    await expect(status(page)).toHaveText(/^Link expired/);
    await expect(page.getByTestId("follow-board")).toHaveCount(0);
    await auditPage(page);
    await page.screenshot({
      path: test.info().outputPath("follow-expired.png"),
    });
  });

  hosted(
    "says when the player stops, and tries no more",
    async ({ host, page }) => {
      host.relay.publish(await withHookshot(page));
      await openFollow(page, host);
      await expect(status(page)).toHaveText(/^Live/);

      host.relay.stop();

      await expect(status(page)).toHaveText(/^Stopped/);
      await page.waitForTimeout(1500);
      expect(host.relay.viewers()).toBe(0);
      // The last run stays on screen
      await expect(page.getByTestId("item-hookshot")).toBeVisible();
    },
  );

  hosted(
    "waits for a seat while eight devices follow",
    async ({ host, page }) => {
      host.relay.publish(await withHookshot(page));
      host.relay.refuse(4503);
      await openFollow(page, host);
      await expect(status(page)).toHaveText(/^Full/);

      host.relay.refuse(null);

      // At least five seconds later, a seat
      await expect(status(page)).toHaveText(/^Live/, { timeout: 8000 });
    },
  );
});
