import { uid } from "./shared.js";

// The CarouselComposer's five slide layouts, reborn as one-click designer
// presets. layoutElements() stamps REAL editable elements (text/shape) in
// canvas units — geometry is the composer's 1080px reference scaled to
// the target canvas, so everything stays adjustable afterwards.

export const LAYOUT_PRESETS = [
  { id: "title", label: "Title" },
  { id: "number", label: "Number" },
  { id: "photo", label: "Photo" },
  { id: "quote", label: "Quote" },
  { id: "cta", label: "CTA" },
];

// Gradient presets from the composer's background row (join the designer's
// Background panel; the PNG export knows how to paint them).
export const CAROUSEL_GRADIENTS = [
  "linear-gradient(135deg, #e8dccd 0%, #8a6f52 100%)",
  "linear-gradient(135deg, #18181b 0%, #3f3f46 100%)",
  "linear-gradient(160deg, #fde68a 0%, #ea580c 100%)",
  "linear-gradient(135deg, #dbeafe 0%, #1e3a8a 100%)",
];

const TAN_GRADIENT = CAROUSEL_GRADIENTS[0];
const INK = "#09090b";
const PAPER = "#fafafa";
const ACCENT = "#ff5a1f";
const DISPLAY = "Bricolage Grotesque";
const BODY = "Switzer";
const MONO = "JetBrains Mono";

const text = (over) => ({
  id: uid(), type: "text", shadow: false, letterSpacing: 0, fontWeight: 400,
  fontFamily: BODY, color: INK, ...over,
});

// Scale factor: composer geometry is authored against a 1080px square.
export function layoutElements(layoutId, W, H) {
  const s = W / 1080; // font/x scale
  const sy = H / 1080; // y scale (square reference; non-square stretches)
  const pad = Math.round(108 * s); // 10% reference padding

  if (layoutId === "number") {
    return {
      bg: PAPER,
      elements: [
        text({ content: "A SHARPER BRIEF", x: pad, y: Math.round(240 * sy), fontSize: 22 * s, fontFamily: MONO, fontWeight: 500, letterSpacing: 2 }),
        text({ content: "01", x: pad, y: Math.round(300 * sy), fontSize: 240 * s, fontFamily: DISPLAY, fontWeight: 700 }),
        text({ content: "Start with the brief, not the feed.", x: pad, y: Math.round(600 * sy), fontSize: 30 * s, fontWeight: 500 }),
      ],
    };
  }

  if (layoutId === "photo") {
    return {
      bg: PAPER,
      elements: [
        { id: uid(), type: "shape", shape: "rect", x: 0, y: 0, width: Math.round(1080 * s), height: Math.round(648 * sy), fill: "#e8dccd", strokeWidth: 0 },
        text({ content: "RANGER & FOX", x: pad, y: Math.round(700 * sy), fontSize: 20 * s, fontFamily: MONO, fontWeight: 500, color: ACCENT, letterSpacing: 2 }),
        text({ content: "A studio note on craft", x: pad, y: Math.round(760 * sy), fontSize: 44 * s, fontFamily: DISPLAY, fontWeight: 700 }),
        text({ content: "Swap the tan block for a photo — drop one right on it.", x: pad, y: Math.round(850 * sy), fontSize: 26 * s, color: "#52525b" }),
      ],
    };
  }

  if (layoutId === "quote") {
    return {
      bg: INK,
      elements: [
        text({ content: "The category whispers.\nWe speak.", x: pad, y: Math.round(380 * sy), fontSize: 60 * s, fontFamily: DISPLAY, fontWeight: 700, color: PAPER }),
        { id: uid(), type: "shape", shape: "line", x: pad, y: Math.round(640 * sy), width: Math.round(88 * s), height: Math.round(8 * sy), stroke: PAPER, strokeWidth: 2, opacity: 0.5 },
        text({ content: "— studio notes, 014", x: pad, y: Math.round(680 * sy), fontSize: 26 * s, fontFamily: MONO, fontWeight: 500, color: PAPER }),
      ],
    };
  }

  if (layoutId === "cta") {
    const pillW = Math.round(430 * s);
    const pillH = Math.round(76 * sy);
    const pillY = Math.round(620 * sy);
    return {
      bg: TAN_GRADIENT,
      elements: [
        text({ content: "RANGER & FOX", x: pad, y: Math.round(320 * sy), fontSize: 20 * s, fontFamily: MONO, fontWeight: 500, letterSpacing: 2 }),
        text({ content: "See the full story.", x: pad, y: Math.round(380 * sy), fontSize: 60 * s, fontFamily: DISPLAY, fontWeight: 700 }),
        { id: uid(), type: "shape", shape: "rect", x: pad, y: pillY, width: pillW, height: pillH, fill: INK, strokeWidth: 0, radius: 999 },
        text({ content: "Read the piece  →", x: pad + Math.round(40 * s), y: pillY + Math.round(22 * sy), fontSize: 28 * s, fontWeight: 600, color: PAPER }),
      ],
    };
  }

  // Default: "title" — kicker top, headline + sub low, swipe footer.
  return {
    bg: TAN_GRADIENT,
    elements: [
      text({ content: "RANGER & FOX · 014", x: pad, y: pad, fontSize: 22 * s, fontFamily: MONO, fontWeight: 500, letterSpacing: 2 }),
      text({ content: "Three notes\non editorial\ncalm.", x: pad, y: Math.round(500 * sy), fontSize: 84 * s, fontFamily: DISPLAY, fontWeight: 700 }),
      text({ content: "A studio read · April 2026", x: pad, y: Math.round(830 * sy), fontSize: 26 * s, fontFamily: MONO, fontWeight: 500 }),
      text({ content: "SWIPE →", x: pad, y: Math.round(940 * sy), fontSize: 20 * s, fontFamily: MONO, fontWeight: 500, opacity: 0.55 }),
    ],
  };
}
