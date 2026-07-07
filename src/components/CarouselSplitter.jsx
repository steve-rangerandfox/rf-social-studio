import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Seo } from "./Seo.jsx";
import { track } from "@vercel/analytics";

// Free tool: seamless carousel splitter. Public, no login — upload one
// image, split it into 2-10 seamless Instagram carousel panels, download
// them numbered and ready to post. Top-of-funnel for Relay: the same slice
// maths the studio's designers use, with a quiet upsell to schedule the
// result instead of hand-posting it.
//
// Everything runs client-side (canvas cover-fit slices); the image never
// leaves the browser.

const ASPECTS = [
  { key: "portrait", label: "4:5 · portrait", w: 1080, h: 1350, hint: "Best for seamless carousels" },
  { key: "square", label: "1:1 · square", w: 1080, h: 1080, hint: "Classic grid-friendly" },
];

function coverSlice(ctx, img, index, total, W, H) {
  const totalW = W * total;
  const scale = Math.max(totalW / img.width, H / img.height);
  const drawW = img.width * scale, drawH = img.height * scale;
  const offsetX = (totalW - drawW) / 2;
  const offsetY = (H - drawH) / 2;
  ctx.drawImage(img, offsetX - index * W, offsetY, drawW, drawH);
}

export function CarouselSplitter() {
  const [img, setImg] = useState(null); // HTMLImageElement
  const [fileName, setFileName] = useState("");
  const [panels, setPanels] = useState(3);
  const [aspect, setAspect] = useState(ASPECTS[0]);
  const [dragOver, setDragOver] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef(null);

  const load = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    setFileName(file.name.replace(/\.[^.]+$/, ""));
  };

  const download = async () => {
    if (!img || downloading) return;
    setDownloading(true);
    track("splitter_download", { panels });
    try {
      for (let i = 0; i < panels; i++) {
        const canvas = document.createElement("canvas");
        canvas.width = aspect.w;
        canvas.height = aspect.h;
        coverSlice(canvas.getContext("2d"), img, i, panels, aspect.w, aspect.h);
        const blob = await new Promise((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Render failed"))), "image/jpeg", 0.95));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${fileName || "carousel"}-${i + 1}-of-${panels}.jpg`;
        a.click();
        URL.revokeObjectURL(a.href);
        // Stagger — browsers block a rapid burst of programmatic downloads.
        if (i < panels - 1) await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setDownloading(false);
    }
  };

  const previewH = 150;
  const previewW = Math.round(previewH * (aspect.w / aspect.h));

  return (
    <div className="spl-root">
      <style>{SPLITTER_CSS}</style>
      <Seo
        title="Free Seamless Carousel Splitter for Instagram — Relay"
        description="Split one image into 2-6 seamless Instagram carousel panels, free and in your browser. Exact 1080px slices, numbered in swipe order — no upload, no watermark."
        path="/tools/carousel-splitter"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to split an image into a seamless Instagram carousel",
          step: [
            { "@type": "HowToStep", name: "Upload", text: "Drop a wide, high-resolution image into the splitter." },
            { "@type": "HowToStep", name: "Choose panels", text: "Pick 2-6 panels and 4:5 portrait or 1:1 square output." },
            { "@type": "HowToStep", name: "Download and post", text: "Download the numbered 1080px slices and upload them to Instagram in order, without re-cropping." },
          ],
        }}
      />
      <header className="spl-head">
        <a className="spl-brand" href="/">Relay</a>
        <a className="spl-cta-link" href="/app">Open the studio →</a>
      </header>

      <main className="spl-main">
        <div className="spl-kicker">Free tool</div>
        <h1 className="spl-title">Split one image into a seamless carousel.</h1>
        <p className="spl-sub">
          Upload a wide image, choose your panels, and download numbered slices that flow
          edge-to-edge when swiped on Instagram. Runs entirely in your browser — the image never leaves your device.
        </p>

        {!img ? (
          <button
            className={"spl-drop" + (dragOver ? " over" : "")}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); load(e.dataTransfer.files?.[0]); }}
          >
            <span className="spl-drop-big">Drop an image here</span>
            <span className="spl-drop-small">or click to browse — wide, high-res images work best</span>
          </button>
        ) : (
          <>
            <div className="spl-controls">
              <div className="spl-control">
                <span className="spl-control-label">Panels</span>
                <div className="spl-seg">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button key={n} className={"spl-seg-btn" + (panels === n ? " on" : "")} onClick={() => setPanels(n)}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="spl-control">
                <span className="spl-control-label">Format</span>
                <div className="spl-seg">
                  {ASPECTS.map((a) => (
                    <button key={a.key} className={"spl-seg-btn" + (aspect.key === a.key ? " on" : "")} onClick={() => setAspect(a)} title={a.hint}>{a.label}</button>
                  ))}
                </div>
              </div>
              <button className="spl-swap" onClick={() => fileRef.current?.click()}>Different image</button>
            </div>

            <div className="spl-preview">
              {Array.from({ length: panels }, (_, i) => (
                <div key={i} className="spl-panel" style={{ width: previewW, height: previewH }}>
                  <img
                    src={img.src}
                    alt=""
                    draggable="false"
                    style={{ position: "absolute", top: 0, left: `${-i * 100}%`, width: `${panels * 100}%`, height: "100%", objectFit: "cover" }}
                  />
                  <span className="spl-panel-n">{i + 1}</span>
                </div>
              ))}
            </div>

            <div className="spl-actions">
              <button className="spl-btn primary" onClick={download} disabled={downloading}>
                {downloading ? "Rendering…" : `Download ${panels} panels`}
              </button>
              <span className="spl-actions-note">{aspect.w}×{aspect.h} JPEGs, numbered in swipe order</span>
            </div>

            <div className="spl-upsell">
              <div className="spl-upsell-title">Posting these by hand every week?</div>
              <div className="spl-upsell-sub">
                Relay designs seamless carousels <em>and</em> publishes them to Instagram on schedule —
                plus multi-frame stories, client approvals, and a queue your whole month fits in.
              </div>
              <a className="spl-btn ghost" href="/app">Try Relay free</a>
            </div>
          </>
        )}

        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />

        <section className="spl-how">
          <div className="spl-kicker">How it works</div>
          <ol className="spl-steps">
            <li>Your image is cover-fitted across the full width of every panel combined.</li>
            <li>Each panel gets its exact slice — edges line up perfectly panel to panel.</li>
            <li>Upload them to Instagram in the numbered order and the carousel swipes as one continuous image.</li>
          </ol>
        </section>

        <nav className="spl-guides">
          <span className="spl-control-label">Go deeper</span>
          <Link className="spl-guide-link" to="/guides/seamless-carousel-instagram">Seamless carousel guide</Link>
          <Link className="spl-guide-link" to="/guides/instagram-carousel-size">Carousel sizes</Link>
          <Link className="spl-guide-link" to="/guides/instagram-story-dimensions">Story dimensions</Link>
        </nav>

        <footer className="spl-foot">
          Built by <a href="/" className="spl-foot-link">Relay</a> — plan, design, and publish in one studio.
        </footer>
      </main>
    </div>
  );
}

