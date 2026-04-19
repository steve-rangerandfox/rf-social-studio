import { describe, it, expect } from "vitest";

import {
  MAX_LATE_MS,
  platformToMediaType,
  findDueRows,
  findDueLinkedInRows,
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
