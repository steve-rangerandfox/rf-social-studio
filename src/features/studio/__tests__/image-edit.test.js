import { describe, it, expect } from "vitest";
import { rotatedDims, cropRectPx, clampCrop } from "../image-edit.js";

// Pure math behind the Edit Image modal (crop / rotate / flip). The
// canvas glue lives in EditImageModal; these invariants keep the export
// from drifting off the visible crop box.

describe("rotatedDims", () => {
  it("keeps dimensions at 0 and 180 degrees", () => {
    expect(rotatedDims(400, 300, 0)).toEqual({ w: 400, h: 300 });
    expect(rotatedDims(400, 300, 180)).toEqual({ w: 400, h: 300 });
  });
  it("swaps dimensions at 90 and 270 degrees", () => {
    expect(rotatedDims(400, 300, 90)).toEqual({ w: 300, h: 400 });
    expect(rotatedDims(400, 300, 270)).toEqual({ w: 300, h: 400 });
  });
});

describe("cropRectPx", () => {
  it("maps a normalized crop to pixel coordinates", () => {
    expect(cropRectPx({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 400, 200))
      .toEqual({ sx: 100, sy: 50, sw: 200, sh: 100 });
  });
  it("never collapses below 1px", () => {
    const r = cropRectPx({ x: 0, y: 0, w: 0.0001, h: 0.0001 }, 100, 100);
    expect(r.sw).toBeGreaterThanOrEqual(1);
    expect(r.sh).toBeGreaterThanOrEqual(1);
  });
});

describe("clampCrop", () => {
  it("keeps the box inside the unit square", () => {
    const r = clampCrop({ x: -0.2, y: 0.8, w: 0.5, h: 0.5 });
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y + r.h).toBeLessThanOrEqual(1.0001);
    expect(r.w).toBeCloseTo(0.5, 5);
  });
  it("shrinks an oversized box to fit", () => {
    const r = clampCrop({ x: 0, y: 0, w: 1.4, h: 0.5 });
    expect(r.w).toBeLessThanOrEqual(1);
  });
  it("enforces a minimum size so the box stays grabbable", () => {
    const r = clampCrop({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 });
    expect(r.w).toBeGreaterThanOrEqual(0.05);
    expect(r.h).toBeGreaterThanOrEqual(0.05);
  });
});
