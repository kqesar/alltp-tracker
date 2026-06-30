import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    mainFields: ["module"],
  },
  test: {
    coverage: {
      exclude: ["src/interfaces", "src/vite-*.ts", "src/main.tsx"],
      include: ["src"],
      reporter: ["html", "json", "json-summary"],
      // Floor thresholds (just below current coverage) to catch regressions
      // without blocking day-to-day work. Raise these as coverage improves.
      thresholds: {
        branches: 55,
        functions: 80,
        lines: 75,
        statements: 72,
      },
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
  },
});
