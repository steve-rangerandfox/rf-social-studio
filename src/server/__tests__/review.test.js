import { describe, it, expect } from "vitest";

import { makeReviewToken, verifyReviewToken, sanitizeReviewRow } from "../review.js";

const env = { sessionSecret: "test-secret-please-ignore" };

describe("review tokens", () => {
  it("round-trips: a made token verifies to its owner and salt", () => {
    const token = makeReviewToken(env, "user_2abcDEF", "a1b2c3d4e5f60708");
    expect(verifyReviewToken(env, token)).toEqual({ ownerUserId: "user_2abcDEF", salt: "a1b2c3d4e5f60708" });
  });

  it("rejects a tampered owner (signature no longer matches)", () => {
    const token = makeReviewToken(env, "user_alice", "a1b2c3d4e5f60708");
    const [, salt, sig] = token.split(".");
    const forged = `${Buffer.from("user_bob", "utf8").toString("base64url")}.${salt}.${sig}`;
    expect(verifyReviewToken(env, forged)).toBeNull();
  });

  it("rejects a tampered salt (revocation can't be bypassed by salt swap)", () => {
    const token = makeReviewToken(env, "user_alice", "a1b2c3d4e5f60708");
    const [owner, , sig] = token.split(".");
    expect(verifyReviewToken(env, `${owner}.ffffffffffffffff.${sig}`)).toBeNull();
  });

  it("rejects tokens signed with a different secret", () => {
    const token = makeReviewToken({ sessionSecret: "other" }, "user_alice", "a1b2c3d4e5f60708");
    expect(verifyReviewToken(env, token)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    for (const bad of [null, undefined, "", "a.b", "a.b.c.d", "!!.zz.short", "a.b." + "z".repeat(64)]) {
      expect(verifyReviewToken(env, bad)).toBeNull();
    }
    expect(verifyReviewToken({ sessionSecret: "" }, makeReviewToken(env, "u", "aa"))).toBeNull();
  });
});

describe("sanitizeReviewRow", () => {
  it("exposes only the client-safe fields", () => {
    const row = {
      id: "r1",
      note: "Launch teaser",
      caption: "Big day.",
      platform: "ig_post",
      status: "needs_review",
      scheduledAt: "2026-07-10T15:00:00.000Z",
      thumbnailUrl: "https://cdn.example/t.jpg",
      mediaKind: "carousel",
      updatedAt: "2026-07-03T00:00:00.000Z",
      // Internal fields that must NOT leak:
      igPostId: "secret-media-id",
      storyFrames: [{ url: "x" }],
      carouselFrameUrls: ["a"],
      publishError: "token expired",
      comments: [{ author: "steve", text: "internal note" }],
      createdBy: "stephen",
    };
    const safe = sanitizeReviewRow(row);
    expect(safe).toEqual({
      id: "r1",
      note: "Launch teaser",
      caption: "Big day.",
      platform: "ig_post",
      status: "needs_review",
      scheduledAt: "2026-07-10T15:00:00.000Z",
      thumbnailUrl: "https://cdn.example/t.jpg",
      mediaKind: "carousel",
      updatedAt: "2026-07-03T00:00:00.000Z",
    });
    expect(safe.comments).toBeUndefined();
    expect(safe.igPostId).toBeUndefined();
    expect(safe.publishError).toBeUndefined();
  });

  it("falls back through thumbnail sources", () => {
    expect(sanitizeReviewRow({ id: "a", platform: "ig_post", status: "needs_review", mediaUrl: "m.jpg" }).thumbnailUrl).toBe("m.jpg");
    expect(sanitizeReviewRow({ id: "a", platform: "ig_post", status: "needs_review", imageUrl: "i.jpg" }).thumbnailUrl).toBe("i.jpg");
    expect(sanitizeReviewRow({ id: "a", platform: "ig_post", status: "needs_review" }).thumbnailUrl).toBeNull();
  });
});
