import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  AArrowDown,
  AIMark,
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  Bold,
  Check,
  ChevronDown,
  Close as X,
  Download,
  Film,
  Grid3 as Grid3x3,
  GripVertical,
  ImageIcon,
  Italic,
  Layers,
  LayoutTemplate,
  Minus,
  PanelLeftClose,
  Plus,
  Redo as Redo2,
  RotateCcw,
  RotateCw,
  Sliders,
  Strikethrough,
  Trash as Trash2,
  TypeIcon as Type,
  Underline,
  Undo as Undo2,
  Upload,
  Wallpaper,
} from "../../../components/icons/index.jsx";
import { CanvasElement, BRAND_COLORS, CANVAS_W, CANVAS_H, fitMediaBox } from "./CanvasElement.jsx";
import { StoryDesignerTour } from "./StoryDesignerTour.jsx";
import { T, uid, TEMPLATES } from "../shared.js";
import { useStudio } from "../StudioContext.jsx";
import { generateStoryTips } from "../../../lib/api-client.js";
import { uploadAssetWithProgress, checkFileSize, fetchAssets, saveAsset } from "../../../lib/supabase.js";

// Session-local clipboard for copy/paste of canvas elements (persists across
// opening/closing the designer; not a React ref, so it stays out of render).
let designerClipboard = [];

const CANVAS_PRESETS = [
  { key: "ig_story", label: "IG Story", w: 290, h: 515, exportW: 1080, exportH: 1920, ratio: "9:16" },
  { key: "ig_post", label: "IG Post", w: 290, h: 290, exportW: 1080, exportH: 1080, ratio: "1:1" },
  { key: "ig_reel", label: "IG Reel", w: 290, h: 515, exportW: 1080, exportH: 1920, ratio: "9:16" },
  { key: "tiktok", label: "TikTok", w: 290, h: 515, exportW: 1080, exportH: 1920, ratio: "9:16" },
  { key: "linkedin", label: "LinkedIn Post", w: 290, h: 362, exportW: 1080, exportH: 1350, ratio: "4:5" },
  { key: "linkedin_link", label: "LinkedIn Link", w: 290, h: 152, exportW: 1200, exportH: 628, ratio: "1.91:1" },
  { key: "youtube", label: "YouTube", w: 290, h: 163, exportW: 1280, exportH: 720, ratio: "16:9" },
];

// Which canvas preset a publishing outlet designs against. A post's outlet
// list (row.platforms) maps through this to decide which presets the
// designer's size dropdown offers.
const PLATFORM_TO_PRESET = {
  ig_story: "ig_story",
  ig_post: "ig_post",
  ig_reel: "ig_reel",
  tiktok: "tiktok",
  linkedin: "linkedin",
  facebook: "ig_post",
};

// `weights` lists the cuts each family ACTUALLY ships with (per the
// @font-face / Google / Fontshare imports) — the UI only offers these, so
// no synthesized faux weights. Plaak Ney is a single Heavy cut; custom
// uploads are one file = one cut (see CUSTOM_FONT_WEIGHTS).
const BRAND_FONTS = [
  { name:"Bricolage Grotesque", label:"Bricolage",  group:"brand", weights:[[500,"Medium"],[600,"Semibold"],[700,"Bold"],[800,"Extrabold"]] },
  { name:"JetBrains Mono",      label:"Mono",       group:"brand", weights:[[400,"Regular"],[500,"Medium"],[600,"Semibold"]] },
  { name:"Switzer",             label:"Switzer",    group:"brand", weights:[[300,"Light"],[400,"Regular"],[500,"Medium"],[600,"Semibold"],[700,"Bold"]] },
  { name:"Plaak Ney",           label:"Plaak",      group:"brand", weights:[[900,"Heavy"]] },
];
const SYS_FONTS   = [
  { name:"Georgia",      label:"Georgia",      group:"system", weights:[[400,"Regular"],[700,"Bold"]] },
  { name:"Arial",        label:"Arial",        group:"system", weights:[[400,"Regular"],[700,"Bold"]] },
];
const ALL_FONTS = [...BRAND_FONTS, ...SYS_FONTS];
const CUSTOM_FONT_WEIGHTS = [[400,"Regular"]];
const fontWeightsOf = (fo) => fo?.weights || CUSTOM_FONT_WEIGHTS;
// Nearest available cut when switching families (e.g. Bold 700 text moved
// to Plaak lands on Heavy 900, not a synthesized 700).
const snapWeight = (fo, w) => {
  const ws = fontWeightsOf(fo).map(([x]) => x);
  return ws.reduce((best, x) => (Math.abs(x - (w || 400)) < Math.abs(best - (w || 400)) ? x : best), ws[0]);
};

// ─── TEXT INSPECTOR (Canva/Photoshop-style compact panel) ────────
const ALL_FONTS_GROUPED = () => {
  const brand = BRAND_FONTS.map(f => ({ ...f, group: "Brand" }));
  const sys = SYS_FONTS.map(f => ({ ...f, group: "System" }));
  return [...brand, ...sys];
};

const GRADIENT_PRESETS = [
  { id: "sunset", label: "Sunset", css: "linear-gradient(135deg, #FF7A00, #F0B24D)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(135deg, #0EA5E9, #7C3AED)" },
  { id: "rose", label: "Rose", css: "linear-gradient(135deg, #FB7185, #BE185D)" },
  { id: "mint", label: "Mint", css: "linear-gradient(135deg, #10B981, #0EA5E9)" },
  { id: "brand", label: "Brand", css: T.posterGrad },
  { id: "gold", label: "Gold", css: "linear-gradient(135deg, #F0B24D, #FF7A00)" },
];

