import React, { useState, useEffect, useRef } from "react";
import { useStudio } from "../StudioContext.jsx";
import { uploadAssetWithProgress, checkFileSize } from "../../../lib/supabase.js";
import { renderCarouselSlidesToFiles } from "../carouselRender.js";

// Multi-slide carousel composer for the active post. IG (1:1) or
// LinkedIn (also 1:1), up to 10 slides. Slides persist onto the row as
// `carouselSlides`. "Render & save" flattens every slide to a hosted JPEG
// (carouselFrameUrls) so the scheduler can auto-publish the carousel at its
// scheduled time; editing a slide after a render invalidates the frames.

const CC_LAYOUTS = [
  { id: "title", label: "Title" },
  { id: "number", label: "Number" },
  { id: "photo", label: "Photo" },
  { id: "quote", label: "Quote" },
  { id: "cta", label: "CTA" },
];

const CC_BG_PRESETS = [
  "#fafafa", "#09090b", "#ff5a1f", "#e8dccd",
  "linear-gradient(135deg, #e8dccd 0%, #8a6f52 100%)",
  "linear-gradient(135deg, #18181b 0%, #3f3f46 100%)",
  "linear-gradient(160deg, #fde68a 0%, #ea580c 100%)",
  "linear-gradient(135deg, #dbeafe 0%, #1e3a8a 100%)",
];

const CC_BRAND = ["#09090b", "#fafafa", "#ff5a1f", "#e8dccd", "#8a6f52", "#71717a"];

function uniqueId(n) {
  return "s" + Date.now() + "-" + n + "-" + Math.random().toString(36).slice(2, 7);
}

function defaultSlide(n) {
  return {
    id: uniqueId(n),
    layout: n === 0 ? "title" : n === 1 ? "number" : "quote",
    bg: n === 0 ? "linear-gradient(135deg, #e8dccd 0%, #8a6f52 100%)" : n === 1 ? "#fafafa" : "#09090b",
    fg: n === 2 ? "#fafafa" : "#09090b",
    title: n === 0 ? "Three notes\non editorial\ncalm." : n === 1 ? "01" : "The category whispers.\nWe speak.",
    sub: n === 0 ? "A studio read · April 2026" : n === 1 ? "Start with the brief, not the feed." : "— studio notes, 014",
    label: n === 0 ? "Ranger & Fox · 014" : n === 1 ? "A sharper brief" : "",
  };
}

