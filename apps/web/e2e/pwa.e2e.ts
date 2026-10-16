import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Response, test } from "@playwright/test";
import { DIST, hostBuild } from "./staticHost";

/** Phone, tablet, laptop and desktop: the widths every layout must hold at. */
const WIDTHS = [390, 820, 1440, 1920] as const;

/** The accessibility standard every page state is held to. */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

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
    const failed: string[] = [];
    page.on("response", (response) => served.push(response));
    page.on("requestfailed", (request) => failed.push(request.url()));
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
    // Everything came from the worker's cache, nothing tried the network
    expect(served.length).toBeGreaterThan(0);
    expect(
      served
        .filter((response) => !response.fromServiceWorker())
        .map((response) => response.url()),
    ).toEqual([]);
    expect(failed).toEqual([]);
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
      name: "A Link to the Past Tracker",
      scope: BASE,
      short_name: "ALLTP Tracker",
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
    expect(installabilityErrors).toEqual([]);
  });
});

/** The title the next version's index.html carries, to tell it apart. */
const NEXT_TITLE = "ALLTP Tracker (next version)";

/**
 * The next release of the build: its index.html changed (its title), so its
 * sw.js lists a new revision for it, exactly as the Vite plugin would write
 * it. Every other file stays as it is, as in most releases.
 */
const nextRelease = async () => {
  const html = (await readFile(join(DIST, "index.html"), "utf8")).replace(
    /<title>[^<]*<\/title>/,
    `<title>${NEXT_TITLE}</title>`,
  );
  const revision = createHash("sha256").update(html).digest("hex").slice(0, 16);
  const worker = (await readFile(join(DIST, "sw.js"), "utf8")).replace(
    new RegExp(`("${BASE}index\\.html",")[0-9a-f]{16}"`),
    `$1${revision}"`,
  );
  expect(worker).toContain(revision);
  return { "index.html": html, "sw.js": worker };
};

/**
 * The build on a host of its own, which a test can release a new version to:
 * the browser checks for one through a request no Playwright route can see.
 */
const hosted = test.extend<{ host: Awaited<ReturnType<typeof hostBuild>> }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's dependencies from this pattern
  host: async ({}, use) => {
    const host = await hostBuild(BASE);
    await use(host);
    await host.close();
  },
});

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

const AVAILABLE = "A new version is available";

test.describe("an update", () => {
  hosted(
    "waits for the player, then switches with the run intact",
    async ({ host, page }) => {
      await openControlled(page, host.url);
      await page.getByTestId("item-hammer").click();

      host.deploy(await nextRelease());
      // Each visit, the browser checks for a new version
      await page.reload();
      const prompt = page.getByTestId("update-prompt");
      await expect(prompt).toHaveRole("status");
      await expect(prompt).toContainText(AVAILABLE);
      // Still the version that was running: nothing reloaded on its own
      await expect(page).not.toHaveTitle(NEXT_TITLE);

      await page.getByTestId("update-reload").click();

      await expect(page).toHaveTitle(NEXT_TITLE);
      await expect(prompt).toBeEmpty();
      await expect(page.getByTestId("item-hammer")).toHaveAccessibleName(
        /^Hammer, obtained\./,
      );
    },
  );

  hosted(
    "can be put off, and is offered again on the next visit",
    async ({ host, page }) => {
      await openControlled(page, host.url);
      host.deploy(await nextRelease());
      await page.reload();
      await expect(page.getByTestId("update-prompt")).toContainText(AVAILABLE);

      await page.getByTestId("update-dismiss").click();
      await expect(page.getByTestId("update-prompt")).toBeEmpty();

      await page.reload();
      await expect(page.getByTestId("update-prompt")).toContainText(AVAILABLE);
      await expect(page).not.toHaveTitle(NEXT_TITLE);
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
        async ({ host, page }) => {
          await openControlled(page, host.url);
          host.deploy(await nextRelease());
          await page.reload();
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

          const { violations } = await new AxeBuilder({ page })
            .include('[data-testid="update-prompt"]')
            .withTags(WCAG_AA)
            .analyze();
          expect(
            violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
          ).toEqual([]);

          // From the top of the page: the two skip links, then the notice
          for (let press = 0; press < 3; press++) {
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
