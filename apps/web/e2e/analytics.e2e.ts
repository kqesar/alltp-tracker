import { expect, type Page, test } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4173);

/** The published site's address. */
const SITE_URL = "https://kqesar.github.io/alltp-tracker/";

// Only the site's own host counts visits, and the browser upgrades a plain
// http address on github.io to https: the build under test is served at the
// site's real address, its requests answered from this machine's server. Its
// service worker is left out, which would answer them itself.
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ context }) => {
  await context.route("https://kqesar.github.io/**", async (route) => {
    const { pathname, search } = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({
        url: `http://localhost:${PORT}${pathname}${search}`,
      }),
    });
  });
});

// The page keeps asking for files (images, chunks) after the assertions are
// done: a request this route is still answering when the test ends fails the
// test with "route.fetch: Test ended". Let the page go quiet first.
test.afterEach(async ({ page }) => {
  await page.waitForLoadState("networkidle");
});

/** Count what the page asks GoatCounter's script host for, the script stubbed. */
const watchCounter = async (page: Page) => {
  const asked: string[] = [];
  await page.route("https://gc.zgo.at/**", (route) => {
    asked.push(route.request().url());
    return route.fulfill({ body: "", contentType: "text/javascript" });
  });
  return asked;
};

const COUNTER_SCRIPT = "script[data-goatcounter]";

test("counts a visit to the tracker once, with a script that does not block", async ({
  page,
}) => {
  const asked = await watchCounter(page);

  await page.goto(SITE_URL);
  await expect(page.getByTestId("toolbar")).toBeVisible();

  const script = page.locator(COUNTER_SCRIPT);
  await expect(script).toHaveCount(1);
  await expect(script).toHaveAttribute(
    "data-goatcounter",
    "https://rando-atlas.goatcounter.com/count",
  );
  await expect(script).toHaveJSProperty("async", true);
  await expect.poll(() => asked).toEqual(["https://gc.zgo.at/count.js"]);
});

test("never counts the stream view", async ({ page }) => {
  const asked = await watchCounter(page);

  await page.goto(`${SITE_URL}?view=obs`);
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.waitForLoadState("load");

  await expect(page.locator(COUNTER_SCRIPT)).toHaveCount(0);
  expect(asked).toEqual([]);
});

test("never counts a visitor who sends Do Not Track", async ({ page }) => {
  const asked = await watchCounter(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "doNotTrack", { get: () => "1" }),
  );

  await page.goto(SITE_URL);
  await expect(page.getByTestId("toolbar")).toBeVisible();
  await page.waitForLoadState("load");

  await expect(page.locator(COUNTER_SCRIPT)).toHaveCount(0);
  expect(asked).toEqual([]);
});

test("counts nothing off the site's host", async ({ page, baseURL }) => {
  const asked = await watchCounter(page);

  await page.goto(baseURL ?? "");
  await expect(page.getByTestId("toolbar")).toBeVisible();
  await page.waitForLoadState("load");

  await expect(page.locator(COUNTER_SCRIPT)).toHaveCount(0);
  expect(asked).toEqual([]);
});
