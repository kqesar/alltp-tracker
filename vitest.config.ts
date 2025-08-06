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
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
  },
});
