import type { Plugin } from "vite";
import { SEO_GAMES } from "./games.ts";
import { landingPage } from "./landing.ts";

/** The tags of the app's page that a game's page repeats: icons and theme colour. */
const SHARED_TAG =
  /<(?:link|meta)\b[^>]*(?:rel="(?:icon|apple-touch-icon)"|name="theme-color")[^>]*>/g;

/**
 * Writes a static page per game next to index.html (`sm/index.html`, ...): the
 * address a search engine can index for that game, which the single-page app
 * cannot give (it picks its game from the device's storage). Site builds
 * only. The icon tags are copied from index.html as Vite wrote them, so a new
 * icon needs no change here.
 *
 * Runs before the service worker plugin, so its pages are in the bundle it
 * lists; vite.config.ts keeps them out of what installs download.
 */
export const gamePages = (): Plugin => ({
  apply: "build",
  generateBundle: {
    handler(_options, bundle) {
      const page = bundle["index.html"];
      if (page?.type !== "asset" || typeof page.source !== "string") {
        this.error("index.html is not in the bundle yet");
      }
      const icons = page.source.match(SHARED_TAG) ?? [];
      if (icons.length === 0) this.error("index.html carries no icon tag");
      for (const game of SEO_GAMES) {
        this.emitFile({
          fileName: `${game.id}/index.html`,
          source: landingPage(game, icons),
          type: "asset",
        });
      }
    },
    // After Vite has written index.html into the bundle
    order: "post",
  },
  name: "alltp:game-pages",
});
