import { defineConfig, devices } from "@playwright/test";

// Real-browser validation tier. Deliberately narrow: one browser (chromium),
// no screenshot suite, no device matrix. It boots the harness Vite server
// (vite.harness.config.js) and drives the real studio + designer surfaces to
// prove the production failure mechanisms build/lint/unit tests cannot:
// surface mount, inline text commit, pointer drag, and muted video readiness.
export default defineConfig({
  testDir: "./browser-tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // no global retries — a browser failure must be a real, actionable failure
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:4321",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npx vite --config vite.harness.config.js",
    url: "http://localhost:4321/studio.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
