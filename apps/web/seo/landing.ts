import { PRODUCT, SEO_GAMES, type SeoGame, SITE } from "./games.ts";

const ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

/** Text or an attribute value, safe in HTML. */
const esc = (text: string) => text.replace(/["&<>]/g, (c) => ESCAPES[c]);

/** Items in running text: "a, b and c". */
const listOf = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** The title of a game's page, as `pageTitle` has it in src/games/registry.ts. */
export const titleOf = (game: SeoGame) =>
  `${PRODUCT} · ${game.name} Randomizer`;

/** The address a game's page is served at, and its link preview image's. */
export const pageUrl = (game: SeoGame) => `${SITE}${game.id}/`;
export const cardUrl = (game: SeoGame) => `${SITE}social/${game.id}.png`;

/** The size of the link preview images (what Open Graph and X's large card use). */
export const CARD = { height: 630, width: 1200 } as const;

const STYLE = `
      :root { color-scheme: dark; }
      body { margin: 0; font: 1rem/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #f4f5fb; background: #07070b linear-gradient(180deg, #11111a, #07070b) no-repeat; }
      main { max-width: 46rem; margin: 0 auto; padding: 2rem 1rem 3rem; }
      a { color: #e6c34a; }
      .brand { margin: 0; font-weight: 700; letter-spacing: 0.04em; color: #e6c34a; }
      h1 { margin: 0.25rem 0 1rem; font-size: 1.75rem; line-height: 1.2; }
      .cta { display: inline-block; margin: 0.5rem 0 1.5rem; padding: 0.7rem 1.4rem; font-weight: 700; color: #07070b; text-decoration: none; background: #e6c34a; border-radius: 0.5rem; }
      .cta:hover { background: #f2d469; }
      .cta:focus-visible, a:focus-visible { outline: 2px solid #f2d469; outline-offset: 3px; }
      img { display: block; width: 100%; height: auto; margin: 0 0 1.5rem; border: 1px solid #2a2c3d; border-radius: 0.5rem; }
      li { margin: 0.4rem 0; }
      footer { margin-top: 2rem; color: #b6bacb; font-size: 0.875rem; }
`;

/**
 * A game's page for search engines and link previews. It is plain HTML with
 * no script: what a crawler reads is what a player sees, and the button opens
 * the tracker on this game (`?game=`, read in src/games/registry.ts).
 * @param icons - The page's icon and theme-colour tags, as the app's index.html has them
 */
export const landingPage = (game: SeoGame, icons: string[]) => {
  const title = titleOf(game);
  const url = pageUrl(game);
  const others = SEO_GAMES.filter(({ id }) => id !== game.id);
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    applicationCategory: "GameApplication",
    description: game.description,
    isAccessibleForFree: true,
    name: PRODUCT,
    operatingSystem: "Web, Windows, macOS, Linux",
    url,
  };
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>${esc(title)}</title>
    <meta content="${esc(game.description)}" name="description" />
    <link href="${url}" rel="canonical" />
${icons.map((tag) => `    ${tag}`).join("\n")}
    <meta content="${esc(PRODUCT)}" property="og:site_name" />
    <meta content="website" property="og:type" />
    <meta content="${esc(title)}" property="og:title" />
    <meta content="${esc(game.description)}" property="og:description" />
    <meta content="${url}" property="og:url" />
    <meta content="${cardUrl(game)}" property="og:image" />
    <meta content="${CARD.width}" property="og:image:width" />
    <meta content="${CARD.height}" property="og:image:height" />
    <meta content="${esc(`The ${PRODUCT} board for ${game.name}`)}" property="og:image:alt" />
    <meta content="summary_large_image" name="twitter:card" />
    <meta content="${esc(title)}" name="twitter:title" />
    <meta content="${esc(game.description)}" name="twitter:description" />
    <meta content="${cardUrl(game)}" name="twitter:image" />
    <script type="application/ld+json">${JSON.stringify(data)}</script>
    <style>${STYLE}    </style>
  </head>
  <body>
    <main>
      <p class="brand">${esc(PRODUCT)}</p>
      <h1>${esc(game.name)} randomizer tracker</h1>
      <p>${esc(game.description)}</p>
      <a class="cta" href="../?game=${game.id}">Open the tracker</a>
      <img alt="The tracker's board for ${esc(game.name)}, with items found" height="${CARD.height}" src="../social/${game.id}.png" width="${CARD.width}" />
      <ul>
${game.features.map((feature) => `        <li>${esc(feature)}</li>`).join("\n")}
      </ul>
      <footer>
        <p>Follows ${esc(game.randomizer.name)} (<a href="${game.randomizer.href}">${game.randomizer.href.replace(/^https:\/\/|\/$/g, "")}</a>). Also tracks ${listOf(others.map((other) => `<a href="../${other.id}/">${esc(other.name)}</a>`))}.</p>
        <p>Free and <a href="https://github.com/kqesar/alltp-tracker">open source</a>. Works offline once opened.</p>
      </footer>
    </main>
  </body>
</html>
`;
};
