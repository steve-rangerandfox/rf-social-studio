import { test, expect } from "@playwright/test";

// Scenario 1 — Studio shell mount.
// Proves the real StudioApp surface (StudioProvider + StudioShell) mounts in a
// browser without an uncaught runtime error. This is the failure class
// build/lint/unit tests cannot catch (CLAUDE.md).
test("studio shell mounts without uncaught runtime errors", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/studio.html");

  // Explicit application-ready condition: the shell chrome actually rendered.
  await expect(
    page.locator(".app main.main"),
    "studio shell (.app main.main) never rendered — mount failed",
  ).toBeVisible();

  // Diagnostic only: async rejections (e.g. the harness's absent backend) are
  // logged, not asserted, so a degraded backend can't masquerade as a mount
  // crash. The mount-crash signal is an uncaught page error.
  const asyncErrors = await page.evaluate(() => window.__HARNESS_ERRORS__ || []);
  if (asyncErrors.length) console.log("studio async rejections (diagnostic):", asyncErrors);

  expect(
    pageErrors,
    `uncaught page errors during studio mount: ${pageErrors.join(" | ")}`,
  ).toEqual([]);
});
