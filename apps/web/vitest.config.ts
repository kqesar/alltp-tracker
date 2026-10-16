import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineProject } from "vitest/config";

// `vitest --coverage` instruments every block, which slows the solver's hot
// loops several times over: the timing tests read this to know whether they
// time the code or the instrumentation (as the engine's do).
const coverage = process.argv.some(
  (arg) =>
    arg === "--coverage" ||
    arg === "--coverage.enabled" ||
    arg === "--coverage.enabled=true",
);

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
    provide: { coverage },
    setupFiles: ["src/test-setup.ts"],
    // A hung test, not a slow one: specs take ~200 ms, but parallel worktree
    // runs under coverage slow them 25x past the 5 s default. Timing budgets
    // are asserted by their own tests.
    testTimeout: 20_000,
  },
});
