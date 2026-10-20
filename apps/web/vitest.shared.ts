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

/** The specs that time the code: they run in their own project (vitest.perf.config.ts). */
export const PERFORMANCE_SPECS = "src/**/*.performance.spec.{ts,tsx}";

/**
 * The web app's unit tests: React, jsdom and the app's setup file. Two
 * projects share it and differ by the specs they run and the pool that runs
 * them. Coverage and the list of projects live in the root vitest.config.ts.
 */
export const webProject = (project: {
  /** The specs to leave out, besides the browser tests (Playwright's). */
  exclude: string[];
  include: string[];
  name: string;
  pool: "forks" | "vmThreads";
}) =>
  defineProject({
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
      exclude: [...configDefaults.exclude, "e2e/**", ...project.exclude],
      globals: true,
      include: project.include,
      name: project.name,
      pool: project.pool,
      provide: { coverage },
      setupFiles: ["src/test-setup.ts"],
      // A hung test, not a slow one: specs take ~200 ms, but parallel worktree
      // runs under coverage slow them 25x past the 5 s default. Timing budgets
      // are asserted by their own tests.
      testTimeout: 20_000,
    },
  });
