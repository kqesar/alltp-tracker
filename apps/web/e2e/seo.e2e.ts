import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { SEO_GAMES, SITE } from "../seo/games";
import { WCAG_AA, WIDTHS } from "./support";

/** The page's title for a game, as the tracker sets it once it runs (`pageTitle`). */
const titleOf = (name: string) => `Rando Atlas · ${name} Randomizer`;

/** An address of the published site, as the host under test serves it. */
const local = (url: string) => url.replace(SITE, "./");

/** The content of a `<meta>` tag, by its `name` or `property`. */
const metaOf = (html: string, key: string) =>
  new RegExp(`<meta content="([^"]*)" (?:name|property)="${key}"`).exec(
    html,
  )?.[1];

/** What a crawler that runs no script reads: the HTML, as served. */
const fetchHtml = async (page: Page, path: string) => {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  return response.text();
};

test.describe("what a crawler reads without running the page", () => {
  for (const game of SEO_GAMES) {
    test(`${game.name}: title, description, canonical and link preview`, async ({
      page,
    }) => {
      const html = await fetchHtml(page, `./${game.id}/`);

      expect(html).toContain(`<title>${titleOf(game.name)}</title>`);
      expect(html).toContain(`<h1>${game.name} randomizer tracker</h1>`);
      expect(metaOf(html, "description")).toBe(game.description);
      expect(game.description.length).toBeLessThanOrEqual(160);
      expect(html).toContain(
        `<link href="${SITE}${game.id}/" rel="canonical" />`,
      );
      expect(metaOf(html, "og:title")).toBe(titleOf(game.name));
      expect(metaOf(html, "og:description")).toBe(game.description);
      expect(metaOf(html, "og:url")).toBe(`${SITE}${game.id}/`);
      expect(metaOf(html, "twitter:card")).toBe("summary_large_image");
      expect(metaOf(html, "twitter:title")).toBe(titleOf(game.name));

      // The card is a 1200 x 630 PNG, and a light one
      const card = metaOf(html, "og:image");
      expect(card).toBe(`${SITE}social/${game.id}.png`);
      expect(metaOf(html, "twitter:image")).toBe(card);
      const image = await page.request.get(local(card ?? ""));
      expect(image.status()).toBe(200);
      expect(image.headers()["content-type"]).toBe("image/png");
      const png = await image.body();
      expect(png.readUInt32BE(16)).toBe(1200);
      expect(png.readUInt32BE(20)).toBe(630);
      expect(png.length).toBeLessThan(250_000);
    });

    test(`${game.name}: the button opens the tracker on this game, whatever the device saved`, async ({
      page,
    }) => {
      // The device tracks another game
      const other = game.id === "sm" ? "smz3" : "sm";
      await page.goto("./");
      await page.evaluate(
        (id) => localStorage.setItem("alltp-tracker-game", id),
        other,
      );

      await page.goto(`./${game.id}/`);
      await page.getByRole("link", { name: "Open the tracker" }).click();

      await expect(page.getByTestId("toolbar")).toBeVisible();
      await expect(page).toHaveTitle(titleOf(game.name));
      expect(new URL(page.url()).search).toBe("");
      await expect(page.getByTestId("header-game")).toHaveText(game.name);
      // Kept by a reload, as a game picked in the run type dialog is
      await page.reload();
      await expect(page).toHaveTitle(titleOf(game.name));
    });
  }

  test("the tracker's own page names the product and links to each game", async ({
    page,
  }) => {
    const html = await fetchHtml(page, "./");

    expect(html).toContain(
      "<title>Rando Atlas · Randomizer Item Tracker</title>",
    );
    expect(html).toContain(`<link href="${SITE}" rel="canonical" />`);
    expect(metaOf(html, "description")).toMatch(
      /^Free item and map tracker for /,
    );
    expect(metaOf(html, "og:image")).toBe(`${SITE}social/alttpr.png`);
    // The body a crawler reads before the tracker starts
    expect(html).toContain("<h1>Rando Atlas</h1>");
    for (const { id, name } of SEO_GAMES) {
      expect(html).toContain(`<a href="${id}/">${name}</a>`);
    }
  });

  test("the sitemap lists the tracker and each game's page, all of which exist", async ({
    page,
  }) => {
    const sitemap = await fetchHtml(page, "./sitemap.xml");
    const urls = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

    expect(urls).toEqual([SITE, ...SEO_GAMES.map(({ id }) => `${SITE}${id}/`)]);
    for (const url of urls) {
      const html = await fetchHtml(page, local(url));
      expect(html).toContain(`<link href="${url}" rel="canonical" />`);
    }
    const robots = await fetchHtml(page, "./robots.txt");
    expect(robots).toContain(`Sitemap: ${SITE}sitemap.xml`);
  });

  test("a browser with scripts off still gets the content", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(baseURL ?? "");

    await expect(
      page.getByRole("heading", { level: 1, name: "Rando Atlas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Super Metroid" }),
    ).toBeVisible();
    await context.close();
  });
});

for (const width of WIDTHS) {
  test(`the game pages hold at ${width}px: no overflow, axe-clean`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    for (const { id } of SEO_GAMES) {
      await page.goto(`./${id}/`);
      await expect(
        page.getByRole("link", { name: "Open the tracker" }),
      ).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const { violations } = await new AxeBuilder({ page })
        .withTags(WCAG_AA)
        .analyze();
      expect(violations).toEqual([]);
    }
  });
}
