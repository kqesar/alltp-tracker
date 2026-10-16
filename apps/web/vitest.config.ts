import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineProject } from "vitest/config";

// The web app's unit tests: React, jsdom and the app's setup file. Coverage
// and the list of projects live in the root vitest.config.ts.
export default defineProject({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    mainFields: ["module"],
  },
  test: {
    benchmark: { include: ["src/**/*.bench.{ts,tsx}"] },
    environment: "jsdom",
    // Browser tests run under Playwright, not here.
    exclude: [...configDefaults.exclude, "e2e/**"],
    globals: true,
    include: ["src/**/*.spec.{ts,tsx}"],
    name: "web",
    setupFiles: ["src/test-setup.ts"],
  },
});
