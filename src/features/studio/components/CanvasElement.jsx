import React, { useState, useRef, useEffect } from "react";

// ─── SNAP ALIGNMENT ENGINE ───────────────────────────────────────
export const CANVAS_W = 290, CANVAS_H = 515, SNAP_THRESH = 4;

export function computeSnap(el, siblings) {
  const w = el.type === 'text' ? (el.boxWidth || 190) : ((el.width || 140) * (el.scale || 1));
  const h = el.type === 'text' ? 40 : ((el.height || 140) * (el.scale || 1)); // approximate text height
  const cx = el.x + w / 2, cy = el.y + h / 2;
  const r = el.x + w, b = el.y + h;
  let guides = [], snapX = null, snapY = null;

  // Snap to canvas center
  const canvasCx = CANVAS_W / 2, canvasCy = CANVAS_H / 2;
  if (Math.abs(cx - canvasCx) < SNAP_THRESH) { snapX = canvasCx - w / 2; guides.push({ axis:'x', pos: canvasCx }); }
  if (Math.abs(cy - canvasCy) < SNAP_THRESH) { snapY = canvasCy - h / 2; guides.push({ axis:'y', pos: canvasCy }); }

  // Snap to sibling edges and centers
  for (const sib of siblings) {
    if (sib.id === el.id || sib.locked) continue;
    const sw = sib.type === 'text' ? (sib.boxWidth || 190) : ((sib.width || 140) * (sib.scale || 1));
    const sh = sib.type === 'text' ? 40 : ((sib.height || 140) * (sib.scale || 1));
    const scx = sib.x + sw / 2, scy = sib.y + sh / 2;
    const sr = sib.x + sw, sb = sib.y + sh;
    // Horizontal center align
    if (snapX === null && Math.abs(cx - scx) < SNAP_THRESH) { snapX = scx - w / 2; guides.push({ axis:'x', pos: scx }); }
    // Left edge align
    if (snapX === null && Math.abs(el.x - sib.x) < SNAP_THRESH) { snapX = sib.x; guides.push({ axis:'x', pos: sib.x }); }
    // Right edge align
    if (snapX === null && Math.abs(r - sr) < SNAP_THRESH) { snapX = sr - w; guides.push({ axis:'x', pos: sr }); }
    // Vertical center align
    if (snapY === null && Math.abs(cy - scy) < SNAP_THRESH) { snapY = scy - h / 2; guides.push({ axis:'y', pos: scy }); }
    // Top edge align
    if (snapY === null && Math.abs(el.y - sib.y) < SNAP_THRESH) { snapY = sib.y; guides.push({ axis:'y', pos: sib.y }); }
    // Bottom edge align
    if (snapY === null && Math.abs(b - sb) < SNAP_THRESH) { snapY = sb - h; guides.push({ axis:'y', pos: sb }); }
  }
  return { x: snapX, y: snapY, guides };
}

// ─── CANVAS ELEMENT ──────────────────────────────────────────────
export const BRAND_COLORS = ["#111318","#7C3AED","#F59E0B","#0A66C2","#BE185D","#FFFFFF","#F7F8FA","#10B981","#E5E7EB"];
export const FONTS = ["Bricolage Grotesque","JetBrains Mono"];

export function fitMediaBox(width, height, maxWidth = 260, maxHeight = 460) {
  if (!width || !height) {
    return { width: 140, height: 140 };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(48, Math.round(width * scale)),
    height: Math.max(48, Math.round(height * scale)),
  };
}

