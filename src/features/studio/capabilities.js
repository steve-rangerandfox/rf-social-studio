// Channel capability matrix — verified per-channel publishing facts, in
// one place, so the Universal Post Designer can enforce them before a
// post is ever queued (SESSION_HANDOFF §7.1).
//
// Each entry declares, per channel:
//   image  : { allowed, max }            — max null = no cap
//   video  : { allowed, max, minSec, maxSec }  — null bound = unconstrained
//   allowMixed : can images AND videos coexist in one post
//   maxItems   : combined item cap (null = no combined cap)
//
// Verified facts (do not "tidy" these without checking the platform docs):
//   IG post/carousel : up to 10 items, images AND videos, mixing OK
//   IG story         : image or video per frame, video 3–60s
//   IG reel          : video only, ≤90s
//   TikTok           : video 3s–10min OR photo carousel ≤35, NO mixing
//   LinkedIn         : 2–20 IMAGES ONLY, or one video ≤10min, NO mixing
//                      (organic document carousel is NOT in the API)
export const CAPABILITIES = {
  ig_post: {
    label: "Instagram Post",
    image: { allowed: true, max: 10 },
    video: { allowed: true, max: 10, minSec: null, maxSec: null },
    allowMixed: true,
    maxItems: 10,
  },
  ig_story: {
    label: "Instagram Story",
    image: { allowed: true, max: null },
    video: { allowed: true, max: null, minSec: 3, maxSec: 60 },
    allowMixed: true,
    maxItems: null,
  },
  ig_reel: {
    label: "Instagram Reel",
    image: { allowed: false, max: 0 },
    video: { allowed: true, max: 1, minSec: null, maxSec: 90 },
    allowMixed: false,
    maxItems: 1,
  },
  tiktok: {
    label: "TikTok",
    image: { allowed: true, max: 35 },
    video: { allowed: true, max: 1, minSec: 3, maxSec: 600 },
    allowMixed: false,
    maxItems: null,
  },
  linkedin: {
    label: "LinkedIn",
    image: { allowed: true, max: 20 },
    video: { allowed: true, max: 1, minSec: null, maxSec: 600 },
    allowMixed: false,
    maxItems: null,
  },
  facebook: {
    label: "Facebook",
    image: { allowed: true, max: null },
    video: { allowed: true, max: null, minSec: null, maxSec: null },
    allowMixed: true,
    maxItems: null,
  },
};

// Permissive fallback so an unknown/new channel never blocks the user
// (validation returns ok until real facts are added to the matrix).
const PERMISSIVE = {
  label: "Channel",
  image: { allowed: true, max: null },
  video: { allowed: true, max: null, minSec: null, maxSec: null },
  allowMixed: true,
  maxItems: null,
};

export function getCapability(channel) {
  return CAPABILITIES[channel] || PERMISSIVE;
}

// mediaItems: [{ kind: "image"|"video", durationSec?: number }]
// Returns { ok, violations: [{ channel, type, message, ...detail }] }.
export function validateChannelMedia(channel, mediaItems = []) {
  const cap = getCapability(channel);
  const name = cap.label;
  const violations = [];
  const add = (type, message, detail = {}) =>
    violations.push({ channel, type, message, ...detail });

  const images = mediaItems.filter((m) => m.kind === "image");
  const videos = mediaItems.filter((m) => m.kind === "video");

  if (!cap.allowMixed && images.length > 0 && videos.length > 0) {
    add("mixed_media", `${name} can't mix images and video in one post.`);
  }

  if (images.length > 0 && !cap.image.allowed) {
    add("unsupported_type", `${name} doesn't support images here.`, { mediaKind: "image" });
  }
  if (videos.length > 0 && !cap.video.allowed) {
    add("unsupported_type", `${name} doesn't support video here.`, { mediaKind: "video" });
  }

  if (cap.image.allowed && cap.image.max != null && images.length > cap.image.max) {
    add("too_many", `${name} allows at most ${cap.image.max} image${cap.image.max === 1 ? "" : "s"}.`, {
      mediaKind: "image",
      max: cap.image.max,
      count: images.length,
    });
  }
  if (cap.video.allowed && cap.video.max != null && videos.length > cap.video.max) {
    add("too_many", `${name} allows at most ${cap.video.max} video${cap.video.max === 1 ? "" : "s"}.`, {
      mediaKind: "video",
      max: cap.video.max,
      count: videos.length,
    });
  }
  if (cap.maxItems != null && mediaItems.length > cap.maxItems) {
    add("too_many", `${name} allows at most ${cap.maxItems} item${cap.maxItems === 1 ? "" : "s"}.`, {
      mediaKind: "any",
      max: cap.maxItems,
      count: mediaItems.length,
    });
  }

  if (cap.video.allowed) {
    for (const v of videos) {
      if (typeof v.durationSec !== "number") continue;
      if (cap.video.minSec != null && v.durationSec < cap.video.minSec) {
        add("duration_under", `${name} video must be at least ${cap.video.minSec}s.`, {
          minSec: cap.video.minSec,
          durationSec: v.durationSec,
        });
      }
      if (cap.video.maxSec != null && v.durationSec > cap.video.maxSec) {
        add("duration_over", `${name} video must be at most ${cap.video.maxSec}s.`, {
          maxSec: cap.video.maxSec,
          durationSec: v.durationSec,
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

// Validate one media set against every selected channel at once. Each
// violation carries its channel so the enforcement dialog can name it.
export function validatePostMedia(channels = [], mediaItems = []) {
  const violations = [];
  for (const channel of channels) {
    violations.push(...validateChannelMedia(channel, mediaItems).violations);
  }
  return { ok: violations.length === 0, violations };
}
