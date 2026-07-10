// Pure math behind the Edit Image modal. Crop rects are normalized
// (0–1) against the DISPLAYED (rotated/flipped) image; the canvas glue
// in EditImageModal converts to pixels via these helpers at export time.

const MIN_CROP = 0.05; // keep the box grabbable

export const rotatedDims = (w, h, rotation) =>
  (rotation % 180 === 0 ? { w, h } : { w: h, h: w });

export const cropRectPx = ({ x, y, w, h }, tw, th) => ({
  sx: Math.round(x * tw),
  sy: Math.round(y * th),
  sw: Math.max(1, Math.round(w * tw)),
  sh: Math.max(1, Math.round(h * th)),
});

export function clampCrop({ x, y, w, h }) {
  let cw = Math.min(1, Math.max(MIN_CROP, w));
  let ch = Math.min(1, Math.max(MIN_CROP, h));
  const cx = Math.min(1 - cw, Math.max(0, x));
  const cy = Math.min(1 - ch, Math.max(0, y));
  return { x: cx, y: cy, w: cw, h: ch };
}