export function CanvasElement({ data, isSelected, onSelect, onUpdate, snapEnabled, siblings, onGuides, isEditing, onStartEdit, onStopEdit }) {
  const videoRef = useRef(null);
  const editRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const isVideo = data.mediaType === 'video';
  const mediaScale = data.scale || 1;
  const mediaWidth = data.width || 140;
  const mediaHeight = data.height || 140;
  const wrapperStyle = {
    left: data.x,
    top: data.y,
    zIndex: isSelected ? 10 : 2,
    ...(data.type === "image"
      ? {
          width: mediaWidth,
          height: mediaHeight,
          transform: `scale(${mediaScale})`,
        }
      : null),
  };

  // Focus contentEditable when entering edit mode
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      // Place cursor at end
      const sel = window.getSelection();
      sel.selectAllChildren(editRef.current);
      sel.collapseToEnd();
    }
  }, [isEditing]);

  const handleDrag = (e) => {
    if (data.locked || isEditing) return;
    e.preventDefault(); e.stopPropagation();
    onSelect();
    const sx = e.clientX - data.x, sy = e.clientY - data.y;
    const onMove = (mv) => {
      let nx = mv.clientX - sx, ny = mv.clientY - sy;
      if (snapEnabled && siblings) {
        const snap = computeSnap({ ...data, x: nx, y: ny }, siblings);
        if (snap.x !== null) nx = snap.x;
        if (snap.y !== null) ny = snap.y;
        if (onGuides) onGuides(snap.guides);
      }
      onUpdate({ x: nx, y: ny });
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (onGuides) onGuides([]);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const startX   = e.clientX, startY = e.clientY;
    const startVal = data.type === 'text' ? (data.fontSize || 14) : (data.scale || 1);
    const onMove = (mv) => {
      const delta = (mv.clientX - startX + mv.clientY - startY) / 2;
      if (data.type === 'text') {
        onUpdate({ fontSize: Math.max(6, Math.min(96, startVal + delta * 0.35)) });
      } else {
        onUpdate({ scale: Math.max(0.1, Math.min(8, startVal + delta * 0.012)) });
      }
    };
    const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleResizeBox = (side) => (e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = data.boxWidth || 190;
    const startElX = data.x;
    const onMove = (mv) => {
      const dx = mv.clientX - startX;
      if (side === 'e') {
        onUpdate({ boxWidth: Math.max(40, startW + dx) });
      } else {
        const newW = Math.max(40, startW - dx);
        onUpdate({ boxWidth: newW, x: startElX + (startW - newW) });
      }
    };
    const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // BG layer (locked image or video)
  if (data.locked) {
    const isVid = data.mediaType === 'video';
    return (
      <>
        {data.url && data.mediaType !== 'video' && <img src={data.url} className="canvas-img" alt="" draggable="false"/>}
        {data.url && isVid && (
          <video ref={videoRef} src={data.url} className="canvas-img"
            autoPlay loop muted={muted} playsInline draggable={false}
            style={{objectFit:'cover'}}/>
        )}
        {data.url && <div className="canvas-ov" style={{background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.05) 50%,rgba(0,0,0,0.3) 100%)"}}/>}
        {data.url && isVid && (
          <button className="mute-toggle" style={{zIndex:60}} onClick={e=>{e.stopPropagation();setMuted(v=>!v);}}>
            {muted ? 'Mute' : 'Unmute'}
          </button>
        )}
      </>
    );
  }

  return (
    <div
      className={"element-wrap " + (isSelected ? "element-selected" : "")}
      style={wrapperStyle}
      onPointerDown={handleDrag}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="el-outline"/>
      {data.type === 'text' ? (
        <div
          ref={editRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onDoubleClick={(e) => { e.stopPropagation(); if (!isEditing) onStartEdit(); }}
          onBlur={() => {
            if (isEditing && editRef.current) {
              onUpdate({ content: editRef.current.innerText });
              onStopEdit();
            }
          }}
          onKeyDown={(e) => {
            if (!isEditing) return;
            e.stopPropagation();
            if (e.key === 'Escape') { editRef.current.blur(); }
          }}
          style={{
            fontSize: data.fontSize, color: data.color,
            fontFamily: `'${data.fontFamily}', sans-serif`,
            letterSpacing: data.letterSpacing || 0,
            fontWeight: data.fontWeight || 600,
            lineHeight: 1.25, whiteSpace: 'pre-wrap',
            width: data.boxWidth || 190,
            textShadow: data.shadow ? '0 2px 12px rgba(0,0,0,0.8)' : undefined,
            textRendering: 'optimizeLegibility',
            pointerEvents: isEditing ? 'auto' : 'none',
            outline: 'none', cursor: isEditing ? 'text' : 'default',
          }}
        >
          {data.content}
        </div>
      ) : isVideo ? (
        <div className="video-el">
          <video ref={videoRef} src={data.url}
            style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:4,display:'block'}}
            autoPlay={data.autoPlay!==false} loop={data.loop!==false}
            muted={data.muted!==false} playsInline draggable={false}
            onLoadedMetadata={(e)=>{
              const fitted = fitMediaBox(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
              if (fitted.width !== data.width || fitted.height !== data.height) onUpdate(fitted);
            }}/>
          <div className="video-badge">{data.trimLabel||'VID'}</div>
          <button className="mute-toggle" onClick={e=>{e.stopPropagation();onUpdate({muted:!data.muted});}}>
            {data.muted!==false?'Mute':'Sound'}
          </button>
        </div>
      ) : (
        <img src={data.url} alt="" draggable="false"
          style={{display:'block',width:'100%',height:'100%',borderRadius:4,pointerEvents:'none'}}
          onLoad={(e)=>{
            const fitted = fitMediaBox(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
            if (fitted.width !== data.width || fitted.height !== data.height) onUpdate(fitted);
          }}/>
      )}
      {isSelected && (
        <>
          <div className="handle handle-nw" onPointerDown={handleResize}/>
          <div className="handle handle-ne" onPointerDown={handleResize}/>
          <div className="handle handle-sw" onPointerDown={handleResize}/>
          <div className="handle handle-se" onPointerDown={handleResize}/>
          {data.type === 'text' && <>
            <div className="handle handle-e" onPointerDown={handleResizeBox('e')}/>
            <div className="handle handle-w" onPointerDown={handleResizeBox('w')}/>
          </>}
        </>
      )}
    </div>
  );
}
