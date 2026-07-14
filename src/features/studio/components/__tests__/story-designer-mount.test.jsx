import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Mount smoke test. A TDZ bug (selectedIdsRef reading selectedIds 200 lines
// before its useState) shipped to prod and crashed the designer ON MOUNT —
// build, unit tests, and lint all passed because nothing ever mounted the
// component. This test exists so that class of failure breaks CI instead.

vi.mock("../../StudioContext.jsx", () => ({
  useStudio: () => ({ brandProfile: {}, updateBrandProfile: vi.fn() }),
}));
vi.mock("../../../../lib/supabase.js", () => ({
  uploadAssetWithProgress: vi.fn(),
  checkFileSize: () => ({ ok: true }),
  fetchAssets: vi.fn(async () => []),
  saveAsset: vi.fn(async () => {}),
}));
vi.mock("../../../../lib/api-client.js", () => ({
  generateStoryTips: vi.fn(async () => ({ tips: [] })),
}));

import { StoryDesigner } from "../StoryDesigner.jsx";

// jsdom has no scrollIntoView; the slides panel scroll-to-center effect
// calls it on mount. Polyfill as a no-op — we're smoke-testing mount, not
// scrolling.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

describe("StoryDesigner", () => {
  it("mounts without throwing (fresh row, no media)", () => {
    const row = {
      id: "r1",
      platforms: ["ig_post"],
      platform: "ig_post",
      mediaItems: [],
      caption: "",
    };
    expect(() =>
      render(<StoryDesigner row={row} onClose={() => {}} onUpdate={() => {}} onSave={() => {}} />),
    ).not.toThrow();
  });

  it("mounts with gallery media seeded onto canvases", () => {
    const row = {
      id: "r2",
      platforms: ["ig_post"],
      platform: "ig_post",
      mediaItems: [
        { url: "https://cdn.example/a.jpg", kind: "image" },
        { url: "https://cdn.example/b.jpg", kind: "image" },
      ],
      caption: "hi",
    };
    expect(() =>
      render(<StoryDesigner row={row} onClose={() => {}} onUpdate={() => {}} onSave={() => {}} />),
    ).not.toThrow();
  });
});
