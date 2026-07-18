// Mechanical adapters: a canonical PublishPlan operation ⇆ the arguments each
// path hands to the platform layer. Field renames only (imageUrl ⇆ mediaUrl for
// the immediate wire contract). No re-decisions of source, type, order, caption,
// classification, or validity — those belong to resolvePublishPlan.
//
// Neutral (src/lib) and pure (no imports) so it is the SINGLE mechanical-mapping
// owner shared by the browser (Composer), the scheduled worker, and the server
// HTTP handler (app.js) — no duplicated mapping to drift.

/** Immediate path → /api/ig-publish contract (api-client.publishToInstagram). */
export function operationToApiClientPayload(op, rowId) {
  const base = { caption: op.caption, mediaType: op.mediaType, rowId };
  if (op.mediaType === "CAROUSEL") return { ...base, imageUrls: op.imageUrls };
  if (op.mediaType === "IMAGE") return { ...base, mediaUrl: op.imageUrl };
  if (op.mediaType === "STORIES") {
    return op.videoUrl ? { ...base, videoUrl: op.videoUrl } : { ...base, mediaUrl: op.imageUrl };
  }
  return { ...base, videoUrl: op.videoUrl }; // VIDEO | REELS
}

/** Inverse of operationToApiClientPayload: the validated /api/ig-publish wire
 *  payload → a canonical operation. Used by app.js so the server HTTP handler
 *  reuses the shared meta mapping instead of maintaining its own dispatch. */
export function apiPayloadToOperation({ mediaType, caption, mediaUrl, videoUrl, imageUrls }) {
  if (mediaType === "CAROUSEL") return { mediaType, imageUrls, caption };
  if (mediaType === "IMAGE") return { mediaType, imageUrl: mediaUrl, caption };
  if (mediaType === "STORIES") {
    // A story is a video when videoUrl is present, otherwise an image (mediaUrl).
    return videoUrl ? { mediaType, videoUrl, caption } : { mediaType, imageUrl: mediaUrl, caption };
  }
  return { mediaType, videoUrl, caption }; // VIDEO | REELS
}

/** Scheduled/server path → meta.js publishInstagramPost arguments. */
export function metaPostArgs(op, { igUserId, userToken }) {
  return {
    igUserId,
    userToken,
    imageUrl: op.imageUrl,
    videoUrl: op.videoUrl,
    caption: op.caption,
    mediaType: op.mediaType,
  };
}

/** Scheduled/server path → meta.js publishInstagramCarousel arguments. */
export function metaCarouselArgs(op, { igUserId, userToken }) {
  return { igUserId, userToken, imageUrls: op.imageUrls, caption: op.caption };
}
