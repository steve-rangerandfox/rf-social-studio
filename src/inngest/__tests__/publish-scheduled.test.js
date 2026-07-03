import { describe, it, expect, vi } from "vitest";

import {
  MAX_LATE_MS,
  platformToMediaType,
  findDueRows,
  findDueLinkedInRows,
  resolveStoryFrames,
  resolveCarouselFrames,
  applyRowPatches,
  saveDocumentWithRetry,
} from "../publish-scheduled.js";

describe("platformToMediaType", () => {
  it("maps ig_reel to REELS", () => {
    expect(platformToMediaType("ig_reel")).toBe("REELS");
  });

  it("maps ig_story to STORIES", () => {
    expect(platformToMediaType("ig_story")).toBe("STORIES");
  });

  it("maps ig_post to IMAGE", () => {
    expect(platformToMediaType("ig_post")).toBe("IMAGE");
  });

  it("defaults unknown platforms to IMAGE", () => {
    expect(platformToMediaType("tiktok")).toBe("IMAGE");
    expect(platformToMediaType(undefined)).toBe("IMAGE");
    expect(platformToMediaType("")).toBe("IMAGE");
  });
});

describe("resolveStoryFrames", () => {
  it("returns each frame with its kind for a multi-canvas story", () => {
    expect(resolveStoryFrames({
      platform: "ig_story",
      storyFrames: [
        { url: "a.png", kind: "image" },
        { url: "clip.mp4", kind: "video" },
        { url: "c.png", kind: "image" },
      ],
    })).toEqual([
      { url: "a.png", kind: "image" },
      { url: "clip.mp4", kind: "video" },
      { url: "c.png", kind: "image" },
    ]);
  });

  it("drops frames without a url and defaults an unknown kind to image", () => {
    expect(resolveStoryFrames({
      platform: "ig_story",
      storyFrames: [{ url: "a.png" }, { kind: "video" }, null, { url: "b.png", kind: "weird" }],
    })).toEqual([
      { url: "a.png", kind: "image" },
      { url: "b.png", kind: "image" },
    ]);
  });

  it("falls back to legacy storyFrameUrls as image frames", () => {
    expect(resolveStoryFrames({
      platform: "ig_story",
      storyFrameUrls: ["a.png", null, "b.png"],
    })).toEqual([
      { url: "a.png", kind: "image" },
      { url: "b.png", kind: "image" },
    ]);
  });

  it("falls back to the single mediaUrl when a story has no frame array", () => {
    expect(resolveStoryFrames({ platform: "ig_story", mediaUrl: "solo.png" })).toEqual([{ url: "solo.png", kind: "image" }]);
    expect(resolveStoryFrames({ platform: "ig_story", storyFrames: [], mediaUrl: "solo.png" })).toEqual([{ url: "solo.png", kind: "image" }]);
  });

  it("ignores story frames for non-story platforms (single media only)", () => {
    expect(resolveStoryFrames({
      platform: "ig_post",
      storyFrames: [{ url: "a.png", kind: "image" }, { url: "b.png", kind: "image" }],
      mediaUrl: "post.png",
    })).toEqual([{ url: "post.png", kind: "image" }]);
  });

  it("returns [] when there is no media at all", () => {
    expect(resolveStoryFrames({ platform: "ig_story" })).toEqual([]);
    expect(resolveStoryFrames({ platform: "ig_post" })).toEqual([]);
  });

  it("uses imageUrl as a last-resort single fallback", () => {
    expect(resolveStoryFrames({ platform: "ig_post", imageUrl: "img.png" })).toEqual([{ url: "img.png", kind: "image" }]);
  });
});

describe("resolveCarouselFrames", () => {
  it("returns rendered slide URLs for a carousel row", () => {
    expect(resolveCarouselFrames({
      mediaKind: "carousel",
      carouselFrameUrls: ["s1.jpg", "s2.jpg", "s3.jpg"],
    })).toEqual(["s1.jpg", "s2.jpg", "s3.jpg"]);
  });

  it("drops empty entries", () => {
    expect(resolveCarouselFrames({
      mediaKind: "carousel",
      carouselFrameUrls: ["s1.jpg", null, "", "s2.jpg"],
    })).toEqual(["s1.jpg", "s2.jpg"]);
  });

  it("returns [] for an un-rendered carousel (frames cleared or never rendered)", () => {
    expect(resolveCarouselFrames({ mediaKind: "carousel" })).toEqual([]);
    expect(resolveCarouselFrames({ mediaKind: "carousel", carouselFrameUrls: null })).toEqual([]);
  });

  it("returns [] for non-carousel rows even if frame URLs are present", () => {
    expect(resolveCarouselFrames({ carouselFrameUrls: ["s1.jpg", "s2.jpg"] })).toEqual([]);
    expect(resolveCarouselFrames({ mediaKind: "single", carouselFrameUrls: ["s1.jpg"] })).toEqual([]);
  });
});

