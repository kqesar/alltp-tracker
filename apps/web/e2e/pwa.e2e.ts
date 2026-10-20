import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  type BrowserContext,
  expect,
  type Page,
  type Response,
  test,
} from "@playwright/test";
import { DIST, hostBuild } from "./staticHost";
import { WCAG_AA, WIDTHS } from "./support";

/** Where the production build is served, as on GitHub Pages. */
const BASE = "/alltp-tracker/";

/** Load the tracker and wait until its service worker controls the page. */
const openControlled = async (page: Page, url = "./") => {
  await page.goto(url);
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
};

test.describe("offline", () => {
  test("loads and keeps the run with no network after the first visit", async ({
    context,
    page,
  }) => {
    await openControlled(page);
    const hookshot = page.getByTestId("item-hookshot");
    await hookshot.click();
    await expect(hookshot).toHaveAccessibleName(/^Hookshot, obtained\./);

    await context.setOffline(true);
    const served: Response[] = [];
    const problems: string[] = [];
    page.on("response", (response) => served.push(response));
    page.on("requestfailed", (request) => problems.push(request.url()));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    await page.reload();

    await expect(page.getByTestId("item-grid")).toBeVisible();
    await expect(hookshot).toHaveAccessibleName(/^Hookshot, obtained\./);
    // Real images, decoded: the header's Triforce and the map
    const triforce = page.getByTestId("link-alttpr").locator("img");
    await expect
      .poll(() =>
        triforce.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    const mapWidth = await page
      .getByTestId("map-world-light")
      .evaluate(async (world) => {
        const url = /url\("(.+)"\)/.exec(
          getComputedStyle(world).backgroundImage,
        )?.[1];
        const image = new Image();
        image.src = url ?? "";
        await image.decode();
        return image.naturalWidth;
      });
    expect(mapWidth).toBeGreaterThan(0);
    // Everything came from the worker's cache, nothing failed
    expect(served.length).toBeGreaterThan(0);
    expect(
      served
        .filter((response) => !response.fromServiceWorker())
        .map((response) => response.url()),
    ).toEqual([]);
    expect(problems).toEqual([]);
  });
});

/** The cache the worker keeps the build in (sw/sw.ts). */
const CACHE = "alltp-tracker-precache";

/** Every path of the worker's cache: the files and the games it holds. */
const cachedPaths = (page: Page) =>
  page.evaluate(
    async (name) =>
      (await (await caches.open(name)).keys()).map(
        (request) => new URL(request.url).pathname,
      ),
    CACHE,
  );

/** Whether a cached path matches, for polling the worker's downloads. */
const hasCached = async (page: Page, file: RegExp) =>
  (await cachedPaths(page)).some((path) => file.test(path));

/** Super Metroid's own sheet, which no other game's files include. */
const SM_FILE = /\/assets\/items-[\w-]+\.png$/;
/** ALttPR's item art and map, which Super Metroid never draws. */
const ALTTPR_FILE = /\/assets\/(boots\.png|map\.webp)$/;
/** SMZ3's board code, which only its players load. */
const SMZ3_FILE = /\/assets\/Smz3AutotrackDialog-[\w-]+\.js$/;

/** Pick a game in the run type dialog: the page loads again on it. */
const pickGame = async (page: Page, game: "alttpr" | "sm") => {
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page
    .getByRole("dialog", { name: "Choose a run type" })
    .getByTestId(`game-${game}`)
    .click();
};

/** Watch a page for what an offline reload must show: all from the cache. */
const watchOffline = (page: Page) => {
  const served: Response[] = [];
  const problems: string[] = [];
  page.on("response", (response) => served.push(response));
  page.on("requestfailed", (request) => problems.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  return () => {
    expect(served.length).toBeGreaterThan(0);
    expect(
      served
        .filter((response) => !response.fromServiceWorker())
        .map((response) => response.url()),
    ).toEqual([]);
    expect(problems).toEqual([]);
  };
};

test.describe("offline, game by game", () => {
  test("a Super Metroid player caches the shell and Super Metroid alone", async ({
    context,
    page,
  }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem("alltp-tracker-game")) {
        localStorage.setItem("alltp-tracker-game", "sm");
      }
    });
    await openControlled(page);
    const morph = page.getByTestId("sm-item-morph");
    await morph.click();
    await expect(morph).toHaveAccessibleName(/^Morphing Ball, obtained\./);

    // The first install already holds the game the page marked: no wait
    const paths = await cachedPaths(page);
    expect(paths.some((path) => SM_FILE.test(path))).toBe(true);
    expect(paths.some((path) => ALTTPR_FILE.test(path))).toBe(false);
    expect(paths.some((path) => SMZ3_FILE.test(path))).toBe(false);

    await context.setOffline(true);
    const check = watchOffline(page);
    await page.reload();

    await expect(page.getByTestId("item-grid")).toBeVisible();
    await expect(morph).toHaveAccessibleName(/^Morphing Ball, obtained\./);
    check();
  });

  test("a game switched to online is cached and loads offline, the first one still does", async ({
    context,
    page,
  }) => {
    await openControlled(page);
    await page.getByTestId("item-hookshot").click();
    expect(await hasCached(page, SM_FILE)).toBe(false);

    await pickGame(page, "sm");
    await expect(page.getByTestId("sm-item-morph")).toBeVisible();
    // The page marked it, the worker then fetches it
    await expect.poll(() => hasCached(page, SM_FILE)).toBe(true);
    // ALttPR's files stay, for the way back; SMZ3's were never wanted
    expect(await hasCached(page, ALTTPR_FILE)).toBe(true);
    expect(await hasCached(page, SMZ3_FILE)).toBe(false);

    await context.setOffline(true);
    const check = watchOffline(page);
    await page.reload();
    await expect(page.getByTestId("sm-item-morph")).toBeVisible();
    check();

    // Back to ALttPR, offline: its files were kept
    await page.evaluate(() =>
      localStorage.setItem("alltp-tracker-game", "alttpr"),
    );
    await page.reload();
    await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
      /^Hookshot, obtained\./,
    );

    // A game this device never opened online cannot start, and says so
    await page.evaluate(() =>
      localStorage.setItem("alltp-tracker-game", "smz3"),
    );
    await page.reload();
    await expect(page.locator("#root")).toHaveText(/could not load/);
  });
});

