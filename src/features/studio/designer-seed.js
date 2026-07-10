import { uid } from "./shared.js";

// What canvases the designer opens with, given the row's saved pages and
// its uploaded gallery (row.mediaItems). Rules:
// 1. No saved pages: one canvas per gallery item (image as locked bg),
//    else the default template.
// 2. Saved pages with no real media anywhere are a stale auto-saved
//    default: reseed from the gallery.
// 3. Saved pages with media are kept — and every gallery item whose url
//    isn't already placed on some page is APPENDED as its own canvas.
//    (The designer auto-saves pages on every open, so images uploaded
//    after a visit must merge in; all-or-nothing loses them.)
export function seedPages(row, makeDefaultElements) {
  const galleryItems = (Array.isArray(row?.mediaItems) ? row.mediaItems : []).filter((it) => it?.url);
  // One canvas per gallery item: plain dark background + the image as a
  // regular UNLOCKED element, so it's draggable/scalable immediately.
  // No width/height — CanvasElement measures the media on load and fits
  // it inside the canvas margins.
  const canvasFor = (it) => ({
    id: uid(),
    elements: [
      { id: "bg", type: "image", url: null, fill: "#080A0E", x: 0, y: 0, scale: 1, locked: true, mediaType: "image" },
      {
        id: uid(), type: "image", url: it.url, x: 15, y: 27, scale: 1, locked: false,
        mediaType: it.kind === "video" ? "video" : "image",
        ...(it.kind === "video" ? { loop: true, muted: true, autoPlay: true } : {}),
      },
    ],
  });

  const saved = Array.isArray(row?.storyPages) && row.storyPages.length ? row.storyPages : null;
  if (saved) {
    const pagesHaveMedia = saved.some((els) => els.some((e) =>
      (e.locked && (e.url || e.fill)) || (!e.locked && e.type === "image" && e.url)));
    if (!pagesHaveMedia && galleryItems.length) return galleryItems.map(canvasFor);
    const placed = new Set(saved.flatMap((els) => els.map((e) => e.url).filter(Boolean)));
    const missing = galleryItems.filter((it) => !placed.has(it.url));
    return [
      ...saved.map((els) => ({ id: uid(), elements: els })),
      ...missing.map(canvasFor),
    ];
  }

  if (galleryItems.length) return galleryItems.map(canvasFor);
  return [{ id: uid(), elements: makeDefaultElements() }];
}
