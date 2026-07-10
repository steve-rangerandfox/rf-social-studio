import { describe, it, expect } from "vitest";
import { LAYOUT_PRESETS, CAROUSEL_GRADIENTS, layoutElements } from "../carousel-layouts.js";

// The CarouselComposer's 5 slide layouts live on as one-click designer
// presets: layoutElements stamps REAL editable elements (text/shape) in
// canvas units, scaled from the 1080px reference geometry.

describe("LAYOUT_PRESETS", () => {
  it("offers the five carousel layouts", () => {
    expect(LAYOUT_PRESETS.map((p) => p.id)).toEqual(["title", "number", "photo", "quote", "cta"]);
    for (const p of LAYOUT_PRESETS) expect(p.label).toBeTruthy();
  });
});

describe("CAROUSEL_GRADIENTS", () => {
  it("exposes the composer's gradient presets", () => {
    expect(CAROUSEL_GRADIENTS.length).toBeGreaterThanOrEqual(4);
    for (const g of CAROUSEL_GRADIENTS) expect(g).toContain("gradient");
  });
});

describe("layoutElements", () => {
  it("returns a background and editable elements for every layout", () => {
    for (const { id } of LAYOUT_PRESETS) {
      const r = layoutElements(id, 290, 290);
      expect(r.bg, id).toBeTruthy();
      expect(r.elements.length, id).toBeGreaterThan(0);
      for (const el of r.elements) {
        expect(el.id, id).toBeTruthy();
        expect(["text", "shape"]).toContain(el.type);
      }
    }
  });

  it("scales geometry with the canvas size", () => {
    const small = layoutElements("title", 290, 290);
    const big = layoutElements("title", 580, 580);
    const smallHead = small.elements.find((e) => e.type === "text" && e.fontSize > 15);
    const bigHead = big.elements.find((e) => e.type === "text" && e.fontSize > 15);
    expect(bigHead.fontSize).toBeCloseTo(smallHead.fontSize * 2, 5);
    expect(bigHead.x).toBeCloseTo(smallHead.x * 2, 5);
  });

  it("title layout uses the tan gradient background", () => {
    expect(layoutElements("title", 290, 290).bg).toContain("gradient");
  });

  it("quote layout is dark with light text", () => {
    const r = layoutElements("quote", 290, 290);
    expect(r.bg).toBe("#09090b");
    const head = r.elements.find((e) => e.type === "text");
    expect(head.color.toLowerCase()).toBe("#fafafa");
  });

  it("cta layout includes a pill shape under its button text", () => {
    const r = layoutElements("cta", 290, 290);
    const pillIdx = r.elements.findIndex((e) => e.type === "shape");
    const btnTextIdx = r.elements.findIndex((e) => e.type === "text" && /→/.test(e.content));
    expect(pillIdx).toBeGreaterThanOrEqual(0);
    expect(btnTextIdx).toBeGreaterThan(pillIdx); // text sits above the pill
  });

  it("generates fresh element ids on every call", () => {
    const a = layoutElements("title", 290, 290).elements.map((e) => e.id);
    const b = layoutElements("title", 290, 290).elements.map((e) => e.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it("falls back to the title layout for unknown ids", () => {
    expect(layoutElements("nope", 290, 290).bg).toBe(layoutElements("title", 290, 290).bg);
  });
});
