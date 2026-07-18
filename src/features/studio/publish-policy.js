// Canonical Instagram publishing policy.
//
// ONE pure, path-independent decision function. Given a normalized row plus an
// optional already-materialized transient-media input, it decides EVERYTHING
// deterministic about an Instagram publish and returns either a plan (platform,
// provenance, mediaType, ordered frames, authoritative operations) or a stable
// invalid result. Immediate and scheduled callers pass identical normalized
// inputs and receive identical results.
//
// It contains NO rendering, uploading, persistence, scheduling, retry, token,
// UI, or network behavior. Media type is decided from structured post/frame
// metadata and the operation being constructed — never from URL extensions.
//
// LinkedIn is intentionally OUT of scope; callers do not route LI through here.

import {
  IG_PUBLISH_MAX_CAPTION,
  IG_CAROUSEL_MIN_ITEMS,
  IG_CAROUSEL_MAX_ITEMS,
} from "../../lib/publishing-constants.js";

// Stable invalid codes. Exposed for adapters/tests; never reformatted silently.
export const INVALID_CODES = {
  NO_MEDIA: "NO_MEDIA",
  CAROUSEL_NOT_RENDERED: "CAROUSEL_NOT_RENDERED",
  CAROUSEL_TOO_FEW: "CAROUSEL_TOO_FEW",
  CAROUSEL_TOO_MANY: "CAROUSEL_TOO_MANY",
  MISSING_VIDEO: "MISSING_VIDEO",
  MISSING_IMAGE: "MISSING_IMAGE",
  CAPTION_TOO_LONG: "CAPTION_TOO_LONG",
  MALFORMED_URL: "MALFORMED_URL",
  NON_HTTPS_URL: "NON_HTTPS_URL",
  INVALID_FRAME_URL: "INVALID_FRAME_URL",
  TYPE_INCOMPATIBLE_MEDIA: "TYPE_INCOMPATIBLE_MEDIA",
  UNSUPPORTED_PLATFORM: "UNSUPPORTED_PLATFORM",
};

const IG_PLATFORMS = ["ig_post", "ig_reel", "ig_story"];

function invalid(code, message) {
  return { invalid: { code, message } };
}

// URL scheme problem for a single selected URL, or null if it is a valid
// HTTPS URL. Structured check only — no extension sniffing.
function urlProblem(u) {
  if (typeof u !== "string" || u.length === 0) return INVALID_CODES.MALFORMED_URL;
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    return INVALID_CODES.MALFORMED_URL;
  }
  if (parsed.protocol !== "https:") return INVALID_CODES.NON_HTTPS_URL;
  return null;
}

function normalizedCaption(row) {
  return typeof row?.caption === "string" ? row.caption.trim() : "";
}

// Ordered, image-only gallery URLs uploaded directly on the post (no designer).
function galleryImages(row) {
  const items = Array.isArray(row?.mediaItems) ? row.mediaItems : [];
  return items.filter((it) => it && it.url && it.kind !== "video").map((it) => it.url);
}

// First raw uploaded video on the post, if any.
function galleryVideo(row) {
  const items = Array.isArray(row?.mediaItems) ? row.mediaItems : [];
  const hit = items.find((it) => it && it.url && it.kind === "video");
  return hit ? hit.url : null;
}

// Validate an ordered list of image URLs (carousel / multi-frame). Returns an
// invalid result on the first bad entry, tagging its index, else null.
function validateOrderedImages(urls) {
  for (let i = 0; i < urls.length; i++) {
    const p = urlProblem(urls[i]);
    if (p) {
      return invalid(
        INVALID_CODES.INVALID_FRAME_URL,
        `Frame ${i + 1} is not a valid HTTPS URL (${p})`,
      );
    }
  }
  return null;
}

