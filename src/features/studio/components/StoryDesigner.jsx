import React, { useState, useRef, useEffect } from "react";
import { X, Check, Plus, Minus, RotateCcw, Undo2, Redo2, Grid3x3, Upload, Trash2, Bold, Italic, Underline, Strikethrough, ChevronDown, Type, AArrowDown, AArrowUp } from "lucide-react";
import { CanvasElement, computeSnap, BRAND_COLORS, CANVAS_W, CANVAS_H, fitMediaBox } from "./CanvasElement.jsx";
import { T, uid, TEMPLATES } from "../shared.js";
import { generateStoryTips } from "../../../lib/api-client.js";

const BRAND_FONTS = [
  { name:"Bricolage Grotesque", label:"Bricolage",  group:"brand" },
  { name:"JetBrains Mono",      label:"Mono",       group:"brand" },
  { name:"Oakes Grotesk",       label:"Oakes",      group:"brand" },
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
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
              boxShadow:"0 12px 32px rgba(24,23,20,0.1)",padding:8,width:172,
            }}>
              {/* Solid colors */}
              <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>Solid</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3,marginBottom:8}}>
                {BRAND_COLORS.map(c => (
                  <button key={c} onClick={() => { updateEl(selectedId, { color: c, gradient: null }); setColorOpen(false); }}
                    style={{width:24,height:24,borderRadius:5,border:!selected.gradient&&selected.color===c?`2px solid ${T.ink}`:c==="#FFFFFF"||c==="#F7F8FA"?"1px solid #ddd":"1px solid transparent",background:c,cursor:"pointer",padding:0}}/>
                ))}
              </div>
              {/* Gradients */}
              <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>Gradient</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,marginBottom:8}}>
                {GRADIENT_PRESETS.map(g => (
                  <button key={g.id} title={g.label} onClick={() => { updateEl(selectedId, { gradient: g.css }); setColorOpen(false); }}
                    style={{height:24,borderRadius:5,border:selected.gradient===g.css?`2px solid ${T.ink}`:"1px solid transparent",background:g.css,cursor:"pointer",padding:0}}/>
                ))}
              </div>
              {/* Hex input */}
              <div style={{display:"flex",alignItems:"center",gap:4,borderTop:`1px solid ${T.border}`,paddingTop:6}}>
                <div style={{width:18,height:18,borderRadius:4,background:colorPreview,border:`1px solid ${T.border}`,flexShrink:0}}/>
                <input type="text" value={selected.gradient || selected.color}
                  onChange={e => {
                    const v = e.target.value;
                    if (v.startsWith("linear-gradient") || v.startsWith("radial-gradient")) updateEl(selectedId, { gradient: v });
                    else updateEl(selectedId, { color: v, gradient: null });
                  }}
                  style={{flex:1,fontSize:10,fontFamily:"'JetBrains Mono',monospace",padding:"3px 5px",border:`1px solid ${T.border}`,borderRadius:4,background:T.s2,color:T.text,outline:"none"}}/>
              </div>
              {selected.gradient && (
                <button onClick={() => { updateEl(selectedId, { gradient: null }); }}
                  style={{marginTop:4,width:"100%",padding:"4px 0",border:"none",borderRadius:4,background:"transparent",cursor:"pointer",fontSize:10,fontWeight:600,color:T.textDim}}>
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
  try { localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(fonts)); } catch {}
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

// Module-level template store (persists across opens in the session)
let _savedTemplates = [];
let _defaultTmplId  = null;

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
    if (_defaultTmplId) {
      const t = _savedTemplates.find(t => t.id === _defaultTmplId);
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
  const MAX_HISTORY = 20;
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

  const [selectedId,  setSelectedId]  = useState(null);
  const [editingId,   setEditingId]   = useState(null);
  const [zoom,        setZoom]        = useState(1.8);
  const [postState,   setPostState]   = useState("idle");
  const [showCopilot, setShowCopilot] = useState(false);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiTips,      setAiTips]      = useState([]);
  const [templates,   setTemplates]   = useState(_savedTemplates);
  const [defaultId,   setDefaultId]   = useState(_defaultTmplId);
  const [tmplName,    setTmplName]    = useState("");
  const [showTmplSave,setShowTmplSave]= useState(false);
  const [snapOn,      setSnapOn]      = useState(true);
  const [guides,      setGuides]      = useState([]);
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

  const selected  = elements.find(el => el.id === selectedId);
  const updateEl  = (id, patch) => setElements(els => els.map(e => e.id === id ? { ...e, ...patch } : e));
  const deleteEl  = (id) => { pushElements(els => els.filter(e => e.id !== id)); setSelectedId(null); };

  // Arrow-key nudge (1px, or 10px with Shift) — skip while inline editing
  useEffect(() => {
    const onKey = (e) => {
      if (editingId) return;
      if (!selectedId) return;
      const sel = elements.find(el => el.id === selectedId);
      if (!sel || sel.locked) return;
      const arrows = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0] };
      const dir = arrows[e.key];
      if (!dir) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      updateEl(selectedId, { x: sel.x + dir[0] * step, y: sel.y + dir[1] * step });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, elements, editingId]);

  const addText = () => {
    const el = { id:uid(), type:"text", content:"New text", x:40, y:180, fontSize:18, fontFamily:"Bricolage Grotesque", color:"#FFFFFF", letterSpacing:0, fontWeight:600, shadow:false };
    pushElements(els => [...els, el]); setSelectedId(el.id);
  };

  const addMedia = (file) => {
    if (!file) return;
    const url    = URL.createObjectURL(file);
    const isGif  = file.type === "image/gif";
    const isVid  = !isGif && file.type.startsWith("video/");
    const mType  = isGif ? 'gif' : isVid ? 'video' : 'image';
    const makeEl = (w, h) => {
      const el = {
        id:uid(),
        type:"image",
        url,
        x:56,
        y:140,
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
      pushElements(els => [...els, el]); setSelectedId(el.id);
    };
    if (!isVid) {
      const img = new Image();
      img.onload = () => { const fitted = fitMediaBox(img.naturalWidth, img.naturalHeight); makeEl(fitted.width, fitted.height); };
      img.src = url;
    } else {
      makeEl(160, 90);
    }
  };

  const setBg = (file) => {
    if (!file) return;
    const url    = URL.createObjectURL(file);
    const isGif  = file.type === "image/gif";
    const isVid  = !isGif && file.type.startsWith("video/");
    pushElements(els => els.map(e => e.id === "bg" ? { ...e, url, mediaType: isGif ? 'gif' : isVid ? 'video' : 'image' } : e));
  };

  // Save template
  const saveTemplate = () => {
    if (!tmplName.trim()) return;
    const tmpl = {
      id: uid(),
      name: tmplName.trim(),
      elements: elements.map(e => ({ ...e, url: e.locked ? null : e.url })), // strip bg URL
    };
    _savedTemplates = [..._savedTemplates, tmpl];
    setTemplates(_savedTemplates);
    setTmplName(""); setShowTmplSave(false);
  };

  const setDefault = (id) => {
    _defaultTmplId = id === defaultId ? null : id;
    setDefaultId(_defaultTmplId);
  };

  const loadTemplate = (tmpl) => {
    const els = tmpl.elements.map(e => ({ ...e, id: e.id === 'bg' ? 'bg' : uid() }));
    pushElements(els); setSelectedId(null);
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
      if ((e.key==='Backspace'||e.key==='Delete') && selectedId && selected && !selected.locked && document.activeElement.tagName!=='INPUT' && document.activeElement.tagName!=='TEXTAREA') deleteEl(selectedId);
      if (e.key==='Escape') setSelectedId(null);
    };
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);
  }, [selectedId,selected,editingId]);

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
              onClick={()=>{setShowCopilot(v=>!v);if(!showCopilot&&aiTips.length===0)runAICopilot();}}>
              {showCopilot?"Hide AI":"AI Refine"}
            </button>
            {postState!=="done"&&<button className="btn btn-ghost btn-sm" onClick={onClose}>Discard</button>}
            {postState==="done"
              ?<button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
              :<button className="btn btn-primary btn-sm" onClick={doPost} disabled={postState==="posting"}>Publish Story</button>}
            <button className="m-x" onClick={onClose}><X size={16}/></button>
          </div>
        </div>

        <div className="s-layout">
          {/* ── PROPERTY INSPECTOR ── */}
          <aside className="s-bar">

            {/* Canvas actions */}
            <div className="inspector-group">
              <div className="inspector-group-title">Canvas</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <button className="btn btn-ghost btn-sm" style={{justifyContent:"flex-start"}} onClick={addText}><Plus size={12} style={{marginRight:4}}/> Add Text</button>
                <button className="btn btn-ghost btn-sm" style={{justifyContent:"flex-start"}} onClick={()=>imgFileRef.current?.click()}><Plus size={12} style={{marginRight:4}}/> Image / GIF</button>
                <button className="btn btn-ghost btn-sm" style={{justifyContent:"flex-start"}} onClick={()=>vidFileRef.current?.click()}><Plus size={12} style={{marginRight:4}}/> Video Layer</button>
                <input ref={imgFileRef} type="file" accept="image/*,image/gif" style={{display:"none"}} onChange={e=>addMedia(e.target.files?.[0])}/>
                <input ref={vidFileRef} type="file" accept="video/*,image/gif"  style={{display:"none"}} onChange={e=>addMedia(e.target.files?.[0])}/>
                <button className="btn btn-ghost btn-sm" style={{flex:1,justifyContent:"flex-start"}} onClick={()=>bgFileRef.current?.click()}>
                  {elements.find(e=>e.id==="bg")?.url?"Replace Background":"Set Background"}
                </button>
                <input ref={bgFileRef} type="file" accept="image/*,video/*,image/gif" style={{display:"none"}} onChange={e=>setBg(e.target.files?.[0])}/>
              </div>
            </div>

            {/* Element properties */}
            {selected && !selected.locked ? (
              <div className="inspector-group">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div className="inspector-group-title" style={{margin:0}}>
                    {selected.type==='text'?'Text':selected.mediaType==='video'?'Video':'Image'} Properties
                  </div>
                  <button className="del-btn" onClick={()=>deleteEl(selectedId)}><X size={10} style={{marginRight:3}}/> Delete</button>
                </div>

                {selected.type==='text' && (
                  <TextInspector
                    selected={selected}
                    selectedId={selectedId}
                    updateEl={updateEl}
                    customFonts={customFonts}
                    removeCustomFont={removeCustomFont}
                    fontFileRef={fontFileRef}
                    handleFontUpload={handleFontUpload}
                    fontInstalling={fontInstalling}
                    fontError={fontError}
                  />
                )}

                {selected.type==='image' && selected.mediaType==='video' && (
                  <>
                    <div className="lbl" style={{marginBottom:2}}>Scale — {(selected.scale||1).toFixed(2)}x</div>
                    <input type="range" className="s-slider" min={0.2} max={3} step={0.05} value={selected.scale||1}
                      onChange={e=>updateEl(selectedId,{scale:parseFloat(e.target.value)})}/>

                    <div className="inspector-group-title" style={{marginTop:8}}>Video Controls</div>

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

                    <div style={{marginTop:4}}>
                      <div className="lbl" style={{marginBottom:4}}>Trim (placeholder)</div>
                      <div style={{height:20,background:T.s3,borderRadius:6,position:"relative",overflow:"hidden",border:`1px solid ${T.border}`}}>
                        <div style={{position:"absolute",left:"10%",right:"20%",top:0,bottom:0,background:"rgba(24,23,20,0.12)",borderLeft:`2px solid ${T.ink}`,borderRight:`2px solid ${T.ink}`,borderRadius:3}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:9,color:T.textDim,fontFamily:"'JetBrains Mono',monospace"}}>
                        <span>0:00</span><span style={{color:T.text}}>Selected range</span><span>0:15</span>
                      </div>
                    </div>
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
              </div>
            ) : (
              <div className="inspector-group">
                <div className="inspector-group-title">Properties</div>
                <div style={{fontSize:12,color:"#9AA0AE",padding:"8px 0"}}>
                  {selectedId?"Background layer is locked.":"Click an element to edit it."}
                </div>
              </div>
            )}

            {/* AI Copilot */}
            {showCopilot && (
              <div className="inspector-group">
                <div className="inspector-group-title">AI Design Copilot</div>
                <div className="ai-copilot">
                  <div className="ai-copilot-title">

                    <span>{aiLoading?"Analyzing...":"Layout Suggestions"}</span>
                    {!aiLoading&&<button style={{marginLeft:"auto",background:"transparent",border:"none",color:"#7C3AED",cursor:"pointer",fontSize:11,fontWeight:600,padding:0}} onClick={runAICopilot}><RotateCcw size={12}/></button>}
                  </div>
                  {aiLoading&&<div style={{height:4,background:"#EDE9FE",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:"60%",background:"#7C3AED",borderRadius:99}}/></div>}
                  {aiTips.map((tip,i)=><div key={i} className="ai-suggestion"><b>{i+1}.</b> {tip}</div>)}
                </div>
              </div>
            )}

            {/* Template Gallery */}
            <div className="inspector-group">
              <div className="inspector-group-title">Templates</div>
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
                      <button className={"tmpl-heart "+(defaultId===tmpl.id?"is-default":"")}
                        onClick={e=>{e.stopPropagation();setDefault(tmpl.id);}}
                        title={defaultId===tmpl.id?"Remove default":"Set as default"}>
                        {defaultId===tmpl.id?"Default":"Set default"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {showTmplSave ? (
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <input className="s-inp" style={{flex:1,fontSize:11.5}} value={tmplName} onChange={e=>setTmplName(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&saveTemplate()} placeholder="Template name..." autoFocus/>
                  <button className="btn btn-primary btn-sm" onClick={saveTemplate}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setShowTmplSave(false)}><X size={10}/></button>
                </div>
              ) : (
                <button className="save-tmpl-btn" onClick={()=>setShowTmplSave(true)}>
                  <Plus size={12} style={{marginRight:4}}/> Save current as template
                </button>
              )}
            </div>

            {/* Layers */}
            <div className="inspector-group" style={{marginTop:"auto",borderTop:"1px solid #E5E7EB"}}>
              <div className="inspector-group-title">Layers</div>
              <div className="layers-stack">
                {layersRev.map(el=>(
                  <div key={el.id} className={"layer-item "+(selectedId===el.id?"active":"")} onClick={()=>setSelectedId(el.id)}>
                    <span className="layer-icon" style={{color:selectedId===el.id?"#111318":"#9AA0AE"}}>
                      {el.type==='text'?'T':el.locked?'\u229E':el.mediaType==='video'?'\u25B6':'img'}
                    </span>
                    <span className="layer-label">{el.type==='text'?el.content?.slice(0,22):el.locked?'Background':el.mediaType==='video'?'Video':'Image'}</span>
                    {!el.locked&&<button className="layer-del" onClick={e=>{e.stopPropagation();deleteEl(el.id);}}><X size={10}/></button>}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── CANVAS AREA ── */}
          <div className="s-canvas-area">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.45)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.2,textTransform:"uppercase"}}>
                1080 × 1920 · 9:16
              </div>
              <div className="canvas-zoom-bar">
                <button className="zoom-btn" onClick={undo} disabled={historyIndex<=0} title="Undo (Ctrl+Z)" style={{opacity:historyIndex<=0?0.35:1}}><Undo2 size={12}/></button>
                <button className="zoom-btn" onClick={redo} disabled={historyIndex>=history.length-1} title="Redo (Ctrl+Shift+Z)" style={{opacity:historyIndex>=history.length-1?0.35:1}}><Redo2 size={12}/></button>
                <span style={{width:1,height:14,background:"var(--t-border)",margin:"0 2px"}}/>
                <button className={"zoom-btn"+(showGuides?" snap-active":"")} onClick={()=>setShowGuides(g=>!g)} title="Toggle guide overlay" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 5px"}}><Grid3x3 size={12}/></button>
                <button className={"zoom-btn"+(snapOn?" snap-active":"")} onClick={()=>setSnapOn(s=>!s)} title="Toggle snap alignment" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 5px"}}>{'\u229E'} Snap</button>
                <span style={{width:1,height:14,background:"var(--t-border)",margin:"0 2px"}}/>
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.max(0.4,parseFloat((z-0.1).toFixed(1))))} title="Zoom out"><Minus size={12}/></button>
                <span className="zoom-label">{Math.round(zoom*100)}%</span>
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.min(2.0,parseFloat((z+0.1).toFixed(1))))} title="Zoom in"><Plus size={12}/></button>
                <button className="zoom-btn" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 4px"}} onClick={()=>setZoom(1.8)} title="Reset zoom">180%</button>
              </div>
            </div>
            <div className="canvas-wrap" style={{transform:`scale(${zoom})`,transformOrigin:"top center"}}>
              <div className="canvas" onMouseDown={e=>{if(e.target===e.currentTarget){setSelectedId(null);setEditingId(null);}}}>
                {elements.filter(e=>e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedId===el.id}
                    onSelect={()=>setSelectedId(el.id)} onUpdate={p=>updateEl(el.id,p)}/>
                ))}
                <div className="canvas-ov" style={{background:"linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.28) 100%)"}}/>
                {elements.filter(e=>!e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedId===el.id}
                    onSelect={()=>{setSelectedId(el.id);if(editingId&&editingId!==el.id)setEditingId(null);}}
                    onUpdate={p=>updateEl(el.id,p)}
                    snapEnabled={snapOn} siblings={elements} onGuides={setGuides}
                    isEditing={editingId===el.id}
                    onStartEdit={()=>{setSelectedId(el.id);setEditingId(el.id);}}
                    onStopEdit={()=>setEditingId(null)}/>
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
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
