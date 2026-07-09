import { describe, it, expect } from "vitest";
import {
  CAPABILITIES,
  getCapability,
  validateChannelMedia,
  validatePostMedia,
} from "../capabilities.js";

// The capability matrix encodes VERIFIED per-channel publishing facts
// (see SESSION_HANDOFF §7.1). These tests pin those facts so a future
// edit to the matrix that contradicts a platform rule fails loudly.
//
// Verified facts being pinned:
//   IG post/carousel : 2–10 items, images AND videos OK, mixing OK
//   IG story         : image or video, video 3–60s/frame
//   IG reel          : video only, ≤90s
//   TikTok           : video 3s–10min OR photo carousel ≤35, NO mixing
//   LinkedIn         : 2–20 IMAGES ONLY, or a single video ≤10min, NO mixing

const img = (over = {}) => ({ kind: "image", ...over });
const vid = (durationSec, over = {}) => ({ kind: "video", durationSec, ...over });
const list = (n, make) => Array.from({ length: n }, () => make());

describe("CAPABILITIES matrix shape", () => {
  it("covers every studio channel", () => {
    for (const key of ["ig_post", "ig_story", "ig_reel", "tiktok", "linkedin", "facebook"]) {
      expect(CAPABILITIES[key], key).toBeTruthy();
      expect(CAPABILITIES[key].label, key).toBeTruthy();
    }
  });
});

describe("getCapability", () => {
  it("returns the matching entry", () => {
    expect(getCapability("ig_reel").label).toBe("Instagram Reel");
  });
  it("falls back to a permissive entry for unknown channels", () => {
    const cap = getCapability("mystery_channel");
    expect(validateChannelMedia("mystery_channel", [img(), vid(999)]).ok).toBe(true);
    expect(cap).toBeTruthy();
  });
});

describe("validateChannelMedia — Instagram post / carousel", () => {
  it("allows up to 10 items", () => {
    expect(validateChannelMedia("ig_post", list(10, img)).ok).toBe(true);
  });
  it("rejects 11 items with a too_many violation", () => {
    const res = validateChannelMedia("ig_post", list(11, img));
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.type === "too_many")).toBe(true);
  });
  it("allows mixing images and videos", () => {
    expect(validateChannelMedia("ig_post", [img(), vid(20), img()]).ok).toBe(true);
  });
});

describe("validateChannelMedia — Instagram story", () => {
  it("accepts a video between 3 and 60 seconds", () => {
    expect(validateChannelMedia("ig_story", [vid(30)]).ok).toBe(true);
  });
  it("rejects a video over 60 seconds", () => {
    const res = validateChannelMedia("ig_story", [vid(75)]);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.type === "duration_over")).toBe(true);
  });
  it("rejects a video under 3 seconds", () => {
    const res = validateChannelMedia("ig_story", [vid(2)]);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.type === "duration_under")).toBe(true);
  });
});

describe("validateChannelMedia — Instagram reel", () => {
  it("accepts a single video up to 90 seconds", () => {
    expect(validateChannelMedia("ig_reel", [vid(90)]).ok).toBe(true);
  });
  it("rejects a video over 90 seconds", () => {
    expect(validateChannelMedia("ig_reel", [vid(120)]).ok).toBe(false);
  });
  it("rejects an image (video only)", () => {
    const res = validateChannelMedia("ig_reel", [img()]);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.type === "unsupported_type")).toBe(true);
  });
});

describe("validateChannelMedia — TikTok", () => {
  it("accepts a photo carousel up to 35 images", () => {
    expect(validateChannelMedia("tiktok", list(35, img)).ok).toBe(true);
  });
  it("rejects a 36th photo", () => {
    expect(validateChannelMedia("tiktok", list(36, img)).ok).toBe(false);
  });
  it("accepts a single video from 3s to 10min", () => {
    expect(validateChannelMedia("tiktok", [vid(600)]).ok).toBe(true);
    expect(validateChannelMedia("tiktok", [vid(601)]).ok).toBe(false);
  });
  it("rejects mixing photos and video", () => {
    const res = validateChannelMedia("tiktok", [img(), vid(20)]);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.type === "mixed_media")).toBe(true);
  });
});

describe("validateChannelMedia — LinkedIn", () => {
  it("accepts 2–20 images", () => {
    expect(validateChannelMedia("linkedin", list(20, img)).ok).toBe(true);
  });
  it("rejects a 21st image", () => {
    expect(validateChannelMedia("linkedin", list(21, img)).ok).toBe(false);
  });
  it("accepts a single video up to 10 minutes", () => {
    expect(validateChannelMedia("linkedin", [vid(600)]).ok).toBe(true);
    expect(validateChannelMedia("linkedin", [vid(601)]).ok).toBe(false);
  });
  it("rejects mixing images and video", () => {
    const res = validateChannelMedia("linkedin", [img(), vid(20)]);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.type === "mixed_media")).toBe(true);
  });
  it("rejects two videos", () => {
    expect(validateChannelMedia("linkedin", [vid(10), vid(10)]).ok).toBe(false);
  });
});

describe("validatePostMedia — aggregate across channels", () => {
  it("is ok when every selected channel is satisfied", () => {
    const res = validatePostMedia(["ig_post", "facebook"], [img(), img()]);
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });
  it("names each offending channel in its violations", () => {
    // A 20s video: fine for ig_post, but reel wants ≤90s (ok) and
    // linkedin can't take a lone short video mixed with an image.
    const res = validatePostMedia(["ig_reel", "linkedin"], [img(), img()]);
    expect(res.ok).toBe(false);
    // reel rejects images; linkedin is fine with 2 images.
    const channels = new Set(res.violations.map((v) => v.channel));
    expect(channels.has("ig_reel")).toBe(true);
    expect(channels.has("linkedin")).toBe(false);
  });
  it("collects violations from multiple channels at once", () => {
    const res = validatePostMedia(["ig_reel", "tiktok"], [img(), vid(20)]);
    expect(res.ok).toBe(false);
    const channels = new Set(res.violations.map((v) => v.channel));
    expect(channels.has("ig_reel")).toBe(true); // image not allowed
    expect(channels.has("tiktok")).toBe(true); // mixed media
  });
  it("ignores empty media (nothing to validate yet)", () => {
    expect(validatePostMedia(["ig_reel", "linkedin"], []).ok).toBe(true);
  });
});
