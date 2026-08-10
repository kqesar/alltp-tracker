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
