// The stream view the desktop app serves to OBS (?view=obs&token=…): the
// browser source's side. The app's server is faked on the host that serves
// the build (staticHost.ts), as the app serves the page and the stream
// together; the player's runs are made by the real tracker in another page.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { DIST, hostBuild, RELAY_TOKEN, type RelayFrame } from "./staticHost";
import { auditPage, openOnGame, WIDTHS } from "./support";

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

/** The source's address, as the app's dialog hands it to OBS. */
const openSource = (
  page: Page,
  host: Host,
  { query = "", token = RELAY_TOKEN } = {},
) => page.goto(`${host.url}?view=obs&token=${token}${query}`);

/** A cell's name, as the board says it. */
const cell = (name: string, state: string) =>
  `${name}, ${state}. Click to change state.`;

/** The player's run after `play`, made by the real tracker. */
const playerRun = async (
  page: Page,
  play: (player: Page) => Promise<void>,
): Promise<RelayFrame> => {
  const browser = page.context().browser();
  if (!browser) throw new Error("No browser");
  const computer = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const player = await computer.newPage();
  await openOnGame(player, "alttpr");
  await play(player);
  const value = await player.evaluate(
    (name) => localStorage.getItem(name) ?? "",
    ALTTPR_KEY,
  );
  await computer.close();
  return { game: "alttpr", key: ALTTPR_KEY, sentAt: Date.now(), value };
};

const withHookshot = (page: Page) =>
  playerRun(page, (player) => player.getByTestId("item-hookshot").click());

/** What OBS composites: a transparent page, the grid alone. */
const expectTransparentStage = async (page: Page) => {
  const backgrounds = await page.evaluate(() => [
    getComputedStyle(document.documentElement).backgroundColor,
    getComputedStyle(document.body).backgroundColor,
    getComputedStyle(document.querySelector(".obs-view") as Element)
      .backgroundColor,
  ]);
  expect(backgrounds).toEqual([
    "rgba(0, 0, 0, 0)",
    "rgba(0, 0, 0, 0)",
    "rgba(0, 0, 0, 0)",
  ]);
};

