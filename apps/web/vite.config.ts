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
const SITE_ONLY = ["models", "social", "robots.txt", "sitemap.xml"];

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
    build: {
      ...(desktop ? { outDir: DESKTOP_OUT } : {}),
      rollupOptions: {
        output: {
          // A game pack's spoiler parser (its `./spoiler` entry) is read only
          // when a player reviews a run, in the review worker or, where there
          // is none, in place: its chunk takes the worker's `review-` name so
          // the service worker keeps it out of every install
          chunkFileNames: (chunk: { facadeModuleId: string | null }) =>
            chunk.facadeModuleId?.includes("/spoiler/parse.")
              ? "assets/review-[name]-[hash].js"
              : "assets/[name]-[hash].js",
        },
      },
    },
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
              // Each game's own files, which the worker caches only for the
              // games a device tracks. Super Metroid draws from the one sheet
              // its own stylesheet names; ALttPR's item art and map are in
              // public/assets, which ALttPR and SMZ3 both draw (SMZ3's board
              // takes its ALttPR items and its Hyrule map from them)
              games: {
                alttpr: {
                  files: /^assets\/[^/]+\.(png|webp)$/,
                  module: "src/games/alttpr/module.ts",
                },
                // Archipelago draws A Link to the Past's items with the same
                // icons (its map is not drawn: no webp)
                archipelago: {
                  files: /^assets\/[^/]+\.png$/,
                  module: "src/games/archipelago/module.ts",
                },
                sm: { module: "src/games/sm/module.ts" },
                smz3: {
                  files: /^assets\/[^/]+\.(png|webp)$/,
                  module: "src/games/smz3/module.ts",
                },
              },
              // Voice commands' engine, and the SMZ3 board's map of Zebes:
              // fetched the first time a page asks, so players of another
              // game never do
              // Reading a spoiler log: its worker and each game's parser
              // (`review-*`, named under `worker` below), loaded when a
              // player reviews a run
              onDemand: /^assets\/(vosk[.-]|smz3\/|review-)/,
              // Never at install: the speech model, and what only crawlers
              // and link previews read (the link preview images, the game
              // pages, robots.txt and the sitemap), which no player's install
              // needs
              uncached:
                /^(models\/|social\/|(alttpr|archipelago|sm|smz3)\/index\.html$|robots\.txt$|sitemap\.xml$)/,
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
    // The spoiler log is read in a module worker (`review/read.ts`) that loads
    // its parser as a chunk: ES format for the split, and names the service
    // worker keeps out of the install download
    worker: {
      format: "es" as const,
      rollupOptions: {
        output: {
          chunkFileNames: "assets/review-[name]-[hash].js",
          entryFileNames: "assets/review-[name]-[hash].js",
        },
      },
    },
  };
});
