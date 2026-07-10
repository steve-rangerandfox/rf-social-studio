import { describe, it, expect } from "vitest";
import { validateCaptionRequest } from "../validate.js";

// The alt_text intent (media viewer "Generate with AI") sends an image
// URL for Claude vision to describe. Pin its request contract.

describe("validateCaptionRequest — alt_text", () => {
  it("accepts a well-formed alt_text request", () => {
    const r = validateCaptionRequest({ intent: "alt_text", imageUrl: "https://cdn.example/img.png" });
    expect(r.valid).toBe(true);
  });

  it("requires an https image url", () => {
    expect(validateCaptionRequest({ intent: "alt_text" }).valid).toBe(false);
    expect(validateCaptionRequest({ intent: "alt_text", imageUrl: "http://cdn.example/img.png" }).valid).toBe(false);
    expect(validateCaptionRequest({ intent: "alt_text", imageUrl: "blob:foo" }).valid).toBe(false);
  });

  it("rejects an oversized url", () => {
    const r = validateCaptionRequest({ intent: "alt_text", imageUrl: "https://cdn.example/" + "a".repeat(2100) });
    expect(r.valid).toBe(false);
  });

  it("still rejects unknown intents", () => {
    expect(validateCaptionRequest({ intent: "nope" }).valid).toBe(false);
  });
});