hosted.describe("the stream view the app serves to OBS", () => {
  for (const width of WIDTHS) {
    hosted(
      `shows the run alone on a transparent page at ${width} px, and passes axe`,
      async ({ host, page }) => {
        const problems: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") problems.push(message.text());
        });
        await page.setViewportSize({ height: 900, width });
        host.relay.publish(await withHookshot(page));

        await openSource(page, host, { query: "&timer=1" });

        const hookshot = page.getByTestId("item-hookshot");
        await expect(hookshot).toHaveAttribute(
          "aria-label",
          cell("Hookshot", "obtained"),
        );
        await expect(page).toHaveTitle("Rando Atlas stream view");
        // The grid alone: no banner, no toolbar
        await expect(page.locator(".follow-banner")).toHaveCount(0);
        await expect(page.getByTestId("toolbar")).toHaveCount(0);
        await expect(page.getByTestId("stream-source")).toHaveAttribute(
          "inert",
        );
        await expect(page.getByTestId("stream-timer")).toBeVisible();
        await expectTransparentStage(page);
        const grid = await page.getByTestId("item-grid").boundingBox();
        expect(grid).toBeTruthy();
        if (!grid) return;
        expect(grid.x).toBeGreaterThanOrEqual(0);
        expect(grid.x + grid.width).toBeLessThanOrEqual(width);
        expect(grid.y + grid.height).toBeLessThanOrEqual(900);

        await auditPage(page);
        await page.screenshot({
          path: test.info().outputPath(`stream-source-${width}.png`),
        });
        expect(problems).toEqual([]);
      },
    );
  }

  for (const [width, height] of [
    [512, 448],
    [1024, 896],
  ] as const) {
    hosted(
      `fills a ${width} × ${height} source with the grid, the pixels whole`,
      async ({ host, page }) => {
        await page.setViewportSize({ height, width });
        host.relay.publish(await withHookshot(page));

        await openSource(page, host);

        await expect(page.getByTestId("item-hookshot")).toBeVisible();
        const cellSize = await page.evaluate(() =>
          Number.parseFloat(
            getComputedStyle(
              document.querySelector(".obs-view") as Element,
            ).getPropertyValue("--cell"),
          ),
        );
        // The icons' own size, or twice it: every game pixel the same width
        expect(cellSize % 16).toBe(0);
        const grid = await page.getByTestId("item-grid").boundingBox();
        expect(grid && grid.x + grid.width).toBeLessThanOrEqual(width);
        expect(grid && grid.y + grid.height).toBeLessThanOrEqual(height);
        await page.screenshot({
          path: test.info().outputPath(`stream-source-${width}x${height}.png`),
        });
      },
    );
  }

  hosted(
    "paints a solid colour when asked, for window capture",
    async ({ host, page }) => {
      host.relay.publish(await withHookshot(page));

      await openSource(page, host, { query: "&bg=00ff00" });

      await expect(page.getByTestId("item-hookshot")).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(document.querySelector(".obs-view") as Element)
              .backgroundColor,
        ),
      ).toBe("rgb(0, 255, 0)");
    },
  );

  hosted(
    "draws nothing while the app has no run, then the run",
    async ({ host, page }) => {
      await openSource(page, host);
      await expect(page.locator("#root")).toBeEmpty();
      // Nothing drawn, and nothing painted either: the scene shows through
      await expectTransparentPage(page);

      host.relay.publish(await withHookshot(page));

      await expect(page.getByTestId("item-hookshot")).toHaveAttribute(
        "aria-label",
        cell("Hookshot", "obtained"),
      );
    },
  );

  hosted("follows the player's changes live", async ({ host, page }) => {
    host.relay.publish(
      await playerRun(page, (player) => player.getByTestId("item-bow").click()),
    );
    await openSource(page, host);
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
  });

  hosted(
    "takes no click and no key: the run is the player's",
    async ({ host, page }) => {
      host.relay.publish(await withHookshot(page));
      await openSource(page, host);
      const bow = page.getByTestId("item-bow");
      await expect(bow).toBeVisible();
      const before = await page.evaluate(
        (key) => localStorage.getItem(key),
        ALTTPR_KEY,
      );

      const box = await bow.boundingBox();
      if (!box) throw new Error("No bow cell");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.press("Control+z");

      await expect(bow).toHaveAttribute(
        "aria-label",
        cell("Bow", "not obtained"),
      );
      expect(
        await page.evaluate((key) => localStorage.getItem(key), ALTTPR_KEY),
      ).toBe(before);
    },
  );

  hosted(
    "keeps the last grid and comes back by itself when the app is turned off and on",
    async ({ host, page }) => {
      host.relay.publish(await withHookshot(page));
      await openSource(page, host);
      const hookshot = page.getByTestId("item-hookshot");
      await expect(hookshot).toBeVisible();
      expect(host.relay.viewers()).toBe(1);

      // The player turns the stream off (4410): a phone would stop here
      host.relay.stop();
      await expect(hookshot).toBeVisible();
      await expect(page.getByTestId("stream-source-notice")).toHaveCount(0);

      // And on again: the source is back within its 5 s cap
      await expect.poll(() => host.relay.viewers(), { timeout: 8000 }).toBe(1);
      host.relay.publish(
        await playerRun(page, (player) =>
          player.getByTestId("item-bow").click(),
        ),
      );
      await expect(page.getByTestId("item-bow")).toHaveAttribute(
        "aria-label",
        "Bow, level 1. Click to change state.",
      );
    },
  );

  hosted(
    "keeps the last grid through a lost connection",
    async ({ host, page }) => {
      host.relay.publish(await withHookshot(page));
      await openSource(page, host);
      await expect(page.getByTestId("item-hookshot")).toBeVisible();

      host.relay.drop();

      await expect(page.getByTestId("item-hookshot")).toBeVisible();
      await expect.poll(() => host.relay.viewers(), { timeout: 8000 }).toBe(1);
    },
  );

  hosted(
    "stays transparent while it waits for a seat",
    async ({ host, page }) => {
      host.relay.refuse(4503);

      await openSource(page, host);

      await expect(page.locator("#root")).toBeEmpty();
      await expectTransparentPage(page);
      await expect(page).toHaveTitle("Rando Atlas stream view");
    },
  );

  hosted(
    "says its address is out of date, and stops asking",
    async ({ host, page }) => {
      await page.setViewportSize({ height: 448, width: 512 });
      await openSource(page, host, { token: "an-old-token" });

      const notice = page.getByTestId("stream-source-notice");
      await expect(notice).toContainText("This address is out of date");
      await expectTransparentPage(page);
      await auditPage(page);
      await page.screenshot({
        path: test.info().outputPath("stream-source-expired.png"),
      });
      await page.waitForTimeout(1500);
      expect(host.relay.viewers()).toBe(0);
    },
  );

  hosted(
    "loads itself again when the app updated while it was away",
    async ({ host, page }) => {
      host.relay.publish(await withHookshot(page));
      await openSource(page, host);
      await expect(page.getByTestId("item-hookshot")).toBeVisible();
      const entry = () =>
        page.evaluate(
          () =>
            document
              .querySelector('script[type="module"][src]')
              ?.getAttribute("src") ?? "",
        );
      const before = await entry();
      expect(before).not.toContain("v=2");

      // A new release: the same page, its entry script under a new address
      const html = await readFile(join(DIST, "index.html"), "utf8");
      host.deploy({
        "index.html": html.replace(
          /(<script[^>]*type="module"[^>]*src=")([^"]+)(")/,
          "$1$2?v=2$3",
        ),
      });
      const reloaded = page.waitForEvent("load");

      host.relay.drop();

      await reloaded;
      await expect.poll(entry, { timeout: 8000 }).toContain("v=2");
      await expect(page.getByTestId("item-hookshot")).toBeVisible();
    },
  );
});

/** The expired source sits on the scene: its page is transparent too. */
const expectTransparentPage = async (page: Page) => {
  expect(
    await page.evaluate(() => [
      getComputedStyle(document.documentElement).backgroundColor,
      getComputedStyle(document.body).backgroundColor,
    ]),
  ).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
};
