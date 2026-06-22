import React, { useEffect, useRef } from "react";
import { useStudio } from "../StudioContext.jsx";
import { uploadAssetWithProgress, checkFileSize } from "../../../lib/supabase.js";

// Brand Central — a first-class view over the brand profile that already
// lives in the studio document (the same data the AI caption + strategy
// generators read). Logos and fonts upload through Supabase and store a
// URL, not a base64 blob, so the synced document stays small.
// Field mapping onto the existing brandProfile shape:
//   name → businessName · voice → toneVoice · do-nots → bannedPhrases.
// Logos/palette/fonts are additive keys the profile carries through.

const DEFAULT_PALETTE = [
  { name: "Ink", hex: "#09090b" },
  { name: "Paper", hex: "#fafafa" },
  { name: "Accent", hex: "#ff5a1f" },
];

function fontFamilyFromName(name) {
  return (
    name.replace(/[-_](Regular|Bold|Italic|Light|Medium|Black|Thin)$/i, "").replace(/[-_]/g, " ").trim() || name
  );
}

export function BrandView() {
  const { brandProfile, updateBrandProfile, showToast } = useStudio();

  const palette = brandProfile.palette?.length ? brandProfile.palette : DEFAULT_PALETTE;
  const fonts = brandProfile.fonts || [];
  const doNots = brandProfile.bannedPhrases || [];

  const markRef = useRef(null);
  const wordRef = useRef(null);
  const fontRef = useRef(null);

  // Inject uploaded brand fonts as @font-face so previews use them.
  useEffect(() => {
    const id = "rf-brand-fonts-style";
    let s = document.getElementById(id);
    if (!s) { s = document.createElement("style"); s.id = id; document.head.appendChild(s); }
    s.textContent = fonts
      .filter((f) => f.url)
      .map((f) => `@font-face{font-family:"${(f.family || "").replace(/"/g, "")}";src:url(${f.url});font-weight:${f.weight || 400};font-style:${f.style || "normal"};font-display:swap;}`)
      .join("\n");
  }, [fonts]);

  const uploadLogo = async (kind, file) => {
    if (!file) return;
    try { checkFileSize(file); } catch (err) { showToast(err.message); return; }
    try {
      const url = await uploadAssetWithProgress(file, () => {});
      updateBrandProfile({ [kind]: url });
      showToast(kind === "logoMarkUrl" ? "Logo mark uploaded." : "Wordmark uploaded.");
    } catch (err) {
      showToast(err?.message || "Upload failed");
    }
  };

  const uploadFonts = async (fileList) => {
    const arr = Array.from(fileList || []);
    const added = [];
    for (const file of arr) {
      try { checkFileSize(file); } catch (err) { showToast(err.message); continue; }
      try {
        const url = await uploadAssetWithProgress(file, () => {});
        const name = file.name.replace(/\.(woff2?|ttf|otf)$/i, "");
        added.push({
          name,
          family: fontFamilyFromName(name),
          url,
          weight: /bold|heavy|black/i.test(name) ? 700 : /light|thin/i.test(name) ? 300 : /medium/i.test(name) ? 500 : 400,
          style: /italic/i.test(name) ? "italic" : "normal",
        });
      } catch (err) {
        showToast(err?.message || "Font upload failed");
      }
    }
    if (added.length) {
      updateBrandProfile({ fonts: [...fonts, ...added] });
      showToast(`${added.length} font${added.length > 1 ? "s" : ""} uploaded.`);
    }
  };

  const setPalette = (next) => updateBrandProfile({ palette: next });
  const addColor = () => setPalette([...palette, { name: "New", hex: "#cccccc" }]);
  const updColor = (i, patch) => setPalette(palette.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const rmColor = (i) => setPalette(palette.filter((_, j) => j !== i));

  const setDoNots = (next) => updateBrandProfile({ bannedPhrases: next });
  const addDoNot = () => setDoNots([...doNots, ""]);
  const updDoNot = (i, v) => setDoNots(doNots.map((d, j) => (j === i ? v : d)));
  const rmDoNot = (i) => setDoNots(doNots.filter((_, j) => j !== i));

  return (
    <div className="bc-wrap">
      <div className="bc-head">
        <div className="bc-kicker">studio / brand central</div>
        <h1 className="bc-title">Brand central</h1>
        <p className="bc-sub">Everything the studio writes, schedules, and generates is keyed to what lives here. Upload your marks, drop in your fonts, lock the palette, and pin the voice.</p>
      </div>

      <div className="bc-grid">
        {/* Identity */}
        <section className="bc-card">
          <div className="bc-card-head">
            <div className="bc-card-kicker">01</div>
            <h2>Identity</h2>
            <p>The basics that render everywhere.</p>
          </div>
          <div className="bc-field">
            <label>Brand name</label>
            <input className="bc-input" value={brandProfile.businessName} onChange={(e) => updateBrandProfile({ businessName: e.target.value })} />
          </div>
          <div className="bc-field">
            <label>Tagline</label>
            <input className="bc-input" value={brandProfile.tagline} onChange={(e) => updateBrandProfile({ tagline: e.target.value })} />
          </div>
        </section>

        {/* Logos */}
        <section className="bc-card">
          <div className="bc-card-head">
            <div className="bc-card-kicker">02</div>
            <h2>Logos</h2>
            <p>Mark for small spots; wordmark for covers.</p>
          </div>
          <div className="bc-logos">
            <div className={"bc-logo " + (brandProfile.logoMarkUrl ? "" : "empty")} onClick={() => markRef.current?.click()}>
              {brandProfile.logoMarkUrl
                ? <img src={brandProfile.logoMarkUrl} alt="Mark" />
                : <div className="bc-logo-empty"><span>+</span><div>Upload mark</div><small>SVG · PNG · square</small></div>}
              <div className="bc-logo-lbl">Mark</div>
              {brandProfile.logoMarkUrl && <button className="bc-logo-x" onClick={(e) => { e.stopPropagation(); updateBrandProfile({ logoMarkUrl: null }); }}>×</button>}
              <input ref={markRef} type="file" accept="image/*,.svg" hidden onChange={(e) => uploadLogo("logoMarkUrl", e.target.files?.[0])} />
            </div>
            <div className={"bc-logo wide " + (brandProfile.logoWordmarkUrl ? "" : "empty")} onClick={() => wordRef.current?.click()}>
              {brandProfile.logoWordmarkUrl
                ? <img src={brandProfile.logoWordmarkUrl} alt="Wordmark" />
                : <div className="bc-logo-empty"><span>+</span><div>Upload wordmark</div><small>SVG · PNG · horizontal</small></div>}
              <div className="bc-logo-lbl">Wordmark</div>
              {brandProfile.logoWordmarkUrl && <button className="bc-logo-x" onClick={(e) => { e.stopPropagation(); updateBrandProfile({ logoWordmarkUrl: null }); }}>×</button>}
              <input ref={wordRef} type="file" accept="image/*,.svg" hidden onChange={(e) => uploadLogo("logoWordmarkUrl", e.target.files?.[0])} />
            </div>
          </div>
        </section>

        {/* Fonts */}
        <section className="bc-card bc-span-2">
          <div className="bc-card-head">
            <div className="bc-card-kicker">03</div>
            <h2>Fonts</h2>
            <p>Upload .woff2, .woff, .ttf, or .otf. Registered studio-wide once you add them.</p>
          </div>
          <div className="bc-font-list">
            {fonts.length === 0 && (
              <div className="bc-font-empty">No custom fonts yet — the studio uses system type until you add one.</div>
            )}
            {fonts.map((f, i) => (
              <div key={i} className="bc-font-row" style={{ fontFamily: `"${f.family}", var(--font-body)` }}>
                <div className="bc-font-sample" style={{ fontWeight: f.weight, fontStyle: f.style }}>Ag</div>
                <div className="bc-font-info">
                  <div className="bc-font-name">{f.family}</div>
                  <div className="bc-font-meta">{f.weight} {f.style} · {f.name}</div>
                </div>
                <div className="bc-font-preview" style={{ fontWeight: f.weight, fontStyle: f.style }}>The content calendar hums on quiet craft.</div>
                <button className="bc-x" onClick={() => updateBrandProfile({ fonts: fonts.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
          </div>
          <div className="bc-font-actions">
            <button className="bc-btn ghost" onClick={() => fontRef.current?.click()}>+ Add font files</button>
            <input ref={fontRef} type="file" accept=".woff,.woff2,.ttf,.otf" multiple hidden onChange={(e) => uploadFonts(e.target.files)} />
            <span className="bc-hint">Multi-select to upload a family at once.</span>
          </div>
        </section>

        {/* Colors */}
        <section className="bc-card">
          <div className="bc-card-head">
            <div className="bc-card-kicker">04</div>
            <h2>Palette</h2>
            <p>The colors the studio composes against.</p>
          </div>
          <div className="bc-colors">
            {palette.map((c, i) => (
              <div key={i} className="bc-color">
                <label className="bc-swatch" style={{ background: c.hex }}>
                  <input type="color" value={c.hex} onChange={(e) => updColor(i, { hex: e.target.value })} />
                </label>
                <input className="bc-color-name" value={c.name} onChange={(e) => updColor(i, { name: e.target.value })} />
                <input className="bc-color-hex" value={c.hex} onChange={(e) => updColor(i, { hex: e.target.value })} />
                <button className="bc-x" onClick={() => rmColor(i)}>×</button>
              </div>
            ))}
            <button className="bc-btn ghost" onClick={addColor}>+ Add color</button>
          </div>
        </section>

        {/* Voice */}
        <section className="bc-card">
          <div className="bc-card-head">
            <div className="bc-card-kicker">05</div>
            <h2>Voice</h2>
            <p>The prompt the studio feeds to caption assist.</p>
          </div>
          <textarea
            className="bc-textarea"
            rows={4}
            value={brandProfile.toneVoice}
            onChange={(e) => updateBrandProfile({ toneVoice: e.target.value })}
          />
          <div className="bc-donots">
            <div className="bc-donots-lbl">Do-nots</div>
            {doNots.map((d, i) => (
              <div key={i} className="bc-donot-row">
                <span className="bc-donot-dot" />
                <input className="bc-color-name" value={d} onChange={(e) => updDoNot(i, e.target.value)} />
                <button className="bc-x" onClick={() => rmDoNot(i)}>×</button>
              </div>
            ))}
            <button className="bc-btn ghost" onClick={addDoNot}>+ Add a don't</button>
          </div>
        </section>
      </div>
    </div>
  );
}
