import React, { useState, useRef, useEffect } from "react";
import { X, Check, Plus, Minus, RotateCcw, RotateCw, Undo2, Redo2, Grid3x3, Upload, Trash2, Bold, Italic, Underline, Strikethrough, ChevronDown, Type, AArrowDown, Image as ImageIcon, Film, Wallpaper, Layers, LayoutTemplate, Sparkles, PanelLeftClose, Sliders, AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Download } from "lucide-react";
import { CanvasElement, BRAND_COLORS, CANVAS_W, CANVAS_H, fitMediaBox } from "./CanvasElement.jsx";
import { T, uid, TEMPLATES } from "../shared.js";
import { generateStoryTips } from "../../../lib/api-client.js";

const CANVAS_PRESETS = [
  { key: "ig_story", label: "IG Story", w: 290, h: 515, exportW: 1080, exportH: 1920, ratio: "9:16" },
  { key: "ig_post", label: "IG Post", w: 290, h: 290, exportW: 1080, exportH: 1080, ratio: "1:1" },
  { key: "ig_reel", label: "IG Reel", w: 290, h: 515, exportW: 1080, exportH: 1920, ratio: "9:16" },
  { key: "tiktok", label: "TikTok", w: 290, h: 515, exportW: 1080, exportH: 1920, ratio: "9:16" },
  { key: "linkedin", label: "LinkedIn", w: 290, h: 152, exportW: 1200, exportH: 628, ratio: "1.91:1" },
  { key: "youtube", label: "YouTube", w: 290, h: 163, exportW: 1280, exportH: 720, ratio: "16:9" },
];

