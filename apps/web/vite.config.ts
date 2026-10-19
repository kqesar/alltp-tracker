import { rmSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { serviceWorker } from "./sw/plugin.ts";

/** Where the desktop app's build goes (apps/desktop's frontendDist). */
const DESKTOP_OUT = "dist-desktop";

/**
 * The desktop app fetches the speech model from the site, as the web does
 * on demand: a copy downloaded into public/ stays out of its installers.
 */
const withoutSpeechModel = (): Plugin => ({
  apply: "build",
  closeBundle: () =>
    rmSync(resolve(import.meta.dirname, DESKTOP_OUT, "models"), {
      force: true,
      recursive: true,
    }),
  name: "without-speech-model",
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
        ? withoutSpeechModel()
        : // Voice commands' engine is cached once a player turns them on;
          // the speech model, which the engine keeps in IndexedDB, never
          serviceWorker({
            // Voice commands' engine, and the SMZ3 board's map of Zebes:
            // fetched the first time a page asks, so players of another
            // game never do
            onDemand: /^assets\/(vosk[.-]|smz3\/)/,
            uncached: /^models\//,
          }),
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
