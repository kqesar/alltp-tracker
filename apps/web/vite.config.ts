import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { serviceWorker } from "./sw/plugin.ts";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/alltp-tracker/" : "/",
  plugins: [
    react(),
    // Voice commands' engine is cached once a player turns them on; the
    // speech model, which the engine keeps in IndexedDB, never
    serviceWorker({
      // Voice commands' engine, and the SMZ3 board's map of Zebes: fetched
      // the first time a page asks, so players of another game never do
      onDemand: /^assets\/(vosk[.-]|smz3\/)/,
      uncached: /^models\//,
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
