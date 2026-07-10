// Render LEGACY designed carousel slides to publishable images. Rows saved by
// the retired CarouselComposer store slides as { layout, bg, fg, title, sub,
// label }; Instagram needs each as a hosted JPEG. We draw them to an offscreen
// canvas at 1080×1080 (square is valid for every IG aspect). New carousels are
// designed in the universal designer (carousel-layouts.js presets) — this file
// only keeps old posts publishable.
// ponytail: canvas mirror of CarouselSlideRender — faithful, not pixel-identical
// to the DOM preview. Needs a real-account visual pass before heavy reliance.

const SIZE = 1080;
const FG_DARK = "#09090b";
const PAPER = "#fafafa";
const ACCENT = "#ff5a1f";

const FONT_DISPLAY = "'Bricolage Grotesque', 'Switzer', sans-serif";
const FONT_BODY = "'Switzer', 'Helvetica Neue', Arial, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

// Make sure the web fonts are ready before measuring/drawing, or canvas
// silently falls back to a system face and the image looks wrong.
async function ensureFonts() {
  if (!document.fonts?.load) return;
  const specs = [
    `700 84px ${FONT_DISPLAY}`,
    `700 240px ${FONT_DISPLAY}`,
    `500 26px ${FONT_BODY}`,
    `600 30px ${FONT_BODY}`,
    `500 22px ${FONT_MONO}`,
  ];
  try {
    await Promise.all(specs.map((s) => document.fonts.load(s)));
    await document.fonts.ready;
  } catch {
    // Fonts unavailable — fall back to system faces rather than block publish.
  }
}

