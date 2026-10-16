import { defineConfig, devices } from "@playwright/test";

// Worktrees that run the suite side by side each pass their own E2E_PORT
const PORT = Number(process.env.E2E_PORT ?? 4173);
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
    // Never test a server this run did not start: one left on the port by
    // another worktree or an earlier run serves some other build. With
    // --strictPort, a busy port fails the run instead.
    reuseExistingServer: false,
    url: BASE_URL,
  },
});