const SPLITTER_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700&display=swap');
.spl-root{min-height:100vh;background:#fafafa;color:#09090b;font-family:'Switzer','Helvetica Neue',Arial,system-ui,sans-serif}
.spl-head{display:flex;align-items:baseline;justify-content:space-between;max-width:860px;margin:0 auto;padding:28px 24px 0}
.spl-brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;letter-spacing:-0.03em;color:#09090b;text-decoration:none}
.spl-cta-link{font-size:13px;font-weight:600;color:#52525b;text-decoration:none}
.spl-cta-link:hover{color:#09090b}
.spl-main{max-width:860px;margin:0 auto;padding:44px 24px 64px}
.spl-kicker{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#71717a;margin-bottom:10px}
.spl-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(30px,5vw,48px);letter-spacing:-0.04em;line-height:1.02;margin:0 0 14px;max-width:16ch}
.spl-sub{font-size:15px;line-height:1.6;color:#52525b;max-width:56ch;margin:0 0 30px}
.spl-drop{width:100%;padding:72px 24px;border:1.5px dashed #d4d4d8;border-radius:20px;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .15s,background .15s}
.spl-drop:hover,.spl-drop.over{border-color:#ff5a1f;background:#fffdfb}
.spl-drop-big{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:20px;letter-spacing:-0.02em}
.spl-drop-small{font-size:13px;color:#71717a}
.spl-controls{display:flex;align-items:flex-end;gap:22px;flex-wrap:wrap;margin-bottom:18px}
.spl-control{display:flex;flex-direction:column;gap:6px}
.spl-control-label{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#71717a}
.spl-seg{display:flex;gap:4px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:12px;padding:3px}
.spl-seg-btn{padding:7px 13px;border:none;border-radius:6px;background:transparent;font-size:13px;font-weight:600;color:#52525b;cursor:pointer}
.spl-seg-btn.on{background:#09090b;color:#fff}
.spl-swap{margin-left:auto;padding:8px 14px;border:1px solid #e4e4e7;border-radius:999px;background:#fff;font-size:13px;font-weight:600;color:#52525b;cursor:pointer}
.spl-swap:hover{border-color:#a1a1aa;color:#09090b}
.spl-preview{display:flex;gap:6px;overflow-x:auto;padding:6px 2px 10px}
.spl-panel{position:relative;flex-shrink:0;border-radius:6px;overflow:hidden;border:1px solid #e4e4e7;background:#f4f4f5}
.spl-panel-n{position:absolute;top:6px;left:6px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;color:#fff;background:rgba(9,9,11,0.6);border-radius:999px;padding:2px 7px}
.spl-actions{display:flex;align-items:center;gap:14px;margin:10px 0 34px;flex-wrap:wrap}
.spl-btn{padding:11px 22px;border-radius:999px;border:1px solid #09090b;background:#09090b;color:#fff;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}
.spl-btn:hover:not(:disabled){background:#27272a}
.spl-btn:disabled{opacity:.5;cursor:default}
.spl-btn.ghost{background:#fff;color:#09090b;border-color:#e4e4e7}
.spl-btn.ghost:hover{border-color:#a1a1aa;background:#fff}
.spl-actions-note{font-family:'JetBrains Mono',monospace;font-size:11px;color:#a1a1aa}
.spl-upsell{border:1px solid #e4e4e7;border-radius:20px;background:#fff;padding:22px 24px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.spl-upsell-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:19px;letter-spacing:-0.02em}
.spl-upsell-sub{font-size:14px;line-height:1.55;color:#52525b;max-width:58ch}
.spl-upsell-sub em{font-style:italic}
.spl-upsell .spl-btn{margin-top:6px}
.spl-how{margin-top:44px}
.spl-steps{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.55;color:#52525b;max-width:60ch}
.spl-guides{display:flex;gap:14px;align-items:baseline;margin-top:44px;flex-wrap:wrap}
.spl-guide-link{font-size:13px;font-weight:600;color:#09090b}
.spl-foot{margin-top:28px;font-size:12px;color:#a1a1aa}
.spl-foot-link{color:#71717a;font-weight:600;text-decoration:none}
@media (max-width:560px){.spl-controls{gap:12px}.spl-swap{margin-left:0}}
`;
