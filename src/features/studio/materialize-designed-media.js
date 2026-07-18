// Shared browser-only materialization for LEGACY designed carousel slides.
//
// A row created by the retired CarouselComposer stores `carouselSlides` (design
// data) with no rendered `carouselFrameUrls`. Publishing needs hosted images, so
// the slides must be rendered to files and uploaded — a browser-only side effect
// (canvas + upload). This helper is the single owner of that behavior, shared by
// immediate publishing (Composer) and the scheduling transition (StudioContext).
//
// It renders + uploads only. It does NOT decide scheduled status, construct
// publish operations, or execute publishing.

import { renderCarouselSlidesToFiles } from "./carouselRender.js";
// supabase is imported lazily inside materializeCarouselSlides so that merely
// importing this module (e.g. via StudioContext) does not construct a Supabase
// client at load time — that requires env vars and is a browser-only concern.

/** True when a row carries legacy carousel slides that have not been rendered
 *  to hosted frame URLs yet. */
export function needsCarouselMaterialization(row) {
  return (
    Array.isArray(row?.carouselSlides) &&
    row.carouselSlides.length >= 2 &&
    !(Array.isArray(row?.carouselFrameUrls) && row.carouselFrameUrls.length)
  );
}

/**
 * Render + upload a row's legacy carousel slides in stable order.
 * @returns {Promise<null | { imageUrls: string[], patch: object, transientMedia: { images: string[], video: null } }>}
 *   null when there are no slides to materialize; otherwise the ordered hosted
 *   URLs, a persistable document patch, and transient media for immediate policy
 *   resolution. Throws if rendering or uploading fails (callers must not schedule).
 */
export async function materializeCarouselSlides(row, onProgress) {
  const slides = Array.isArray(row?.carouselSlides) ? row.carouselSlides : [];
  if (slides.length < 2) return null;

  const { uploadAssetWithProgress } = await import("../../lib/supabase.js");
  const files = await renderCarouselSlidesToFiles(slides);
  const imageUrls = [];
  for (let i = 0; i < files.length; i++) {
    const url = await uploadAssetWithProgress(files[i], (p) => onProgress?.((i + p) / files.length));
    imageUrls.push(url);
  }

  return {
    imageUrls,
    // carouselFrameUrls is the scheduler's canonical designed-carousel source;
    // mediaKind marks explicit carousel intent; mediaUrl/thumbnailUrl keep the
    // queue/grid previews (which use <img>) working.
    patch: {
      carouselFrameUrls: imageUrls,
      mediaKind: "carousel",
      mediaUrl: imageUrls[0],
      thumbnailUrl: imageUrls[0],
    },
    transientMedia: { images: imageUrls, video: null },
  };
}

/**
 * Media-only helper for the scheduling transition: if the row needs legacy
 * carousel materialization, render + upload and return the media/document patch;
 * otherwise return null. It decides NOTHING about scheduled lifecycle (no status,
 * no scheduledAt) — that is StudioContext.schedulePost's sole responsibility.
 * Throws if rendering/uploading fails so the caller leaves the row unscheduled.
 * @returns {Promise<object|null>} the media patch to merge, or null
 */
export async function materializeForSchedule(row) {
  if (!needsCarouselMaterialization(row)) return null;
  const materialized = await materializeCarouselSlides(row);
  if (!materialized) throw new Error("No carousel slides to render");
  return materialized.patch;
}
