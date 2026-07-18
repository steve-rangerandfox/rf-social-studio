import { describe, it, expect } from "vitest";

import { resolvePublishPlan, INVALID_CODES } from "../publish-policy.js";
import { IG_PUBLISH_MAX_CAPTION } from "../../../lib/publishing-constants.js";

const H = "https://cdn.example.com"; // valid https prefix
const img = (n) => `${H}/img-${n}.jpg`;
const vid = (n) => `${H}/vid-${n}.mp4`;

describe("resolvePublishPlan — platform gate", () => {
  it("rejects unsupported platforms", () => {
    expect(resolvePublishPlan({ row: { platform: "linkedin", caption: "hi" } }).invalid.code).toBe(INVALID_CODES.UNSUPPORTED_PLATFORM);
    expect(resolvePublishPlan({ row: { platform: "tiktok" } }).invalid.code).toBe(INVALID_CODES.UNSUPPORTED_PLATFORM);
    expect(resolvePublishPlan({ row: null }).invalid.code).toBe(INVALID_CODES.UNSUPPORTED_PLATFORM);
  });
});

describe("feed image/video — source precedence & provenance", () => {
  it("session transient image wins as IMAGE", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_post", mediaUrl: img("stored"), caption: "c" },
      transientMedia: { images: [img("session")], video: null },
    });
    expect(plan.provenance).toBe("session");
    expect(plan.mediaType).toBe("IMAGE");
    expect(plan.operations).toEqual([{ mediaType: "IMAGE", imageUrl: img("session"), caption: "c" }]);
  });

  it("session transient video wins as VIDEO", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_post", caption: "c" },
      transientMedia: { images: [], video: vid("s") },
    });
    expect(plan.provenance).toBe("session");
    expect(plan.mediaType).toBe("VIDEO");
    expect(plan.operations).toEqual([{ mediaType: "VIDEO", videoUrl: vid("s"), caption: "c" }]);
  });

  it("stored video feed post maps to VIDEO (matches immediate)", () => {
    const plan = resolvePublishPlan({ row: { platform: "ig_post", mediaKind: "video", mediaUrl: vid("v"), caption: "c" } });
    expect(plan.provenance).toBe("stored_media");
    expect(plan.mediaType).toBe("VIDEO");
    expect(plan.operations[0]).toEqual({ mediaType: "VIDEO", videoUrl: vid("v"), caption: "c" });
  });

  it("stored image feed post maps to IMAGE", () => {
    const plan = resolvePublishPlan({ row: { platform: "ig_post", mediaUrl: img("m"), caption: "c" } });
    expect(plan.provenance).toBe("stored_media");
    expect(plan.mediaType).toBe("IMAGE");
  });

  it("falls back to raw gallery image", () => {
    const plan = resolvePublishPlan({ row: { platform: "ig_post", mediaKind: "image", mediaItems: [{ url: img("g"), kind: "image" }], caption: "c" } });
    expect(plan.provenance).toBe("raw_gallery");
    expect(plan.mediaType).toBe("IMAGE");
    expect(plan.operations[0].imageUrl).toBe(img("g"));
  });

  it("returns NO_MEDIA when nothing resolves", () => {
    expect(resolvePublishPlan({ row: { platform: "ig_post", caption: "c" } }).invalid.code).toBe(INVALID_CODES.NO_MEDIA);
  });
});

describe("carousel classification", () => {
  it("explicit mediaKind carousel uses designed carouselFrameUrls in order", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_post", mediaKind: "carousel", carouselFrameUrls: [img(1), img(2), img(3)], caption: "c" },
    });
    expect(plan.mediaType).toBe("CAROUSEL");
    expect(plan.provenance).toBe("designed_carousel");
    expect(plan.operations).toEqual([{ mediaType: "CAROUSEL", imageUrls: [img(1), img(2), img(3)], caption: "c" }]);
  });

  it("explicit carousel with no rendered frames → CAROUSEL_NOT_RENDERED", () => {
    expect(resolvePublishPlan({ row: { platform: "ig_post", mediaKind: "carousel", caption: "c" } }).invalid.code)
      .toBe(INVALID_CODES.CAROUSEL_NOT_RENDERED);
  });

  it("legacy inference: absent mediaKind + 2+ gallery images → carousel", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_post", mediaItems: [{ url: img(1), kind: "image" }, { url: img(2), kind: "image" }], caption: "c" },
    });
    expect(plan.mediaType).toBe("CAROUSEL");
    expect(plan.provenance).toBe("raw_gallery");
  });

  it("explicitly non-carousel post with multiple gallery images stays single", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_post", mediaKind: "image", mediaUrl: img("main"), mediaItems: [{ url: img(1), kind: "image" }, { url: img(2), kind: "image" }], caption: "c" },
    });
    expect(plan.mediaType).toBe("IMAGE");
    expect(plan.operations[0].imageUrl).toBe(img("main"));
  });

  it("session multi-image is explicit carousel intent (overrides mediaKind)", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_post", mediaKind: "image", caption: "c" },
      transientMedia: { images: [img(1), img(2)], video: null },
    });
    expect(plan.mediaType).toBe("CAROUSEL");
    expect(plan.provenance).toBe("session");
  });

  it("enforces 2–10 without truncation", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => img(i));
    expect(resolvePublishPlan({ row: { platform: "ig_post", mediaKind: "carousel", carouselFrameUrls: eleven, caption: "c" } }).invalid.code)
      .toBe(INVALID_CODES.CAROUSEL_TOO_MANY);
    expect(resolvePublishPlan({ row: { platform: "ig_post", mediaKind: "carousel", carouselFrameUrls: [img(1)], caption: "c" } }).invalid.code)
      .toBe(INVALID_CODES.CAROUSEL_TOO_FEW);
  });

  it("does not silently drop the 11th image", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => img(i));
    const plan = resolvePublishPlan({ row: { platform: "ig_post", mediaKind: "carousel", carouselFrameUrls: eleven, caption: "c" } });
    expect(plan.operations).toBeUndefined();
    expect(plan.invalid.message).toContain("11");
  });
});

