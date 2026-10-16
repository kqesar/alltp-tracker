import { defineProject } from "vitest/config";

// `vitest --coverage` instruments every block of the engine's code, which
// slows its hot loops several times over. Timing tests read this to know
// whether they measure the engine or the instrumentation. (No Node types in
// this package: process is reached through globalThis.)
const argv =
  (globalThis as { process?: { argv?: readonly string[] } }).process?.argv ??
  [];
const coverage = argv.some(
  (arg) =>
    arg === "--coverage" ||
    arg === "--coverage.enabled" ||
    arg === "--coverage.enabled=true",
);

// The engine is pure TypeScript: its tests run in Node, without the app's
// jsdom environment and setup file, which also proves it needs no DOM.
export default defineProject({
  test: {
    environment: "node",
    include: ["{src,examples,test}/**/*.spec.ts"],
    name: "engine",
    provide: { coverage },
    // A hung test, not a slow one: specs take ~200 ms, but parallel worktree
    // runs under coverage slow them 25x past the 5 s default. Timing budgets
    // are asserted by their own tests.
    testTimeout: 20_000,
  },
});