function TextInspector({ selected, selectedId, updateEl, customFonts, removeCustomFont, fontFileRef, handleFontUpload, fontInstalling, fontError }) {
  const [fontOpen, setFontOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [spacingOpen, setSpacingOpen] = useState(false);
  const fontRef = useRef(null);
  const colorRef = useRef(null);
  const spacingRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (fontRef.current && !fontRef.current.contains(e.target)) setFontOpen(false);
      if (colorRef.current && !colorRef.current.contains(e.target)) setColorOpen(false);
      if (spacingRef.current && !spacingRef.current.contains(e.target)) setSpacingOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  const allFonts = ALL_FONTS_GROUPED();
  const currentFont = [...allFonts, ...customFonts].find(f => f.name === selected.fontFamily);
  const currentLabel = currentFont?.label || selected.fontFamily || "Select font";

  const stepSize = (delta) => updateEl(selectedId, { fontSize: Math.max(6, Math.min(96, Math.round(selected.fontSize + delta))) });
  const stepSpacing = (delta) => updateEl(selectedId, { letterSpacing: Math.max(-2, Math.min(10, parseFloat(((selected.letterSpacing || 0) + delta).toFixed(1)))) });
  const stepLineHeight = (delta) => updateEl(selectedId, { lineHeight: Math.max(0.8, Math.min(3, parseFloat(((selected.lineHeight || 1.25) + delta).toFixed(2)))) });

  const tb = (active) => ({
    width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",
    border:"none",borderRadius:6,cursor:"pointer",transition:"all 0.1s",flexShrink:0,
    background:active?T.ink:"transparent",color:active?T.surface:T.textSub,
  });

  const numInput = {
    width:"100%",textAlign:"center",border:"none",background:"transparent",
    fontSize:11,fontWeight:700,color:T.text,padding:0,outline:"none",
    fontFamily:"'JetBrains Mono',monospace",MozAppearance:"textfield",
  };

  const colorPreview = selected.gradient || selected.color;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {/* ── Row 1: [Font ▾] [- size +] ── */}
      <div style={{display:"flex",gap:4,alignItems:"stretch"}}>
        <div style={{position:"relative",flex:1,minWidth:0}} ref={fontRef}>
          <button onClick={() => setFontOpen(v => !v)}
            style={{
              width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
              gap:4,padding:"0 8px",borderRadius:6,border:`1px solid ${T.border}`,
              background:T.s2,cursor:"pointer",fontFamily:`'${selected.fontFamily}',sans-serif`,
              fontSize:13,fontWeight:600,color:T.text,minHeight:32,
            }}>
            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentLabel}</span>
            <ChevronDown size={10} style={{flexShrink:0,opacity:0.4,transform:fontOpen?"rotate(180deg)":"none",transition:"transform 0.15s"}}/>
          </button>
          {fontOpen && (
            <div style={{
              position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:50,
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,
              boxShadow:"0 12px 32px rgba(9,9,11,0.1)",maxHeight:220,overflowY:"auto",padding:4,
            }}>
              {[
                { label: "Brand", fonts: BRAND_FONTS },
                { label: "System", fonts: SYS_FONTS },
                ...(customFonts.length > 0 ? [{ label: "Custom", fonts: customFonts, custom: true }] : []),
              ].map(group => (
                <div key={group.label}>
                  <div style={{padding:"6px 8px 2px",fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textDim,fontFamily:"'JetBrains Mono',monospace"}}>{group.label}</div>
                  {group.fonts.map(f => (
                    <div key={f.name || f.id} style={{display:"flex",alignItems:"center"}}>
                      <button onClick={() => { updateEl(selectedId, { fontFamily: f.name }); setFontOpen(false); }}
                        style={{
                          flex:1,display:"flex",alignItems:"center",gap:6,padding:"5px 8px",border:"none",
                          borderRadius:6,background:selected.fontFamily===f.name?T.s3:"transparent",
                          cursor:"pointer",fontSize:12,color:T.text,fontFamily:`'${f.name}',sans-serif`,
                          fontWeight:selected.fontFamily===f.name?700:500,textAlign:"left",
                        }}>
                        {f.label}
                        {selected.fontFamily===f.name && <Check size={10} style={{marginLeft:"auto",opacity:0.5}}/>}
                      </button>
                      {group.custom && (
                        <button onClick={() => removeCustomFont(f.id)} title="Remove"
                          style={{background:"transparent",border:"none",cursor:"pointer",color:T.textDim,padding:4,borderRadius:4}}>
                          <Trash2 size={9}/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <div style={{borderTop:`1px solid ${T.border}`,margin:"2px 0 0",padding:"2px 0 0"}}>
                <button onClick={() => { fontFileRef.current?.click(); setFontOpen(false); }} disabled={fontInstalling}
                  style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"6px 8px",border:"none",borderRadius:6,background:"transparent",cursor:"pointer",fontSize:11,fontWeight:600,color:T.textSub}}>
                  <Upload size={10}/> {fontInstalling ? "Installing..." : "Upload font"}
                </button>
              </div>
            </div>
          )}
          <input ref={fontFileRef} type="file" accept=".woff,.woff2,.ttf,.otf,.eot" style={{display:"none"}}
            onChange={e => { handleFontUpload(e.target.files?.[0]); e.target.value = ""; }}/>
        </div>
        <div style={{display:"flex",alignItems:"center",border:`1px solid ${T.border}`,borderRadius:6,background:T.s2,flexShrink:0,width:80}}>
          <button onClick={() => stepSize(-1)} style={{padding:"0 4px",border:"none",background:"transparent",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center",height:"100%"}}><Minus size={10}/></button>
          <input type="number" value={Math.round(selected.fontSize)} min={6} max={96}
            onChange={e => updateEl(selectedId, { fontSize: Math.max(6, Math.min(96, parseInt(e.target.value) || 6)) })}
            style={numInput}/>
          <button onClick={() => stepSize(1)} style={{padding:"0 4px",border:"none",background:"transparent",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center",height:"100%"}}><Plus size={10}/></button>
        </div>
      </div>
      {fontError && <div style={{fontSize:10,color:T.red,lineHeight:1.4}}>{fontError}</div>}

      {/* ── Weight · line height · letter spacing (Figma typography row) ──
             Only the cuts this family actually ships with. ── */}
      <div style={{display:"flex",gap:4}}>
        <select value={snapWeight(currentFont, selected.fontWeight || 400)} onChange={e => updateEl(selectedId, { fontWeight: parseInt(e.target.value) })}
          title="Font weight"
          style={{flex:1,minWidth:0,height:28,borderRadius:6,border:`1px solid ${T.border}`,background:T.s2,fontSize:11,fontWeight:600,color:T.text,padding:"0 6px",outline:"none"}}>
          {fontWeightsOf(currentFont).map(([w,l]) => (
            <option key={w} value={w}>{l} · {w}</option>
          ))}
        </select>
        <input type="number" step={0.05} min={0.8} max={3} value={selected.lineHeight ?? 1.25} title="Line height"
          onChange={e => updateEl(selectedId, { lineHeight: Math.max(0.8, Math.min(3, parseFloat(e.target.value) || 1.25)) })}
          style={{height:28,borderRadius:6,border:`1px solid ${T.border}`,background:T.s2,...numInput,width:52}}/>
        <input type="number" step={0.1} min={-2} max={10} value={selected.letterSpacing ?? 0} title="Letter spacing"
          onChange={e => updateEl(selectedId, { letterSpacing: Math.max(-2, Math.min(10, parseFloat(e.target.value) || 0)) })}
          style={{height:28,borderRadius:6,border:`1px solid ${T.border}`,background:T.s2,...numInput,width:52}}/>
      </div>

      {/* ── Row 2: [Color] | [B] [I] [U] [S] | [spacing ▾] ── */}
      <div style={{display:"flex",alignItems:"center",gap:2,background:T.s2,borderRadius:6,padding:2,border:`1px solid ${T.border}`}}>
        {/* Color */}
        <div style={{position:"relative"}} ref={colorRef}>
          <button title="Text color" onClick={() => setColorOpen(v => !v)}
            style={{...tb(false),position:"relative"}}>
            <span style={{display:"block",width:17,height:17,borderRadius:6,background:colorPreview,border:"1px solid rgba(9,9,11,0.22)",boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.5)"}}/>
          </button>
          {colorOpen && (
            <div style={{
              position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:50,
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,
              boxShadow:"0 12px 32px rgba(9,9,11,0.1)",padding:8,width:180,
            }}>
              {/* Solid swatches */}
              <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>Solid</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3,marginBottom:4}}>
                {BRAND_COLORS.map(c => (
                  <button key={c} onClick={() => { updateEl(selectedId, { color: c, gradient: null }); }}
                    style={{width:26,height:26,borderRadius:6,border:!selected.gradient&&selected.color===c?`2px solid ${T.ink}`:c==="#FFFFFF"||c==="#F7F8FA"?"1px solid #ddd":"1px solid transparent",background:c,cursor:"pointer",padding:0}}/>
                ))}
              </div>
              {/* Custom color picker */}
              <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}>
                <input type="color" value={selected.gradient ? "#ffffff" : (selected.color?.startsWith("#") ? selected.color : "#ffffff")}
                  onChange={e => updateEl(selectedId, { color: e.target.value, gradient: null })}
                  style={{width:26,height:26,border:`1px solid ${T.border}`,borderRadius:6,padding:0,cursor:"pointer",background:"transparent"}}/>
                <input type="text" value={selected.gradient ? "" : selected.color}
                  placeholder="#hex"
                  onChange={e => updateEl(selectedId, { color: e.target.value, gradient: null })}
                  style={{flex:1,minWidth:0,fontSize:10,fontFamily:"'JetBrains Mono',monospace",padding:"4px 6px",border:`1px solid ${T.border}`,borderRadius:6,background:T.s2,color:T.text,outline:"none"}}/>
              </div>

              {/* Gradient presets */}
              <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>Gradient</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,marginBottom:4}}>
                {GRADIENT_PRESETS.map(g => (
                  <button key={g.id} title={g.label} onClick={() => updateEl(selectedId, { gradient: g.css })}
                    style={{height:26,borderRadius:6,border:selected.gradient===g.css?`2px solid ${T.ink}`:"1px solid transparent",background:g.css,cursor:"pointer",padding:0}}/>
                ))}
              </div>
              {/* Custom gradient builder */}
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <input type="color" value={selected._gradA || "#FF7A00"}
                  onChange={e => {
                    const a = e.target.value;
                    const b = selected._gradB || "#7C3AED";
                    updateEl(selectedId, { gradient: `linear-gradient(135deg, ${a}, ${b})`, _gradA: a, _gradB: b });
                  }}
                  style={{width:26,height:26,border:`1px solid ${T.border}`,borderRadius:6,padding:0,cursor:"pointer",background:"transparent"}}/>
                <div style={{flex:1,height:26,borderRadius:6,background:selected.gradient || `linear-gradient(135deg, ${selected._gradA||"#FF7A00"}, ${selected._gradB||"#7C3AED"})`,border:`1px solid ${T.border}`}}/>
                <input type="color" value={selected._gradB || "#7C3AED"}
                  onChange={e => {
                    const a = selected._gradA || "#FF7A00";
                    const b = e.target.value;
                    updateEl(selectedId, { gradient: `linear-gradient(135deg, ${a}, ${b})`, _gradA: a, _gradB: b });
                  }}
                  style={{width:26,height:26,border:`1px solid ${T.border}`,borderRadius:6,padding:0,cursor:"pointer",background:"transparent"}}/>
              </div>
              {selected.gradient && (
                <button onClick={() => updateEl(selectedId, { gradient: null })}
                  style={{marginTop:6,width:"100%",padding:"4px 0",border:"none",borderRadius:4,background:"transparent",cursor:"pointer",fontSize:10,fontWeight:600,color:T.textDim}}>
                  Clear gradient
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{width:1,height:18,background:T.border,flexShrink:0}}/>

        {/* Bold — only when this family ships a real ≥700 cut */}
        {(() => {
          const ws = fontWeightsOf(currentFont).map(([w]) => w);
          const boldW = ws.find(w => w >= 700);
          const regW = snapWeight(currentFont, 400);
          const isBold = (selected.fontWeight || 400) >= 700;
          return (
            <button title={boldW || isBold ? "Bold" : "This font has no bold cut"} disabled={!boldW && !isBold}
              onClick={() => updateEl(selectedId, { fontWeight: isBold ? regW : boldW })}
              style={{...tb(isBold), opacity: !boldW && !isBold ? 0.3 : 1}}>
              <Bold size={14}/>
            </button>
          );
        })()}
        {/* Italic */}
        <button title="Italic" onClick={() => updateEl(selectedId, { italic: !selected.italic })}
          style={tb(selected.italic)}>
          <Italic size={14}/>
        </button>
        {/* Underline */}
        <button title="Underline" onClick={() => updateEl(selectedId, { underline: !selected.underline })}
          style={tb(selected.underline)}>
          <Underline size={14}/>
        </button>
        {/* Strikethrough */}
        <button title="Strikethrough" onClick={() => updateEl(selectedId, { strikethrough: !selected.strikethrough })}
          style={tb(selected.strikethrough)}>
          <Strikethrough size={14}/>
        </button>

        <div style={{width:1,height:18,background:T.border,flexShrink:0}}/>

        {/* Spacing popover */}
        <div style={{position:"relative"}} ref={spacingRef}>
          <button title="Letter & line spacing" onClick={() => setSpacingOpen(v => !v)}
            style={{...tb(spacingOpen),width:"auto",padding:"0 6px",gap:2}}>
            <AArrowDown size={13}/>
          </button>
          {spacingOpen && (
            <div style={{
              position:"absolute",top:"calc(100% + 4px)",right:0,zIndex:50,
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,
              boxShadow:"0 12px 32px rgba(9,9,11,0.1)",padding:10,width:170,
              display:"flex",flexDirection:"column",gap:8,
            }}>
              {/* Letter spacing */}
              <div>
                <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>Letter spacing</div>
                <div style={{display:"flex",alignItems:"center",border:`1px solid ${T.border}`,borderRadius:6,background:T.s2,overflow:"hidden"}}>
                  <button onClick={() => stepSpacing(-0.5)} style={{padding:"4px 6px",border:"none",background:"transparent",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center"}}><Minus size={10}/></button>
                  <input type="number" value={selected.letterSpacing || 0} min={-2} max={10} step={0.5}
                    onChange={e => updateEl(selectedId, { letterSpacing: Math.max(-2, Math.min(10, parseFloat(e.target.value) || 0)) })}
                    style={numInput}/>
                  <button onClick={() => stepSpacing(0.5)} style={{padding:"4px 6px",border:"none",background:"transparent",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center"}}><Plus size={10}/></button>
                </div>
              </div>
              {/* Line spacing */}
              <div>
                <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>Line height</div>
                <div style={{display:"flex",alignItems:"center",border:`1px solid ${T.border}`,borderRadius:6,background:T.s2,overflow:"hidden"}}>
                  <button onClick={() => stepLineHeight(-0.05)} style={{padding:"4px 6px",border:"none",background:"transparent",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center"}}><Minus size={10}/></button>
                  <input type="number" value={(selected.lineHeight || 1.25).toFixed(2)} min={0.8} max={3} step={0.05}
                    onChange={e => updateEl(selectedId, { lineHeight: Math.max(0.8, Math.min(3, parseFloat(e.target.value) || 1.25)) })}
                    style={numInput}/>
                  <button onClick={() => stepLineHeight(0.05)} style={{padding:"4px 6px",border:"none",background:"transparent",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center"}}><Plus size={10}/></button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Custom Font Manager ─────────────────────────────────────────
const CUSTOM_FONTS_KEY = "rf_studio_custom_fonts";

function loadCustomFonts() {
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_FONTS_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    // Re-register each font face on load
    stored.forEach((f) => {
      const face = new FontFace(f.name, `url(${f.dataUrl})`);
      face.load().then(() => document.fonts.add(face)).catch(() => {});
    });
    return stored;
  } catch { return []; }
}

function saveCustomFonts(fonts) {
  try { localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(fonts)); } catch { /* storage full */ }
}

async function installFontFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      // Derive font name from filename: "My Font Bold.woff2" → "My Font Bold"
      const rawName = file.name.replace(/\.(woff2?|ttf|otf|eot)$/i, "").replace(/[-_]/g, " ");
      const fontName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      try {
        const face = new FontFace(fontName, `url(${dataUrl})`);
        await face.load();
        document.fonts.add(face);
        resolve({ id: uid(), name: fontName, label: fontName, dataUrl, fileName: file.name, group: "custom" });
      } catch (err) {
        reject(new Error(`Could not load "${file.name}" as a font: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ─── Persistent Template Storage ─────────────────────────────────
const TEMPLATES_STORAGE_KEY = "rf_studio_templates";
const DEFAULT_TMPL_KEY = "rf_studio_default_template";

function loadSavedTemplates() {
  try {
    const stored = JSON.parse(localStorage.getItem(TEMPLATES_STORAGE_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch { return []; }
}

function saveSavedTemplates(templates) {
  try { localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates)); } catch { /* storage full */ }
}

function loadDefaultTmplId() {
  return localStorage.getItem(DEFAULT_TMPL_KEY) || null;
}

function saveDefaultTmplId(id) {
  if (id) localStorage.setItem(DEFAULT_TMPL_KEY, id);
  else localStorage.removeItem(DEFAULT_TMPL_KEY);
}

export function StoryDesigner({ row, onClose, onUpdate }) {
  // Default template, positioned relative to the given canvas dimensions so a
  // new canvas fits whatever preset is active (the y fractions reproduce the
  // original 290×515 story layout exactly).
  const makeDefault = (dims) => {
    const H = dims?.h ?? 515;
    return [
      { id:"bg",  type:"image", url:null, x:0, y:0, scale:1, locked:true, mediaType:'image' },
      { id:uid(), type:"text",  content:"RANGER & FOX",          x:20, y:Math.round(H*0.043), fontSize:8.5, fontFamily:"JetBrains Mono",     color:T.ink, letterSpacing:3,    fontWeight:600, shadow:false },
      { id:uid(), type:"text",  content:row?.note||"Headline",   x:20, y:Math.round(H*0.301), fontSize:24,  fontFamily:"Bricolage Grotesque",color:"#FFFFFF", letterSpacing:-0.5, fontWeight:700, shadow:true  },
      { id:uid(), type:"text",  content:"Supporting detail",      x:20, y:Math.round(H*0.398), fontSize:12,  fontFamily:"Bricolage Grotesque",color:"rgba(255,255,255,0.6)", letterSpacing:0, fontWeight:400, shadow:false },
    ];
  };

  const computeInitialElements = () => {
    // Use previously saved elements for this row
    if (row?.storyElements) return row.storyElements;
    // If a default template exists, clone it (update headline with note)
    const storedDefaultId = loadDefaultTmplId();
    if (storedDefaultId) {
      const storedTemplates = loadSavedTemplates();
      const t = storedTemplates.find(t => t.id === storedDefaultId);
      if (t) {
        const els = t.elements.map(e => ({ ...e, id: e.id === 'bg' ? 'bg' : uid() }));
        const headlineEl = els.find(e => e.type === 'text' && e.fontSize >= 20);
        if (headlineEl && row?.note) headlineEl.content = row.note;
        return els;
      }
    }
    return makeDefault();
  };

  // ── Artboards (multi-canvas pages) ──────────────────────────────────
  // `elements` is a derived view of the ACTIVE page — the rest of the editor
  // is unchanged; setElements writes back to the active page in `pages`.
  const [pages, setPages] = useState(() => {
    if (Array.isArray(row?.storyPages) && row.storyPages.length) {
      return row.storyPages.map(els => ({ id: uid(), elements: els }));
    }
    return [{ id: uid(), elements: computeInitialElements() }];
  });
  const [activePageIdx, setActivePageIdx] = useState(0);
  const activePageIdxRef = useRef(0);
  useEffect(() => { activePageIdxRef.current = activePageIdx; }, [activePageIdx]);

  const elements = useMemo(() => pages[activePageIdx]?.elements || pages[0]?.elements || [], [pages, activePageIdx]);
  const setElements = (updater) => setPages(prev => prev.map((pg, i) =>
    i === activePageIdxRef.current
      ? { ...pg, elements: typeof updater === "function" ? updater(pg.elements) : updater }
      : pg));

  // ── Undo / Redo history ──
  const MAX_HISTORY = 50;
  const [history, setHistory] = useState(() => [elements]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Canvas-deletion undo: deleted pages stack here; Ctrl+Z restores the top
  // entry when the deletion is more recent than the last element edit
  // (otherwise it falls through to normal element undo).
  const deletedPagesRef = useRef([]);
  const lastElementEditRef = useRef(0);

  const pushElements = (newElements) => {
    const resolved = typeof newElements === 'function' ? newElements(elements) : newElements;
    lastElementEditRef.current = Date.now();
    // Compute next history + index OUTSIDE the setState updater — calling a
    // setState inside another's updater throws "cannot update a component
    // while rendering a different component".
    const truncated = history.slice(0, historyIndex + 1);
    const next = [...truncated, resolved].slice(-MAX_HISTORY);
    setHistory(next);
    setHistoryIndex(next.length - 1);
    setElements(resolved);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  };

  // ── Page (artboard) management ──
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  // Canvas-size dropdown (custom popover — the native select can't match
  // the design system and drags the UA focus ring with it).
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const resetPageEditState = (els) => { setHistory([els]); setHistoryIndex(0); setSelectedIds(new Set()); setEditingId(null); };
  const switchPage = (idx) => {
    if (idx === activePageIdx || idx < 0 || idx >= pages.length) return;
    setActivePageIdx(idx);
    resetPageEditState(pages[idx]?.elements || []);
  };
  const addPage = (duplicate) => {
    setPageMenuOpen(false);
    const src = pages[activePageIdx];
    const newEls = duplicate && src
      ? src.elements.map(e => ({ ...e, id: e.id === "bg" ? "bg" : uid() })) // keep the special bg id per page
      : makeDefault(preset);
    const insertAt = activePageIdx + 1;
    setPages(prev => { const next = [...prev]; next.splice(insertAt, 0, { id: uid(), elements: newEls }); return next; });
    setActivePageIdx(insertAt);
    resetPageEditState(newEls);
  };
  const deletePage = (idx) => {
    if (pages.length <= 1) return;
    // Deletion is undoable: Ctrl+Z restores the most recently deleted canvas
    // (when that deletion is more recent than the last element edit).
    deletedPagesRef.current.push({ page: pages[idx], index: idx, at: Date.now() });
    const remaining = pages.filter((_, i) => i !== idx);
    const newActive = idx < activePageIdx ? activePageIdx - 1 : Math.min(idx === activePageIdx ? idx : activePageIdx, remaining.length - 1);
    setPages(remaining);
    setActivePageIdx(newActive);
    resetPageEditState(remaining[newActive]?.elements || []);
  };
  const restoreDeletedPage = () => {
    const entry = deletedPagesRef.current.pop();
    if (!entry) return false;
    const at = Math.min(entry.index, pages.length);
    setPages(prev => { const next = [...prev]; next.splice(Math.min(entry.index, next.length), 0, entry.page); return next; });
    setActivePageIdx(at);
    resetPageEditState(entry.page.elements || []);
    return true;
  };
  const movePage = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= pages.length) return;
    setPages(prev => { const next = [...prev]; [next[idx], next[j]] = [next[j], next[idx]]; return next; });
    setActivePageIdx(a => (a === idx ? j : a === j ? idx : a));
  };

  // ── Panorama: fit one image across every canvas ──
  // The background of each spanned page shares a `bgSpanId`; the slice each
  // page shows is derived from its position among the pages that share the id,
  // so add / delete / reorder re-spread the image automatically.
  const spanFileRef = useRef(null);
  const spanInfoForEls = (pageEls, pageIdx) => {
    const sid = pageEls[pageIdx]?.find(e => e.locked)?.bgSpanId;
    if (!sid) return null;
    const members = [];
    pageEls.forEach((els, i) => { if (els.find(e => e.locked)?.bgSpanId === sid) members.push(i); });
    if (members.length < 2) return null;
    return { total: members.length, index: members.indexOf(pageIdx) };
  };
  const spanInfoFor = (pageIdx) => spanInfoForEls(pages.map(p => p.elements), pageIdx);
  const spanImageAcross = async (file) => {
    if (!file) return;
    try { checkFileSize(file); } catch (err) { setUploadError(err.message); return; }
    const isVid = file.type.startsWith("video/");
    const mType = file.type === "image/gif" ? 'gif' : isVid ? 'video' : 'image';
    const previewUrl = URL.createObjectURL(file);
    const spanId = uid();
    const uploadId = uid();
    setUploadError("");
    setActiveUploads(prev => [...prev, { id: uploadId, name: `Panorama — ${file.name}`, progress: 0 }]);
    // Snapshot the backgrounds so an upload failure can be rolled back — the
    // blob: preview URL is dead after a reload, so it must never be left behind.
    const prevPages = pages;
    const applySpan = els => els.map(e => e.locked ? { ...e, url: previewUrl, mediaType: mType, bgSpanId: spanId } : e);
    setPages(prev => prev.map(pg => ({ ...pg, elements: applySpan(pg.elements) })));
    // Seed the active page's undo history with its post-span state so a later
    // edit can't undo back to a background-less canvas.
    resetPageEditState(applySpan(pages[activePageIdxRef.current]?.elements || []));
    try {
      const publicUrl = await uploadAssetWithProgress(file, (p) => setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: p } : u)));
      setPages(prev => prev.map(pg => ({ ...pg, elements: pg.elements.map(e => (e.locked && e.bgSpanId === spanId) ? { ...e, url: publicUrl } : e) })));
      URL.revokeObjectURL(previewUrl);
      setActiveUploads(prev => prev.filter(u => u.id !== uploadId));
    } catch (err) {
      // Roll back to the pre-span backgrounds and free the blob URL.
      setPages(prevPages);
      resetPageEditState(prevPages[activePageIdxRef.current]?.elements || []);
      URL.revokeObjectURL(previewUrl);
      setUploadError(err?.message || "Upload failed");
      setActiveUploads(prev => prev.filter(u => u.id !== uploadId));
    }
  };

  // ── Guide overlay ──
  const [showGuides, setShowGuides] = useState(false);

  // True once doPost has flattened the current design into storyFrames; the
  // next canvas edit invalidates them so the scheduler can't publish stale
  // frames rendered before the edit.
  const renderedRef = useRef(false);
  const firstSaveRef = useRef(true);

  // Auto-save elements to parent row whenever they change.
  // Persist every page; keep storyElements = page 0 for scheduler/export.
  useEffect(() => {
    if (!onUpdate) return;
    layoutsRef.current[canvasPreset] = pages.map(p => p.elements);
    const patch = {
      storyPages: pages.map(p => p.elements),
      storyElements: pages[0]?.elements || [],
      storyLayouts: { ...layoutsRef.current },
      storyPreset: canvasPreset,
    };
    if (firstSaveRef.current) {
      // Initial mount — don't wipe frames just because the designer opened.
      firstSaveRef.current = false;
    } else if (renderedRef.current || row?.storyFrames || row?.storyFrameUrls || row?.mediaUrl) {
      // The design changed after a render (this session or a prior one) — drop
      // the now-stale flattened frames so a re-render is required before publishing.
      renderedRef.current = false;
      Object.assign(patch, { storyFrames: null, storyFrameUrls: null, storyFramesPosted: 0, storyFrameIds: null, mediaUrl: null, thumbnailUrl: null });
      if (postState === "done") setPostState("idle");
      
    }
    onUpdate(patch);
  }, [pages, onUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedIds, setSelectedIds]  = useState(new Set());
  const [editingId,   setEditingId]   = useState(null);
  // Convenience: single selectedId for backward compat in properties panel
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const [zoom,        setZoom]        = useState(1.8);
  const [activeUploads, setActiveUploads] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const [canvasPreset, setCanvasPreset] = useState(() =>
    row?.storyPreset || PLATFORM_TO_PRESET[row?.platform] || "ig_story");
  // Per-outlet arrangements: presetKey → array of page element-arrays. The
  // design is shared; each outlet remembers how it was hand-arranged after
  // the automatic reflow.
  const layoutsRef = useRef({ ...(row?.storyLayouts || {}) });
  const [postState,   setPostState]   = useState("idle");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiTips,      setAiTips]      = useState([]);
  const [templates,   setTemplates]   = useState(() => loadSavedTemplates());
  const [defaultId,   setDefaultId]   = useState(() => loadDefaultTmplId());
  const [tmplName,    setTmplName]    = useState("");
  const [showTmplSave,setShowTmplSave]= useState(false);
  const [snapOn,      setSnapOn]      = useState(true);
  const [guides,      setGuides]      = useState([]);
  const [ctxMenu,     setCtxMenu]     = useState(null); // { x, y, id } right-click menu
  const [marquee,     setMarquee]     = useState(null); // rubber-band select rect (canvas coords)
  // Layer drag-to-reorder state
  const [dragLayerIdx, setDragLayerIdx] = useState(null);
  const [dragOverLayerIdx, setDragOverLayerIdx] = useState(null);

  const handleLayerDragStart = (idx) => setDragLayerIdx(idx);
  const handleLayerDragOver = (e, idx) => { e.preventDefault(); setDragOverLayerIdx(idx); };
  const handleLayerDrop = (idx) => {
    if (dragLayerIdx === null || dragLayerIdx === idx) return;
    const reordered = [...elements];
    const [moved] = reordered.splice(dragLayerIdx, 1);
    reordered.splice(idx, 0, moved);
    setElements(reordered);
    pushElements(reordered);
    setDragLayerIdx(null);
    setDragOverLayerIdx(null);
  };
  // Sidebar tab: null = collapsed, 'elements' | 'text' | 'uploads' | 'templates' | 'layers' | 'ai'
  const [sideTab, setSideTab] = useState('elements');
  // Fonts panel: which font's weight sub-list is expanded.
  const [fontOpenName, setFontOpenName] = useState(null);
  // Uploads library (media_assets table): null until first opened.
  const [libAssets, setLibAssets] = useState(null);
  const [libQuery, setLibQuery] = useState("");
  const [libFilter, setLibFilter] = useState("image");
  const bgFileRef  = useRef(null);
  const imgFileRef = useRef(null);
  const vidFileRef = useRef(null);
  const fontFileRef = useRef(null);

  // Custom fonts
  const [customFonts, setCustomFonts] = useState(() => loadCustomFonts());
  // Brand fonts live in the synced brand profile (uploaded to storage), so a
  // font added once follows the brand to every device; localStorage stays as
  // the device-local cache/fallback.
  const { brandProfile, updateBrandProfile } = useStudio();
  useEffect(() => {
    const brandFonts = brandProfile?.fonts || [];
    if (!brandFonts.length) return;
    brandFonts.forEach(bf => {
      if (!bf.url) return;
      const face = new FontFace(bf.name, `url(${bf.url})`);
      face.load().then(() => document.fonts.add(face)).catch(() => {});
    });
    setCustomFonts(prev => {
      const have = new Set(prev.map(p => p.name));
      return [...prev, ...brandFonts.filter(bf => !have.has(bf.name))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [fontInstalling, setFontInstalling] = useState(false);
  const [fontError, setFontError] = useState(null);

  const handleFontUpload = async (file) => {
    if (!file) return;
    setFontInstalling(true);
    setFontError(null);
    try {
      const font = await installFontFile(file);
      const updated = [...customFonts, font];
      setCustomFonts(updated);
      saveCustomFonts(updated);
      // Persist to brand assets: host the file, store by URL in the profile.
      try {
        const url = await uploadAssetWithProgress(file, () => {});
        updateBrandProfile({ fonts: [...(brandProfile?.fonts || []).filter(bf => bf.name !== font.name), { id: font.id, name: font.name, label: font.label, url }] });
      } catch { /* upload failed — font stays device-local */ }
    } catch (err) {
      setFontError(err.message);
    }
    setFontInstalling(false);
  };

  const removeCustomFont = (fontId) => {
    const updated = customFonts.filter(f => f.id !== fontId);
    setCustomFonts(updated);
    saveCustomFonts(updated);
    updateBrandProfile({ fonts: (brandProfile?.fonts || []).filter(bf => bf.id !== fontId) });
  };

  const preset = CANVAS_PRESETS.find(p => p.key === canvasPreset) || CANVAS_PRESETS[0];
  const selected  = selectedId ? elements.find(el => el.id === selectedId) : null;
  const selectedFontDef = selected?.type === "text"
    ? [...ALL_FONTS, ...customFonts].find(f => f.name === selected.fontFamily)
    : null;

  // The size dropdown offers only the post's outlets (mapped to presets).
  // A post with no outlet list — or one opened outside the post flow —
  // still gets the full preset menu.
  const rowPlatforms = Array.isArray(row?.platforms) && row.platforms.length
    ? row.platforms
    : (row?.platform ? [row.platform] : []);
  const outletPresetKeys = [...new Set(rowPlatforms.map(p => PLATFORM_TO_PRESET[p]).filter(Boolean))];
  const presetOptions = outletPresetKeys.length
    ? CANVAS_PRESETS.filter(p => outletPresetKeys.includes(p.key) || p.key === canvasPreset)
    : CANVAS_PRESETS;

  // Reflow one page's elements from one canvas size into another — positions
  // per-axis (nothing can end up clipped off-canvas), type and media by the
  // geometric mean of the two ratios so scale stays proportionate in both
  // directions. Backgrounds cover-fit on their own.
  const rescaleElements = (els, from, to) => {
    const wR = to.w / from.w;
    const hR = to.h / from.h;
    const sR = Math.sqrt(wR * hR);
    return els.map(e => {
      if (e.locked) return e;
      const out = { ...e, x: Math.round(e.x * wR), y: Math.round(e.y * hR) };
      if (out.boxWidth) out.boxWidth = Math.max(20, Math.round(out.boxWidth * wR));
      if (out.fontSize) out.fontSize = Math.max(4, +(out.fontSize * sR).toFixed(1));
      if (out.letterSpacing) out.letterSpacing = +(out.letterSpacing * sR).toFixed(2);
      if (out.width) out.width = Math.max(8, Math.round(out.width * sR));
      if (out.height) out.height = Math.max(8, Math.round(out.height * sR));
      return out;
    });
  };

  // Switching outlet: remember the outgoing arrangement, restore the target
  // outlet's own arrangement if it has one, otherwise reflow the shared
  // design into the new dimensions.
  const handlePresetChange = (key) => {
    const next = CANVAS_PRESETS.find(p => p.key === key);
    if (!next || next.key === preset.key) return;
    layoutsRef.current[preset.key] = pages.map(p => p.elements);
    const saved = layoutsRef.current[next.key];
    if (Array.isArray(saved) && saved.length) {
      const restored = saved.map(els => ({ id: uid(), elements: els }));
      setPages(restored);
      setActivePageIdx(0);
      setCanvasPreset(key);
      resetPageEditState(restored[0].elements);
      return;
    }
    const rescaledActive = rescaleElements(pages[activePageIdxRef.current]?.elements || [], preset, next);
    setPages(prev => prev.map(pg => ({ ...pg, elements: rescaleElements(pg.elements, preset, next) })));
    setCanvasPreset(key);
    resetPageEditState(rescaledActive);
  };

  // Helper: select element(s) with shift support
  const handleSelect = (id, shiftKey) => {
    if (shiftKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  };

  // Clicking the background opens the Background panel. Unlocked elements
  // edit through the contextual top bar; the full inspector stays a click
  // away behind the top bar's "⋯" button.
  useEffect(() => {
    if (selected?.locked) setSideTab("props");
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateEl  = (id, patch) => setElements(els => els.map(e => e.id === id ? { ...e, ...patch } : e));
  const deleteEl  = (id) => { pushElements(els => els.filter(e => e.id !== id)); setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); };
  const deleteSelected = () => {
    const toDelete = [...selectedIds].filter(id => { const el = elements.find(e => e.id === id); return el && !el.locked; });
    if (toDelete.length === 0) return;
    pushElements(els => els.filter(e => !toDelete.includes(e.id)));
    setSelectedIds(new Set());
  };
  // Vector shapes (Figma-style): centered on the canvas, selected on insert.
  const addShape = (shape) => {
    const dims = shape === 'line' ? { width: 140, height: 12 }
      : shape === 'arrow' ? { width: 140, height: 16 }
      : { width: 110, height: 110 };
    const id = uid();
    pushElements(els => [...els, {
      id, type: 'shape', shape, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 1, strokeCap: 'butt', strokeAlign: 'center', scale: 1,
      x: Math.round(preset.w / 2 - dims.width / 2),
      y: Math.round(preset.h / 2 - dims.height / 2),
      ...dims,
    }]);
    setSelectedIds(new Set([id]));
  };

  // Canva-style duplicate (Cmd/Ctrl+D): clone selected elements offset by 16px.
  const duplicateSelected = () => {
    const toDup = elements.filter(el => selectedIds.has(el.id) && !el.locked);
    if (toDup.length === 0) return;
    const copies = toDup.map(el => ({ ...el, id: uid(), x: (el.x || 0) + 16, y: (el.y || 0) + 16 }));
    pushElements([...elements, ...copies]);
    setSelectedIds(new Set(copies.map(c => c.id)));
  };

  // Copy / paste (Cmd+C / Cmd+V) — session-local clipboard (module scope, so
  // it survives closing/reopening the designer).
  const copySelected = () => {
    const sel = elements.filter(e => selectedIds.has(e.id) && !e.locked);
    if (sel.length) designerClipboard = sel.map(e => ({ ...e }));
  };
  const pasteClipboard = () => {
    const items = designerClipboard;
    if (!items?.length) return;
    const copies = items.map(e => ({ ...e, id: uid(), x: (e.x || 0) + 16, y: (e.y || 0) + 16 }));
    pushElements([...elements, ...copies]);
    setSelectedIds(new Set(copies.map(c => c.id)));
  };

  // Z-order (locked background always stays at the bottom).
  const reorderZ = (id, where) => {
    const el = elements.find(e => e.id === id);
    if (!el || el.locked) return;
    const locked = elements.filter(e => e.locked);
    const movable = elements.filter(e => !e.locked && e.id !== id);
    const mIdx = elements.filter(e => !e.locked).findIndex(e => e.id === id);
    if (where === "front") movable.push(el);
    else if (where === "back") movable.unshift(el);
    else if (where === "forward") movable.splice(Math.min(mIdx + 1, movable.length), 0, el);
    else movable.splice(Math.max(mIdx - 1, 0), 0, el); // backward
    pushElements([...locked, ...movable]);
  };

  // ── Alignment functions ──

  // Multi-drag: store start positions for all selected elements
  const dragStartRef = useRef({});
  const initMultiDrag = () => {
    const starts = {};
    selectedIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el && !el.locked) starts[id] = { x: el.x, y: el.y };
    });
    dragStartRef.current = starts;
  };
  const multiDrag = (dx, dy) => {
    const starts = dragStartRef.current;
    setElements(els => els.map(e => {
      if (starts[e.id]) return { ...e, x: starts[e.id].x + dx, y: starts[e.id].y + dy };
      return e;
    }));
  };

  // Arrow-key nudge (1px, or 10px with Shift) — skip while inline editing
  useEffect(() => {
    const onKey = (e) => {
      if (editingId) return;
      if (selectedIds.size === 0) return;
      const arrows = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0] };
      const dir = arrows[e.key];
      if (!dir) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      selectedIds.forEach(id => {
        const sel = elements.find(el => el.id === id);
        if (sel && !sel.locked) updateEl(id, { x: sel.x + dir[0] * step, y: sel.y + dir[1] * step });
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, elements, editingId]);

  const canvasRef = useRef(null);

  // Opening the Fonts panel starts with the current font's weights expanded.
  useEffect(() => {
    if (sideTab === "fonts") setFontOpenName(selected?.fontFamily || null);
  }, [sideTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the shared asset library the first time the Uploads tab opens.
  useEffect(() => {
    if (sideTab !== "uploads" || libAssets !== null) return;
    let cancelled = false;
    fetchAssets()
      .then(rows => { if (!cancelled) setLibAssets(rows || []); })
      .catch(() => { if (!cancelled) setLibAssets([]); });
    return () => { cancelled = true; };
  }, [sideTab, libAssets]);

  // Place an already-hosted library asset on the canvas — no re-upload.
  const addMediaFromUrl = (asset) => {
    const id = uid();
    const isVid = asset.type === "video";
    const isGif = /\.gif($|\?)/i.test(asset.url || "") || /\.gif$/i.test(asset.name || "");
    const base = {
      id, type: "image", url: asset.url, x: 56, y: 140, scale: 1, locked: false,
      mediaType: isVid ? "video" : isGif ? "gif" : "image",
      loop: true, muted: true, autoPlay: true,
      trimLabel: (asset.name || "").split(".").pop()?.toUpperCase() || "",
    };
    const place = (w, h) => { pushElements(els => [...els, { ...base, width: w, height: h }]); setSelectedIds(new Set([id])); };
    if (isVid) { place(160, 284); return; }
    const img = new window.Image();
    img.onload = () => { const fitted = fitMediaBox(img.naturalWidth, img.naturalHeight); place(fitted.width, fitted.height); };
    img.onerror = () => place(160, 160);
    img.src = asset.url;
  };

  const addText = (dropX, dropY) => {
    const el = { id:uid(), type:"text", content:"New text", x: dropX ?? 40, y: dropY ?? 180, fontSize:18, fontFamily:"Bricolage Grotesque", color:"#FFFFFF", letterSpacing:0, fontWeight:600, shadow:false };
    pushElements(els => [...els, el]); setSelectedIds(new Set([el.id]));
  };

  const addMedia = async (file, dropX, dropY) => {
    if (!file) return;
    try {
      checkFileSize(file);
    } catch (err) {
      setUploadError(err.message);
      return;
    }

    const isGif  = file.type === "image/gif";
    const isVid  = !isGif && file.type.startsWith("video/");
    const mType  = isGif ? 'gif' : isVid ? 'video' : 'image';

    // Show a local preview URL while the upload runs so the user sees
    // the media immediately. The element's real `url` is the Supabase
    // public URL (stored on completion). Never persist the blob URL —
    // it doesn't survive reloads and can't be used by the publisher.
    const previewUrl = URL.createObjectURL(file);
    const elementId = uid();
    setUploadError("");
    setActiveUploads((prev) => [...prev, { id: elementId, name: file.name, progress: 0 }]);

    const makeEl = (w, h, url) => ({
      id: elementId,
      type: "image",
      url,
      x: dropX ?? 56,
      y: dropY ?? 140,
      scale: 1,
      width: w,
      height: h,
      locked: false,
      mediaType: mType,
      loop: true,
      muted: true,
      autoPlay: true,
      trimLabel: file.name.split('.').pop().toUpperCase(),
      _uploading: true,
    });

    // Place the element with the preview URL first so it renders.
    const placeElement = (w, h) => {
      pushElements((els) => [...els, makeEl(w, h, previewUrl)]);
      setSelectedIds(new Set([elementId]));
    };

    if (!isVid) {
      const img = new window.Image();
      img.onload = () => {
        const fitted = fitMediaBox(img.naturalWidth, img.naturalHeight);
        placeElement(fitted.width, fitted.height);
      };
      img.src = previewUrl;
    } else {
      placeElement(160, 284);
    }

    try {
      const publicUrl = await uploadAssetWithProgress(file, (p) => {
        setActiveUploads((prev) => prev.map((u) => u.id === elementId ? { ...u, progress: p } : u));
      });
      // Swap the preview URL for the real public URL + clear the flag.
      pushElements((els) => els.map((el) => el.id === elementId ? { ...el, url: publicUrl, _uploading: false } : el));
      URL.revokeObjectURL(previewUrl);
      setActiveUploads((prev) => prev.filter((u) => u.id !== elementId));
      // Register in the shared asset library so it shows up in Uploads
      // (and in the Assets view) from now on. Best-effort.
      saveAsset({ name: file.name, url: publicUrl, type: isVid ? "video" : "image", size_bytes: file.size })
        .then((saved) => setLibAssets((a) => (Array.isArray(a) ? [saved, ...a] : a)))
        .catch(() => {});
    } catch (err) {
      setUploadError(err?.message || "Upload failed");
      pushElements((els) => els.filter((el) => el.id !== elementId));
      URL.revokeObjectURL(previewUrl);
      setActiveUploads((prev) => prev.filter((u) => u.id !== elementId));
    }
  };

  const setBg = async (file) => {
    if (!file) return;
    try {
      checkFileSize(file);
    } catch (err) {
      setUploadError(err.message);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const isGif = file.type === "image/gif";
    const isVid = !isGif && file.type.startsWith("video/");
    const mType = isGif ? 'gif' : isVid ? 'video' : 'image';
    const uploadId = uid();
    setUploadError("");
    setActiveUploads((prev) => [...prev, { id: uploadId, name: `Background \u2014 ${file.name}`, progress: 0 }]);
    pushElements(els => els.map(e => e.id === "bg" ? { ...e, url: previewUrl, mediaType: mType, bgSpanId: undefined } : e));
    try {
      const publicUrl = await uploadAssetWithProgress(file, (p) => {
        setActiveUploads((prev) => prev.map((u) => u.id === uploadId ? { ...u, progress: p } : u));
      });
      pushElements(els => els.map(e => e.id === "bg" ? { ...e, url: publicUrl } : e));
      URL.revokeObjectURL(previewUrl);
      setActiveUploads((prev) => prev.filter((u) => u.id !== uploadId));
    } catch (err) {
      setUploadError(err?.message || "Upload failed");
      setActiveUploads((prev) => prev.filter((u) => u.id !== uploadId));
    }
  };

  // Replace an existing media element's source, keeping position/size/scale
  const replaceMedia = async (elementId, file) => {
    if (!file) return;
    try {
      checkFileSize(file);
    } catch (err) {
      setUploadError(err.message);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const isGif = file.type === "image/gif";
    const isVid = !isGif && file.type.startsWith("video/");
    const mType = isGif ? 'gif' : isVid ? 'video' : 'image';
    const uploadId = uid();
    setUploadError("");
    setActiveUploads((prev) => [...prev, { id: uploadId, name: file.name, progress: 0 }]);
    pushElements(els => els.map(e =>
      e.id === elementId ? { ...e, url: previewUrl, mediaType: mType, trimLabel: file.name.split('.').pop().toUpperCase() } : e
    ));
    try {
      const publicUrl = await uploadAssetWithProgress(file, (p) => {
        setActiveUploads((prev) => prev.map((u) => u.id === uploadId ? { ...u, progress: p } : u));
      });
      pushElements(els => els.map(e => e.id === elementId ? { ...e, url: publicUrl } : e));
      URL.revokeObjectURL(previewUrl);
      setActiveUploads((prev) => prev.filter((u) => u.id !== uploadId));
    } catch (err) {
      setUploadError(err?.message || "Upload failed");
      setActiveUploads((prev) => prev.filter((u) => u.id !== uploadId));
    }
  };

  // Canvas-level drop: add media or set background
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  // Marquee (rubber-band) select: drag a box on empty canvas to select the
  // elements it touches. A plain click (no drag) just deselects.
  const handleCanvasPointerDown = (e) => {
    if (e.target !== e.currentTarget) return; // only when starting on empty canvas
    setEditingId(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) { setSelectedIds(new Set()); return; }
    const x0 = (e.clientX - rect.left) / zoom;
    const y0 = (e.clientY - rect.top) / zoom;
    let moved = false;
    setMarquee({ x0, y0, x1: x0, y1: y0 });
    const onMove = (mv) => {
      moved = true;
      setMarquee({ x0, y0, x1: (mv.clientX - rect.left) / zoom, y1: (mv.clientY - rect.top) / zoom });
    };
    const onUp = (mv) => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      setMarquee(null);
      if (!moved) { setSelectedIds(new Set()); return; }
      const x1 = (mv.clientX - rect.left) / zoom, y1 = (mv.clientY - rect.top) / zoom;
      const rx0 = Math.min(x0, x1), rx1 = Math.max(x0, x1), ry0 = Math.min(y0, y1), ry1 = Math.max(y0, y1);
      const hits = elements.filter(el => {
        if (el.locked) return false;
        const w = el.type === "text" ? (el.boxWidth || 190) : (el.width || 140) * (el.scale || 1);
        const h = el.type === "text" ? 40 : (el.height || 140) * (el.scale || 1);
        return el.x < rx1 && el.x + w > rx0 && el.y < ry1 && el.y + h > ry0;
      }).map(el => el.id);
      setSelectedIds(new Set(hits));
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const handleCanvasDragOver = (e) => { e.preventDefault(); setCanvasDragOver(true); };
  const handleCanvasDragLeave = (e) => {
    // Only trigger if leaving the canvas itself, not a child
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setCanvasDragOver(false);
  };
  const handleCanvasDrop = (e) => {
    e.preventDefault();
    setCanvasDragOver(false);
    // Check for toolbar element drag
    const toolType = e.dataTransfer.getData("application/rf-tool-type");
    if (toolType) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        const x = (e.clientX - canvasRect.left) / zoom;
        const y = (e.clientY - canvasRect.top) / zoom;
        if (toolType === "text") addText(x, y);
        else if (toolType === "image") imgFileRef.current?.click();
        else if (toolType === "video") vidFileRef.current?.click();
      }
      return;
    }
    const file = e.dataTransfer?.files?.[0];
    if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/"))) return;
    // Always place a dropped file as a positionable element (selected on
    // insert, deselecting whatever was selected) — the background is set
    // explicitly from the Background panel, not by a stray drop.
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      addMedia(file, (e.clientX - canvasRect.left) / zoom, (e.clientY - canvasRect.top) / zoom);
    } else {
      addMedia(file);
    }
  };

  // ── Render the story to a flattened canvas (shared by PNG export +
  //    the real publish path, which needs a hosted image URL). Defaults to the
  //    active page; pass explicit elements + span info to flatten any page
  //    (used when rendering every canvas of a multi-frame story). ──
  const renderCanvas = async (els = elements, spanInfo = spanInfoFor(activePageIdxRef.current), rPreset = preset) => {
    const EXPORT_W = rPreset.exportW;
    const EXPORT_H = rPreset.exportH;
    const SCALE = EXPORT_W / rPreset.w;

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_W;
    canvas.height = EXPORT_H;
    const ctx = canvas.getContext("2d");

    // Draw background
    const bgEl = els.find(e => e.locked);
    if (bgEl?.url && bgEl.mediaType !== 'video') {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = bgEl.url; });
      const sp = spanInfo;
      if (sp && sp.total > 1 && img.width) {
        // Cover-fit the image across the full N-canvas panorama, then draw
        // only this page's slice (the same maths as the CSS preview).
        const totalW = EXPORT_W * sp.total;
        const scale = Math.max(totalW / img.width, EXPORT_H / img.height);
        const drawW = img.width * scale, drawH = img.height * scale;
        const offsetX = (totalW - drawW) / 2;
        const offsetY = (EXPORT_H - drawH) / 2;
        ctx.drawImage(img, offsetX - sp.index * EXPORT_W, offsetY, drawW, drawH);
      } else {
        ctx.drawImage(img, 0, 0, EXPORT_W, EXPORT_H);
      }
    } else if (bgEl?.url && bgEl.mediaType === 'video') {
      // A video that must be flattened (overlays on top, or a still export):
      // capture its first frame as a poster so the frame isn't a black
      // rectangle. Best-effort — a cross-origin video with no CORS headers
      // taints the canvas, so fall back to the dark fill.
      ctx.fillStyle = "#080A0E";
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
      try {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.preload = "auto";
        video.src = bgEl.url;
        await new Promise((resolve) => { video.onloadeddata = resolve; video.onerror = resolve; });
        await new Promise((resolve) => {
          video.onseeked = resolve;
          try { video.currentTime = Math.min(0.1, (video.duration || 1) / 2); } catch { resolve(); }
          setTimeout(resolve, 600); // don't hang if seek never fires
        });
        if (video.videoWidth) ctx.drawImage(video, 0, 0, EXPORT_W, EXPORT_H);
      } catch { /* keep the dark fallback */ }
    } else {
      ctx.fillStyle = bgEl?.fill || "#080A0E";
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
    }

    // Draw vector shapes (under text, mirroring the editor stack)
    for (const el of els.filter(e => !e.locked && e.type === "shape")) {
      const w = (el.width || 110) * (el.scale || 1) * SCALE;
      const h = (el.height || 110) * (el.scale || 1) * SCALE;
      ctx.save();
      ctx.translate(el.x * SCALE + w / 2, el.y * SCALE + h / 2);
      if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = el.opacity ?? 1;
      ctx.lineCap = (el.strokeCap === "round" || el.strokeStyle === "dot") ? "round" : "butt";
      ctx.lineJoin = el.strokeCap === "round" ? "round" : "miter";
      const dashUnit = Math.max((el.strokeWidth || 1), 1) * SCALE;
      ctx.setLineDash(el.strokeStyle === "dash" ? [dashUnit*3, dashUnit*2]
        : el.strokeStyle === "minidash" ? [dashUnit*1.5, dashUnit*1.5]
        : el.strokeStyle === "dot" ? [0.01, dashUnit*2.2] : []);
      if (el.shape === "line") {
        ctx.strokeStyle = el.stroke || "#FFFFFF";
        ctx.lineWidth = Math.max((el.strokeWidth || 1) * SCALE, SCALE);
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        ctx.restore(); continue;
      }
      // Rebuildable path (alignment strokes need it more than once), matching
      // ShapeSVG's unit geometry exactly — including the single closed arrow.
      const buildPath = () => {
        ctx.beginPath();
        if (el.shape === "ellipse") ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        else if (el.shape === "polygon") { ctx.moveTo(w / 2, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); }
        else if (el.shape === "star") {
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            const r = i % 2 ? 0.19 : 0.5;
            const px = w / 2 + r * w * Math.cos(a), py = h / 2 + r * h * Math.sin(a);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
        } else if (el.shape === "arrow") {
          ctx.moveTo(0, h * 0.38); ctx.lineTo(w * 0.74, h * 0.38); ctx.lineTo(w * 0.74, h * 0.08);
          ctx.lineTo(w, h * 0.5); ctx.lineTo(w * 0.74, h * 0.92); ctx.lineTo(w * 0.74, h * 0.62);
          ctx.lineTo(0, h * 0.62); ctx.closePath();
        } else {
          ctx.rect(0, 0, w, h);
        }
      };
      // Stroke alignment mirrors the ShapeSVG technique: outside = 2x stroke
      // painted under the fill; inside = 2x stroke clipped to the path over
      // it; center = a normal stroke.
      const sw = (el.strokeWidth > 0 ? el.strokeWidth : 0) * SCALE;
      const align = el.strokeAlign || "center";
      ctx.strokeStyle = el.stroke || "#FFFFFF";
      ctx.fillStyle = el.fill || "#FFFFFF";
      if (sw > 0 && align === "outside") { buildPath(); ctx.lineWidth = sw * 2; ctx.stroke(); }
      buildPath();
      ctx.fill();
      if (sw > 0 && align === "center") { ctx.lineWidth = sw; ctx.stroke(); }
      if (sw > 0 && align === "inside") {
        ctx.save(); buildPath(); ctx.clip();
        ctx.lineWidth = sw * 2; buildPath(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // Draw text elements
    for (const el of els.filter(e => !e.locked && e.type === "text")) {
      ctx.save();
      const x = el.x * SCALE;
      const y = el.y * SCALE;
      const fontSize = (el.fontSize || 18) * SCALE;

      if (el.rotation) {
        const cx = x + ((el.boxWidth || 190) * SCALE) / 2;
        const cy = y + fontSize / 2;
        ctx.translate(cx, cy);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }

      ctx.font = `${el.fontWeight || 600} ${fontSize}px ${el.fontFamily || "sans-serif"}`;
      ctx.fillStyle = el.gradient ? el.gradient : (el.color || "#fff");
      ctx.textBaseline = "top";

      if (el.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 12 * SCALE;
      }

      // Word wrap (uppercase + list markers applied first; justify falls
      // back to left in the flattened render)
      const maxWidth = (el.boxWidth || 190) * SCALE;
      let source = el.content || "";
      if (el.uppercase) source = source.toUpperCase();
      if (el.listStyle) source = source.split("\n").map((ln, i) => (el.listStyle === "number" ? `${i + 1}. ` : "\u2022 ") + ln).join("\n");
      const align = el.textAlign === "center" ? "center" : el.textAlign === "right" ? "right" : "left";
      ctx.textAlign = align;
      const anchorX = align === "center" ? x + maxWidth / 2 : align === "right" ? x + maxWidth : x;
      const words = source.split(" ");
      let line = "";
      let lineY = y;
      const lineHeight = fontSize * (el.lineHeight || 1.25);

      for (const word of words) {
        const test = line + (line ? " " : "") + word;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, anchorX, lineY);
          line = word;
          lineY += lineHeight;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, anchorX, lineY);
      ctx.textAlign = "left";
      ctx.restore();
    }

    // Draw image / GIF elements
    for (const el of els.filter(e => !e.locked && (e.type === "image" || e.mediaType === "image" || e.mediaType === "gif") && e.url && e.mediaType !== "video")) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = el.url; });
        const scale = el.scale || 1;
        ctx.save();
        if (el.rotation) {
          const cx = el.x * SCALE + ((el.width || img.width) * scale * SCALE) / 2;
          const cy = el.y * SCALE + ((el.height || img.height) * scale * SCALE) / 2;
          ctx.translate(cx, cy);
          ctx.rotate((el.rotation * Math.PI) / 180);
          ctx.translate(-cx, -cy);
        }
        ctx.drawImage(img, el.x * SCALE, el.y * SCALE, (el.width || img.width) * scale * SCALE, (el.height || img.height) * scale * SCALE);
        ctx.restore();
      } catch { /* skip failed images */ }
    }

    return canvas;
  };

  // Download every canvas as its own PNG (one file per frame for a multi-canvas
  // story) so a manual post can rebuild the whole story by hand.
  const exportAsPng = async () => {
    for (let i = 0; i < pages.length; i++) {
      const canvas = await renderCanvas(pages[i].elements, spanInfoFor(i));
      const link = document.createElement("a");
      link.download = pages.length > 1 ? `story-frame-${i + 1}.png` : `story-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png"); // throws on a tainted canvas
      link.click();
      // Stagger downloads — browsers block a rapid burst of programmatic clicks.
      if (i < pages.length - 1) await new Promise((r) => setTimeout(r, 250));
    }
  };

  const renderToBlob = async (els, spanInfo, rPreset) => {
    const canvas = await renderCanvas(els, spanInfo, rPreset);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Render failed"))), "image/png"));
  };

  // Save template
  const saveTemplate = () => {
    if (!tmplName.trim()) return;
    const tmpl = {
      id: uid(),
      name: tmplName.trim(),
      elements: elements.map(e => ({ ...e, url: e.locked ? null : e.url })), // strip bg URL
    };
    const updated = [...templates, tmpl];
    setTemplates(updated); saveSavedTemplates(updated);
    setTmplName(""); setShowTmplSave(false);
  };

  const setDefault = (id) => {
    const newId = id === defaultId ? null : id;
    setDefaultId(newId); saveDefaultTmplId(newId);
  };

  const deleteTemplate = (tmplId) => {
    const updated = templates.filter(t => t.id !== tmplId);
    setTemplates(updated);
    saveSavedTemplates(updated);
    if (defaultId === tmplId) { setDefaultId(null); saveDefaultTmplId(null); }
  };

  const loadTemplate = (tmpl) => {
    const els = tmpl.elements.map(e => ({ ...e, id: e.id === 'bg' ? 'bg' : uid() }));
    pushElements(els); setSelectedIds(new Set());
  };

  const runAICopilot = async () => {
    setAiLoading(true); setAiTips([]);
    const boardCtx = elements.filter(e => !e.locked).map(e => ({
      type: e.type, content: e.type==='text'?e.content:'Media',
      position: { x:Math.round(e.x), y:Math.round(e.y) },
      fontSize: e.fontSize, color: e.color,
    }));
    try {
      const data = await generateStoryTips(boardCtx);
      setAiTips(data.tips?.length ? data.tips : ["Keep text above y=340 (safe zone).","Use high-contrast headline color.","Anchor R&F logo to a corner for brand safety."]);
    } catch { setAiTips(["Keep text above y=340 (safe zone).","Use high-contrast headline color.","Anchor R&F logo to a corner for brand safety."]); }
    setAiLoading(false);
  };

  // Real publish prep: flatten EVERY canvas to an image, upload each, and
  // attach them as the post's story frames so the scheduler can publish them
  // as a multi-frame story (one frame per canvas, in order). Frame 0 doubles
  // as mediaUrl/thumbnailUrl for back-compat (the readiness gate + previews).
  // No fake "live", no approval bypass — the normal schedule/approval flow
  // still governs when it actually posts.
  const doPost = async () => {
    setUploadError("");
    setPostState("posting");
    try {
      // Frames publish at the PRIMARY outlet's dimensions, whatever size the
      // designer happens to be viewing: use that outlet's own arrangement if
      // one was saved, else reflow the current design into it.
      const primaryKey = PLATFORM_TO_PRESET[row?.platform] || preset.key;
      const rPreset = CANVAS_PRESETS.find(p => p.key === primaryKey) || preset;
      let framePages = pages.map(p => p.elements);
      if (rPreset.key !== preset.key) {
        const saved = layoutsRef.current[rPreset.key];
        framePages = Array.isArray(saved) && saved.length
          ? saved
          : framePages.map(els => rescaleElements(els, preset, rPreset));
      }
      const frames = [];
      for (let i = 0; i < framePages.length; i++) {
        const els = framePages[i];
        const bg = els.find(e => e.locked);
        // Overlays (text or a placed image) can't be composited onto a video
        // via the Graph API, so a canvas only publishes as a real video frame
        // when its video background stands alone; otherwise it's flattened.
        const hasOverlay = els.some(e => !e.locked && ((e.type === "text" && (e.content || "").trim()) || (e.type === "image" && e.url)));
        // Only a fully-uploaded (public) video can be published directly; a
        // still-uploading blob: URL isn't reachable by the API, so flatten it.
        if (bg?.mediaType === "video" && bg.url && !bg.url.startsWith("blob:") && !hasOverlay) {
          frames.push({ url: bg.url, kind: "video" });
        } else {
          const blob = await renderToBlob(els, spanInfoForEls(framePages, i), rPreset);
          const file = new File([blob], `story-${row?.id || "draft"}-${i + 1}.png`, { type: "image/png" });
          frames.push({ url: await uploadAssetWithProgress(file, () => {}), kind: "image" });
        }
      }
      // A fresh render supersedes any partial publish from a previous attempt.
      // Thumbnail must be a still image: prefer the first flattened frame, and
      // if every frame is a raw video, render page 0 to a poster so the queue /
      // grid / publish-confirm previews (which use <img>) aren't broken.
      let thumbnailUrl = frames.find(f => f.kind === "image")?.url;
      if (!thumbnailUrl) {
        const posterBlob = await renderToBlob(framePages[0], spanInfoForEls(framePages, 0), rPreset);
        const posterFile = new File([posterBlob], `story-${row?.id || "draft"}-poster.png`, { type: "image/png" });
        thumbnailUrl = await uploadAssetWithProgress(posterFile, () => {});
      }
      onUpdate?.({
        mediaUrl: frames[0].url,
        thumbnailUrl,
        storyFrames: frames,
        storyFramesPosted: 0,
        storyFrameIds: [],
      });
      renderedRef.current = true; // a later canvas edit will invalidate these frames
      setPostState("done");
    } catch {
      setPostState("idle");
      setUploadError("Couldn't render & upload the story — a cross-site background can block it. Try re-uploading the background.");
    }
  };


  // Undo/Redo keyboard shortcuts. Ctrl+Z restores a just-deleted canvas when
  // that deletion is the most recent action; otherwise it's element undo.
  useEffect(() => {
    const hUR = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const stack = deletedPagesRef.current;
        if (stack.length && stack[stack.length - 1].at > lastElementEditRef.current) restoreDeletedPage();
        else undo();
      }
      if (mod && e.key === 'z' && e.shiftKey)  { e.preventDefault(); redo(); }
      if (mod && e.key === 'y')                 { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', hUR);
    return () => window.removeEventListener('keydown', hUR);
  }, [historyIndex, history, pages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push elements to history on pointerup (after drag / resize finishes)
  useEffect(() => {
    const onUp = () => {
      const last = history[history.length - 1];
      if (JSON.stringify(last) === JSON.stringify(elements)) return;
      const truncated = history.slice(0, historyIndex + 1);
      const next = [...truncated, elements].slice(-MAX_HISTORY);
      setHistory(next);
      setHistoryIndex(next.length - 1);
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [elements, history, historyIndex]);

  useEffect(() => {
    const h = (e) => {
      if (editingId) return;
      const inField = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateSelected(); return; }
      if (mod && (e.key === 'c' || e.key === 'C') && !inField && selectedIds.size > 0) { e.preventDefault(); copySelected(); return; }
      if ((e.key==='Backspace'||e.key==='Delete') && selectedIds.size > 0 && !inField) deleteSelected();
      if (e.key==='Escape') { setSelectedIds(new Set()); setCtxMenu(null); }
      // Figma shape shortcuts (plain keys, guarded against typing contexts)
      if (!mod && !e.altKey && !inField) {
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); addShape('rect'); }
        else if (e.key === 'l') { e.preventDefault(); addShape('line'); }
        else if (e.key === 'L') { e.preventDefault(); addShape('arrow'); }
        else if (e.key === 'o' || e.key === 'O') { e.preventDefault(); addShape('ellipse'); }
      }
    };
    // Paste rides the real clipboard event (not a Ctrl+V keydown) so an image
    // copied from another site or the desktop pastes straight onto the canvas
    // through the normal upload pipeline; with no media in the OS clipboard it
    // falls back to the internal element clipboard.
    const onPaste = (e) => {
      if (editingId) return;
      const el = document.activeElement;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
      const files = Array.from(e.clipboardData?.files || []);
      const media = files.find(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
      if (media) { e.preventDefault(); addMedia(media); return; }
      if (designerClipboard.length) { e.preventDefault(); pasteClipboard(); }
    };
    window.addEventListener('keydown',h);
    window.addEventListener('paste', onPaste);
    return ()=>{ window.removeEventListener('keydown',h); window.removeEventListener('paste', onPaste); };
  }, [selectedIds,elements,editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing saves invisibly: if the design changed since the last flatten
  // (renderedRef is cleared by the auto-save invalidation), render + attach
  // the frames before closing — no button, it just happens.
  const closeAndSave = async () => {
    if (postState === "posting") return;
    const hasFrames = renderedRef.current || !!row?.storyFrames;
    if (!hasFrames) {
      try { await doPost(); } catch { /* close anyway — the publish gate catches unrendered rows */ }
    }
    onClose();
  };

  // Contextual top-bar popover (fill | stroke | tcolor | spacing)
  const [topPop, setTopPop] = useState(null);
  useEffect(() => { setTopPop(null); }, [selectedId]);
  const cycleAlign = () => {
    const order = ["left","center","right","justify"];
    const cur = selected?.textAlign || "left";
    updateEl(selectedId, { textAlign: order[(order.indexOf(cur)+1)%order.length] });
  };
  const cycleList = () => {
    const order = [null,"bullet","number"];
    const cur = selected?.listStyle || null;
    updateEl(selectedId, { listStyle: order[(order.indexOf(cur)+1)%order.length] });
  };

  const layersRev = [...elements].reverse();

  return (
    <div className="overlay s-overlay-full" onClick={onClose}>
      <div className="modal s-modal s-modal-full" onClick={e=>e.stopPropagation()}>
        <div className="m-head" style={{flexShrink:0}}>
          <div><div className="m-title">Story Designer</div><div className="m-sub">{row?.note}</div></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {postState==="posting"&&<div className="pr" style={{marginRight:4}}><div className="pd"/><span className="pt">Saving&hellip;</span></div>}
            <button className="btn btn-ghost btn-sm" onClick={exportAsPng} title={pages.length>1?`Download all ${pages.length} canvases as PNGs`:"Download as PNG"}><Download size={14} style={{marginRight:4}}/> Download</button>
            <button className="sd-board-tool danger" style={{width:30,height:30}} onClick={onClose} title="Discard changes and close" aria-label="Discard"><Trash2 size={13}/></button>
            <button className="m-x" onClick={closeAndSave} disabled={postState==="posting"} aria-label="Save and close designer"><X size={16}/></button>
          </div>
        </div>

        <div className="s-layout">
          {/* Hidden file inputs */}
          <input ref={imgFileRef} type="file" accept="image/*,image/gif" style={{display:"none"}} onChange={e=>{addMedia(e.target.files?.[0]); e.target.value="";}}/>
          <input ref={vidFileRef} type="file" accept="video/*,image/gif"  style={{display:"none"}} onChange={e=>{addMedia(e.target.files?.[0]); e.target.value="";}}/>
          <input ref={bgFileRef} type="file" accept="image/*,video/*,image/gif" style={{display:"none"}} onChange={e=>{setBg(e.target.files?.[0]); e.target.value="";}}/>
          <input ref={spanFileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{spanImageAcross(e.target.files?.[0]); e.target.value="";}}/>

          {/* ── ICON RAIL — Canva-scale: ~26px glyphs, 10.5px labels,
                 roomy 56px buttons on a 72px rail ── */}
          <div style={{
            width:72,flexShrink:0,background:T.surface,borderRight:`1px solid ${T.border}`,
            display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 0",gap:6,
          }}>
            {[
              { id:"elements", icon:<ImageIcon size={26}/>, label:"Elements" },
              { id:"text", icon:<Type size={26}/>, label:"Text" },
              { id:"uploads", icon:<Upload size={26}/>, label:"Uploads" },
              { id:"layers", icon:<Layers size={26}/>, label:"Layers" },
              { id:"templates", icon:<LayoutTemplate size={26}/>, label:"Templates" },
              { id:"ai", icon:<AIMark size={26}/>, label:"AI" },
            ].map(tab => (
              <button key={tab.id} title={tab.label}
                onClick={() => setSideTab(prev => prev === tab.id ? null : tab.id)}
                style={{
                  width:60,height:56,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  gap:4,border:"none",borderRadius:6,cursor:"pointer",transition:"all 0.1s",
                  background:sideTab===tab.id ? T.s3 : "transparent",
                  color:sideTab===tab.id ? T.ink : T.textDim,
                }}>
                {tab.icon}
                <span style={{fontSize:10.5,fontWeight:600,letterSpacing:"0.01em",lineHeight:1}}>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── PALETTE PANEL (collapsible) ── */}
          {sideTab && (
            <div style={{
              width:240,flexShrink:0,borderRight:`1px solid ${T.border}`,
              display:"flex",flexDirection:"column",background:T.surface,overflow:"hidden",
              animation:"drawerIn 0.15s ease-out",
            }}>
              {/* Palette header */}
              <div style={{
                padding:"10px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",
                alignItems:"center",justifyContent:"space-between",flexShrink:0,
              }}>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:T.text,fontFamily:"'JetBrains Mono',monospace"}}>
                  {{elements:"Elements",text:"Text",uploads:"Uploads",templates:"Templates",layers:"Layers",ai:"AI Copilot",props:"Properties",fonts:"Fonts"}[sideTab]}
                </span>
                <button onClick={() => setSideTab(null)} title="Collapse" aria-label="Collapse panel"
                  style={{background:"transparent",border:"none",cursor:"pointer",color:T.textDim,padding:2,display:"flex"}}>
                  <PanelLeftClose size={14}/>
                </button>
              </div>

              {/* Palette content */}
              <div style={{flex:1,overflowY:"auto",padding:"8px 10px",display:"flex",flexDirection:"column",gap:8}}>

                {/* ── ELEMENTS tab ── */}
                {sideTab === "elements" && (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
                      {[
                        ["rect","Rectangle","R",<svg key="r" width="18" height="18" viewBox="0 0 18 18"><rect x="2.5" y="4" width="13" height="10" fill="none" stroke="currentColor" strokeWidth="1.1"/></svg>],
                        ["line","Line","L",<svg key="l" width="18" height="18" viewBox="0 0 18 18"><path d="M3 14 L15 4" stroke="currentColor" strokeWidth="1.1"/></svg>],
                        ["arrow","Arrow","Shift+L",<svg key="a" width="18" height="18" viewBox="0 0 18 18"><path d="M3 14 L14 4 M8.5 4 H14 V9.5" fill="none" stroke="currentColor" strokeWidth="1.1"/></svg>],
                        ["ellipse","Ellipse","O",<svg key="o" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.1"/></svg>],
                        ["polygon","Polygon","",<svg key="p" width="18" height="18" viewBox="0 0 18 18"><path d="M9 3.5 L15 14.5 H3 Z" fill="none" stroke="currentColor" strokeWidth="1.1"/></svg>],
                        ["star","Star","",<svg key="s" width="18" height="18" viewBox="0 0 18 18"><path d="M9 2.8 L10.9 6.9 L15.4 7.4 L12 10.4 L13 14.9 L9 12.5 L5 14.9 L6 10.4 L2.6 7.4 L7.1 6.9 Z" fill="none" stroke="currentColor" strokeWidth="1.1"/></svg>],
                      ].map(([shape, label, kbd, icon]) => (
                        <button key={shape} onClick={()=>addShape(shape)} title={kbd ? `${label} (${kbd})` : label}
                          style={{padding:"10px 4px",borderRadius:6,border:`1px solid ${T.border}`,background:T.s2,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontSize:10,fontWeight:600,color:T.textSub,transition:"border-color 0.1s"}}
                          onMouseEnter={e=>e.currentTarget.style.borderColor=T.border2}
                          onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                          {icon} {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* ── FONTS panel (opened from the top bar's font button) —
                       Canva-style list: chevron expands a weight sub-list,
                       each weight drawn in its own weight. ── */}
                {sideTab === "fonts" && (
                  <div style={{display:"flex",flexDirection:"column"}}>
                    {!selected || selected.type!=='text' ? (
                      <div style={{fontSize:11,color:T.textDim,padding:"8px 0",lineHeight:1.5}}>Select a text element to change its font.</div>
                    ) : (
                      [...BRAND_FONTS, ...SYS_FONTS, ...customFonts].map(fo => {
                        const isCur = selected.fontFamily === fo.name;
                        const isOpen = fontOpenName === fo.name;
                        return (
                          <div key={fo.name || fo.id}>
                            <div className={"sd-font-row"+(isCur?" on":"")}>
                              <button className="sd-font-caret" aria-expanded={isOpen} aria-label={`${isOpen?"Collapse":"Expand"} ${fo.label} weights`}
                                onClick={()=>setFontOpenName(isOpen?null:fo.name)}>
                                <ChevronDown size={11} style={{transform:isOpen?"none":"rotate(-90deg)",transition:"transform .15s"}}/>
                              </button>
                              <button className="sd-font-name" onClick={()=>{updateEl(selectedId,{fontFamily:fo.name,fontWeight:snapWeight(fo,selected.fontWeight)}); setFontOpenName(fo.name);}}>
                                <span className="sd-font-label" style={{fontFamily:`'${fo.name}',sans-serif`}}>{fo.label}</span>
                                <span className="sd-font-sample" style={{fontFamily:`'${fo.name}',sans-serif`}}>AaBbCc</span>
                              </button>
                              {isCur && <Check size={11} style={{opacity:.5,flexShrink:0}}/>}
                            </div>
                            {isOpen && (
                              <div className="sd-font-weights">
                                {fontWeightsOf(fo).map(([w,l])=>{
                                  const active = isCur && (selected.fontWeight||400)===w;
                                  return (
                                    <button key={w} className={"sd-font-weight"+(active?" on":"")}
                                      style={{fontFamily:`'${fo.name}',sans-serif`,fontWeight:w}}
                                      onClick={()=>updateEl(selectedId,{fontFamily:fo.name,fontWeight:w})}>
                                      {l}
                                      {active && <Check size={10} style={{opacity:.5,marginLeft:"auto"}}/>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ── TEXT tab ── */}
                {sideTab === "text" && (
                  <>
                    {[
                      { label:"Heading", fontSize:28, fontWeight:700, fontFamily:"Bricolage Grotesque" },
                      { label:"Subheading", fontSize:18, fontWeight:600, fontFamily:"Bricolage Grotesque" },
                      { label:"Body", fontSize:13, fontWeight:400, fontFamily:"Switzer" },
                      { label:"Label", fontSize:10, fontWeight:600, fontFamily:"JetBrains Mono", letterSpacing:2 },
                    ].map(preset => (
                      <button key={preset.label}
                        onClick={() => {
                          const el = { id:uid(), type:"text", content:preset.label, x:20, y:160, fontSize:preset.fontSize, fontFamily:preset.fontFamily, color:"#FFFFFF", letterSpacing:preset.letterSpacing||0, fontWeight:preset.fontWeight, shadow:false };
                          pushElements(els => [...els, el]); setSelectedIds(new Set([el.id])); setSideTab("props");
                        }}
                        style={{
                          width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${T.border}`,
                          background:T.s2,cursor:"pointer",textAlign:"left",transition:"border-color 0.1s",
                          fontFamily:`'${preset.fontFamily}',sans-serif`,fontSize:Math.min(preset.fontSize, 18),
                          fontWeight:preset.fontWeight,color:T.text,letterSpacing:preset.letterSpacing||0,
                        }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=T.border2}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                        {preset.label}
                      </button>
                    ))}
                  </>
                )}

                {/* ── UPLOADS tab — search, dropzone, persistent library ── */}
                {sideTab === "uploads" && (
                  <>
                    <input
                      className="sd-lib-search"
                      placeholder="Search uploads…"
                      value={libQuery}
                      onChange={e => setLibQuery(e.target.value)}
                      aria-label="Search uploaded assets"
                    />
                    <div
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.ink; }}
                      onDragLeave={e => { e.currentTarget.style.borderColor = T.border2; }}
                      onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.border2; const f = e.dataTransfer?.files?.[0]; if (f) addMedia(f); }}
                      onClick={() => imgFileRef.current?.click()}
                      style={{
                        padding:"20px 14px",borderRadius:12,border:`2px dashed ${T.border2}`,
                        background:"transparent",cursor:"pointer",textAlign:"center",transition:"border-color 0.15s",flexShrink:0,
                      }}>
                      <Upload size={20} style={{color:T.textDim,margin:"0 auto 6px"}}/>
                      <div style={{fontSize:12,fontWeight:600,color:T.textSub}}>Drop files here</div>
                      <div style={{fontSize:9,color:T.textDim,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>JPG · PNG · GIF · MP4 · MOV</div>
                    </div>
                    <div className="sd-lib-tabs" role="tablist" aria-label="Asset type">
                      {[["image","Images"],["video","Videos"]].map(([k,l]) => (
                        <button key={k} role="tab" aria-selected={libFilter===k}
                          className={"sd-lib-tab"+(libFilter===k?" on":"")}
                          onClick={()=>setLibFilter(k)}>{l}</button>
                      ))}
                    </div>
                    {libAssets === null && (
                      <div style={{fontSize:11,color:T.textDim,padding:"6px 0"}}>Loading library…</div>
                    )}
                    {Array.isArray(libAssets) && (() => {
                      const q = libQuery.trim().toLowerCase();
                      const visible = libAssets.filter(a =>
                        (a.type || "image") === libFilter &&
                        (!q || (a.name || "").toLowerCase().includes(q)));
                      if (!visible.length) return (
                        <div style={{fontSize:11,color:T.textDim,lineHeight:1.5,padding:"6px 0"}}>
                          {q ? "Nothing matches that search." : `No ${libFilter === "video" ? "videos" : "images"} yet — drop a file above and it lands here for every post.`}
                        </div>
                      );
                      return (
                        <div className="sd-lib-grid">
                          {visible.map(a => (
                            <button key={a.id || a.url} className="sd-lib-thumb" title={`${a.name || "Asset"} — click to add`}
                              onClick={() => addMediaFromUrl(a)}>
                              {a.type === "video"
                                ? <video src={a.url} muted loop playsInline preload="metadata"
                                    onMouseEnter={e=>e.currentTarget.play().catch(()=>{})}
                                    onMouseLeave={e=>e.currentTarget.pause()}/>
                                : <img src={a.url} alt={a.name || ""} loading="lazy"/>}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ── TEMPLATES tab ── */}
                {sideTab === "templates" && (
                  <>
                    {templates.length > 0 && (
                      <div className="tmpl-gallery">
                        {templates.map(tmpl => (
                          <div key={tmpl.id} className={"tmpl-card "+(defaultId===tmpl.id?"default-tmpl":"")}
                            onClick={()=>loadTemplate(tmpl)} title={tmpl.name}>
                            <div className="tmpl-card-preview">
                              {tmpl.elements.filter(e=>!e.locked&&e.type==='text').slice(0,3).map((el,i)=>(
                                <div key={i} className="tmpl-card-el" style={{
                                  left:el.x*.22, top:el.y*.22,
                                  fontSize:(el.fontSize||14)*.22,
                                  color:el.color||'#fff',
                                  fontFamily:`'${el.fontFamily||'Bricolage Grotesque'}',sans-serif`,
                                  fontWeight:el.fontWeight||600,
                                  letterSpacing:(el.letterSpacing||0)*.22,
                                }}>{el.content}</div>
                              ))}
                            </div>
                            <div className="tmpl-name">{tmpl.name}</div>
                            <div style={{display:"flex",gap:4,alignItems:"center"}}>
                              <button className={"tmpl-heart "+(defaultId===tmpl.id?"is-default":"")}
                                onClick={e=>{e.stopPropagation();setDefault(tmpl.id);}}
                                title={defaultId===tmpl.id?"Remove default":"Set as default"} aria-label={defaultId===tmpl.id?"Remove default template":"Set as default template"}>
                                {defaultId===tmpl.id?"Default":"Set default"}
                              </button>
                              <button className="tmpl-del-btn"
                                onClick={e=>{e.stopPropagation();deleteTemplate(tmpl.id);}}
                                title="Delete template" aria-label="Delete template">
                                <Trash2 size={10}/>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showTmplSave ? (
                      <div style={{display:"flex",gap:4}}>
                        <input className="s-inp" style={{flex:1,fontSize:11}} value={tmplName} onChange={e=>setTmplName(e.target.value)}
                          onKeyDown={e=>e.key==="Enter"&&saveTemplate()} placeholder="Name…" autoFocus/>
                        <button className="btn btn-primary btn-sm" onClick={saveTemplate}>Save</button>
                        <button onClick={()=>setShowTmplSave(false)} style={{background:"transparent",border:"none",cursor:"pointer",color:T.textDim}}><X size={12}/></button>
                      </div>
                    ) : (
                      <button className="save-tmpl-btn" onClick={()=>setShowTmplSave(true)}>
                        <Plus size={12} style={{marginRight:4}}/> Save current as template
                      </button>
                    )}
                    {templates.length === 0 && !showTmplSave && (
                      <div style={{fontSize:11,color:T.textDim,lineHeight:1.5,padding:"8px 0"}}>No templates yet. Design a story then save it as a template.</div>
                    )}
                  </>
                )}

                {/* ── LAYERS tab ── */}
                {sideTab === "layers" && (
                  <div className="layers-stack" style={{maxHeight:"none"}}>
                    {layersRev.map((el, revIdx) => {
                      const realIdx = elements.length - 1 - revIdx;
                      return (
                        <div key={el.id}
                          className={"layer-item " + (selectedIds.has(el.id) ? "active" : "") + (dragOverLayerIdx === realIdx ? " drag-over" : "")}
                          draggable={!el.locked}
                          onDragStart={() => handleLayerDragStart(realIdx)}
                          onDragOver={(e) => handleLayerDragOver(e, realIdx)}
                          onDragEnd={() => { setDragLayerIdx(null); setDragOverLayerIdx(null); }}
                          onDrop={() => handleLayerDrop(realIdx)}
                          onClick={() => setSelectedIds(new Set([el.id]))}
                        >
                          {dragOverLayerIdx === realIdx && dragLayerIdx !== null && dragLayerIdx !== realIdx && (
                            <div className="layer-drop-indicator" />
                          )}
                          {!el.locked && <span className="layer-grip" aria-hidden="true"><GripVertical size={12}/></span>}
                          <span className="layer-icon" style={{color:selectedIds.has(el.id)?T.ink:T.textDim}}>
                            {el.type==='text'?<Type size={12}/>:el.locked?<Wallpaper size={12}/>:el.type==='shape'?<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.1"/></svg>:el.mediaType==='video'?<Film size={12}/>:<ImageIcon size={12}/>}
                          </span>
                          <span className="layer-label">{el.type==='text'?el.content?.slice(0,20):el.locked?'Background':el.mediaType==='video'?'Video':'Image'}</span>
                          {!el.locked&&<button className="layer-del" aria-label="Remove layer" onClick={e=>{e.stopPropagation();deleteEl(el.id);}}><X size={10}/></button>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── AI tab ── */}
                {sideTab === "ai" && (
                  <div className="ai-copilot">
                    <div className="ai-copilot-title">
                      <span>{aiLoading?"Analyzing...":"Layout Suggestions"}</span>
                      {!aiLoading&&<button style={{marginLeft:"auto",background:"transparent",border:"none",color:"#7C3AED",cursor:"pointer",fontSize:11,fontWeight:600,padding:0}} onClick={runAICopilot}><RotateCcw size={12}/></button>}
                    </div>
                    {aiLoading&&<div style={{height:4,background:"#EDE9FE",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:"60%",background:"#7C3AED",borderRadius:999}}/></div>}
                    {aiTips.length > 0 ? aiTips.map((tip,i)=><div key={i} className="ai-suggestion"><b>{i+1}.</b> {tip}</div>)
                      : !aiLoading && <button onClick={runAICopilot} style={{width:"100%",padding:"10px",borderRadius:6,border:`1px solid ${T.border}`,background:T.s2,cursor:"pointer",fontSize:11,fontWeight:600,color:T.textSub}}>
                        <AIMark size={12} style={{marginRight:4}}/> Analyze layout
                      </button>
                    }
                  </div>
                )}

                {/* ── PROPERTIES tab (context-sensitive) ── */}
                {sideTab === "props" && selected && !selected.locked && (
                  <>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:11,fontWeight:600,color:T.textSub}}>
                        {selected.type==='text'?'Text':selected.type==='shape'?(selected.shape||'Shape'):selected.mediaType==='video'?'Video':'Image'}
                      </span>
                      <button className="del-btn" onClick={()=>deleteEl(selectedId)} aria-label="Delete selected element" style={{fontSize:10,padding:"2px 8px"}}><X size={9} style={{marginRight:2}}/> Delete</button>
                    </div>

                    {/* Opacity control for all elements */}
                    <div className="inspector-group">
                      <div className="inspector-group-title">Opacity</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="range"
                          className="s-slider"
                          min="0"
                          max="100"
                          value={Math.round((selected.opacity ?? 1) * 100)}
                          onChange={(e) => updateEl(selectedId, { opacity: Number(e.target.value) / 100 })}
                        />
                        <span className="sd-opacity-value">{Math.round((selected.opacity ?? 1) * 100)}%</span>
                      </div>
                    </div>

                    {selected.type==='shape' && (
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {selected.shape !== 'line' && (
                          <>
                            <div className="inspector-group-title">Fill</div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                              {BRAND_COLORS.map(c => (
                                <button key={c} onClick={()=>updateEl(selectedId,{fill:c})} title={c}
                                  style={{width:20,height:20,borderRadius:6,border:(selected.fill||'#FFFFFF')===c?`2px solid ${T.ink}`:`1px solid ${T.border}`,background:c,cursor:"pointer",padding:0}}/>
                              ))}
                              <input type="color" value={selected.fill||'#FFFFFF'} onChange={e=>updateEl(selectedId,{fill:e.target.value})}
                                style={{width:24,height:24,border:"none",background:"transparent",cursor:"pointer",padding:0}} title="Custom fill"/>
                            </div>
                          </>
                        )}
                        <div className="inspector-group-title" style={{marginTop:selected.shape==='line'?0:8}}>Stroke</div>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <input type="color" value={selected.stroke||'#FFFFFF'}
                            onChange={e=>updateEl(selectedId,{stroke:e.target.value, strokeWidth: selected.strokeWidth || 1})}
                            style={{width:24,height:24,border:`1px solid ${T.border}`,borderRadius:6,padding:0,cursor:"pointer"}} title="Stroke color"/>
                          <input type="range" min={selected.shape==='line'?1:0} max={20} step={1} value={selected.strokeWidth||(selected.shape==='line'?1:0)} title="Stroke weight"
                            onChange={e=>updateEl(selectedId,{strokeWidth: parseInt(e.target.value)})}
                            className="s-slider" style={{width:70}}/>
                          <span style={{fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:T.text,width:26,textAlign:"right"}}>{selected.strokeWidth||(selected.shape==='line'?1:0)}px</span>
                          <div style={{display:"flex",gap:2,background:T.s2,border:`1px solid ${T.border}`,borderRadius:6,padding:2}} title="Stroke style">
                            {[["solid","0"],["dash","7 5"],["minidash","3 3"],["dot","0.5 4"]].map(([st,da]) => (
                              <button key={st} onClick={()=>updateEl(selectedId,{strokeStyle:st})} title={st}
                                style={{width:26,height:18,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderRadius:4,cursor:"pointer",background:(selected.strokeStyle||"solid")===st?T.ink:"transparent",padding:0}}>
                                <svg width="18" height="4" viewBox="0 0 18 4"><line x1="1" y1="2" x2="17" y2="2" stroke={(selected.strokeStyle||"solid")===st?T.surface:T.textSub} strokeWidth="1.6" strokeDasharray={da==="0"?undefined:da} strokeLinecap={st==="dot"?"round":"butt"}/></svg>
                              </button>
                            ))}
                          </div>
                          {/* Cap ends: butt or rounded */}
                          <div style={{display:"flex",gap:2,background:T.s2,border:`1px solid ${T.border}`,borderRadius:6,padding:2}} title="Stroke ends">
                            {[["butt","Butt end"],["round","Rounded end"]].map(([c,label]) => (
                              <button key={c} onClick={()=>updateEl(selectedId,{strokeCap:c})} title={label}
                                style={{width:26,height:18,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderRadius:4,cursor:"pointer",background:(selected.strokeCap||"butt")===c?T.ink:"transparent",padding:0}}>
                                <span style={{display:"block",width:14,height:4,background:(selected.strokeCap||"butt")===c?T.surface:T.textSub,borderRadius:c==="round"?99:0}}/>
                              </button>
                            ))}
                          </div>
                          {/* Alignment on the source spline (closed shapes only) */}
                          {selected.shape !== 'line' && (
                            <select value={selected.strokeAlign||"center"} onChange={e=>updateEl(selectedId,{strokeAlign:e.target.value})} title="Stroke position on the path"
                              style={{height:24,borderRadius:6,border:`1px solid ${T.border}`,background:T.s2,fontSize:10,fontWeight:600,color:T.text,outline:"none",padding:"0 4px"}}>
                              <option value="inside">Inside</option>
                              <option value="center">Center</option>
                              <option value="outside">Outside</option>
                            </select>
                          )}
                        </div>
                      </div>
                    )}

                    {selected.type==='text' && (
                      <>
                      <TextInspector
                        selected={selected} selectedId={selectedId} updateEl={updateEl}
                        customFonts={customFonts} removeCustomFont={removeCustomFont}
                        fontFileRef={fontFileRef} handleFontUpload={handleFontUpload}
                        fontInstalling={fontInstalling} fontError={fontError}
                      />
                      {/* Text Alignment */}
                      <div className="inspector-group">
                        <div className="inspector-group-title">Alignment</div>
                        <div className="sd-text-align">
                          {["left", "center", "right"].map(align => (
                            <button
                              key={align}
                              className={`sd-align-btn${(selected.textAlign || "left") === align ? " active" : ""}`}
                              onClick={() => updateEl(selectedId, { textAlign: align })}
                              aria-label={`Align ${align}`}
                            >
                              {align === "left" && <AlignLeft size={14} />}
                              {align === "center" && <AlignCenter size={14} />}
                              {align === "right" && <AlignRight size={14} />}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Fill + Stroke, adjacent (Figma-style) */}
                      <div className="inspector-group" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div>
                          <div className="inspector-group-title">Fill</div>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <input type="color" value={selected.gradient ? "#ffffff" : (selected.color || "#ffffff")}
                              onChange={(e) => updateEl(selectedId, { color: e.target.value, gradient: null })}
                              style={{width:26,height:26,border:`1px solid ${T.border}`,borderRadius:6,padding:0,cursor:"pointer"}} title="Fill color"/>
                            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.textSub}}>{selected.gradient ? "Gradient" : (selected.color || "#ffffff").toUpperCase()}</span>
                          </div>
                        </div>
                        <div>
                          <div className="inspector-group-title">Stroke</div>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <input type="color" value={selected.outlineColor || "#000000"}
                              onChange={(e) => updateEl(selectedId, { outlineColor: e.target.value, outline: selected.outline || 1 })}
                              style={{width:26,height:26,border:`1px solid ${T.border}`,borderRadius:6,padding:0,cursor:"pointer"}} title="Stroke color"/>
                            <input type="number" min={0} max={3} step={0.5} value={selected.outline || 0} title="Stroke weight (0 = none)"
                              onChange={(e) => updateEl(selectedId, { outline: Math.max(0, Math.min(3, parseFloat(e.target.value) || 0)) })}
                              style={{width:44,height:26,borderRadius:6,border:`1px solid ${T.border}`,background:T.s2,textAlign:"center",fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:T.text,outline:"none"}}/>
                          </div>
                        </div>
                      </div>
                      </>
                    )}

                    {selected.type==='image' && selected.mediaType==='video' && (
                      <>
                        <div className="lbl" style={{marginBottom:2}}>Scale — {(selected.scale||1).toFixed(2)}x</div>
                        <input type="range" className="s-slider" min={0.2} max={3} step={0.05} value={selected.scale||1}
                          onChange={e=>updateEl(selectedId,{scale:parseFloat(e.target.value)})}/>
                        <div className="lbl" style={{marginTop:8,marginBottom:4}}>Video Controls</div>
                        <div className="s-toggle-row">
                          <div className="lbl" style={{margin:0}}>Loop</div>
                          <div className="s-toggle" style={{background:selected.loop!==false?T.ink:T.border2}}
                            onClick={()=>updateEl(selectedId,{loop:!(selected.loop!==false)})}>
                            <div className="s-toggle-knob" style={{left:selected.loop!==false?14:2}}/>
                          </div>
                        </div>
                        <div className="s-toggle-row">
                          <div className="lbl" style={{margin:0}}>Mute</div>
                          <div className="s-toggle" style={{background:selected.muted!==false?T.ink:T.border2}}
                            onClick={()=>updateEl(selectedId,{muted:!(selected.muted!==false)})}>
                            <div className="s-toggle-knob" style={{left:selected.muted!==false?14:2}}/>
                          </div>
                        </div>
                        <div className="lbl" style={{marginBottom:2,marginTop:4}}>Volume — {Math.round((selected.volume||0)*100)}%</div>
                        <input type="range" className="s-slider" min={0} max={1} step={0.05} value={selected.volume||0}
                          onChange={e=>updateEl(selectedId,{volume:parseFloat(e.target.value),muted:parseFloat(e.target.value)===0})}/>
                      </>
                    )}

                    {selected.type==='image' && selected.mediaType!=='video' && !selected.locked && (
                      <>
                        <div className="lbl" style={{marginBottom:2}}>Scale — {(selected.scale||1).toFixed(2)}x</div>
                        <input type="range" className="s-slider" min={0.2} max={3} step={0.05} value={selected.scale||1}
                          onChange={e=>updateEl(selectedId,{scale:parseFloat(e.target.value)})}/>
                        <button className="btn btn-ghost btn-sm" style={{width:"100%",marginTop:4}}
                          onClick={()=>imgFileRef.current?.click()}>Replace Image</button>
                      </>
                    )}

                    {/* ── Rotation controls ── */}
                    <div style={{marginTop:8,borderTop:`1px solid ${T.border}`,paddingTop:8}}>
                      <div className="lbl" style={{marginBottom:4}}>Rotation — {Math.round(selected.rotation||0)}°</div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <input type="range" className="s-slider" min={0} max={360} step={1} value={selected.rotation||0}
                          style={{flex:1,margin:0}}
                          onChange={e=>updateEl(selectedId,{rotation:parseFloat(e.target.value)})}/>
                        <input type="number" min={0} max={360} value={Math.round(selected.rotation||0)}
                          onChange={e=>updateEl(selectedId,{rotation:Math.max(0,Math.min(360,parseInt(e.target.value)||0))})}
                          style={{width:44,textAlign:"center",border:`1px solid ${T.border}`,borderRadius:6,background:T.s2,fontSize:10,fontWeight:700,color:T.text,padding:"3px 2px",outline:"none",fontFamily:"'JetBrains Mono',monospace"}}/>
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{width:"100%",marginTop:4,fontSize:10}}
                        onClick={()=>updateEl(selectedId,{rotation:0})}>
                        <RotateCcw size={10} style={{marginRight:4}}/> Reset rotation
                      </button>
                    </div>

                    {/* ── Filters (media only) ── */}
                    {(selected.type==='image' && !selected.locked) && (
                      <div style={{marginTop:8,borderTop:`1px solid ${T.border}`,paddingTop:8}}>
                        <div className="lbl" style={{marginBottom:6}}>Filters</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                          {[
                            {label:"Reset",brightness:100,contrast:100,saturation:100,blur:0},
                            {label:"Vivid",brightness:100,contrast:110,saturation:130,blur:0},
                            {label:"Muted",brightness:110,contrast:100,saturation:60,blur:0},
                            {label:"B&W",brightness:100,contrast:100,saturation:0,blur:0},
                            {label:"Dreamy",brightness:110,contrast:100,saturation:80,blur:1},
                          ].map(preset=>(
                            <button key={preset.label} onClick={()=>updateEl(selectedId,{brightness:preset.brightness,contrast:preset.contrast,saturation:preset.saturation,blur:preset.blur})}
                              style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:T.s2,cursor:"pointer",fontSize:9,fontWeight:600,color:T.textSub,transition:"border-color 0.1s"}}>
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>
                              <span>Brightness</span><span>{selected.brightness??100}%</span>
                            </div>
                            <input type="range" className="s-slider" min={0} max={200} step={1} value={selected.brightness??100} style={{margin:0}}
                              onChange={e=>updateEl(selectedId,{brightness:parseInt(e.target.value)})}/>
                          </div>
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>
                              <span>Contrast</span><span>{selected.contrast??100}%</span>
                            </div>
                            <input type="range" className="s-slider" min={0} max={200} step={1} value={selected.contrast??100} style={{margin:0}}
                              onChange={e=>updateEl(selectedId,{contrast:parseInt(e.target.value)})}/>
                          </div>
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>
                              <span>Saturation</span><span>{selected.saturation??100}%</span>
                            </div>
                            <input type="range" className="s-slider" min={0} max={200} step={1} value={selected.saturation??100} style={{margin:0}}
                              onChange={e=>updateEl(selectedId,{saturation:parseInt(e.target.value)})}/>
                          </div>
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>
                              <span>Blur</span><span>{selected.blur??0}px</span>
                            </div>
                            <input type="range" className="s-slider" min={0} max={20} step={0.5} value={selected.blur??0} style={{margin:0}}
                              onChange={e=>updateEl(selectedId,{blur:parseFloat(e.target.value)})}/>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {sideTab === "props" && (!selected || selected.locked) && (
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div className="inspector-group-title">Background</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      {["#080A0E","#09090b","#FFFFFF","#F4F4F5","#FF5A1F","#0A66C2","#10B981","#7C3AED","#BE185D"].map(c => (
                        <button key={c} onClick={()=>pushElements(els=>els.map(e=>e.locked?{...e,fill:c,url:null,mediaType:'image'}:e))} title={c}
                          style={{width:22,height:22,borderRadius:6,border:(elements.find(e=>e.locked)?.fill||"#080A0E")===c?`2px solid ${T.ink}`:`1px solid ${T.border}`,background:c,cursor:"pointer",padding:0}}/>
                      ))}
                      <input type="color" value={elements.find(e=>e.locked)?.fill||"#080A0E"}
                        onChange={e=>{const v=e.target.value;pushElements(els=>els.map(el=>el.locked?{...el,fill:v,url:null,mediaType:'image'}:el));}}
                        style={{width:24,height:24,border:"none",background:"transparent",cursor:"pointer",padding:0}} title="Custom background color"/>
                    </div>
                    <button onClick={()=>bgFileRef.current?.click()}
                      style={{width:"100%",padding:"8px 12px",borderRadius:6,border:`1px dashed ${T.border2}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:11,fontWeight:600,color:T.textSub}}>
                      <Wallpaper size={14}/> {elements.find(e=>e.id==="bg")?.url ? "Replace background image" : "Set background image"}
                    </button>
                    {elements.find(e=>e.locked)?.url && (
                      <button onClick={()=>pushElements(els=>els.map(e=>e.locked?{...e,url:null,bgSpanId:undefined}:e))}
                        style={{width:"100%",padding:"7px 12px",borderRadius:6,border:`1px solid ${T.border}`,background:"transparent",cursor:"pointer",fontSize:11,fontWeight:600,color:T.textSub}}>
                        Remove background image
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CANVAS AREA ── */}
          <div className="s-canvas-area">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",position:"relative"}}>
              {selected && !selected.locked && (
                <div className="sd-topbar" onPointerDown={e=>e.stopPropagation()}>
                  {topPop && <div className="sd-pop-backdrop" onClick={()=>setTopPop(null)}/>}
                  {selected.type==='text' && (<>
                    <button className="sd-tb-font" onClick={()=>setSideTab('fonts')} title="Change font" style={{fontFamily:`'${selected.fontFamily}',sans-serif`}}>
                      {selected.fontFamily}
                    </button>
                    <div className="sd-tb-size">
                      <button onClick={()=>updateEl(selectedId,{fontSize:Math.max(6,Math.round(selected.fontSize-1))})}><Minus size={10}/></button>
                      <span>{Math.round(selected.fontSize)}</span>
                      <button onClick={()=>updateEl(selectedId,{fontSize:Math.min(96,Math.round(selected.fontSize+1))})}><Plus size={10}/></button>
                    </div>
                    <div className="sd-tb-wrap">
                      <button className="sd-tb-btn" onClick={()=>setTopPop(topPop==='tcolor'?null:'tcolor')} title="Text color">
                        <span className="sd-tb-chip" style={{background:selected.gradient||selected.color||'#fff'}}/>
                      </button>
                      {topPop==='tcolor' && (
                        <div className="sd-pop">
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center",width:150}}>
                            {BRAND_COLORS.map(c=>(<button key={c} onClick={()=>updateEl(selectedId,{color:c,gradient:null})} style={{width:20,height:20,borderRadius:6,border:(selected.color===c&&!selected.gradient)?`2px solid ${T.ink}`:`1px solid ${T.border}`,background:c,cursor:"pointer",padding:0}}/>))}
                            <input type="color" value={selected.gradient?'#ffffff':(selected.color||'#ffffff')} onChange={e=>updateEl(selectedId,{color:e.target.value,gradient:null})} style={{width:22,height:22,border:"none",background:"transparent",cursor:"pointer",padding:0}}/>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="sd-tb-div"/>
                    {(() => {
                      const ws = fontWeightsOf(selectedFontDef).map(([w]) => w);
                      const boldW = ws.find(w => w >= 700);
                      const isBold = (selected.fontWeight||400) >= 700;
                      return (
                        <button className={"sd-tb-btn"+(isBold?" on":"")} disabled={!boldW && !isBold}
                          style={!boldW && !isBold ? {opacity:.3} : undefined}
                          onClick={()=>updateEl(selectedId,{fontWeight:isBold?snapWeight(selectedFontDef,400):boldW})}
                          title={boldW || isBold ? "Bold" : "This font has no bold cut"}><Bold size={13}/></button>
                      );
                    })()}
                    <button className={"sd-tb-btn"+(selected.italic?" on":"")} onClick={()=>updateEl(selectedId,{italic:!selected.italic})} title="Italic"><Italic size={13}/></button>
                    <button className={"sd-tb-btn"+(selected.underline?" on":"")} onClick={()=>updateEl(selectedId,{underline:!selected.underline})} title="Underline"><Underline size={13}/></button>
                    <button className={"sd-tb-btn"+(selected.strikethrough?" on":"")} onClick={()=>updateEl(selectedId,{strikethrough:!selected.strikethrough})} title="Strikethrough"><Strikethrough size={13}/></button>
                    <button className={"sd-tb-btn"+(selected.uppercase?" on":"")} onClick={()=>updateEl(selectedId,{uppercase:!selected.uppercase})} title="All caps" style={{fontSize:11,fontWeight:700}}>aA</button>
                    <button className="sd-tb-btn" onClick={cycleAlign} title={`Alignment: ${selected.textAlign||'left'} (click to cycle)`}>
                      {(selected.textAlign||'left')==='left'?<AlignLeft size={13}/>:(selected.textAlign==='center')?<AlignCenter size={13}/>:(selected.textAlign==='right')?<AlignRight size={13}/>:<svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor"><path d="M1 3h13v1H1zM1 7h13v1H1zM1 11h13v1H1z"/></svg>}
                    </button>
                    <button className={"sd-tb-btn"+(selected.listStyle?" on":"")} onClick={cycleList} title={`List: ${selected.listStyle||'none'} (click to cycle)`}>
                      {selected.listStyle==='number'
                        ? <svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor"><text x="0" y="5.5" fontSize="5.5" fontFamily="monospace">1.</text><text x="0" y="12.5" fontSize="5.5" fontFamily="monospace">2.</text><path d="M8 3.6h6v1H8zM8 10.6h6v1H8z"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor"><circle cx="2.5" cy="4" r="1.4"/><circle cx="2.5" cy="11" r="1.4"/><path d="M6 3.5h8v1H6zM6 10.5h8v1H6z"/></svg>}
                    </button>
                    <span className="sd-tb-div"/>
                    <div className="sd-tb-wrap">
                      <button className="sd-tb-btn" onClick={()=>setTopPop(topPop==='spacing'?null:'spacing')} title="Letter & line spacing"><Sliders size={13}/></button>
                      {topPop==='spacing' && (
                        <div className="sd-pop" style={{width:190}}>
                          <div className="sd-pop-label">Letter spacing — {(selected.letterSpacing??0).toFixed(1)}</div>
                          <input type="range" className="s-slider" min={-2} max={10} step={0.1} value={selected.letterSpacing??0} onChange={e=>updateEl(selectedId,{letterSpacing:parseFloat(e.target.value)})}/>
                          <div className="sd-pop-label" style={{marginTop:8}}>Line spacing — {(selected.lineHeight??1.25).toFixed(2)}</div>
                          <input type="range" className="s-slider" min={0.8} max={3} step={0.05} value={selected.lineHeight??1.25} onChange={e=>updateEl(selectedId,{lineHeight:parseFloat(e.target.value)})}/>
                        </div>
                      )}
                    </div>
                  </>)}
                  {selected.type==='shape' && (<>
                    <div className="sd-tb-wrap">
                      <button className="sd-tb-btn" onClick={()=>setTopPop(topPop==='fill'?null:'fill')} title="Fill color" disabled={selected.shape==='line'} style={selected.shape==='line'?{opacity:.3}:undefined}>
                        <span className="sd-tb-chip" style={{background:selected.fill||'#fff'}}/>
                      </button>
                      {topPop==='fill' && (
                        <div className="sd-pop">
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center",width:150}}>
                            {BRAND_COLORS.map(c=>(<button key={c} onClick={()=>updateEl(selectedId,{fill:c})} style={{width:20,height:20,borderRadius:6,border:(selected.fill||'#FFFFFF')===c?`2px solid ${T.ink}`:`1px solid ${T.border}`,background:c,cursor:"pointer",padding:0}}/>))}
                            <input type="color" value={selected.fill||'#FFFFFF'} onChange={e=>updateEl(selectedId,{fill:e.target.value})} style={{width:22,height:22,border:"none",background:"transparent",cursor:"pointer",padding:0}}/>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="sd-tb-wrap">
                      <button className="sd-tb-btn" onClick={()=>setTopPop(topPop==='stroke'?null:'stroke')} title="Stroke">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"><rect x="2.5" y="2.5" width="11" height="11" rx="2" strokeWidth="2"/></svg>
                      </button>
                      {topPop==='stroke' && (
                        <div className="sd-pop" style={{width:200}}>
                          <div className="sd-pop-label">Style</div>
                          <div style={{display:"flex",gap:2,background:T.s2,border:`1px solid ${T.border}`,borderRadius:6,padding:2,width:"fit-content"}}>
                            {[["solid","0"],["dash","7 5"],["minidash","3 3"],["dot","0.5 4"]].map(([st,da])=>(
                              <button key={st} onClick={()=>updateEl(selectedId,{strokeStyle:st,strokeWidth:selected.strokeWidth||1})} title={st}
                                style={{width:30,height:20,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderRadius:4,cursor:"pointer",background:(selected.strokeStyle||"solid")===st?T.ink:"transparent",padding:0}}>
                                <svg width="22" height="4" viewBox="0 0 22 4"><line x1="1" y1="2" x2="21" y2="2" stroke={(selected.strokeStyle||"solid")===st?T.surface:T.textSub} strokeWidth="1.6" strokeDasharray={da==="0"?undefined:da} strokeLinecap={st==="dot"?"round":"butt"}/></svg>
                              </button>
                            ))}
                          </div>
                          <div className="sd-pop-label" style={{marginTop:8}}>Ends</div>
                          <div style={{display:"flex",gap:2,background:T.s2,border:`1px solid ${T.border}`,borderRadius:6,padding:2,width:"fit-content"}}>
                            {[["butt","Flat"],["round","Rounded"]].map(([c,label])=>(
                              <button key={c} onClick={()=>updateEl(selectedId,{strokeCap:c})} title={label}
                                style={{padding:"3px 10px",border:"none",borderRadius:4,cursor:"pointer",fontSize:10,fontWeight:600,background:(selected.strokeCap||"butt")===c?T.ink:"transparent",color:(selected.strokeCap||"butt")===c?T.surface:T.textSub}}>{label}</button>
                            ))}
                          </div>
                          <div className="sd-pop-label" style={{marginTop:8}}>Weight — {selected.strokeWidth||(selected.shape==='line'?1:0)}px</div>
                          <input type="range" className="s-slider" min={selected.shape==='line'?1:0} max={20} step={1} value={selected.strokeWidth||(selected.shape==='line'?1:0)} onChange={e=>updateEl(selectedId,{strokeWidth:parseInt(e.target.value)})}/>
                          <div className="sd-pop-label" style={{marginTop:8}}>Color</div>
                          <input type="color" value={selected.stroke||'#FFFFFF'} onChange={e=>updateEl(selectedId,{stroke:e.target.value,strokeWidth:selected.strokeWidth||1})} style={{width:26,height:26,border:`1px solid ${T.border}`,borderRadius:6,padding:0,cursor:"pointer"}}/>
                        </div>
                      )}
                    </div>
                  </>)}
                  {/* Shared cluster — every element type: opacity, full
                      inspector ("⋯", the props panel's new front door), delete. */}
                  {selected.type!=='image' && <span className="sd-tb-div"/>}
                  <div className="sd-tb-wrap">
                    <button className="sd-tb-btn" onClick={()=>setTopPop(topPop==='opacity'?null:'opacity')} title="Opacity">
                      <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M8 2 A6 6 0 0 1 8 14 Z" fill="currentColor"/></svg>
                    </button>
                    {topPop==='opacity' && (
                      <div className="sd-pop" style={{width:170}}>
                        <div className="sd-pop-label">Opacity — {Math.round((selected.opacity??1)*100)}%</div>
                        <input type="range" className="s-slider" min={0} max={100} step={1} value={Math.round((selected.opacity??1)*100)} onChange={e=>updateEl(selectedId,{opacity:Number(e.target.value)/100})}/>
                      </div>
                    )}
                  </div>
                  <button className="sd-tb-btn" onClick={()=>setSideTab(s=>s==='props'?null:'props')} title="More settings" aria-label="More settings" style={{fontSize:15,fontWeight:700,letterSpacing:.5,paddingBottom:5}}>⋯</button>
                  <button className="sd-tb-btn" onClick={()=>deleteEl(selectedId)} title="Delete element" aria-label="Delete element"><Trash2 size={13}/></button>
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div className="sd-preset-wrap">
                  <button className="sd-preset-trigger" onClick={() => setPresetMenuOpen(o => !o)}
                    aria-haspopup="listbox" aria-expanded={presetMenuOpen} aria-label="Canvas size preset"
                    title={outletPresetKeys.length ? "Sizes follow this post's outlets — add outlets on the post window" : "Canvas size"}>
                    <span className="sd-preset-name">{preset.label}</span>
                    <span className="sd-preset-ratio">{preset.ratio}</span>
                    <ChevronDown size={11} className="sd-preset-caret"/>
                  </button>
                  {presetMenuOpen && (
                    <>
                      <div className="sd-pop-backdrop" onClick={() => setPresetMenuOpen(false)}/>
                      <div className="sd-preset-menu" role="listbox" aria-label="Canvas size options">
                        {presetOptions.map(p => (
                          <button key={p.key} role="option" aria-selected={p.key === canvasPreset}
                            className={"sd-preset-option" + (p.key === canvasPreset ? " on" : "")}
                            onClick={() => { handlePresetChange(p.key); setPresetMenuOpen(false); }}>
                            <span className="sd-preset-frame" style={{aspectRatio: `${p.exportW} / ${p.exportH}`}}/>
                            <span className="sd-preset-opt-label">{p.label}</span>
                            <span className="sd-preset-opt-ratio">{p.ratio}</span>
                            {p.key === canvasPreset && <Check size={11} className="sd-preset-check"/>}
                          </button>
                        ))}
                        {outletPresetKeys.length > 0 && (
                          <div className="sd-preset-foot">Sizes follow this post&rsquo;s outlets</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.45)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.2,textTransform:"uppercase"}}>
                  {preset.exportW} × {preset.exportH} · {preset.ratio}
                </span>
              </div>
              <div className="canvas-zoom-bar" role="toolbar" aria-label="Canvas toolbar">
                <button className="zoom-btn" onClick={undo} disabled={historyIndex<=0} title="Undo (Ctrl+Z)" aria-label="Undo (Ctrl+Z)" style={{opacity:historyIndex<=0?0.35:1}}><Undo2 size={12}/></button>
                <button className="zoom-btn" onClick={redo} disabled={historyIndex>=history.length-1} title="Redo (Ctrl+Shift+Z)" aria-label="Redo (Ctrl+Shift+Z)" style={{opacity:historyIndex>=history.length-1?0.35:1}}><Redo2 size={12}/></button>
                <span style={{width:1,height:14,background:"var(--t-border)",margin:"0 2px"}}/>
                <button className={"zoom-btn"+(showGuides?" snap-active":"")} onClick={()=>setShowGuides(g=>!g)} title="Toggle guide overlay" aria-label="Toggle grid overlay" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 5px"}}><Grid3x3 size={12}/></button>
                <button className={"zoom-btn"+(snapOn?" snap-active":"")} onClick={()=>setSnapOn(s=>!s)} title="Snap to guides" aria-label="Toggle snap to guides"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M4.5 13.5 V7 A3.5 3.5 0 0 1 11.5 7 V13.5" /><path d="M4.5 10.5 H7.2 M8.8 10.5 H11.5" /></svg></button>
                <span style={{width:1,height:14,background:"var(--t-border)",margin:"0 2px"}}/>
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.max(0.4,parseFloat((z-0.1).toFixed(1))))} title="Zoom out" aria-label="Zoom out"><Minus size={12}/></button>
                <button className="zoom-label" onClick={()=>setZoom(1)} title="Reset to 100%" style={{border:"none",background:"transparent",cursor:"pointer",padding:0}}>{Math.round(zoom*100)}%</button>
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.min(2.0,parseFloat((z+0.1).toFixed(1))))} title="Zoom in" aria-label="Zoom in"><Plus size={12}/></button>
                
              </div>
            </div>
            {/* ── ARTBOARD WORKSPACE — every canvas visible side by side
                   (Photoshop/Figma-style). The active board carries the full
                   editing machinery; clicking any other board activates it.
                   Each frame is sized to the ZOOMED dimensions so the scaled
                   canvases occupy real layout space and never overlap. ── */}
            <div className={"sd-canvas-row" + (pages.length > 1 ? " multi" : "")}>
            {pages.map((pg, i) => {
              const isActive = i === activePageIdx;
              const sp = spanInfoFor(i);
              if (!isActive) return (
                <div key={pg.id} className="sd-board">
                  {/* Same fixed-height bar as the active board (tools omitted)
                      so activating a canvas never shifts its position. */}
                  <div className="sd-board-bar" style={{width:preset.w*zoom}}>
                    <button className="sd-board-label" onClick={() => switchPage(i)} title={`Edit canvas ${i + 1}`}>{String(i + 1).padStart(2, "0")}</button>
                  </div>
                  <div style={{width:preset.w*zoom,height:preset.h*zoom,flexShrink:0}}>
                    <div className="canvas-wrap" style={{transform:`scale(${zoom})`,transformOrigin:"top left","--sd-zoom":zoom}}>
                      <div className="canvas" role="button" aria-label={`Activate canvas ${i + 1}`}
                        onPointerDown={() => switchPage(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); switchPage(i); }}
                        style={{width:preset.w,height:preset.h,cursor:"pointer"}}>
                        <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
                          {pg.elements.filter(e=>e.locked).map(el=>(
                            <CanvasElement key={el.id} data={el} isSelected={false}
                              bgSpanTotal={sp?.total} bgSpanIndex={sp?.index}
                              onSelect={()=>{}} onUpdate={()=>{}} canvasW={preset.w} canvasH={preset.h}/>
                          ))}
                          {pg.elements.filter(e=>!e.locked).map(el=>(
                            <CanvasElement key={el.id} data={el} isSelected={false}
                              onSelect={()=>{}} onUpdate={()=>{}} zoom={zoom} canvasW={preset.w} canvasH={preset.h}/>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
              return (
              <div key={pg.id} className="sd-board active">
              {/* Canvas toolbar — hugs the active canvas's top-right corner:
                  move left / move right / delete (⌘Z restores a deleted canvas). */}
              {pages.length > 1 && (
                <div className="sd-board-bar" style={{width:preset.w*zoom}}>
                  <span className="sd-board-label">{String(i + 1).padStart(2, "0")}</span>
                  <div className="sd-board-tools">
                    <button className="sd-board-tool" title="Move canvas left" aria-label="Move canvas left" disabled={i === 0} onClick={() => movePage(i, -1)}>{"‹"}</button>
                    <button className="sd-board-tool" title="Move canvas right" aria-label="Move canvas right" disabled={i === pages.length - 1} onClick={() => movePage(i, 1)}>{"›"}</button>
                    <button className="sd-board-tool danger" title="Delete canvas (Ctrl+Z to undo)" aria-label="Delete canvas" onClick={() => deletePage(i)}><Trash2 size={11}/></button>
                  </div>
                </div>
              )}
              <div style={{width:preset.w*zoom,height:preset.h*zoom,flexShrink:0}}>
            <div className="canvas-wrap" style={{transform:`scale(${zoom})`,transformOrigin:"top left","--sd-zoom":zoom}}>
              <div className="canvas" ref={canvasRef} role="application" aria-label="Story canvas"
                onPointerDown={handleCanvasPointerDown}
                onDragOver={handleCanvasDragOver}
                onDragLeave={handleCanvasDragLeave}
                onDrop={handleCanvasDrop}
                style={{width:preset.w,height:preset.h,...(canvasDragOver ? {outline:'2px solid #0EA5E9',outlineOffset:-2} : {})}}>
                {elements.filter(e=>e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedIds.has(el.id)}
                    bgSpanTotal={sp?.total} bgSpanIndex={sp?.index}
                    onSelect={()=>setSelectedIds(new Set([el.id]))} onUpdate={p=>updateEl(el.id,p)} canvasW={preset.w} canvasH={preset.h}/>
                ))}
                {elements.filter(e=>!e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedIds.has(el.id)}
                    onSelect={(id, shiftKey)=>{handleSelect(el.id, shiftKey);initMultiDrag();if(editingId&&editingId!==el.id)setEditingId(null);}}
                    onUpdate={p=>updateEl(el.id,p)}
                    onDragAll={selectedIds.size > 1 && selectedIds.has(el.id) ? multiDrag : undefined}
                    onDropReplace={replaceMedia}
                    onContextMenu={(e, id) => { e.preventDefault(); handleSelect(id, false); setCtxMenu({ x: e.clientX, y: e.clientY, id }); }}
                    snapEnabled={snapOn} siblings={elements} onGuides={setGuides}
                    isEditing={editingId===el.id}
                    onStartEdit={()=>{setSelectedIds(new Set([el.id]));setEditingId(el.id);}}
                    onStopEdit={()=>setEditingId(null)}
                    zoom={zoom} canvasW={preset.w} canvasH={preset.h}/>
                ))}
                {guides.map((g,i) => g.axis === 'x'
                  ? <div key={i} style={{position:'absolute',left:g.pos,top:0,width:1,height:'100%',background:'rgba(0,165,114,0.6)',pointerEvents:'none',zIndex:40}}/>
                  : <div key={i} style={{position:'absolute',top:g.pos,left:0,height:1,width:'100%',background:'rgba(0,165,114,0.6)',pointerEvents:'none',zIndex:40}}/>
                )}
                {marquee && (
                  <div className="sd-marquee" style={{
                    left: Math.min(marquee.x0, marquee.x1),
                    top: Math.min(marquee.y0, marquee.y1),
                    width: Math.abs(marquee.x1 - marquee.x0),
                    height: Math.abs(marquee.y1 - marquee.y0),
                  }}/>
                )}
                {showGuides && (
                  <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:30}}>
                    {/* Center lines */}
                    <div style={{position:'absolute',left:'50%',top:0,width:1,height:'100%',borderLeft:'1px dashed rgba(255,255,255,0.3)'}}/>
                    <div style={{position:'absolute',top:'50%',left:0,height:1,width:'100%',borderTop:'1px dashed rgba(255,255,255,0.3)'}}/>
                    {/* Rule of thirds */}
                    <div style={{position:'absolute',left:'33.33%',top:0,width:1,height:'100%',borderLeft:'1px dashed rgba(255,255,255,0.15)'}}/>
                    <div style={{position:'absolute',left:'66.66%',top:0,width:1,height:'100%',borderLeft:'1px dashed rgba(255,255,255,0.15)'}}/>
                    <div style={{position:'absolute',top:'33.33%',left:0,height:1,width:'100%',borderTop:'1px dashed rgba(255,255,255,0.15)'}}/>
                    <div style={{position:'absolute',top:'66.66%',left:0,height:1,width:'100%',borderTop:'1px dashed rgba(255,255,255,0.15)'}}/>
                    {/* Safe zone (10% inset) */}
                    <div style={{position:'absolute',left:'10%',top:'10%',right:'10%',bottom:'10%',border:'1px dashed rgba(255,122,0,0.3)',borderRadius:4}}/>
                  </div>
                )}
              </div>
            </div>
              </div>
              </div>
              );
            })}
            {/* Add-canvas rail \u2014 hugs the right edge of the last canvas, Photoshop-artboard style */}
            <div className="sd-page-add-wrap side">
              <button className="sd-page-add" title="Add canvas" aria-label="Add canvas" onClick={() => setPageMenuOpen(o => !o)}><Plus size={15} /></button>
              {pageMenuOpen && (
                <>
                  <div className="sd-page-menu-backdrop" onClick={() => setPageMenuOpen(false)} />
                  <div className="sd-page-menu">
                    <button onClick={() => addPage(false)}>New canvas</button>
                    <button onClick={() => addPage(true)}>Duplicate canvas</button>
                  </div>
                </>
              )}
            </div>
            </div>

            {/* Artboards / page strip */}
            <div className="sd-pages">
              {pages.map((pg, i) => (
                <div key={pg.id} className={"sd-page-tab" + (i === activePageIdx ? " active" : "")} onClick={() => switchPage(i)} title={`Canvas ${i + 1}`}>
                  <span className="sd-page-num">{i + 1}</span>
                </div>
              ))}
              <span className="sd-pages-sep" />
              {pages.length > 1 && (
                <button className="sd-pages-tool" title="Fit one image seamlessly across every canvas" onClick={() => spanFileRef.current?.click()}>
                  <ImageIcon size={13} /> Fit image across {pages.length}
                </button>
              )}
            </div>


          </div>
        </div>
        <StoryDesignerTour />

        {ctxMenu && (
          <>
            <div className="sd-ctx-backdrop" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
            <div className="sd-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
              {[
                ["Duplicate", () => duplicateSelected()],
                ["Copy", () => copySelected()],
                ["Bring to front", () => reorderZ(ctxMenu.id, "front")],
                ["Bring forward", () => reorderZ(ctxMenu.id, "forward")],
                ["Send backward", () => reorderZ(ctxMenu.id, "backward")],
                ["Send to back", () => reorderZ(ctxMenu.id, "back")],
              ].map(([label, fn]) => (
                <button key={label} className="sd-ctx-item" onClick={() => { fn(); setCtxMenu(null); }}>{label}</button>
              ))}
              <div className="sd-ctx-sep" />
              <button className="sd-ctx-item sd-ctx-danger" onClick={() => { deleteEl(ctxMenu.id); setCtxMenu(null); }}>Delete</button>
            </div>
          </>
        )}

        {(activeUploads.length > 0 || uploadError) && (
          <div style={{position:"fixed",bottom:20,right:20,display:"flex",flexDirection:"column",gap:8,zIndex:60,maxWidth:320}}>
            {activeUploads.map((u) => (
              <div key={u.id} style={{background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:12,padding:"10px 12px",boxShadow:"0 8px 24px rgba(9,9,11,0.12)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{fontSize:13,color:"#09090b",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
                  <div style={{fontSize:12,color:"#71717a",fontVariantNumeric:"tabular-nums"}}>{Math.round(u.progress*100)}%</div>
                </div>
                <div style={{height:4,background:"#e4e4e7",borderRadius:999,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.round(u.progress*100)}%`,background:"#09090b",transition:"width 140ms ease"}}/>
                </div>
              </div>
            ))}
            {uploadError && (
              <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"10px 12px",fontSize:13,color:"#dc2626",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <span>{uploadError}</span>
                <button onClick={() => setUploadError("")} style={{background:"transparent",border:"none",color:"#dc2626",cursor:"pointer",fontSize:14,lineHeight:1,padding:0}}>×</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