test.describe("installation", () => {
  test("serves a valid manifest Chrome can install from", async ({ page }) => {
    await openControlled(page);

    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    const response = await page.request.get(
      new URL(href ?? "", page.url()).href,
    );
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain(
      "application/manifest+json",
    );
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      display: "standalone",
      name: "Rando Atlas",
      scope: BASE,
      short_name: "Rando Atlas",
      start_url: BASE,
    });
    expect(new URL(page.url()).pathname).toBe(manifest.start_url);

    // Its colours are the page background token, as is the theme-color meta
    const background = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-bg")
        .trim(),
    );
    expect(manifest.theme_color).toBe(background);
    expect(manifest.background_color).toBe(background);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      background,
    );

    // Every icon loads at the size it claims; one of them is maskable
    const manifestUrl = response.url();
    const icons: { src: string; sizes: string; purpose?: string }[] =
      manifest.icons;
    const sizes = await page.evaluate(
      (urls) =>
        Promise.all(
          urls.map(async (url) => {
            const image = new Image();
            image.src = url;
            await image.decode();
            return `${image.naturalWidth}x${image.naturalHeight}`;
          }),
        ),
      icons.map((icon) => new URL(icon.src, manifestUrl).href),
    );
    expect(sizes).toEqual(icons.map((icon) => icon.sizes));
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(icons.map((icon) => icon.purpose)).toContain("maskable");

    // The tab and home screen icons resolve under the base path too
    for (const [rel, size] of [
      ["icon", 32],
      ["apple-touch-icon", 180],
    ] as const) {
      const link = page.locator(`link[rel="${rel}"]`);
      const url = new URL((await link.getAttribute("href")) ?? "", page.url());
      expect(url.pathname.startsWith(BASE)).toBe(true);
      const width = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return image.naturalWidth;
      }, url.href);
      expect(width).toBe(size);
    }

    // Chrome's own reading: no manifest error, nothing blocking installation
    const cdp = await page.context().newCDPSession(page);
    const { errors } = await cdp.send("Page.getAppManifest");
    expect(errors).toEqual([]);
    const { installabilityErrors } = await cdp.send(
      "Page.getInstallabilityErrors",
    );
    // Playwright's browser contexts are incognito-like, and a full Chrome
    // (CI's channel) never installs from incognito: that error is about the
    // test's browser, not the app. Every other one fails the test.
    expect(
      installabilityErrors.filter(({ errorId }) => errorId !== "in-incognito"),
    ).toEqual([]);
  });
});

