import { defineProject } from "vitest/config";

// A pack is data and pure functions over the engine: its tests run in Node,
// like the engine's, without the app's jsdom environment and setup file.
export default defineProject({
  test: {
    environment: "node",
    include: ["{src,test}/**/*.spec.ts"],
    name: "sm",
    // A hung test, not a slow one: specs take ~200 ms, but parallel worktree
    // runs under coverage slow them 25x past the 5 s default. Timing budgets
    // are asserted by their own tests.
    testTimeout: 20_000,
  },
});
