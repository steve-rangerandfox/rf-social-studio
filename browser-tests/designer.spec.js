import { test, expect } from "@playwright/test";
import { TEXT_ELEMENT_ID, VIDEO_ELEMENT_ID } from "../browser-harness/fixture-row.js";

const CANVAS = '.canvas[aria-label="Story canvas"]';
// Elements are rendered both in the main editing canvas and in the page-board
// thumbnail, so every element locator is scoped to the main canvas.
const TEXT = `${CANVAS} [data-elid="${TEXT_ELEMENT_ID}"]`;
const VIDEO = `${CANVAS} [data-elid="${VIDEO_ELEMENT_ID}"]`;

async function gotoDesigner(page) {
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/designer.html");
  // Explicit designer-ready condition: the real canvas rendered with elements.
  await expect(
    page.locator(CANVAS),
    "designer canvas never rendered — designer mount failed",
  ).toBeVisible();
  await expect(page.locator(TEXT), "fixture text element missing on canvas").toBeVisible();
  return pageErrors;
}

// Scenario 2 — Designer mount.
test("story designer mounts without uncaught runtime errors", async ({ page }) => {
  const pageErrors = await gotoDesigner(page);
  await expect(page.locator(VIDEO)).toBeVisible();
  expect(
    pageErrors,
    `uncaught page errors during designer mount: ${pageErrors.join(" | ")}`,
  ).toEqual([]);
});

// Scenario 3 — Text commit + click-out/focus transition.
// Guards the documented invariant: inline text commits on every keystroke, so a
// click-out that clears editing (and may swallow blur in Chrome) must NOT lose
// the edit. If the app regressed to blur-only commit, the text would revert to
// the fixture's original and this fails.
test("committed text survives the click-out transition", async ({ page }) => {
  await gotoDesigner(page);

  await page.locator(TEXT).dblclick(); // enter inline edit (onStartEdit for text)
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Committed-Edit-42");

  // Real click-out onto empty canvas — the transition target that clears
  // editingId before blur can fire.
  await page.locator(CANVAS).click({ position: { x: 6, y: 6 } });

  await expect(
    page.locator(TEXT),
    "committed text was lost on click-out — keystroke-commit invariant broken",
  ).toContainText("Committed-Edit-42");
});

// Scenario 4 — Pointer/drag interaction (real events, not state mutation).
// A single real pointerdown+move+up through the product's handleDrag path
// (which both selects and drags). Movement is measured vertically because the
// text and video fixtures share x=60, so the horizontal snap guide would pull
// x back — dy is the unambiguous position-change signal.
test("dragging an element with real pointer events moves it", async ({ page }) => {
  await gotoDesigner(page);

  const el = page.locator(TEXT);
  await el.scrollIntoViewIfNeeded(); // the tall story canvas renders elements below the fold
  const box = await el.boundingBox();
  expect(box, "text element has no box").not.toBeNull();

  // Authoritative canvas-space position (set by the drag's onUpdate({y})).
  // Screen boundingBox is confounded by canvas zoom + the scroll container, so
  // assert on the element's own committed top instead.
  const topBefore = await el.evaluate((n) => parseFloat(n.style.top) || 0);

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY + 90, { steps: 10 }); // > 2px threshold
  await page.mouse.up();

  await expect
    .poll(async () => el.evaluate((n) => parseFloat(n.style.top) || 0), {
      message: "element top did not change after a real pointer drag",
    })
    .toBeGreaterThan(topBefore + 20);
});

// Scenario 5 — Muted preview video readiness (deterministic repo fixture).
// Proves the explicit browser state Relay needs for a usable preview: the
// muted DOM property is truly set (the React-muted-prop autoplay trap) and the
// element decoded a frame (HAVE_CURRENT_DATA) and is actually playing. No
// arbitrary sleeps — polled on real media state.
test("muted preview video reaches a usable, playing readiness state", async ({ page }) => {
  await gotoDesigner(page);

  const video = page.locator(`${VIDEO} video`);
  await expect(video, "preview <video> never mounted").toBeAttached();

  // The muted property (not just the attribute) must be true, or Chromium
  // blocks muted-autoplay and the preview never plays.
  await expect
    .poll(async () => video.evaluate((v) => v.muted), {
      message: "preview video muted property is not set — autoplay would be blocked",
    })
    .toBe(true);

  // Decoded at least the current frame → a usable still preview.
  await expect
    .poll(async () => video.evaluate((v) => v.readyState), {
      message: "preview video never reached HAVE_CURRENT_DATA (readyState >= 2)",
    })
    .toBeGreaterThanOrEqual(2);

  // And it is actually advancing (muted autoplay succeeded).
  await expect
    .poll(async () => video.evaluate((v) => v.currentTime), {
      message: "preview video is not playing (currentTime not advancing)",
    })
    .toBeGreaterThan(0);
});
