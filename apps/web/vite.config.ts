import { rmSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { gamePages } from "./seo/plugin.ts";
import { serviceWorker } from "./sw/plugin.ts";

/** Where the desktop app's build goes (apps/desktop's frontendDist). */
const DESKTOP_OUT = "dist-desktop";

/**
 * What only the site needs, kept out of the desktop app's installers: the
 * speech model, which the app fetches from the site as the web does on demand
 * (a copy downloaded into public/ would ship), and what search engines and
 * link previews read.
 */
const SITE_ONLY = [
  "models",
  "social",
  "assets/map.png",
  "robots.txt",
  "sitemap.xml",
];

const withoutSiteOnlyFiles = (): Plugin => ({
  apply: "build",
  closeBundle: () => {
    for (const name of SITE_ONLY) {
      rmSync(resolve(import.meta.dirname, DESKTOP_OUT, name), {
        force: true,
        recursive: true,
      });
    }
  },
  name: "without-site-only-files",
});

// https://vite.dev/config/
// Two builds: the site (GitHub Pages, under /alltp-tracker/, offline through
// its service worker) and, in the "desktop" mode, the desktop app's pages,
// served by the app itself from its root, with no worker
export default defineConfig(({ mode }) => {
  const desktop = mode === "desktop";
  return {
    base:
      !desktop && process.env.NODE_ENV === "production"
        ? "/alltp-tracker/"
        : "/",
    build: desktop ? { outDir: DESKTOP_OUT } : {},
    plugins: [
      react(),
      desktop
        ? withoutSiteOnlyFiles()
        : [
            // A page per game for search engines, in the bundle the worker lists
            gamePages(),
            // Voice commands' engine is cached once a player turns them on;
            // the speech model, which the engine keeps in IndexedDB, never
            serviceWorker({
              // Voice commands' engine, and the SMZ3 board's map of Zebes:
              // fetched the first time a page asks, so players of another
              // game never do
              onDemand: /^assets\/(vosk[.-]|smz3\/)/,
              // Never at install: the speech model, and what only crawlers
              // and link previews read (the link preview images, the game
              // pages, robots.txt and the sitemap), which no player's install
              // needs. assets/map.png is the old share card, no longer
              // referenced: delete it and this clause.
              uncached:
                /^(models\/|social\/|assets\/map\.png$|(alttpr|sm|smz3)\/index\.html$|robots\.txt$|sitemap\.xml$)/,
            }),
          ],
    ],
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
      },
    },
    // tauri dev loads this port: another one would leave its window blank
    server: desktop ? { strictPort: true } : {},
  };
});