/**
 * The application name the next version's index.html carries, to tell it
 * apart (the title is no marker: the page sets it for the game it tracks).
 */
const NEXT_NAME = "Rando Atlas (next version)";

/** The marker on a page: present once it shows the next version. */
const nextMark = (page: Page) =>
  page.locator(`meta[name="application-name"][content="${NEXT_NAME}"]`);

/** The id of that next build. */
const NEXT_BUILD = "0123456789abcdef";

/** The meta tag carrying a page's build id (sw/plugin.ts). */
const BUILD_META =
  /(<meta content=")([0-9a-f]{16})(" name="alltp-tracker-build")/;

/**
 * The next release of the build: its index.html changed (its application name), so it
 * has a new build id, and its sw.js lists that id and a new revision for the
 * page, exactly as the Vite plugin writes them. Every other file stays as it
 * is, as in most releases.
 */
const nextRelease = async () => {
  const built = await readFile(join(DIST, "index.html"), "utf8");
  const build = BUILD_META.exec(built)?.[2] ?? "";
  const html = built
    .replace(
      /(<meta content=")[^"]*(" name="application-name")/,
      `$1${NEXT_NAME}$2`,
    )
    .replace(BUILD_META, `$1${NEXT_BUILD}$3`);
  const revision = createHash("sha256").update(html).digest("hex").slice(0, 16);
  const worker = (await readFile(join(DIST, "sw.js"), "utf8"))
    .replace(
      new RegExp(`("${BASE}index\\.html",")[0-9a-f]{16}"`),
      `$1${revision}"`,
    )
    .replace(`"${build}"`, `"${NEXT_BUILD}"`);
  expect(build).toMatch(/^[0-9a-f]{16}$/);
  expect(html).toContain(NEXT_BUILD);
  expect(worker).toContain(revision);
  expect(worker).toContain(`"${NEXT_BUILD}"`);
  return { "index.html": html, "sw.js": worker };
};

/** A file only ALttPR's players load, and the line the next release adds. */
const ALTTPR_CHUNK =
  /"(\/alltp-tracker\/assets\/legacy-[\w-]+\.js)","([0-9a-f]{16})"/;
const NEXT_CODE = "\n// the next release\n";

/**
 * The next release, with a change to a file of ALttPR too: the game a
 * Super Metroid tab does not show.
 */
const nextReleaseWithGameFile = async () => {
  const release = await nextRelease();
  const [, path = "", revision = ""] =
    ALTTPR_CHUNK.exec(release["sw.js"]) ?? [];
  expect(path).not.toBe("");
  const file = path.slice(BASE.length);
  const body = `${await readFile(join(DIST, file), "utf8")}${NEXT_CODE}`;
  const next = createHash("sha256").update(body).digest("hex").slice(0, 16);
  return {
    ...release,
    "sw.js": release["sw.js"].replace(
      `"${path}","${revision}"`,
      `"${path}","${next}"`,
    ),
    [file]: body,
  };
};

type Host = Awaited<ReturnType<typeof hostBuild>>;

/**
 * The build on a host of its own, which a test can release a new version to:
 * the browser checks for one through a request no Playwright route can see.
 */
const hosted = test.extend<{ host: Host }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's dependencies from this pattern
  host: async ({}, use) => {
    const host = await hostBuild(BASE);
    await use(host);
    await host.close();
  },
});

/**
 * Release the next version while the tracker stays open, the network gone
 * for a moment: its return is one of the moments the page checks again.
 */
const releaseWhileOpen = async (
  context: BrowserContext,
  host: Host,
  release: () => ReturnType<typeof nextRelease> = nextRelease,
) => {
  await context.setOffline(true);
  host.deploy(await release());
  await context.setOffline(false);
};

/** The build of the worker controlling a page. */
const controllerBuild = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => resolve(event.data);
        navigator.serviceWorker.controller?.postMessage("get-build", [
          channel.port2,
        ]);
      }),
  );

/** Ask the browser to check for a new version; how its install ended. */
const checkForUpdate = (page: Page) =>
  page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
    const worker = registration?.installing;
    if (!worker) return "no new version";
    return new Promise<string>((resolve) => {
      const settle = () => {
        if (worker.state === "installed" || worker.state === "redundant") {
          resolve(worker.state);
        }
      };
      worker.addEventListener("statechange", settle);
      settle();
    });
  });

