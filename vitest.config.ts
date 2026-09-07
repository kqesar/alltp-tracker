import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    mainFields: ["module"],
  },
  test: {
    coverage: {
      // These are glob patterns: a bare directory name matches nothing, so
      // both lists must spell out the extensions they mean. "src" alone used
      // to drag every non-source file under src into the report at 0%.
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.spec.{ts,tsx}",
        "src/main.tsx",
        "src/test-setup.ts",
      ],
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["html", "json", "json-summary"],
      // Floors sit just under current coverage so a regression fails the build
      // without blocking day-to-day work. Raise them as coverage improves.
      thresholds: {
        branches: 82,
        functions: 89,
        lines: 87,
        statements: 85,
      },
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
  },
});
