import { describe, it, expect } from "vitest";
import { normalizeRow, applyRowPatch } from "../document-store.js";

// normalizeRow is a WHITELIST: any field it doesn't copy is silently
// stripped from the row on every patch. These tests pin the fields that
// other parts of the app write (media, carousel, scheduler write-backs)
// so the whitelist can't regress without a failing test.

describe("normalizeRow field preservation", () => {
  const fullRow = () => normalizeRow({
    id: "r1",
    note: "A post",
    platform: "ig_post",
    status: "draft",
    mediaUrl: "https://cdn.example/img.png",
    thumbnailUrl: "https://cdn.example/thumb.png",
    imageUrl: "https://cdn.example/legacy.png",
    videoUrl: "https://cdn.example/vid.mp4",
    mediaKind: "carousel",
    carouselSlides: [{ id: "s1" }, { id: "s2" }],
    tags: ["studio-notes", "design"],
    reelDuration: 42,
    igPostId: "igp_1",
    liPostUrn: "urn:li:share:1",
    liPermalink: "https://linkedin.com/feed/1",
    publishError: "boom",
    publishErrorAt: "2026-06-01T00:00:00.000Z",
    publishMode: "manual",
    storyLink: "https://rangerandfox.tv",
    platforms: ["ig_post", "linkedin"],
  });

  it("keeps media + editorial + scheduler write-back fields", () => {
    const row = fullRow();
    expect(row.mediaUrl).toBe("https://cdn.example/img.png");
    expect(row.thumbnailUrl).toBe("https://cdn.example/thumb.png");
    expect(row.imageUrl).toBe("https://cdn.example/legacy.png");
    expect(row.videoUrl).toBe("https://cdn.example/vid.mp4");
    expect(row.mediaKind).toBe("carousel");
    expect(row.carouselSlides).toHaveLength(2);
    expect(row.tags).toEqual(["studio-notes", "design"]);
    expect(row.reelDuration).toBe(42);
    expect(row.igPostId).toBe("igp_1");
    expect(row.liPostUrn).toBe("urn:li:share:1");
    expect(row.liPermalink).toBe("https://linkedin.com/feed/1");
    expect(row.publishError).toBe("boom");
    expect(row.publishErrorAt).toBe("2026-06-01T00:00:00.000Z");
    expect(row.publishMode).toBe("manual");
    expect(row.storyLink).toBe("https://rangerandfox.tv");
    expect(row.platforms).toEqual(["ig_post", "linkedin"]);
  });

  it("survives an unrelated patch (the original data-loss bug)", () => {
    const patched = applyRowPatch(fullRow(), { note: "Renamed" }, "tester");
    expect(patched.note).toBe("Renamed");
    expect(patched.mediaUrl).toBe("https://cdn.example/img.png");
    expect(patched.carouselSlides).toHaveLength(2);
    expect(patched.mediaKind).toBe("carousel");
    expect(patched.reelDuration).toBe(42);
    expect(patched.publishError).toBe("boom");
    expect(patched.liPermalink).toBe("https://linkedin.com/feed/1");
    expect(patched.publishMode).toBe("manual");
    expect(patched.platforms).toEqual(["ig_post", "linkedin"]);
  });

  it("defaults missing fields without inventing data", () => {
    const row = normalizeRow({ note: "bare" });
    expect(row.mediaUrl).toBeNull();
    expect(row.carouselSlides).toBeNull();
    expect(row.tags).toEqual([]);
    expect(row.reelDuration).toBeNull();
    expect(row.publishMode).toBe("auto");
    expect(row.platforms).toEqual([row.platform]);
  });
});