// ── Story resolution ────────────────────────────────────────────────
// Order: session transient → designed storyFrames → legacy storyFrameUrls →
// stored single media → raw gallery. The single/gallery fallback is reachable
// ONLY when both frame arrays are empty, so a stored poster/mediaUrl can never
// collapse a valid legacy multi-frame story.
function resolveStory(row, transientMedia) {
  let frames = null;
  let provenance = null;

  if (transientMedia && (transientMedia.video || (Array.isArray(transientMedia.images) && transientMedia.images.length))) {
    const t = [];
    for (const url of transientMedia.images || []) t.push({ url, kind: "image" });
    if (transientMedia.video) t.push({ url: transientMedia.video, kind: "video" });
    frames = t;
    provenance = "session";
  } else if (Array.isArray(row.storyFrames) && row.storyFrames.filter((f) => f && f.url).length) {
    frames = row.storyFrames
      .filter((f) => f && f.url)
      .map((f) => ({ url: f.url, kind: f.kind === "video" ? "video" : "image" }));
    provenance = "designed_story";
  } else if (Array.isArray(row.storyFrameUrls) && row.storyFrameUrls.filter(Boolean).length) {
    frames = row.storyFrameUrls.filter(Boolean).map((url) => ({ url, kind: "image" }));
    provenance = "legacy_story_frames";
  } else {
    const single = row.mediaUrl || row.imageUrl || null;
    if (single) {
      frames = [{ url: single, kind: row.mediaKind === "video" ? "video" : "image" }];
      provenance = "stored_media";
    } else {
      const gv = galleryVideo(row);
      const gi = galleryImages(row);
      if (gi.length) {
        frames = [{ url: gi[0], kind: "image" }];
        provenance = "raw_gallery";
      } else if (gv) {
        frames = [{ url: gv, kind: "video" }];
        provenance = "raw_gallery";
      }
    }
  }

  if (!frames || !frames.length) return invalid(INVALID_CODES.NO_MEDIA, "No media attached for this story");

  const urlErr = validateOrderedImages(frames.map((f) => f.url));
  if (urlErr) return urlErr;

  const operations = frames.map((f) =>
    f.kind === "video"
      ? { mediaType: "STORIES", videoUrl: f.url, caption: "" }
      : { mediaType: "STORIES", imageUrl: f.url, caption: "" },
  );

  return { platform: "ig_story", provenance, mediaType: "STORIES", frames, operations };
}

// ── Reel resolution ─────────────────────────────────────────────────
// Always REELS; requires a video. Order: session → stored videoUrl →
// stored mediaUrl (when mediaKind video) → raw gallery video.
function resolveReel(row, transientMedia, caption) {
  if (transientMedia && Array.isArray(transientMedia.images) && transientMedia.images.length && !transientMedia.video) {
    return invalid(INVALID_CODES.TYPE_INCOMPATIBLE_MEDIA, "A reel needs a video, but only image media was supplied");
  }

  let url = null;
  let provenance = null;
  if (transientMedia && transientMedia.video) {
    url = transientMedia.video;
    provenance = "session";
  } else if (row.videoUrl) {
    url = row.videoUrl;
    provenance = "stored_media";
  } else if (row.mediaKind === "video" && row.mediaUrl) {
    url = row.mediaUrl;
    provenance = "stored_media";
  } else {
    const gv = galleryVideo(row);
    if (gv) {
      url = gv;
      provenance = "raw_gallery";
    }
  }

  if (!url) return invalid(INVALID_CODES.MISSING_VIDEO, "No video attached for this reel");
  const p = urlProblem(url);
  if (p) return invalid(p, `Reel video is not a valid HTTPS URL (${p})`);

  return {
    platform: "ig_reel",
    provenance,
    mediaType: "REELS",
    frames: [{ url, kind: "video" }],
    operations: [{ mediaType: "REELS", videoUrl: url, caption }],
  };
}

// Resolve the ordered carousel image candidates and their provenance, or null.
function resolveCarouselCandidate(row, transientMedia) {
  if (transientMedia && Array.isArray(transientMedia.images) && transientMedia.images.length) {
    return { images: transientMedia.images.filter(Boolean), provenance: "session" };
  }
  if (Array.isArray(row.carouselFrameUrls) && row.carouselFrameUrls.filter(Boolean).length) {
    return { images: row.carouselFrameUrls.filter(Boolean), provenance: "designed_carousel" };
  }
  const gi = galleryImages(row);
  if (gi.length) return { images: gi, provenance: "raw_gallery" };
  return null;
}

function buildCarousel(images, provenance, caption) {
  if (images.length < IG_CAROUSEL_MIN_ITEMS) {
    return invalid(INVALID_CODES.CAROUSEL_TOO_FEW, `A carousel needs at least ${IG_CAROUSEL_MIN_ITEMS} images`);
  }
  if (images.length > IG_CAROUSEL_MAX_ITEMS) {
    // Never silently truncate — reject so the user fixes the source.
    return invalid(INVALID_CODES.CAROUSEL_TOO_MANY, `A carousel allows at most ${IG_CAROUSEL_MAX_ITEMS} images (got ${images.length})`);
  }
  const urlErr = validateOrderedImages(images);
  if (urlErr) return urlErr;
  return {
    platform: "ig_post",
    provenance,
    mediaType: "CAROUSEL",
    frames: images.map((url) => ({ url, kind: "image" })),
    operations: [{ mediaType: "CAROUSEL", imageUrls: images, caption }],
  };
}