describe("findDueRows", () => {
  const now = Date.now();
  const oneMin = 60_000;

  function row(overrides = {}) {
    return {
      id: "r",
      platform: "ig_post",
      status: "scheduled",
      scheduledAt: new Date(now - oneMin).toISOString(),
      deletedAt: null,
      ...overrides,
    };
  }

  it("returns [] for empty / malformed document", () => {
    expect(findDueRows(null)).toEqual([]);
    expect(findDueRows(undefined)).toEqual([]);
    expect(findDueRows({})).toEqual([]);
    expect(findDueRows({ rows: "nope" })).toEqual([]);
  });

  it("includes a row whose scheduledAt is within the grace window", () => {
    const result = findDueRows({ rows: [row()] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r");
  });

  it("excludes soft-deleted rows", () => {
    const result = findDueRows({
      rows: [row({ id: "a" }), row({ id: "b", deletedAt: new Date().toISOString() })],
    });
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("excludes rows not in 'scheduled' status", () => {
    for (const status of ["idea", "draft", "needs_review", "approved", "posted"]) {
      const result = findDueRows({ rows: [row({ status })] });
      expect(result).toEqual([]);
    }
  });

  it("excludes non-IG platforms", () => {
    for (const platform of ["linkedin", "tiktok", "facebook"]) {
      const result = findDueRows({ rows: [row({ platform })] });
      expect(result).toEqual([]);
    }
  });

  it("excludes rows in manual publish mode (user posts by hand)", () => {
    expect(findDueRows({ rows: [row({ publishMode: "manual" })] })).toEqual([]);
    // auto / unset still publishes
    expect(findDueRows({ rows: [row({ publishMode: "auto" })] })).toHaveLength(1);
    expect(findDueRows({ rows: [row()] })).toHaveLength(1);
  });

  it("excludes rows without scheduledAt", () => {
    expect(findDueRows({ rows: [row({ scheduledAt: null })] })).toEqual([]);
    expect(findDueRows({ rows: [row({ scheduledAt: undefined })] })).toEqual([]);
  });

  it("excludes rows more than MAX_LATE_MS in the past", () => {
    const tooStale = new Date(now - MAX_LATE_MS - oneMin).toISOString();
    expect(findDueRows({ rows: [row({ scheduledAt: tooStale })] })).toEqual([]);
  });

  it("excludes rows whose scheduledAt is in the future", () => {
    const future = new Date(now + oneMin).toISOString();
    expect(findDueRows({ rows: [row({ scheduledAt: future })] })).toEqual([]);
  });

  it("includes all three IG platforms when scheduled and due", () => {
    const result = findDueRows({
      rows: [
        row({ id: "p", platform: "ig_post" }),
        row({ id: "r", platform: "ig_reel" }),
        row({ id: "s", platform: "ig_story" }),
      ],
    });
    expect(result.map((r) => r.id).sort()).toEqual(["p", "r", "s"]);
  });
});

describe("findDueLinkedInRows", () => {
  const now = Date.now();
  const oneMin = 60_000;

  function liRow(overrides = {}) {
    return {
      id: "li",
      platform: "linkedin",
      status: "scheduled",
      caption: "A real LinkedIn post.",
      scheduledAt: new Date(now - oneMin).toISOString(),
      deletedAt: null,
      ...overrides,
    };
  }

  it("includes a LinkedIn row with caption + due scheduledAt", () => {
    expect(findDueLinkedInRows({ rows: [liRow()] })).toHaveLength(1);
  });

  it("excludes rows without a caption", () => {
    expect(findDueLinkedInRows({ rows: [liRow({ caption: "" })] })).toEqual([]);
    expect(findDueLinkedInRows({ rows: [liRow({ caption: "   " })] })).toEqual([]);
  });

  it("excludes non-LinkedIn platforms", () => {
    for (const platform of ["ig_post", "ig_reel", "ig_story", "tiktok", "facebook"]) {
      expect(findDueLinkedInRows({ rows: [liRow({ platform })] })).toEqual([]);
    }
  });

  it("excludes non-scheduled statuses", () => {
    for (const status of ["idea", "draft", "needs_review", "approved", "posted"]) {
      expect(findDueLinkedInRows({ rows: [liRow({ status })] })).toEqual([]);
    }
  });

  it("excludes soft-deleted rows", () => {
    expect(findDueLinkedInRows({ rows: [liRow({ deletedAt: new Date().toISOString() })] })).toEqual([]);
  });

  it("excludes rows more than MAX_LATE_MS in the past", () => {
    const tooStale = new Date(now - MAX_LATE_MS - oneMin).toISOString();
    expect(findDueLinkedInRows({ rows: [liRow({ scheduledAt: tooStale })] })).toEqual([]);
  });
});

describe("applyRowPatches", () => {
  it("applies patches in order and preserves untouched rows/fields", () => {
    const doc = { rows: [
      { id: "a", status: "scheduled", caption: "hi" },
      { id: "b", status: "scheduled", caption: "yo" },
    ] };
    const result = applyRowPatches(doc, [
      { rowId: "a", patch: { status: "posted", igPostId: "m1" } },
    ]);
    expect(result.rows[0]).toEqual({ id: "a", status: "posted", caption: "hi", igPostId: "m1" });
    expect(result.rows[1]).toEqual({ id: "b", status: "scheduled", caption: "yo" });
    expect(doc.rows[0].status).toBe("scheduled"); // input untouched
  });
});

// Minimal supabase mock: `update` outcomes are scripted per call; `select`
// (the conflict refetch) returns the given fresh record.
function mockSupabase({ updateResults, fresh }) {
  const updateCalls = [];
  return {
    updateCalls,
    from() {
      return {
        update(payload) {
          updateCalls.push(payload);
          const result = updateResults[updateCalls.length - 1] ?? { error: null };
          return { eq() { return { eq() { return Promise.resolve(result); } }; } };
        },
        select() {
          return { eq() { return { maybeSingle: () => Promise.resolve(fresh) }; } };
        },
      };
    },
  };
}

const silentLogger = { warn: vi.fn(), error: vi.fn() };

describe("saveDocumentWithRetry", () => {
  const patches = [{ rowId: "a", patch: { status: "posted", igPostId: "m1" } }];
  const patchedDoc = { rows: [{ id: "a", status: "posted", igPostId: "m1" }] };

  it("returns true on a clean first save", async () => {
    const supabase = mockSupabase({ updateResults: [{ error: null }] });
    const ok = await saveDocumentWithRetry({ supabase, ownerUserId: "u", document: patchedDoc, version: 3, rowPatches: patches, logger: silentLogger });
    expect(ok).toBe(true);
    expect(supabase.updateCalls).toHaveLength(1);
    expect(supabase.updateCalls[0].version).toBe(4);
  });

  it("re-merges publish outcomes onto the fresh document after a version conflict", async () => {
    // Concurrent user edit changed the caption AND bumped the version.
    const freshDoc = { rows: [{ id: "a", status: "scheduled", caption: "edited meanwhile" }] };
    const supabase = mockSupabase({
      updateResults: [{ error: { message: "version conflict" } }, { error: null }],
      fresh: { data: { document: freshDoc, version: 7 }, error: null },
    });
    const ok = await saveDocumentWithRetry({ supabase, ownerUserId: "u", document: patchedDoc, version: 3, rowPatches: patches, logger: silentLogger });
    expect(ok).toBe(true);
    expect(supabase.updateCalls).toHaveLength(2);
    // Second write targets the fresh version and carries BOTH the user's
    // concurrent edit and the authoritative publish outcome.
    expect(supabase.updateCalls[1].version).toBe(8);
    expect(supabase.updateCalls[1].document.rows[0]).toEqual({
      id: "a", status: "posted", caption: "edited meanwhile", igPostId: "m1",
    });
  });

  it("gives up after the attempt budget and returns false", async () => {
    const supabase = mockSupabase({
      updateResults: [{ error: { message: "x" } }, { error: { message: "x" } }, { error: { message: "x" } }],
      fresh: { data: null, error: { message: "read failed" } },
    });
    const ok = await saveDocumentWithRetry({ supabase, ownerUserId: "u", document: patchedDoc, version: 3, rowPatches: patches, logger: silentLogger, attempts: 3 });
    expect(ok).toBe(false);
    expect(supabase.updateCalls).toHaveLength(3);
  });
});
