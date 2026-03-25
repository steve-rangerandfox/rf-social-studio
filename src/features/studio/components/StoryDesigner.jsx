import React, { useState, useRef, useEffect } from "react";
import { X, Check, Plus, Minus, RotateCcw } from "lucide-react";
import { CanvasElement, computeSnap, BRAND_COLORS, CANVAS_W, CANVAS_H, fitMediaBox } from "./CanvasElement.jsx";
import { T, uid, TEMPLATES } from "../shared.js";
import { generateStoryTips } from "../../lib/api-client.js";

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

  // Auto-save elements to parent row whenever they change
  useEffect(() => { if (onSave) onSave(elements); }, [elements, onSave]);

  const [selectedId,  setSelectedId]  = useState(null);
  const [editingId,   setEditingId]   = useState(null);
  const [zoom,        setZoom]        = useState(1.5);
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

  const selected  = elements.find(el => el.id === selectedId);
  const updateEl  = (id, patch) => setElements(els => els.map(e => e.id === id ? { ...e, ...patch } : e));
  const deleteEl  = (id) => { setElements(els => els.filter(e => e.id !== id)); setSelectedId(null); };

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
    setElements(els => [...els, el]); setSelectedId(el.id);
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
      setElements(els => [...els, el]); setSelectedId(el.id);
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
    updateEl("bg", { url, mediaType: isGif ? 'gif' : isVid ? 'video' : 'image' });
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
    setElements(els); setSelectedId(null);
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
            <button className="btn btn-ai" style={{padding:"5px 11px",fontSize:12}}
              onClick={()=>{setShowCopilot(v=>!v);if(!showCopilot&&aiTips.length===0)runAICopilot();}}>
              {showCopilot?"Hide AI":"AI Refine"}
            </button>
            {postState!=="done"&&<button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:12}} onClick={onClose}>Discard</button>}
            {postState==="done"
              ?<button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:12}} onClick={onClose}>Close</button>
              :<button className="btn btn-primary" style={{padding:"5px 14px",fontSize:12}} onClick={doPost} disabled={postState==="posting"}>Publish Story</button>}
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
                <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px",justifyContent:"flex-start"}} onClick={addText}><Plus size={12} style={{marginRight:4}}/> Add Text</button>
                <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px",justifyContent:"flex-start"}} onClick={()=>imgFileRef.current?.click()}><Plus size={12} style={{marginRight:4}}/> Image / GIF</button>
                <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px",justifyContent:"flex-start"}} onClick={()=>vidFileRef.current?.click()}><Plus size={12} style={{marginRight:4}}/> Video Layer</button>
                <input ref={imgFileRef} type="file" accept="image/*,image/gif" style={{display:"none"}} onChange={e=>addMedia(e.target.files?.[0])}/>
                <input ref={vidFileRef} type="file" accept="video/*,image/gif"  style={{display:"none"}} onChange={e=>addMedia(e.target.files?.[0])}/>
                <button className="btn btn-ghost" style={{flex:1,fontSize:12,padding:"6px 10px",justifyContent:"flex-start"}} onClick={()=>bgFileRef.current?.click()}>
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
                  <>
                    <div className="lbl" style={{marginBottom:4}}>Font</div>
                    <div className="font-section-header"><span className="font-verified"><Check size={10}/></span> Brand Fonts</div>
                    <div className="font-row">
                      {BRAND_FONTS.map(f=>(
                        <button key={f.name} className={"font-btn "+(selected.fontFamily===f.name?"sel":"")}
                          style={{fontFamily:`'${f.name}',sans-serif`}}
                          onClick={()=>updateEl(selectedId,{fontFamily:f.name})}>{f.label}</button>
                      ))}
                    </div>
                    <div className="font-section-header">System Fonts</div>
                    <div className="font-row">
                      {SYS_FONTS.map(f=>(
                        <button key={f.name} className={"font-btn "+(selected.fontFamily===f.name?"sel":"")}
                          style={{fontFamily:`'${f.name}',sans-serif`}}
                          onClick={()=>updateEl(selectedId,{fontFamily:f.name})}>{f.label}</button>
                      ))}
                    </div>

                    <div className="lbl" style={{marginBottom:2}}>Size — {selected.fontSize}px</div>
                    <input type="range" className="s-slider" min={7} max={72} value={selected.fontSize}
                      onChange={e=>updateEl(selectedId,{fontSize:parseInt(e.target.value)})}/>

                    <div className="lbl" style={{marginBottom:2}}>Letter Spacing — {selected.letterSpacing||0}</div>
                    <input type="range" className="s-slider" min={-2} max={10} step={0.5} value={selected.letterSpacing||0}
                      onChange={e=>updateEl(selectedId,{letterSpacing:parseFloat(e.target.value)})}/>

                    <div className="lbl" style={{marginBottom:6}}>Weight</div>
                    <div className="font-row" style={{marginBottom:8}}>
                      {[{l:"Regular",v:400},{l:"Bold",v:700},{l:"Black",v:800}].map(w=>(
                        <button key={w.v} className={"font-btn "+(selected.fontWeight===w.v?"sel":"")}
                          style={{fontWeight:w.v}} onClick={()=>updateEl(selectedId,{fontWeight:w.v})}>{w.l}</button>
                      ))}
                    </div>

                    <div className="s-toggle-row">
                      <div className="lbl" style={{margin:0}}>Text Shadow</div>
                      <div className="s-toggle" style={{background:selected.shadow?T.ink:T.border2}}
                        onClick={()=>updateEl(selectedId,{shadow:!selected.shadow})}>
                        <div className="s-toggle-knob" style={{left:selected.shadow?14:2}}/>
                      </div>
                    </div>

                    <div className="lbl" style={{marginBottom:4}}>Color</div>
                    <div className="color-swatches">
                      {BRAND_COLORS.map(c=>(
                        <div key={c} className={"color-swatch "+(selected.color===c?"sel":"")}
                          style={{background:c,border:c==="#FFFFFF"?"2px solid #E5E7EB":undefined}}
                          onClick={()=>updateEl(selectedId,{color:c})}/>
                      ))}
                    </div>
                  </>
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
                    <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px",width:"100%",marginTop:4}}
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
                  <button className="btn btn-primary" style={{padding:"5px 10px",fontSize:11}} onClick={saveTemplate}>Save</button>
                  <button className="btn btn-ghost" style={{padding:"5px 8px",fontSize:11}} onClick={()=>setShowTmplSave(false)}><X size={10}/></button>
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
                <button className={"zoom-btn"+(snapOn?" snap-active":"")} onClick={()=>setSnapOn(s=>!s)} title="Toggle snap alignment" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 5px"}}>{'\u229E'} Snap</button>
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.max(0.4,parseFloat((z-0.1).toFixed(1))))} title="Zoom out"><Minus size={12}/></button>
                <span className="zoom-label">{Math.round(zoom*100)}%</span>
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.min(2.0,parseFloat((z+0.1).toFixed(1))))} title="Zoom in"><Plus size={12}/></button>
                <button className="zoom-btn" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 4px"}} onClick={()=>setZoom(1.5)} title="Reset zoom">150%</button>
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
                <div style={{position:"absolute",bottom:14,right:14,fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:"rgba(255,255,255,0.2)",letterSpacing:2.5,textTransform:"uppercase",pointerEvents:"none",zIndex:50}}>R&F</div>
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