// ── Feed resolution (ig_post) ───────────────────────────────────────
// Classification first: explicit carousel intent (mediaKind==="carousel"),
// caller-supplied multi-image transient media (explicit carousel), or a legacy
// inference from ≥2 resolved images when mediaKind is absent. An explicitly
// non-carousel post is never auto-promoted to a carousel.
function resolveFeed(row, transientMedia, caption) {
  const candidate = resolveCarouselCandidate(row, transientMedia);
  const transientMulti = transientMedia && Array.isArray(transientMedia.images) && transientMedia.images.length >= 2;
  const mediaKindAbsent = row.mediaKind == null || row.mediaKind === "";

  if (row.mediaKind === "carousel") {
    if (!candidate || !candidate.images.length) {
      return invalid(
        INVALID_CODES.CAROUSEL_NOT_RENDERED,
        "This carousel has no rendered slides — open the carousel designer, render & save, then try again",
      );
    }
    return buildCarousel(candidate.images, candidate.provenance, caption);
  }

  if (transientMulti) {
    return buildCarousel(candidate.images, candidate.provenance, caption);
  }

  if (mediaKindAbsent && candidate && candidate.images.length >= IG_CAROUSEL_MIN_ITEMS) {
    return buildCarousel(candidate.images, candidate.provenance, caption);
  }

  // Single feed post (image or video).
  if (transientMedia && transientMedia.video) {
    const p = urlProblem(transientMedia.video);
    if (p) return invalid(p, `Media is not a valid HTTPS URL (${p})`);
    return single(row, "session", "VIDEO", transientMedia.video, "video", caption);
  }
  if (transientMedia && Array.isArray(transientMedia.images) && transientMedia.images.length === 1) {
    const url = transientMedia.images[0];
    const p = urlProblem(url);
    if (p) return invalid(p, `Media is not a valid HTTPS URL (${p})`);
    return single(row, "session", "IMAGE", url, "image", caption);
  }
  if (candidate && candidate.provenance === "designed_carousel" && candidate.images.length === 1) {
    const p = urlProblem(candidate.images[0]);
    if (p) return invalid(p, `Media is not a valid HTTPS URL (${p})`);
    return single(row, "designed_carousel", "IMAGE", candidate.images[0], "image", caption);
  }
  if (row.mediaKind === "video" && (row.videoUrl || row.mediaUrl)) {
    const url = row.videoUrl || row.mediaUrl;
    const p = urlProblem(url);
    if (p) return invalid(p, `Media is not a valid HTTPS URL (${p})`);
    return single(row, "stored_media", "VIDEO", url, "video", caption);
  }
  if (row.mediaUrl || row.imageUrl) {
    const url = row.mediaUrl || row.imageUrl;
    const p = urlProblem(url);
    if (p) return invalid(p, `Media is not a valid HTTPS URL (${p})`);
    return single(row, "stored_media", "IMAGE", url, "image", caption);
  }
  const gv = galleryVideo(row);
  const gi = galleryImages(row);
  if (gi.length) {
    const p = urlProblem(gi[0]);
    if (p) return invalid(p, `Media is not a valid HTTPS URL (${p})`);
    return single(row, "raw_gallery", "IMAGE", gi[0], "image", caption);
  }
  if (gv) {
    const p = urlProblem(gv);
    if (p) return invalid(p, `Media is not a valid HTTPS URL (${p})`);
    return single(row, "raw_gallery", "VIDEO", gv, "video", caption);
  }

  return invalid(INVALID_CODES.NO_MEDIA, "No media attached for this post");
}

function single(row, provenance, mediaType, url, kind, caption) {
  const op =
    mediaType === "VIDEO"
      ? { mediaType: "VIDEO", videoUrl: url, caption }
      : { mediaType: "IMAGE", imageUrl: url, caption };
  return {
    platform: "ig_post",
    provenance,
    mediaType,
    frames: [{ url, kind }],
    operations: [op],
  };
}

/**
 * Resolve a deterministic Instagram publish plan.
 * @param {{ row: object, transientMedia?: { images?: string[], video?: string|null }|null }} input
 * @returns {{ platform, provenance, mediaType, frames, operations } | { invalid: { code, message } }}
 */
export function resolvePublishPlan({ row, transientMedia = null } = {}) {
  if (!row || !IG_PLATFORMS.includes(row.platform)) {
    return invalid(INVALID_CODES.UNSUPPORTED_PLATFORM, `Unsupported platform: ${row?.platform ?? "none"}`);
  }

  const caption = normalizedCaption(row);
  if (caption.length > IG_PUBLISH_MAX_CAPTION) {
    return invalid(INVALID_CODES.CAPTION_TOO_LONG, `Caption exceeds ${IG_PUBLISH_MAX_CAPTION} characters`);
  }

  if (row.platform === "ig_story") return resolveStory(row, transientMedia);
  if (row.platform === "ig_reel") return resolveReel(row, transientMedia, caption);
  return resolveFeed(row, transientMedia, caption);
}