function hexStops(value) {
  return String(value || "").match(/#[0-9a-f]{3,8}/gi) || [];
}

// Load an image for canvas drawing; resolves null on failure so a broken
// photo degrades to the color background instead of blocking publish.
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Seamless photo: slides sharing a bgSpanId show slices of one image. The
// slice each slide shows is derived from its position among the sharing
// slides — the same maths as the SlicedBg CSS preview (cover-fit across an
// N-slide-wide box, shifted left by index slides).
function spanInfoFor(slides, i) {
  const sid = slides[i]?.bgSpanId;
  if (!sid) return null;
  const members = [];
  slides.forEach((s, idx) => { if (s.bgSpanId === sid) members.push(idx); });
  if (members.length < 2) return null;
  return { total: members.length, index: members.indexOf(i) };
}

function drawPhotoBackground(ctx, img, span) {
  const total = span?.total || 1;
  const index = span?.index || 0;
  const totalW = SIZE * total;
  const scale = Math.max(totalW / img.width, SIZE / img.height);
  const drawW = img.width * scale, drawH = img.height * scale;
  const offsetX = (totalW - drawW) / 2;
  const offsetY = (SIZE - drawH) / 2;
  ctx.drawImage(img, offsetX - index * SIZE, offsetY, drawW, drawH);
  // Scrim matching the DOM preview so overlaid copy stays readable.
  const scrim = ctx.createLinearGradient(0, SIZE, 0, 0);
  scrim.addColorStop(0, "rgba(0,0,0,0.55)");
  scrim.addColorStop(0.55, "rgba(0,0,0,0.08)");
  scrim.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function paintBackground(ctx, bg) {
  const stops = hexStops(bg);
  if (String(bg).includes("gradient") && stops.length >= 2) {
    // Approximate any CSS angle with a top-left → bottom-right diagonal.
    const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = stops[0] || bg || PAPER;
  }
  ctx.fillRect(0, 0, SIZE, SIZE);
}

// Wrap text to maxWidth, honoring explicit "\n" breaks first.
function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text || "").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(""); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const trial = line + " " + words[i];
      if (ctx.measureText(trial).width > maxWidth) {
        lines.push(line);
        line = words[i];
      } else {
        line = trial;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Draw a wrapped block from top y; returns the y below the block.
function drawBlock(ctx, text, { x, y, font, color, lineHeight, maxWidth, align = "left" }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  const lines = wrapLines(ctx, text, maxWidth);
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

async function drawSlide(ctx, slide, span) {
  const pad = SIZE * 0.1;
  const maxW = SIZE - pad * 2;
  const fg = slide.fg || FG_DARK;
  paintBackground(ctx, slide.bg);
  if (slide.bgImage) {
    const img = await loadImage(slide.bgImage);
    if (img?.width) drawPhotoBackground(ctx, img, span);
  }

  if (slide.layout === "number") {
    const kH = slide.label ? 40 : 0;
    const numFont = `700 240px ${FONT_DISPLAY}`;
    ctx.font = numFont;
    const subLines = wrapLines(ctx, slide.sub, maxW); // measured after, fine
    const blockH = kH + 240 + 24 + subLines.length * 40;
    let y = (SIZE - blockH) / 2;
    if (slide.label) {
      y = drawBlock(ctx, slide.label.toUpperCase(), { x: pad, y, font: `500 22px ${FONT_MONO}`, color: fg, lineHeight: 30, maxWidth: maxW });
      y += 18;
    }
    drawBlock(ctx, slide.title, { x: pad, y, font: numFont, color: fg, lineHeight: 220, maxWidth: maxW });
    y += 240 + 20;
    drawBlock(ctx, slide.sub, { x: pad, y, font: `500 30px ${FONT_BODY}`, color: fg, lineHeight: 40, maxWidth: maxW * 0.85 });
    return;
  }

  if (slide.layout === "photo") {
    // Top: brand gradient "photo". Bottom: paper panel with dark text.
    const split = SIZE * 0.6;
    const g = ctx.createLinearGradient(0, 0, SIZE, split);
    g.addColorStop(0, "#e8dccd"); g.addColorStop(1, "#8a6f52");
    ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, split);
    ctx.fillStyle = PAPER; ctx.fillRect(0, split, SIZE, SIZE - split);
    let y = split + pad * 0.7;
    if (slide.label) { y = drawBlock(ctx, slide.label.toUpperCase(), { x: pad, y, font: `500 20px ${FONT_MONO}`, color: ACCENT, lineHeight: 28, maxWidth: maxW }) + 10; }
    y = drawBlock(ctx, slide.title, { x: pad, y, font: `700 44px ${FONT_DISPLAY}`, color: FG_DARK, lineHeight: 50, maxWidth: maxW }) + 12;
    drawBlock(ctx, slide.sub, { x: pad, y, font: `400 26px ${FONT_BODY}`, color: "#52525b", lineHeight: 36, maxWidth: maxW });
    return;
  }

  if (slide.layout === "quote") {
    ctx.font = `700 60px ${FONT_DISPLAY}`;
    const titleLines = wrapLines(ctx, slide.title, maxW);
    const blockH = titleLines.length * 70 + 40 + 30;
    let y = (SIZE - blockH) / 2;
    y = drawBlock(ctx, slide.title, { x: pad, y, font: `700 60px ${FONT_DISPLAY}`, color: fg, lineHeight: 70, maxWidth: maxW }) + 24;
    ctx.fillStyle = fg; ctx.globalAlpha = 0.5; ctx.fillRect(pad, y, 88, 4); ctx.globalAlpha = 1;
    y += 22;
    drawBlock(ctx, slide.sub, { x: pad, y, font: `500 26px ${FONT_MONO}`, color: fg, lineHeight: 34, maxWidth: maxW });
    return;
  }

  if (slide.layout === "cta") {
    ctx.font = `700 60px ${FONT_DISPLAY}`;
    const titleLines = wrapLines(ctx, slide.title, maxW);
    const blockH = (slide.label ? 40 : 0) + titleLines.length * 68 + 40 + 84;
    let y = (SIZE - blockH) / 2;
    if (slide.label) { y = drawBlock(ctx, slide.label.toUpperCase(), { x: pad, y, font: `500 20px ${FONT_MONO}`, color: fg, lineHeight: 28, maxWidth: maxW }) + 18; }
    y = drawBlock(ctx, slide.title, { x: pad, y, font: `700 60px ${FONT_DISPLAY}`, color: fg, lineHeight: 68, maxWidth: maxW }) + 28;
    // Pill button
    const label = (slide.sub || "Read the piece") + "  →";
    ctx.font = `600 28px ${FONT_BODY}`;
    const tw = ctx.measureText(label).width;
    const pillW = tw + 80, pillH = 76, r = pillH / 2;
    ctx.fillStyle = fg;
    roundRect(ctx, pad, y, pillW, pillH, r); ctx.fill();
    ctx.fillStyle = /^#(0|1|2|3)/i.test(fg) ? PAPER : FG_DARK;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(label, pad + 40, y + pillH / 2 + 2);
    return;
  }

  // Default: "title" layout — kicker top, headline + sub bottom, swipe footer.
  drawBlock(ctx, (slide.label || "").toUpperCase(), { x: pad, y: pad, font: `500 22px ${FONT_MONO}`, color: fg, lineHeight: 30, maxWidth: maxW });
  const footerY = SIZE - pad - 24;
  ctx.font = `700 84px ${FONT_DISPLAY}`;
  const titleLines = wrapLines(ctx, slide.title, maxW);
  const subLines = wrapLines(ctx, slide.sub, maxW);
  const subH = subLines.length * 34;
  const titleH = titleLines.length * 88;
  let y = footerY - 40 - subH - 18 - titleH;
  y = drawBlock(ctx, slide.title, { x: pad, y, font: `700 84px ${FONT_DISPLAY}`, color: fg, lineHeight: 88, maxWidth: maxW }) + 18;
  drawBlock(ctx, slide.sub, { x: pad, y, font: `500 26px ${FONT_MONO}`, color: fg, lineHeight: 34, maxWidth: maxW });
  ctx.globalAlpha = 0.55;
  drawBlock(ctx, "SWIPE →", { x: pad, y: footerY, font: `500 20px ${FONT_MONO}`, color: fg, lineHeight: 24, maxWidth: maxW });
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvasToFile(canvas, name) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(new File([blob], name, { type: "image/jpeg" })) : reject(new Error("Failed to render slide")),
      "image/jpeg",
      0.92,
    );
  });
}

// Render every slide to a JPEG File, in order. Honors the seamless photo
// (bgImage sliced across slides sharing a bgSpanId).
export async function renderCarouselSlidesToFiles(slides) {
  await ensureFonts();
  const files = [];
  for (let i = 0; i < slides.length; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    await drawSlide(ctx, slides[i], spanInfoFor(slides, i));
    files.push(await canvasToFile(canvas, `carousel-${i + 1}.jpg`));
  }
  return files;
}