const BRAND_FONTS = [
  { name:"Bricolage Grotesque", label:"Bricolage",  group:"brand" },
  { name:"JetBrains Mono",      label:"Mono",       group:"brand" },
  { name:"Switzer",             label:"Switzer",    group:"brand" },
  { name:"Plaak Ney",           label:"Plaak",      group:"brand" },
];
const SYS_FONTS   = [
  { name:"Georgia",      label:"Georgia",      group:"system" },
  { name:"Arial",        label:"Arial",        group:"system" },
];
const ALL_FONTS = [...BRAND_FONTS, ...SYS_FONTS];

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
              gap:4,padding:"0 8px",borderRadius:8,border:`1px solid ${T.border}`,
              background:T.s2,cursor:"pointer",fontFamily:`'${selected.fontFamily}',sans-serif`,
              fontSize:13,fontWeight:600,color:T.text,minHeight:32,
            }}>
            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentLabel}</span>
            <ChevronDown size={10} style={{flexShrink:0,opacity:0.4,transform:fontOpen?"rotate(180deg)":"none",transition:"transform 0.15s"}}/>
          </button>
          {fontOpen && (
            <div style={{
              position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:50,
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
              boxShadow:"0 12px 32px rgba(24,23,20,0.1)",maxHeight:220,overflowY:"auto",padding:4,
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
        <div style={{display:"flex",alignItems:"center",border:`1px solid ${T.border}`,borderRadius:8,background:T.s2,flexShrink:0,width:80}}>
          <button onClick={() => stepSize(-1)} style={{padding:"0 4px",border:"none",background:"transparent",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center",height:"100%"}}><Minus size={10}/></button>
          <input type="number" value={Math.round(selected.fontSize)} min={6} max={96}
            onChange={e => updateEl(selectedId, { fontSize: Math.max(6, Math.min(96, parseInt(e.target.value) || 6)) })}
            style={numInput}/>
          <button onClick={() => stepSize(1)} style={{padding:"0 4px",border:"none",background:"transparent",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center",height:"100%"}}><Plus size={10}/></button>
        </div>
      </div>
      {fontError && <div style={{fontSize:10,color:T.red,lineHeight:1.4}}>{fontError}</div>}

      {/* ── Row 2: [Color] | [B] [I] [U] [S] | [spacing ▾] ── */}
      <div style={{display:"flex",alignItems:"center",gap:2,background:T.s2,borderRadius:8,padding:2,border:`1px solid ${T.border}`}}>
        {/* Color */}
        <div style={{position:"relative"}} ref={colorRef}>
          <button title="Text color" onClick={() => setColorOpen(v => !v)}
            style={{...tb(false),position:"relative"}}>
            <Type size={13} style={{color:T.textSub}}/>
            <div style={{position:"absolute",bottom:3,left:5,right:5,height:3,borderRadius:1,background:colorPreview}}/>
          </button>
          {colorOpen && (
            <div style={{
              position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:50,
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
              boxShadow:"0 12px 32px rgba(24,23,20,0.1)",padding:8,width:180,
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
                  style={{flex:1,minWidth:0,fontSize:10,fontFamily:"'JetBrains Mono',monospace",padding:"4px 6px",border:`1px solid ${T.border}`,borderRadius:5,background:T.s2,color:T.text,outline:"none"}}/>
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

        {/* Bold */}
        <button title="Bold" onClick={() => updateEl(selectedId, { fontWeight: selected.fontWeight >= 700 ? 400 : 700 })}
          style={tb(selected.fontWeight >= 700)}>
          <Bold size={14}/>
        </button>
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
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,
              boxShadow:"0 12px 32px rgba(24,23,20,0.1)",padding:10,width:170,
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

export function StoryDesigner({ row, onClose, onSave }) {
  const makeDefault = () => [
    { id:"bg",  type:"image", url:null, x:0, y:0, scale:1, locked:true, mediaType:'image' },
    { id:uid(), type:"text",  content:"RANGER & FOX",          x:20, y:22,  fontSize:8.5, fontFamily:"JetBrains Mono",     color:T.ink, letterSpacing:3,    fontWeight:600, shadow:false },
    { id:uid(), type:"text",  content:row?.note||"Headline",   x:20, y:155, fontSize:24,  fontFamily:"Bricolage Grotesque",color:"#FFFFFF", letterSpacing:-0.5, fontWeight:700, shadow:true  },
    { id:uid(), type:"text",  content:"Supporting detail",      x:20, y:205, fontSize:12,  fontFamily:"Bricolage Grotesque",color:"rgba(255,255,255,0.6)", letterSpacing:0, fontWeight:400, shadow:false },
  ];

  const [elements,    setElements]    = useState(() => {
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
  });

  // ── Undo / Redo history ──
  const MAX_HISTORY = 50;
  const [history, setHistory] = useState(() => [elements]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushElements = (newElements) => {
    const resolved = typeof newElements === 'function' ? newElements(elements) : newElements;
    setHistory(prev => {
      const truncated = prev.slice(0, historyIndex + 1);
      const next = [...truncated, resolved].slice(-MAX_HISTORY);
      setHistoryIndex(next.length - 1);
      return next;
    });
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

  // ── Guide overlay ──
  const [showGuides, setShowGuides] = useState(false);

  // Auto-save elements to parent row whenever they change
  useEffect(() => { if (onSave) onSave(elements); }, [elements, onSave]);

  const [selectedIds, setSelectedIds]  = useState(new Set());
  const [editingId,   setEditingId]   = useState(null);
  // Convenience: single selectedId for backward compat in properties panel
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const [zoom,        setZoom]        = useState(1.8);
  const [canvasPreset, setCanvasPreset] = useState("ig_story");
  const [postState,   setPostState]   = useState("idle");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiTips,      setAiTips]      = useState([]);
  const [templates,   setTemplates]   = useState(() => loadSavedTemplates());
  const [defaultId,   setDefaultId]   = useState(() => loadDefaultTmplId());
  const [tmplName,    setTmplName]    = useState("");
  const [showTmplSave,setShowTmplSave]= useState(false);
  const [snapOn,      setSnapOn]      = useState(true);
  const [guides,      setGuides]      = useState([]);
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
  const bgFileRef  = useRef(null);
  const imgFileRef = useRef(null);
  const vidFileRef = useRef(null);
  const fontFileRef = useRef(null);

  // Custom fonts
  const [customFonts, setCustomFonts] = useState(() => loadCustomFonts());
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
    } catch (err) {
      setFontError(err.message);
    }
    setFontInstalling(false);
  };

  const removeCustomFont = (fontId) => {
    const updated = customFonts.filter(f => f.id !== fontId);
    setCustomFonts(updated);
    saveCustomFonts(updated);
  };

  const preset = CANVAS_PRESETS.find(p => p.key === canvasPreset) || CANVAS_PRESETS[0];
  const selected  = selectedId ? elements.find(el => el.id === selectedId) : null;

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

  // Auto-open properties panel when selecting a single unlocked element
  useEffect(() => {
    if (selected && !selected.locked) setSideTab("props");
  }, [selectedId]);

  const updateEl  = (id, patch) => setElements(els => els.map(e => e.id === id ? { ...e, ...patch } : e));
  const deleteEl  = (id) => { pushElements(els => els.filter(e => e.id !== id)); setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); };
  const deleteSelected = () => {
    const toDelete = [...selectedIds].filter(id => { const el = elements.find(e => e.id === id); return el && !el.locked; });
    if (toDelete.length === 0) return;
    pushElements(els => els.filter(e => !toDelete.includes(e.id)));
    setSelectedIds(new Set());
  };

  // ── Alignment functions ──
  const alignSelected = (direction) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setElements(els => els.map(el => {
      if (!ids.includes(el.id) || el.locked) return el;
      const w = el.type === 'text' ? (el.boxWidth || 190) : ((el.width || 140) * (el.scale || 1));
      const h = el.type === 'text' ? 40 : ((el.height || 140) * (el.scale || 1));
      switch (direction) {
        case 'left':     return { ...el, x: 0 };
        case 'center-h': return { ...el, x: (CANVAS_W - w) / 2 };
        case 'right':    return { ...el, x: CANVAS_W - w };
        case 'top':      return { ...el, y: 0 };
        case 'center-v': return { ...el, y: (CANVAS_H - h) / 2 };
        case 'bottom':   return { ...el, y: CANVAS_H - h };
        default: return el;
      }
    }));
  };

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

  const addText = (dropX, dropY) => {
    const el = { id:uid(), type:"text", content:"New text", x: dropX ?? 40, y: dropY ?? 180, fontSize:18, fontFamily:"Bricolage Grotesque", color:"#FFFFFF", letterSpacing:0, fontWeight:600, shadow:false };
    pushElements(els => [...els, el]); setSelectedIds(new Set([el.id]));
  };

  const fileToDataURL = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const addMedia = async (file, dropX, dropY) => {
    if (!file) return;
    const url    = await fileToDataURL(file);
    const isGif  = file.type === "image/gif";
    const isVid  = !isGif && file.type.startsWith("video/");
    const mType  = isGif ? 'gif' : isVid ? 'video' : 'image';
    const makeEl = (w, h) => {
      const el = {
        id:uid(),
        type:"image",
        url,
        x: dropX ?? 56,
        y: dropY ?? 140,
        scale:1,
        width: w,
        height: h,
        locked:false,
        mediaType: mType,
        loop:true,
        muted:true,
        autoPlay:true,
        trimLabel: file.name.split('.').pop().toUpperCase(),
      };
      pushElements(els => [...els, el]); setSelectedIds(new Set([el.id]));
    };
    if (!isVid) {
      const img = new window.Image();
      img.onload = () => { const fitted = fitMediaBox(img.naturalWidth, img.naturalHeight); makeEl(fitted.width, fitted.height); };
      img.src = url;
    } else {
      makeEl(160, 90);
    }
  };

  const setBg = async (file) => {
    if (!file) return;
    const url    = await fileToDataURL(file);
    const isGif  = file.type === "image/gif";
    const isVid  = !isGif && file.type.startsWith("video/");
    pushElements(els => els.map(e => e.id === "bg" ? { ...e, url, mediaType: isGif ? 'gif' : isVid ? 'video' : 'image' } : e));
  };

  // Replace an existing media element's source, keeping position/size/scale
  const replaceMedia = async (elementId, file) => {
    if (!file) return;
    const url = await fileToDataURL(file);
    const isGif = file.type === "image/gif";
    const isVid = !isGif && file.type.startsWith("video/");
    const mType = isGif ? 'gif' : isVid ? 'video' : 'image';
    pushElements(els => els.map(e =>
      e.id === elementId ? { ...e, url, mediaType: mType, trimLabel: file.name.split('.').pop().toUpperCase() } : e
    ));
  };

  // Canvas-level drop: add media or set background
  const [canvasDragOver, setCanvasDragOver] = useState(false);
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
    const bgEl = elements.find(el => el.id === "bg");
    if (!bgEl?.url) {
      setBg(file);
    } else {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        addMedia(file, (e.clientX - canvasRect.left) / zoom, (e.clientY - canvasRect.top) / zoom);
      } else {
        addMedia(file);
      }
    }
  };

  const handleToolDragStart = (e, type) => {
    e.dataTransfer.setData("application/rf-tool-type", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  // ── PNG Export ──
  const exportAsPng = async () => {
    const EXPORT_W = preset.exportW;
    const EXPORT_H = preset.exportH;
    const SCALE = EXPORT_W / preset.w;

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_W;
    canvas.height = EXPORT_H;
    const ctx = canvas.getContext("2d");

    // Draw background
    const bgEl = elements.find(e => e.locked);
    if (bgEl?.url && bgEl.mediaType !== 'video') {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = bgEl.url; });
      ctx.drawImage(img, 0, 0, EXPORT_W, EXPORT_H);
    } else {
      ctx.fillStyle = "#080A0E";
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
    }

    // Draw text elements
    for (const el of elements.filter(e => !e.locked && e.type === "text")) {
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

      // Word wrap
      const maxWidth = (el.boxWidth || 190) * SCALE;
      const words = (el.content || "").split(" ");
      let line = "";
      let lineY = y;
      const lineHeight = fontSize * (el.lineHeight || 1.25);

      for (const word of words) {
        const test = line + (line ? " " : "") + word;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, x, lineY);
          line = word;
          lineY += lineHeight;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, x, lineY);
      ctx.restore();
    }

    // Draw image / GIF elements
    for (const el of elements.filter(e => !e.locked && (e.type === "image" || e.mediaType === "image" || e.mediaType === "gif") && e.url && e.mediaType !== "video")) {
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

    // Trigger download
    const link = document.createElement("a");
    link.download = `story-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
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

  const doPost = async () => { setPostState("posting"); await new Promise(r=>setTimeout(r,2000)); setPostState("done"); };

  // Undo/Redo keyboard shortcuts
  useEffect(() => {
    const hUR = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && e.key === 'z' && e.shiftKey)  { e.preventDefault(); redo(); }
      if (mod && e.key === 'y')                 { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', hUR);
    return () => window.removeEventListener('keydown', hUR);
  }, [historyIndex, history]);

  // Push elements to history on pointerup (after drag / resize finishes)
  useEffect(() => {
    const onUp = () => {
      setHistory(prev => {
        const last = prev[prev.length - 1];
        if (JSON.stringify(last) === JSON.stringify(elements)) return prev;
        const truncated = prev.slice(0, historyIndex + 1);
        const next = [...truncated, elements].slice(-MAX_HISTORY);
        setHistoryIndex(next.length - 1);
        return next;
      });
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [elements, historyIndex]);

  useEffect(() => {
    const h = (e) => {
      if (editingId) return;
      if ((e.key==='Backspace'||e.key==='Delete') && selectedIds.size > 0 && document.activeElement.tagName!=='INPUT' && document.activeElement.tagName!=='TEXTAREA') deleteSelected();
      if (e.key==='Escape') setSelectedIds(new Set());
    };
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);
  }, [selectedIds,elements,editingId]);

  const layersRev = [...elements].reverse();

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal s-modal" onClick={e=>e.stopPropagation()}>
        <div className="m-head" style={{flexShrink:0}}>
          <div><div className="m-title">Story Designer</div><div className="m-sub">{row?.note}</div></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {postState==="posting"&&<div className="pr" style={{marginRight:4}}><div className="pd"/><span className="pt">Posting...</span></div>}
            {postState==="done"&&<div className="sr" style={{marginRight:4}}><div className="si"><Check size={12}/></div><span className="st2">Story live</span></div>}
            <button className="btn btn-ai btn-sm"
              onClick={()=>{const opening=sideTab!=="ai";setSideTab(opening?"ai":null);if(opening&&aiTips.length===0)runAICopilot();}}>
              {sideTab==="ai"?"Hide AI":"AI Refine"}
            </button>
            {postState!=="done"&&<button className="btn btn-ghost btn-sm" onClick={onClose}>Discard</button>}
            {postState==="done"
              ?<button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
              :<><button className="btn btn-ghost btn-sm" onClick={exportAsPng} title="Download as PNG"><Download size={14} style={{marginRight:4}}/> PNG</button><button className="btn btn-primary btn-sm" onClick={doPost} disabled={postState==="posting"}>Publish Story</button></>}
            <button className="m-x" onClick={onClose} aria-label="Close story designer"><X size={16}/></button>
          </div>
        </div>

        <div className="s-layout">
          {/* Hidden file inputs */}
          <input ref={imgFileRef} type="file" accept="image/*,image/gif" style={{display:"none"}} onChange={e=>{addMedia(e.target.files?.[0]); e.target.value="";}}/>
          <input ref={vidFileRef} type="file" accept="video/*,image/gif"  style={{display:"none"}} onChange={e=>{addMedia(e.target.files?.[0]); e.target.value="";}}/>
          <input ref={bgFileRef} type="file" accept="image/*,video/*,image/gif" style={{display:"none"}} onChange={e=>{setBg(e.target.files?.[0]); e.target.value="";}}/>

          {/* ── ICON RAIL ── */}
          <div style={{
            width:52,flexShrink:0,background:T.surface,borderRight:`1px solid ${T.border}`,
            display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 0",gap:2,
          }}>
            {[
              { id:"elements", icon:<ImageIcon size={18}/>, label:"Elements" },
              { id:"text", icon:<Type size={18}/>, label:"Text" },
              { id:"uploads", icon:<Upload size={18}/>, label:"Uploads" },
              { id:"templates", icon:<LayoutTemplate size={18}/>, label:"Templates" },
              { id:"layers", icon:<Layers size={18}/>, label:"Layers" },
              { id:"ai", icon:<Sparkles size={18}/>, label:"AI" },
            ].map(tab => (
              <button key={tab.id} title={tab.label}
                onClick={() => setSideTab(prev => prev === tab.id ? null : tab.id)}
                style={{
                  width:40,height:40,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  gap:1,border:"none",borderRadius:8,cursor:"pointer",transition:"all 0.1s",
                  background:sideTab===tab.id ? T.s3 : "transparent",
                  color:sideTab===tab.id ? T.ink : T.textDim,
                }}>
                {tab.icon}
                <span style={{fontSize:8,fontWeight:600,letterSpacing:"0.02em",lineHeight:1}}>{tab.label}</span>
              </button>
            ))}
            {/* Properties auto-tab (shows when element selected) */}
            {selected && !selected.locked && (
              <>
                <div style={{width:24,height:1,background:T.border,margin:"4px 0"}}/>
                <button title="Properties"
                  onClick={() => setSideTab(prev => prev === "props" ? null : "props")}
                  style={{
                    width:40,height:40,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    gap:1,border:"none",borderRadius:8,cursor:"pointer",transition:"all 0.1s",
                    background:sideTab==="props" ? T.s3 : "transparent",
                    color:sideTab==="props" ? T.ink : T.textDim,
                  }}>
                  <Sliders size={18}/>
                  <span style={{fontSize:8,fontWeight:600,letterSpacing:"0.02em",lineHeight:1}}>Props</span>
                </button>
              </>
            )}
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
                  {{elements:"Elements",text:"Text",uploads:"Uploads",templates:"Templates",layers:"Layers",ai:"AI Copilot",props:"Properties"}[sideTab]}
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
                    <button onClick={addText} draggable onDragStart={(e)=>handleToolDragStart(e,"text")}
                      style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.s2,cursor:"grab",display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600,color:T.text,transition:"border-color 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=T.border2}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                      <Type size={16}/> Add text box
                    </button>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                      <button onClick={()=>imgFileRef.current?.click()} draggable onDragStart={(e)=>handleToolDragStart(e,"image")}
                        style={{padding:"12px 8px",borderRadius:8,border:`1px solid ${T.border}`,background:T.s2,cursor:"grab",display:"flex",flexDirection:"column",alignItems:"center",gap:4,fontSize:11,fontWeight:600,color:T.textSub,transition:"border-color 0.1s"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=T.border2}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                        <ImageIcon size={20}/> Image / GIF
                      </button>
                      <button onClick={()=>vidFileRef.current?.click()} draggable onDragStart={(e)=>handleToolDragStart(e,"video")}
                        style={{padding:"12px 8px",borderRadius:8,border:`1px solid ${T.border}`,background:T.s2,cursor:"grab",display:"flex",flexDirection:"column",alignItems:"center",gap:4,fontSize:11,fontWeight:600,color:T.textSub,transition:"border-color 0.1s"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=T.border2}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                        <Film size={20}/> Video
                      </button>
                    </div>
                    <button onClick={()=>bgFileRef.current?.click()}
                      style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`1px dashed ${T.border2}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:11,fontWeight:600,color:T.textSub,transition:"border-color 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=T.ink}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=T.border2}>
                      <Wallpaper size={14}/> {elements.find(e=>e.id==="bg")?.url ? "Replace background" : "Set background"}
                    </button>
                  </>
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
                          width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${T.border}`,
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

                {/* ── UPLOADS tab ── */}
                {sideTab === "uploads" && (
                  <>
                    <div
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.ink; }}
                      onDragLeave={e => { e.currentTarget.style.borderColor = T.border2; }}
                      onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.border2; const f = e.dataTransfer?.files?.[0]; if (f) addMedia(f); }}
                      onClick={() => imgFileRef.current?.click()}
                      style={{
                        padding:"32px 16px",borderRadius:12,border:`2px dashed ${T.border2}`,
                        background:"transparent",cursor:"pointer",textAlign:"center",transition:"border-color 0.15s",
                      }}>
                      <Upload size={24} style={{color:T.textDim,margin:"0 auto 8px"}}/>
                      <div style={{fontSize:13,fontWeight:600,color:T.textSub}}>Drop files here</div>
                      <div style={{fontSize:10,color:T.textDim,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>JPG · PNG · GIF · MP4 · MOV</div>
                    </div>
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
                          onKeyDown={e=>e.key==="Enter"&&saveTemplate()} placeholder="Name..." autoFocus/>
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
                          <span className="layer-icon" style={{color:selectedIds.has(el.id)?T.ink:T.textDim}}>
                            {el.type==='text'?<Type size={12}/>:el.locked?<Wallpaper size={12}/>:el.mediaType==='video'?<Film size={12}/>:<ImageIcon size={12}/>}
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
                    {aiLoading&&<div style={{height:4,background:"#EDE9FE",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:"60%",background:"#7C3AED",borderRadius:99}}/></div>}
                    {aiTips.length > 0 ? aiTips.map((tip,i)=><div key={i} className="ai-suggestion"><b>{i+1}.</b> {tip}</div>)
                      : !aiLoading && <button onClick={runAICopilot} style={{width:"100%",padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.s2,cursor:"pointer",fontSize:11,fontWeight:600,color:T.textSub}}>
                        <Sparkles size={12} style={{marginRight:4}}/> Analyze layout
                      </button>
                    }
                  </div>
                )}

                {/* ── PROPERTIES tab (context-sensitive) ── */}
                {sideTab === "props" && selected && !selected.locked && (
                  <>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:11,fontWeight:600,color:T.textSub}}>
                        {selected.type==='text'?'Text':selected.mediaType==='video'?'Video':'Image'}
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
                      {/* Text Outline */}
                      <div className="inspector-group">
                        <div className="inspector-group-title">Outline</div>
                        <div className="sd-outline-row">
                          <label style={{fontSize:11,color:T.textSub,fontWeight:600}}>Outline</label>
                          <input type="checkbox" checked={!!selected.outline} onChange={(e) => updateEl(selectedId, { outline: e.target.checked ? 1 : 0 })} />
                          {selected.outline > 0 && (
                            <>
                              <input type="range" className="s-slider" min="0.5" max="3" step="0.5" value={selected.outline || 1} onChange={(e) => updateEl(selectedId, { outline: Number(e.target.value) })} style={{flex:1}} />
                              <input type="color" value={selected.outlineColor || "#000000"} onChange={(e) => updateEl(selectedId, { outlineColor: e.target.value })} style={{width:26,height:26,border:`1px solid ${T.border}`,borderRadius:6,padding:0,cursor:"pointer"}} />
                            </>
                          )}
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
                  <div style={{fontSize:11,color:T.textDim,padding:"8px 0",lineHeight:1.5}}>
                    {selectedId ? "Background layer is locked." : "Select an element on the canvas to see its properties."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CANVAS AREA ── */}
          <div className="s-canvas-area">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <select className="sd-preset-select" value={canvasPreset} onChange={(e) => setCanvasPreset(e.target.value)} aria-label="Canvas size preset">
                  {CANVAS_PRESETS.map(p => (
                    <option key={p.key} value={p.key}>{p.label} ({p.ratio})</option>
                  ))}
                </select>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.45)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.2,textTransform:"uppercase"}}>
                  {preset.exportW} × {preset.exportH} · {preset.ratio}
                </span>
              </div>
              <div className="canvas-zoom-bar" role="toolbar" aria-label="Canvas toolbar">
                <button className="zoom-btn" onClick={undo} disabled={historyIndex<=0} title="Undo (Ctrl+Z)" aria-label="Undo (Ctrl+Z)" style={{opacity:historyIndex<=0?0.35:1}}><Undo2 size={12}/></button>
                <button className="zoom-btn" onClick={redo} disabled={historyIndex>=history.length-1} title="Redo (Ctrl+Shift+Z)" aria-label="Redo (Ctrl+Shift+Z)" style={{opacity:historyIndex>=history.length-1?0.35:1}}><Redo2 size={12}/></button>
                <span style={{width:1,height:14,background:"var(--t-border)",margin:"0 2px"}}/>
                <button className={"zoom-btn"+(showGuides?" snap-active":"")} onClick={()=>setShowGuides(g=>!g)} title="Toggle guide overlay" aria-label="Toggle grid overlay" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 5px"}}><Grid3x3 size={12}/></button>
                <button className={"zoom-btn"+(snapOn?" snap-active":"")} onClick={()=>setSnapOn(s=>!s)} title="Toggle snap alignment" aria-label="Toggle snap to guides" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 5px"}}>{'\u229E'} Snap</button>
                <span style={{width:1,height:14,background:"var(--t-border)",margin:"0 2px"}}/>
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.max(0.4,parseFloat((z-0.1).toFixed(1))))} title="Zoom out" aria-label="Zoom out"><Minus size={12}/></button>
                <span className="zoom-label">{Math.round(zoom*100)}%</span>
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.min(2.0,parseFloat((z+0.1).toFixed(1))))} title="Zoom in" aria-label="Zoom in"><Plus size={12}/></button>
                <button className="zoom-btn" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 4px"}} onClick={()=>setZoom(1.8)} title="Reset zoom" aria-label="Reset zoom">180%</button>
              </div>
            </div>
            {selectedIds.size > 0 && (
              <div className="sd-align-bar">
                {selectedIds.size > 1 && (
                  <span style={{fontSize:9,fontWeight:700,color:T.textSub,fontFamily:"'JetBrains Mono',monospace",marginRight:4}}>{selectedIds.size} sel</span>
                )}
                <button onClick={() => alignSelected("left")} title="Align left" aria-label="Align left">
                  <svg width="14" height="14" viewBox="0 0 14 14"><line x1="1" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="3" width="8" height="3" rx="0.5" fill="currentColor"/><rect x="3" y="8" width="5" height="3" rx="0.5" fill="currentColor"/></svg>
                </button>
                <button onClick={() => alignSelected("center-h")} title="Align center" aria-label="Align center horizontally">
                  <svg width="14" height="14" viewBox="0 0 14 14"><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="3" width="8" height="3" rx="0.5" fill="currentColor"/><rect x="4" y="8" width="6" height="3" rx="0.5" fill="currentColor"/></svg>
                </button>
                <button onClick={() => alignSelected("right")} title="Align right" aria-label="Align right">
                  <svg width="14" height="14" viewBox="0 0 14 14"><line x1="13" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="3" width="8" height="3" rx="0.5" fill="currentColor"/><rect x="6" y="8" width="5" height="3" rx="0.5" fill="currentColor"/></svg>
                </button>
                <div className="sd-align-divider" />
                <button onClick={() => alignSelected("top")} title="Align top" aria-label="Align top">
                  <svg width="14" height="14" viewBox="0 0 14 14"><line x1="1" y1="1" x2="13" y2="1" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="3" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="8" y="3" width="3" height="5" rx="0.5" fill="currentColor"/></svg>
                </button>
                <button onClick={() => alignSelected("center-v")} title="Align middle" aria-label="Align center vertically">
                  <svg width="14" height="14" viewBox="0 0 14 14"><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="3" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="8" y="4" width="3" height="6" rx="0.5" fill="currentColor"/></svg>
                </button>
                <button onClick={() => alignSelected("bottom")} title="Align bottom" aria-label="Align bottom">
                  <svg width="14" height="14" viewBox="0 0 14 14"><line x1="1" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="3" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="8" y="6" width="3" height="5" rx="0.5" fill="currentColor"/></svg>
                </button>
              </div>
            )}
            <div className="canvas-wrap" style={{transform:`scale(${zoom})`,transformOrigin:"top center"}}>
              <div className="canvas" ref={canvasRef} role="application" aria-label="Story canvas"
                onPointerDown={e=>{if(e.target===e.currentTarget){setSelectedIds(new Set());setEditingId(null);}}}
                onDragOver={handleCanvasDragOver}
                onDragLeave={handleCanvasDragLeave}
                onDrop={handleCanvasDrop}
                style={{width:preset.w,height:preset.h,...(canvasDragOver ? {outline:'2px solid #0EA5E9',outlineOffset:-2} : {})}}>
                {elements.filter(e=>e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedIds.has(el.id)}
                    onSelect={()=>setSelectedIds(new Set([el.id]))} onUpdate={p=>updateEl(el.id,p)} canvasW={preset.w} canvasH={preset.h}/>
                ))}
                <div className="canvas-ov" style={{background:"linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.28) 100%)"}}/>
                {elements.filter(e=>!e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedIds.has(el.id)}
                    onSelect={(id, shiftKey)=>{handleSelect(el.id, shiftKey);initMultiDrag();if(editingId&&editingId!==el.id)setEditingId(null);}}
                    onUpdate={p=>updateEl(el.id,p)}
                    onDragAll={selectedIds.size > 1 && selectedIds.has(el.id) ? multiDrag : undefined}
                    onDropReplace={replaceMedia}
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
                <div style={{position:"absolute",bottom:14,right:14,fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:"rgba(255,255,255,0.2)",letterSpacing:2.5,textTransform:"uppercase",pointerEvents:"none",zIndex:50}}>R&F</div>
                <div className="sd-shortcuts-hint" title="Keyboard shortcuts: Arrow keys to nudge, Shift+Arrow for 10px, Delete to remove, Ctrl+Z/Y for undo/redo, Escape to deselect">{"\u2318?"}</div>
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