describe("reel", () => {
  it("maps to REELS from stored video", () => {
    const plan = resolvePublishPlan({ row: { platform: "ig_reel", videoUrl: vid("r"), caption: "c" } });
    expect(plan.mediaType).toBe("REELS");
    expect(plan.operations[0]).toEqual({ mediaType: "REELS", videoUrl: vid("r"), caption: "c" });
  });

  it("requires a video (MISSING_VIDEO)", () => {
    expect(resolvePublishPlan({ row: { platform: "ig_reel", caption: "c" } }).invalid.code).toBe(INVALID_CODES.MISSING_VIDEO);
  });

  it("image-only transient for a reel is TYPE_INCOMPATIBLE_MEDIA", () => {
    expect(resolvePublishPlan({ row: { platform: "ig_reel", caption: "c" }, transientMedia: { images: [img(1)], video: null } }).invalid.code)
      .toBe(INVALID_CODES.TYPE_INCOMPATIBLE_MEDIA);
  });
});

describe("story — order preservation", () => {
  it("designed storyFrames in order with per-frame kind", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_story", storyFrames: [{ url: img(1), kind: "image" }, { url: vid(2), kind: "video" }] },
    });
    expect(plan.provenance).toBe("designed_story");
    expect(plan.operations).toEqual([
      { mediaType: "STORIES", imageUrl: img(1), caption: "" },
      { mediaType: "STORIES", videoUrl: vid(2), caption: "" },
    ]);
  });

  it("legacy storyFrameUrls preserved and NOT collapsed by a stored mediaUrl", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_story", storyFrameUrls: [img(1), img(2), img(3)], mediaUrl: img("poster") },
    });
    expect(plan.provenance).toBe("legacy_story_frames");
    expect(plan.operations).toHaveLength(3);
    expect(plan.operations.map((o) => o.imageUrl)).toEqual([img(1), img(2), img(3)]);
  });

  it("stored single-media fallback only when both frame arrays empty", () => {
    const plan = resolvePublishPlan({ row: { platform: "ig_story", mediaUrl: img("solo") } });
    expect(plan.provenance).toBe("stored_media");
    expect(plan.operations).toEqual([{ mediaType: "STORIES", imageUrl: img("solo"), caption: "" }]);
  });

  it("NO_MEDIA when a story has nothing", () => {
    expect(resolvePublishPlan({ row: { platform: "ig_story" } }).invalid.code).toBe(INVALID_CODES.NO_MEDIA);
  });
});

describe("caption limit", () => {
  it("CAPTION_TOO_LONG beyond the shared limit", () => {
    const long = "x".repeat(IG_PUBLISH_MAX_CAPTION + 1);
    expect(resolvePublishPlan({ row: { platform: "ig_post", mediaUrl: img(1), caption: long } }).invalid.code)
      .toBe(INVALID_CODES.CAPTION_TOO_LONG);
  });

  it("trims caption into operations", () => {
    const plan = resolvePublishPlan({ row: { platform: "ig_post", mediaUrl: img(1), caption: "  hi  " } });
    expect(plan.operations[0].caption).toBe("hi");
  });
});

describe("URL validity", () => {
  it("MALFORMED_URL for a non-URL single media", () => {
    expect(resolvePublishPlan({ row: { platform: "ig_post", mediaUrl: "not a url" } }).invalid.code).toBe(INVALID_CODES.MALFORMED_URL);
  });

  it("NON_HTTPS_URL for http media", () => {
    expect(resolvePublishPlan({ row: { platform: "ig_post", mediaUrl: "http://x.com/a.jpg" } }).invalid.code).toBe(INVALID_CODES.NON_HTTPS_URL);
  });

  it("INVALID_FRAME_URL identifies the bad carousel frame index", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_post", mediaKind: "carousel", carouselFrameUrls: [img(1), "http://x/b.jpg", img(3)], caption: "c" },
    });
    expect(plan.invalid.code).toBe(INVALID_CODES.INVALID_FRAME_URL);
    expect(plan.invalid.message).toContain("Frame 2");
  });

  it("INVALID_FRAME_URL identifies the bad story frame index", () => {
    const plan = resolvePublishPlan({
      row: { platform: "ig_story", storyFrames: [{ url: img(1), kind: "image" }, { url: "bad", kind: "image" }] },
    });
    expect(plan.invalid.code).toBe(INVALID_CODES.INVALID_FRAME_URL);
    expect(plan.invalid.message).toContain("Frame 2");
  });
});

describe("determinism", () => {
  it("returns the same result for identical inputs", () => {
    const row = { platform: "ig_post", mediaKind: "carousel", carouselFrameUrls: [img(1), img(2)], caption: "hi" };
    expect(resolvePublishPlan({ row })).toEqual(resolvePublishPlan({ row }));
  });
});
