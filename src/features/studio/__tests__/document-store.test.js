import { describe, it, expect } from "vitest";
import { normalizeRow, applyRowPatch, mergeStudioDocuments, createNewRow } from "../document-store.js";

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
    firstComment: "First comment with #hashtags",
    storyLayouts: { ig_post: [[{ id: "bg" }]], linkedin: [[{ id: "bg" }]] },
    storyPreset: "linkedin",
    storyFrameIds: ["f1", "f2"],
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
    expect(row.firstComment).toBe("First comment with #hashtags");
    // Designer per-outlet state — losing these resets outlet layouts and
    // the size dropdown on every save (gotcha #1 class).
    expect(row.storyLayouts).toEqual({ ig_post: [[{ id: "bg" }]], linkedin: [[{ id: "bg" }]] });
    expect(row.storyPreset).toBe("linkedin");
    expect(row.storyFrameIds).toEqual(["f1", "f2"]);
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

  it("preserves mediaItems across a patch (multi-image gallery)", () => {
    const items = [{ url: "https://cdn.example/1.jpg", kind: "image" }, { url: "https://cdn.example/2.jpg", kind: "image" }];
    const row = normalizeRow({ note: "gallery", mediaItems: items });
    expect(row.mediaItems).toEqual(items);
    const patched = applyRowPatch(row, { caption: "hi" }, "tester");
    expect(patched.mediaItems).toEqual(items);
  });

  it("createNewRow carries gallery + channel overrides onto the new row", () => {
    const items = [{ url: "https://cdn.example/1.jpg", kind: "image" }, { url: "https://cdn.example/2.jpg", kind: "image" }];
    const row = createNewRow({
      note: "gallery post",
      platform: "ig_post",
      platforms: ["ig_post", "linkedin"],
      mediaItems: items,
      mediaKind: "carousel",
      mediaUrl: items[0].url,
      thumbnailUrl: items[0].url,
    }, "tester", 0);
    expect(row.mediaItems).toEqual(items);
    expect(row.mediaKind).toBe("carousel");
    expect(row.mediaUrl).toBe(items[0].url);
    expect(row.thumbnailUrl).toBe(items[0].url);
    expect(row.platforms).toEqual(["ig_post", "linkedin"]);
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

describe("mergeStudioDocuments (conflict/poll merge)", () => {
  const doc = (rows, extra = {}) => ({ rows, auditLog: [], ...extra });
  const row = (id, updatedAt, fields = {}) => ({ id, updatedAt, ...fields });

  it("keeps the local row when it is newer (typing survives a refresh)", () => {
    const local = doc([row("a", "2026-07-07T10:00:05Z", { caption: "typed locally" })]);
    const server = doc([row("a", "2026-07-07T10:00:00Z", { caption: "stale" })]);
    const merged = mergeStudioDocuments(server, local);
    expect(merged.rows).toHaveLength(1);
    expect(merged.rows[0].caption).toBe("typed locally");
  });

  it("takes the server row when it is newer (scheduler outcomes land)", () => {
    const local = doc([row("a", "2026-07-07T10:00:00Z", { status: "scheduled" })]);
    const server = doc([row("a", "2026-07-07T10:00:09Z", { status: "posted" })]);
    const merged = mergeStudioDocuments(server, local);
    expect(merged.rows[0].status).toBe("posted");
  });

  it("keeps rows that exist on only one side, local order first", () => {
    const local = doc([row("a", "2026-07-07T10:00:00Z"), row("new-local", "2026-07-07T10:00:01Z")]);
    const server = doc([row("a", "2026-07-07T10:00:00Z"), row("new-server", "2026-07-07T10:00:02Z")]);
    const merged = mergeStudioDocuments(server, local);
    expect(merged.rows.map((r) => r.id)).toEqual(["a", "new-local", "new-server"]);
  });

  it("prefers the longer audit log and local non-row fields", () => {
    const local = doc([], { instagram: { account: "local" }, auditLog: [{ id: 1 }] });
    const server = doc([], { instagram: { account: "server" }, auditLog: [{ id: 1 }, { id: 2 }] });
    const merged = mergeStudioDocuments(server, local);
    expect(merged.auditLog).toHaveLength(2);
    expect(merged.instagram.account).toBe("local");
  });

  it("treats a missing updatedAt as oldest", () => {
    const local = doc([row("a", undefined, { caption: "no stamp" })]);
    const server = doc([row("a", "2026-07-07T10:00:00Z", { caption: "stamped" })]);
    const merged = mergeStudioDocuments(server, local);
    expect(merged.rows[0].caption).toBe("stamped");
  });
});
