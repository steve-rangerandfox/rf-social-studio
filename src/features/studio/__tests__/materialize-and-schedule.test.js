import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser-only side effects so the materialization/scheduling logic is
// testable without a canvas or a network.
vi.mock("../carouselRender.js", () => ({
  renderCarouselSlidesToFiles: vi.fn(),
}));
vi.mock("../../../lib/supabase.js", () => ({
  uploadAssetWithProgress: vi.fn(),
}));

import { renderCarouselSlidesToFiles } from "../carouselRender.js";
import { uploadAssetWithProgress } from "../../../lib/supabase.js";
import {
  needsCarouselMaterialization,
  materializeCarouselSlides,
  materializeForSchedule,
} from "../materialize-designed-media.js";
import { resolvePublishPlan } from "../publish-policy.js";

const H = "https://cdn.example.com";
const slidesRow = () => ({
  id: "r1",
  platform: "ig_post",
  caption: "hi",
  carouselSlides: [{ layout: "title", title: "a" }, { layout: "title", title: "b" }],
});

beforeEach(() => {
  renderCarouselSlidesToFiles.mockReset();
  uploadAssetWithProgress.mockReset();
});

describe("needsCarouselMaterialization", () => {
  it("true for legacy slides with no rendered frames", () => {
    expect(needsCarouselMaterialization(slidesRow())).toBe(true);
  });
  it("false once carouselFrameUrls exist", () => {
    expect(needsCarouselMaterialization({ ...slidesRow(), carouselFrameUrls: [`${H}/1.jpg`, `${H}/2.jpg`] })).toBe(false);
  });
  it("false without slides", () => {
    expect(needsCarouselMaterialization({ platform: "ig_post" })).toBe(false);
  });
});

describe("materializeCarouselSlides", () => {
  it("renders and uploads slides in stable order", async () => {
    renderCarouselSlidesToFiles.mockResolvedValue(["fileA", "fileB"]);
    uploadAssetWithProgress
      .mockResolvedValueOnce(`${H}/a.jpg`)
      .mockResolvedValueOnce(`${H}/b.jpg`);

    const out = await materializeCarouselSlides(slidesRow());
    expect(out.imageUrls).toEqual([`${H}/a.jpg`, `${H}/b.jpg`]);
    expect(out.patch.carouselFrameUrls).toEqual([`${H}/a.jpg`, `${H}/b.jpg`]);
    expect(out.patch.mediaKind).toBe("carousel");
    expect(out.transientMedia).toEqual({ images: [`${H}/a.jpg`, `${H}/b.jpg`], video: null });
  });
});

describe("materializeForSchedule — media-only (no scheduled-state decision)", () => {
  it("returns the media patch (carouselFrameUrls) and NO status/scheduledAt", async () => {
    renderCarouselSlidesToFiles.mockResolvedValue(["fileA", "fileB"]);
    uploadAssetWithProgress.mockResolvedValueOnce(`${H}/a.jpg`).mockResolvedValueOnce(`${H}/b.jpg`);

    const patch = await materializeForSchedule(slidesRow());
    expect(patch.carouselFrameUrls).toEqual([`${H}/a.jpg`, `${H}/b.jpg`]);
    // Ownership boundary: materialization must not decide scheduled lifecycle.
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("scheduledAt");
  });

  it("throws when rendering fails — caller leaves the row unscheduled", async () => {
    renderCarouselSlidesToFiles.mockRejectedValue(new Error("canvas blocked"));
    await expect(materializeForSchedule(slidesRow())).rejects.toThrow();
  });

  it("returns null when no materialization is needed (no upload)", async () => {
    const patch = await materializeForSchedule({ platform: "ig_post", mediaUrl: `${H}/x.jpg` });
    expect(patch).toBeNull();
    expect(uploadAssetWithProgress).not.toHaveBeenCalled();
  });
});

describe("legacy carouselSlides immediate compatibility", () => {
  it("materialized transient media resolves to a CAROUSEL plan", async () => {
    renderCarouselSlidesToFiles.mockResolvedValue(["fileA", "fileB"]);
    uploadAssetWithProgress.mockResolvedValueOnce(`${H}/a.jpg`).mockResolvedValueOnce(`${H}/b.jpg`);

    const { transientMedia } = await materializeCarouselSlides(slidesRow());
    const plan = resolvePublishPlan({ row: slidesRow(), transientMedia });
    expect(plan.mediaType).toBe("CAROUSEL");
    expect(plan.provenance).toBe("session");
    expect(plan.operations[0].imageUrls).toEqual([`${H}/a.jpg`, `${H}/b.jpg`]);
  });
});

describe("pre-existing scheduled carouselSlides-only row (scheduled path, no browser)", () => {
  it("fails cleanly with CAROUSEL_NOT_RENDERED instead of publishing wrong media", () => {
    // The scheduled worker has no transient media and cannot render in Node.
    const plan = resolvePublishPlan({ row: { ...slidesRow(), mediaKind: "carousel" } });
    expect(plan.invalid.code).toBe("CAROUSEL_NOT_RENDERED");
  });
});
