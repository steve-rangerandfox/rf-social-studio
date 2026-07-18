import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// Proves the REAL /api/ig-publish handler's dispatch to meta.js — not a mirror.
// meta.js, the IG session, and auth/rate-limit are mocked so the handler runs
// end to end and we can assert the exact arguments publishInstagramPost /
// publishInstagramCarousel receive.

vi.mock("../meta.js", () => ({
  publishInstagramPost: vi.fn(async () => ({ mediaId: "m1" })),
  publishInstagramCarousel: vi.fn(async () => ({ mediaId: "c1" })),
  fetchInstagramMedia: vi.fn(),
  fetchInstagramProfile: vi.fn(),
  refreshInstagramToken: vi.fn(),
}));
vi.mock("../instagram-session.js", () => ({
  getInstagramSession: () => ({ igUserToken: "tok", igUserId: "ig1", ownerUserId: "user_test" }),
  setInstagramSession: vi.fn(),
  clearCookie: vi.fn(),
}));
vi.mock("../middleware.js", () => ({
  requireRequestAuth: () => ({ userId: "user_test" }),
  checkRateLimit: async () => true,
}));

import { publishInstagramPost, publishInstagramCarousel } from "../meta.js";
import { handleApiRequest } from "../app.js";

class MockRequest extends EventEmitter {
  constructor({ method = "GET", url = "/", headers = {}, body } = {}) {
    super();
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
  }
}
class MockResponse {
  constructor() { this.statusCode = 200; this.headers = new Map(); this.body = ""; this.finished = false; }
  setHeader(n, v) { this.headers.set(n.toLowerCase(), v); }
  getHeader(n) { return this.headers.get(n.toLowerCase()); }
  end(b = "") { this.body = b; this.finished = true; }
}

const env = { nodeEnv: "test", sessionSecret: "s", allowedOrigins: new Set(["http://localhost:5173"]) };
const headers = { origin: "http://localhost:5173", host: "localhost:3001" };

async function publish(body) {
  const res = new MockResponse();
  await handleApiRequest(new MockRequest({ method: "POST", url: "/api/ig-publish", headers, body }), res, env);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

beforeEach(() => { publishInstagramPost.mockClear(); publishInstagramCarousel.mockClear(); });

describe("/api/ig-publish real dispatch → meta.js", () => {
  it("image STORIES dispatches mediaType STORIES with imageUrl and no videoUrl", async () => {
    const r = await publish({ mediaType: "STORIES", mediaUrl: "https://cdn.example.com/s.jpg", caption: "" });
    expect(r.status).toBe(200);
    expect(publishInstagramCarousel).not.toHaveBeenCalled();
    expect(publishInstagramPost).toHaveBeenCalledTimes(1);
    expect(publishInstagramPost.mock.calls[0][0]).toEqual({
      igUserId: "ig1", userToken: "tok", imageUrl: "https://cdn.example.com/s.jpg", videoUrl: undefined, caption: "", mediaType: "STORIES",
    });
  });

  it("video STORIES dispatches mediaType STORIES with videoUrl and no imageUrl", async () => {
    const r = await publish({ mediaType: "STORIES", videoUrl: "https://cdn.example.com/s.mp4", caption: "" });
    expect(r.status).toBe(200);
    expect(publishInstagramPost.mock.calls[0][0]).toEqual({
      igUserId: "ig1", userToken: "tok", imageUrl: undefined, videoUrl: "https://cdn.example.com/s.mp4", caption: "", mediaType: "STORIES",
    });
  });

  it("STORIES with neither image nor video is rejected and never dispatched", async () => {
    const r = await publish({ mediaType: "STORIES", caption: "" });
    expect(r.status).toBe(400);
    expect(publishInstagramPost).not.toHaveBeenCalled();
    expect(publishInstagramCarousel).not.toHaveBeenCalled();
  });

  it("does not re-decide caption/type/order: passes them through unchanged", async () => {
    await publish({ mediaType: "CAROUSEL", imageUrls: ["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"], caption: "hi" });
    expect(publishInstagramPost).not.toHaveBeenCalled();
    expect(publishInstagramCarousel.mock.calls[0][0]).toEqual({
      igUserId: "ig1", userToken: "tok", imageUrls: ["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"], caption: "hi",
    });
  });
});