export function CarouselComposer({ row, onClose }) {
  const { update, showToast } = useStudio();
  const [slides, setSlides] = useState(() => {
    if (row?.carouselSlides?.length) return row.carouselSlides;
    // Images uploaded on the post seed one photo slide each — already set
    // when the carousel builder opens.
    const imgs = (Array.isArray(row?.mediaItems) ? row.mediaItems : []).filter((it) => it.kind !== "video");
    if (imgs.length) {
      return imgs.map((it, n) => ({ ...defaultSlide(n), layout: "photo", bgImage: it.url, title: "", sub: "", label: "", fg: "#fafafa" }));
    }
    return [defaultSlide(0), defaultSlide(1), defaultSlide(2)];
  });
  const [cur, setCur] = useState(0);
  const [platform, setPlatform] = useState(row?.platform === "linkedin" ? "linkedin" : "instagram");

  const slide = slides[cur] || slides[0];
  // Both platforms preview square — IG carousels render 1080×1080, and
  // LinkedIn native images are square too (1.91:1 is the LINK-preview
  // format, not an image post).
  const aspect = "1 / 1";

  // ── Seamless photo: fit one image across every slide ──
  // Slides that share a `bgSpanId` render slices of the same image; each
  // slice is derived from the slide's position among the sharing slides, so
  // add / delete / reorder re-spread the photo automatically.
  const photoRef = useRef(null);
  const [photoUp, setPhotoUp] = useState(0); // 0 = idle, else upload progress
  const hasPhoto = slides.some((s) => s.bgImage);
  const slideSpanInfo = (i) => {
    const sid = slides[i]?.bgSpanId;
    if (!sid) return null;
    const members = [];
    slides.forEach((s, idx) => { if (s.bgSpanId === sid) members.push(idx); });
    if (members.length < 2) return null;
    return { total: members.length, index: members.indexOf(i) };
  };
  const fitPhotoAcross = async (file) => {
    if (!file) return;
    try { checkFileSize(file); } catch (err) { showToast(err.message); return; }
    const previewUrl = URL.createObjectURL(file);
    const spanId = uniqueId("sp");
    setSlides((ss) => ss.map((s) => ({ ...s, bgImage: previewUrl, bgSpanId: spanId, fg: "#fafafa" })));
    setPhotoUp(0.01);
    try {
      const url = await uploadAssetWithProgress(file, (p) => setPhotoUp(Math.max(0.01, p)));
      setSlides((ss) => ss.map((s) => (s.bgSpanId === spanId ? { ...s, bgImage: url } : s)));
      URL.revokeObjectURL(previewUrl);
      showToast("Photo fitted across all slides.");
    } catch (err) {
      // Roll back the optimistic blob: preview so a dead URL is never persisted.
      setSlides((ss) => ss.map((s) => (s.bgSpanId === spanId ? { ...s, bgImage: undefined, bgSpanId: undefined } : s)));
      URL.revokeObjectURL(previewUrl);
      showToast(err?.message || "Upload failed");
    } finally {
      setPhotoUp(0);
    }
  };
  const removePhoto = () => setSlides((ss) => ss.map((s) => ({ ...s, bgImage: undefined, bgSpanId: undefined })));

  // ── Render & save: flatten every slide to a hosted JPEG so the scheduler
  //    can auto-publish this as a real IG carousel at its scheduled time. ──
  const [renderState, setRenderState] = useState("idle"); // idle | rendering | done
  const renderedRef = useRef(false);
  const firstSaveRef = useRef(true);
  const renderAndSave = async () => {
    if (photoUp > 0) { showToast("Wait for the photo upload to finish."); return; }
    setRenderState("rendering");
    try {
      const files = await renderCarouselSlidesToFiles(slides);
      const urls = [];
      for (const f of files) urls.push(await uploadAssetWithProgress(f, () => {}));
      update(row.id, {
        carouselSlides: slides,
        mediaKind: "carousel",
        carouselFrameUrls: urls,
        mediaUrl: urls[0],
        thumbnailUrl: urls[0],
      });
      renderedRef.current = true;
      setRenderState("done");
      showToast(`Rendered ${urls.length} slide${urls.length === 1 ? "" : "s"} — auto-publishes on schedule.`);
    } catch (err) {
      setRenderState("idle");
      showToast(err?.message || "Couldn't render the carousel — try again.");
    }
  };

  // Debounced persist onto the row. Suspended while a seamless photo is
  // uploading so the transient blob: preview URL is never written to the row;
  // the persist runs once photoUp returns to 0 with the public URL in place.
  // Editing after a render (this session or a prior one) drops the now-stale
  // flattened frames so the scheduler can't publish pre-edit slides.
  useEffect(() => {
    if (!row || photoUp > 0) return undefined;
    const t = setTimeout(() => {
      const patch = { carouselSlides: slides, mediaKind: "carousel" };
      if (firstSaveRef.current) {
        firstSaveRef.current = false;
      } else if (renderedRef.current || row.carouselFrameUrls) {
        renderedRef.current = false;
        Object.assign(patch, { carouselFrameUrls: null, mediaUrl: null, thumbnailUrl: null });
        setRenderState("idle");
      }
      update(row.id, patch);
    }, 400);
    return () => clearTimeout(t);
  }, [slides, row, update, photoUp]);  

  const patchSlide = (patch) => setSlides((ss) => ss.map((s, i) => (i === cur ? { ...s, ...patch } : s)));
  const add = () => {
    if (slides.length >= 10) { showToast("Carousels cap at 10 slides."); return; }
    setSlides((ss) => [...ss, defaultSlide(ss.length)]);
    setCur(slides.length);
  };
  const del = (i) => {
    if (slides.length <= 1) return;
    setSlides((ss) => ss.filter((_, j) => j !== i));
    setCur((c) => Math.max(0, c - (i <= c ? 1 : 0)));
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    setSlides((ss) => { const c = [...ss]; [c[i], c[j]] = [c[j], c[i]]; return c; });
    setCur(j);
  };

  const saveAndClose = () => { showToast("Carousel saved to post."); onClose(); };

  return (
    <div className="cc2-root">
      <div className="cc2-topbar">
        <div className="cc2-top-l">
          <button className="cc2-close" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1"><path d="m4 4 8 8M12 4l-8 8" /></svg>
          </button>
          <div className="cc2-breadcrumb">
            <span className="cc2-bc-k">Post · {(row?.note || row?.caption || "Untitled").slice(0, 28)}</span>
            <span className="cc2-bc-sep">/</span>
            <span className="cc2-bc-cur">Carousel composer</span>
          </div>
        </div>
        <div className="cc2-top-c">
          <div className="cc2-plats">
            {[["instagram", "Instagram", "1:1"], ["linkedin", "LinkedIn", "1:1"]].map(([k, l, r]) => (
              <button key={k} className={"cc2-plat " + (platform === k ? "on" : "")} onClick={() => setPlatform(k)}>
                <span className="cc2-plat-ratio">{r}</span>{l}
              </button>
            ))}
          </div>
        </div>
        <div className="cc2-top-r">
          {renderState === "done" && <span className="cc2-rendered-note">Rendered — auto-publishes on schedule</span>}
          <button className="btn btn-ghost" onClick={saveAndClose}>Save draft</button>
          <button className="btn btn-primary" onClick={renderAndSave} disabled={renderState === "rendering"}
            title={`Flatten all ${slides.length} slides to images and attach them so the carousel auto-publishes at its scheduled time`}>
            {renderState === "rendering" ? `Rendering ${slides.length} slides…` : `Render ${slides.length} slides & save`}
          </button>
        </div>
      </div>

      <div className="cc2-body">
        <div className="cc2-left">
          <div className="cc2-rail-t">Slides <span className="cc2-rail-n">{slides.length} / 10</span></div>
          <div className="cc2-thumbs">
            {slides.map((s, i) => (
              <div key={s.id} className={"cc2-thumb " + (i === cur ? "on" : "")} onClick={() => setCur(i)}>
                <div className="cc2-thumb-n">{String(i + 1).padStart(2, "0")}</div>
                <div className="cc2-thumb-prev" style={{ background: s.bg, color: s.fg, aspectRatio: aspect, position: "relative", overflow: "hidden" }}>
                  {s.bgImage && <SlicedBg url={s.bgImage} span={slideSpanInfo(i)} />}
                  <div className="cc2-thumb-lbl" style={s.bgImage ? { position: "relative" } : undefined}>{(s.title || "").split("\n")[0].slice(0, 22)}</div>
                </div>
                <div className="cc2-thumb-ctrls">
                  <button onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0} title="Up">{"↑"}</button>
                  <button onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === slides.length - 1} title="Down">{"↓"}</button>
                  <button onClick={(e) => { e.stopPropagation(); del(i); }} disabled={slides.length <= 1} title="Delete">{"×"}</button>
                </div>
              </div>
            ))}
            <button className="cc2-add" onClick={add} disabled={slides.length >= 10}>+ Add slide</button>
          </div>
          <div className="cc2-photo-fit">
            <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { fitPhotoAcross(e.target.files?.[0]); e.target.value = ""; }} />
            {hasPhoto
              ? <button className="cc2-photo-btn on" onClick={removePhoto} title="Remove the photo from every slide">Remove photo</button>
              : <button className="cc2-photo-btn" onClick={() => photoRef.current?.click()} disabled={photoUp > 0} title="Split one image seamlessly across every slide (the seamless-swipe look)">
                  {photoUp > 0 ? `Uploading ${Math.round(photoUp * 100)}%` : "◨ Fit photo across slides"}
                </button>}
          </div>
        </div>

        <div className="cc2-stage">
          {/* Artboard workspace — every slide side by side (Figma-board style).
              Click a slide to edit it in the properties panel. */}
          <div className="cc2-boards">
            {slides.map((s, i) => (
              <div key={s.id} className={"cc2-board" + (i === cur ? " on" : "")} onClick={() => setCur(i)} role="button" aria-label={`Edit slide ${i + 1}`}>
                <div className="cc2-board-n">{String(i + 1).padStart(2, "0")}</div>
                <div className="cc2-device" style={{ aspectRatio: aspect }}>
                  <div className="cc2-card" style={{ background: s.bg, color: s.fg, position: "relative", overflow: "hidden" }}>
                    {s.bgImage && <>
                      <SlicedBg url={s.bgImage} span={slideSpanInfo(i)} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.55),rgba(0,0,0,0.08) 55%,rgba(0,0,0,0.32))", pointerEvents: "none" }} />
                    </>}
                    <div style={{ position: "relative", height: "100%" }}>
                      <CarouselSlideRender slide={s} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button className="cc2-board-add" onClick={add} disabled={slides.length >= 10} title="Add slide">+</button>
          </div>
          <div className="cc2-stage-foot">
            Slide {cur + 1} of {slides.length} · {platform === "instagram" ? "Instagram · renders 1080×1080" : "LinkedIn · preview ratio only"}
          </div>
        </div>

        <div className="cc2-right">
          <div className="cc2-pp-head">
            <div className="cc2-pp-head-k">Slide {String(cur + 1).padStart(2, "0")}</div>
            <div className="cc2-pp-head-t">{CC_LAYOUTS.find((l) => l.id === slide.layout)?.label || "Layout"}</div>
          </div>

          <div className="cc2-pp-section">
            <div className="cc2-pp-section-t">Layout</div>
            <div className="cc2-layouts">
              {CC_LAYOUTS.map((l) => (
                <button key={l.id} className={"cc2-layout " + (slide.layout === l.id ? "on" : "")} onClick={() => patchSlide({ layout: l.id })}>
                  <LayoutMini kind={l.id} />
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="cc2-pp-section">
            <div className="cc2-pp-section-t">Copy</div>
            <div className="cc2-copy-row">
              <div className="cc2-pp-l">Kicker</div>
              <input className="cc2-input" value={slide.label || ""} onChange={(e) => patchSlide({ label: e.target.value })} />
            </div>
            <div className="cc2-copy-row">
              <div className="cc2-pp-l">Headline</div>
              <textarea className="cc2-input" rows={3} value={slide.title || ""} onChange={(e) => patchSlide({ title: e.target.value })} />
            </div>
            <div className="cc2-copy-row">
              <div className="cc2-pp-l">Sub</div>
              <input className="cc2-input" value={slide.sub || ""} onChange={(e) => patchSlide({ sub: e.target.value })} />
            </div>
          </div>

          <div className="cc2-pp-section">
            <div className="cc2-pp-section-t">Background</div>
            <div className="cc2-bg-grid">
              {CC_BG_PRESETS.map((b, i) => (
                <button key={i} className={"cc2-bg-sw " + (slide.bg === b ? "on" : "")} style={{ background: b }}
                  onClick={() => {
                    const darkBg = /^#0|^#18|linear-gradient\(.*#(18|00|1c|1e)/i.test(b);
                    patchSlide({ bg: b, fg: darkBg ? "#fafafa" : "#09090b" });
                  }} />
              ))}
            </div>
          </div>

          <div className="cc2-pp-section">
            <div className="cc2-pp-section-t">Text color</div>
            <div className="cc2-brand">
              {CC_BRAND.map((c) => (
                <button key={c} className={"cc2-brand-sw " + (slide.fg === c ? "on" : "")} style={{ background: c }} onClick={() => patchSlide({ fg: c })} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// One slice of a photo fitted across N slides. When spanning, the image is
// rendered N slides wide and shifted so only this slide's slice shows.
function SlicedBg({ url, span }) {
  const style = span && span.total > 1
    ? { position: "absolute", top: 0, left: `${-span.index * 100}%`, width: `${span.total * 100}%`, height: "100%", objectFit: "cover" }
    : { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
  return <img src={url} alt="" draggable="false" style={style} onError={(e) => { e.target.style.display = "none"; }} />;
}

function LayoutMini({ kind }) {
  const box = { position: "absolute", background: "currentColor" };
  return (
    <div className="cc2-lm">
      {kind === "title" && <>
        <div style={{ ...box, left: 6, top: 16, width: 20, height: 1.5 }} />
        <div style={{ ...box, left: 6, top: 24, width: 30, height: 4 }} />
        <div style={{ ...box, left: 6, top: 31, width: 26, height: 4 }} />
        <div style={{ ...box, left: 6, bottom: 6, width: 14, height: 1 }} />
      </>}
      {kind === "number" && <>
        <div style={{ position: "absolute", left: 6, top: 6, font: "700 22px 'Bricolage Grotesque'", color: "currentColor", letterSpacing: "-0.03em", lineHeight: 1 }}>01</div>
        <div style={{ ...box, left: 6, bottom: 10, width: 30, height: 1.5 }} />
      </>}
      {kind === "photo" && <>
        <div style={{ ...box, left: 0, top: 0, width: 48, height: 28, opacity: 0.25 }} />
        <div style={{ ...box, left: 6, top: 34, width: 28, height: 3 }} />
      </>}
      {kind === "quote" && <>
        <div style={{ position: "absolute", left: 6, top: 2, font: "700 18px 'Bricolage Grotesque'", color: "currentColor" }}>{"“"}</div>
        <div style={{ ...box, left: 6, top: 20, width: 30, height: 2 }} />
        <div style={{ ...box, left: 6, top: 25, width: 24, height: 2 }} />
        <div style={{ ...box, left: 6, bottom: 8, width: 14, height: 1 }} />
      </>}
      {kind === "cta" && <>
        <div style={{ ...box, left: 6, top: 10, width: 30, height: 2 }} />
        <div style={{ ...box, left: 6, top: 26, width: 22, height: 8, borderRadius: 4 }} />
      </>}
    </div>
  );
}

function CarouselSlideRender({ slide }) {
  const { layout, title, sub, label, fg, bg } = slide;

  if (layout === "title") return (
    <div style={{ padding: "10%", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
      <div style={{ font: "500 12px 'JetBrains Mono'", letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.8 }}>{label}</div>
      <div>
        <div style={{ font: "700 clamp(32px, 6vw, 72px) 'Bricolage Grotesque'", letterSpacing: "-0.035em", lineHeight: 1.02, whiteSpace: "pre-wrap" }}>{title}</div>
        <div style={{ marginTop: 18, font: "500 14px 'JetBrains Mono'", opacity: 0.7 }}>{sub}</div>
      </div>
      <div style={{ font: "500 11px 'JetBrains Mono'", opacity: 0.55, letterSpacing: "0.08em", textTransform: "uppercase" }}>Swipe {"→"}</div>
    </div>
  );

  if (layout === "number") return (
    <div style={{ padding: "10%", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: 20 }}>
      <div style={{ font: "500 11px 'JetBrains Mono'", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6 }}>{label}</div>
      <div style={{ font: "700 clamp(100px, 22vw, 240px) 'Bricolage Grotesque'", letterSpacing: "-0.06em", lineHeight: 0.88 }}>{title}</div>
      <div style={{ font: "500 17px 'Switzer'", letterSpacing: "-0.01em", opacity: 0.8, maxWidth: "82%", lineHeight: 1.35 }}>{sub}</div>
    </div>
  );

  if (layout === "photo") return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, background: "linear-gradient(135deg, #e8dccd 0%, #8a6f52 100%)" }} />
      <div style={{ padding: "7% 10%", background: "#fafafa", color: "#09090b" }}>
        <div style={{ font: "500 11px 'JetBrains Mono'", letterSpacing: "0.06em", textTransform: "uppercase", color: "#ff5a1f" }}>{label}</div>
        <div style={{ font: "700 clamp(22px, 3.8vw, 36px) 'Bricolage Grotesque'", letterSpacing: "-0.03em", marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.08 }}>{title}</div>
        <div style={{ marginTop: 10, font: "400 14px 'Switzer'", color: "#52525b" }}>{sub}</div>
      </div>
    </div>
  );

  if (layout === "quote") return (
    <div style={{ padding: "10%", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
      <div style={{ font: "700 clamp(26px, 4.8vw, 52px) 'Bricolage Grotesque'", letterSpacing: "-0.03em", lineHeight: 1.1, whiteSpace: "pre-wrap" }}>{title}</div>
      <div style={{ marginTop: 28, width: 44, height: 2, background: "currentColor", opacity: 0.5 }} />
      <div style={{ marginTop: 14, font: "500 13px 'JetBrains Mono'", opacity: 0.7 }}>{sub}</div>
    </div>
  );

  if (layout === "cta") return (
    <div style={{ padding: "10%", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: 20 }}>
      <div style={{ font: "500 11px 'JetBrains Mono'", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6 }}>{label}</div>
      <div style={{ font: "700 clamp(28px, 5vw, 52px) 'Bricolage Grotesque'", letterSpacing: "-0.03em", whiteSpace: "pre-wrap", lineHeight: 1.05 }}>{title}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 22px", background: fg, color: /^#(0|1|2|3)/i.test(bg) ? "#fafafa" : (fg === "#09090b" ? "#fafafa" : "#09090b"), borderRadius: 999, alignSelf: "flex-start", font: "600 15px 'Switzer'", letterSpacing: "-0.005em" }}>
        {sub || "Read the piece"} {"→"}
      </div>
    </div>
  );

  return null;
}