/** Leave a mark in a page, which only a reload of it would wipe. */
const mark = (page: Page) =>
  page.evaluate(() => {
    (window as { notReloaded?: boolean }).notReloaded = true;
  });
const stillMarked = (page: Page) =>
  page.evaluate(() => (window as { notReloaded?: boolean }).notReloaded);

/** The build a page shows, from its index.html (the stream view retitles). */
const pageBuild = (page: Page) =>
  page
    .locator('meta[name="alltp-tracker-build"]')
    .getAttribute("content", { timeout: 1000 })
    .catch(() => null);

const AVAILABLE = "A new version is available";

test.describe("an update", () => {
  hosted(
    "is on screen after one reload while online, the run intact",
    async ({ host, page }) => {
      await openControlled(page, host.url);
      await page.getByTestId("item-hammer").click();

      host.deploy(await nextRelease());
      await page.reload();

      await expect(nextMark(page)).toHaveCount(1);
      await expect(page.getByTestId("item-hammer")).toHaveAccessibleName(
        /^Hammer, obtained\./,
      );
      // The worker of that same version takes over, with nothing to offer
      await expect.poll(() => controllerBuild(page)).toBe(NEXT_BUILD);
      await expect(page.getByTestId("update-prompt")).toBeEmpty();
    },
  );

  hosted(
    "is offered to a tab left open, and taken only when asked",
    async ({ context, host, page }) => {
      await openControlled(page, host.url);
      await page.getByTestId("item-hammer").click();

      await releaseWhileOpen(context, host);
      const prompt = page.getByTestId("update-prompt");
      await expect(prompt).toHaveRole("status");
      await expect(prompt).toContainText(AVAILABLE);
      // Still the version that was running: nothing reloaded on its own
      await expect(nextMark(page)).toHaveCount(0);

      await page.getByTestId("update-reload").click();

      await expect(nextMark(page)).toHaveCount(1);
      await expect(prompt).toBeEmpty();
      await expect(page.getByTestId("item-hammer")).toHaveAccessibleName(
        /^Hammer, obtained\./,
      );
    },
  );

  hosted(
    "reaches every game the device holds, the one on screen or not, and no other",
    async ({ context, host, page }) => {
      // ALttPR first, then Super Metroid: both held, the tab on Super Metroid
      await openControlled(page, host.url);
      await pickGame(page, "sm");
      await expect(page.getByTestId("sm-item-morph")).toBeVisible();
      await expect.poll(() => hasCached(page, SM_FILE)).toBe(true);
      expect(await hasCached(page, ALTTPR_FILE)).toBe(true);
      await page.getByTestId("sm-item-morph").click();

      // A release that changes a file of ALttPR, which that stale tab never runs
      await releaseWhileOpen(context, host, nextReleaseWithGameFile);
      await expect(page.getByTestId("update-prompt")).toContainText(AVAILABLE);
      await page.getByTestId("update-reload").click();
      await expect(nextMark(page)).toHaveCount(1);
      await expect.poll(() => controllerBuild(page)).toBe(NEXT_BUILD);

      // The new revision of that file is cached, the old one dropped
      const chunk = (await cachedPaths(page)).filter((path) =>
        /\/assets\/legacy-[\w-]+\.js$/.test(path),
      );
      expect(chunk).toHaveLength(1);
      expect(await hasCached(page, SMZ3_FILE)).toBe(false);

      await context.setOffline(true);
      await page.reload();
      await expect(nextMark(page)).toHaveCount(1);
      await expect(page.getByTestId("sm-item-morph")).toHaveAccessibleName(
        /^Morphing Ball, obtained\./,
      );
      const served = await page.evaluate(
        async (path) => (await fetch(path)).text(),
        chunk[0] ?? "",
      );
      expect(served).toContain(NEXT_CODE.trim());
    },
  );

  hosted(
    "is looked for every hour by a tab left open",
    async ({ host, page }) => {
      await page.clock.install();
      await openControlled(page, host.url);
      host.deploy(await nextRelease());

      await page.clock.fastForward("01:00:00");

      await expect(page.getByTestId("update-prompt")).toContainText(AVAILABLE);
      await expect(nextMark(page)).toHaveCount(0);
    },
  );

  hosted(
    "is offered to the copy started offline, which can take it offline",
    async ({ context, host, page }) => {
      await openControlled(page, host.url);
      await releaseWhileOpen(context, host);
      await expect(page.getByTestId("update-prompt")).toContainText(AVAILABLE);
      await page.getByTestId("update-dismiss").click();

      await context.setOffline(true);
      await page.reload();

      // The cached copy, behind the version its worker already holds
      await expect(page.getByTestId("item-grid")).toBeVisible();
      await expect(nextMark(page)).toHaveCount(0);
      await expect(page.getByTestId("update-prompt")).toContainText(AVAILABLE);
      await page.getByTestId("update-reload").click();
      await expect(nextMark(page)).toHaveCount(1);
    },
  );

  hosted(
    "installs nothing from a release seen half-way, until it is whole",
    async ({ host, page }) => {
      await openControlled(page, host.url);
      const { "index.html": html, "sw.js": worker } = await nextRelease();

      // A CDN can serve the new sw.js beside the old index.html for a while
      host.deploy({ "sw.js": worker });
      expect(await checkForUpdate(page)).toBe("redundant");
      await expect(page.getByTestId("update-prompt")).toBeEmpty();

      host.deploy({ "index.html": html });
      expect(await checkForUpdate(page)).toBe("installed");
      await expect(page.getByTestId("update-prompt")).toContainText(AVAILABLE);
    },
  );

  hosted(
    "taken in one tab never reloads another",
    async ({ context, host, page }) => {
      const other = await context.newPage();
      await openControlled(page, host.url);
      await openControlled(other, host.url);
      await mark(other);

      await releaseWhileOpen(context, host);
      await expect(page.getByTestId("update-prompt")).toContainText(AVAILABLE);
      await expect(other.getByTestId("update-prompt")).toContainText(AVAILABLE);
      await page.getByTestId("update-reload").click();

      await expect(nextMark(page)).toHaveCount(1);
      // The other tab still runs, offered a reload of its own
      await expect(other.getByTestId("update-prompt")).toContainText(AVAILABLE);
      expect(await stillMarked(other)).toBe(true);
      await expect(nextMark(other)).toHaveCount(0);
    },
  );

  hosted(
    "is taken by the stream view on its own, only offered to the tracker beside it",
    async ({ context, host, page }) => {
      const stream = await context.newPage();
      await openControlled(page, host.url);
      await openControlled(stream, `${host.url}?view=obs`);
      await mark(page);

      await releaseWhileOpen(context, host);

      await expect.poll(() => pageBuild(stream)).toBe(NEXT_BUILD);
      await expect(stream.getByTestId("item-grid")).toBeVisible();
      await expect(page.getByTestId("update-prompt")).toContainText(AVAILABLE);
      expect(await stillMarked(page)).toBe(true);
      await expect(nextMark(page)).toHaveCount(0);
    },
  );

  for (const width of WIDTHS) {
    test.describe(`at ${width}px`, () => {
      const phone = width < 600;
      hosted.use({
        hasTouch: phone,
        isMobile: phone,
        viewport: { height: phone ? 844 : 900, width },
      });

      hosted(
        "is offered in a notice on screen, axe-clean, a few Tabs away",
        async ({ context, host, page }) => {
          await openControlled(page, host.url);
          await releaseWhileOpen(context, host);
          await expect(page.getByTestId("update-prompt")).toContainText(
            AVAILABLE,
          );
          const reload = page.getByTestId("update-reload");
          const dismiss = page.getByTestId("update-dismiss");

          // Both buttons in full view, nothing pushed sideways
          await expect(reload).toBeInViewport({ ratio: 1 });
          await expect(dismiss).toBeInViewport({ ratio: 1 });
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          expect(overflow).toBeLessThanOrEqual(0);

          // The card fades in: contrast measured mid-fade reads as a failure
          await page
            .getByTestId("update-prompt")
            .evaluate((notice) =>
              Promise.all(
                notice
                  .getAnimations({ subtree: true })
                  .map((run) => run.finished),
              ),
            );
          const { violations } = await new AxeBuilder({ page })
            .include('[data-testid="update-prompt"]')
            .withTags(WCAG_AA)
            .analyze();
          expect(
            violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
          ).toEqual([]);

          // From the top of the page: the three skip links, then the notice
          for (let press = 0; press < 4; press++) {
            await page.keyboard.press("Tab");
          }
          await expect(reload).toBeFocused();
          await page.keyboard.press("Tab");
          await expect(dismiss).toBeFocused();
          await page.keyboard.press("Enter");
          await expect(page.getByTestId("update-prompt")).toBeEmpty();
        },
      );
    });
  }
});
