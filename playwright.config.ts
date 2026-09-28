import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "corepack pnpm --filter @ottv2/web dev --host 127.0.0.1 --port 4173", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
  use: {
  baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
});
