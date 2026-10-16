import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
// The production build, served under the GitHub Pages base path it ships with
const BASE_URL = `http://localhost:${PORT}/alltp-tracker/`;
const CI = Boolean(process.env.CI);

export default defineConfig({
  forbidOnly: CI,
  fullyParallel: true,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // GitHub runners ship Google Chrome: using it skips the browser
        // download, which would otherwise dominate the job's run time.
        channel: CI ? "chrome" : undefined,
      },
    },
  ],
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  // A flaky browser test is a defect to fix, not to retry away
  retries: 0,
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    reuseExistingServer: !CI,
    url: BASE_URL,
  },
});
