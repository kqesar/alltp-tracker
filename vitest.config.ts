import { defineConfig } from "vitest/config";

// One run over every workspace: each project brings its own config (the web
// app runs in jsdom, the engine and the game packs in Node). Coverage is
// measured here, over all of them, so the floors below hold for the whole
// repository.
export default defineConfig({
  test: {
    coverage: {
      // These are glob patterns: a bare directory name matches nothing, so
      // both lists must spell out the extensions they mean.
      exclude: [
        "**/*.d.ts",
        "**/*.spec.{ts,tsx}",
        "apps/web/src/main.tsx",
        "apps/web/src/test-setup.ts",
      ],
      include: [
        "apps/web/src/**/*.{ts,tsx}",
        "packages/*/src/**/*.ts",
        "packs/*/src/**/*.ts",
      ],
      reporter: ["html", "json", "json-summary"],
      // Floors sit just under current coverage so a regression fails the build
      // without blocking day-to-day work. Raise them as coverage improves.
      thresholds: {
        branches: 88,
        functions: 97,
        lines: 97,
        statements: 94,
      },
    },
    // Listing the projects by path keeps agent worktrees under .claude out.
    projects: ["apps/web", "packages/*", "packs/*"],
  },
});
