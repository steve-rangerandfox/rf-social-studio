/* eslint-disable react-refresh/only-export-components */
// This file exports a handful of snap-alignment constants + helpers
// alongside the CanvasElement component. Splitting for fast-refresh
// purity would fragment tight-knit canvas code; disabling the rule
// here is the better trade.
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume as Volume2, VolumeMute as VolumeX } from "../../../components/icons/index.jsx";

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── SNAP ALIGNMENT ENGINE ───────────────────────────────────────
export const CANVAS_W = 290, CANVAS_H = 515, SNAP_THRESH = 4;

export function computeSnap(el, siblings, canvasW = CANVAS_W, canvasH = CANVAS_H) {
  const w = el.type === 'text' ? (el.boxWidth || 190) : ((el.width || 140) * (el.scale || 1));
  const h = el.type === 'text' ? 40 : ((el.height || 140) * (el.scale || 1)); // approximate text height
  const cx = el.x + w / 2, cy = el.y + h / 2;
  const r = el.x + w, b = el.y + h;
  let guides = [], snapX = null, snapY = null;

  // Snap to canvas center
  const canvasCx = canvasW / 2, canvasCy = canvasH / 2;
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

export function fitMediaBox(width, height, maxWidth, maxHeight) {
  if (!width || !height) {
    return { width: 140, height: 140 };
  }

  const mw = maxWidth || (CANVAS_W - 30);   // 15px margin each side
  const mh = maxHeight || (CANVAS_H - 55);  // margins top/bottom
  const scale = Math.min(mw / width, mh / height, 1);
  return {
    width: Math.max(48, Math.round(width * scale)),
    height: Math.max(48, Math.round(height * scale)),
  };
}

export function CanvasElement({ data, isSelected, onSelect, onUpdate, onDragAll, snapEnabled, siblings, onGuides, isEditing, onStartEdit, onStopEdit, onDropReplace, zoom = 1, canvasW = CANVAS_W, canvasH = CANVAS_H }) {
  const videoRef = useRef(null);
  const editRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [dropHover, setDropHover] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationDisplay, setRotationDisplay] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const isVideo = data.mediaType === 'video';
  const isGif = data.mediaType === 'gif' || (data.url && /\.gif(\?|$)/i.test(data.url));
  const mediaScale = data.scale || 1;
  const mediaWidth = data.width || 140;
  const mediaHeight = data.height || 140;
  const rotation = data.rotation || 0;

  // CSS filter for media elements
  const filterStyle = (data.type === "image" || data.type === "video") && !data.locked
    ? `brightness(${data.brightness ?? 100}%) contrast(${data.contrast ?? 100}%) saturate(${data.saturation ?? 100}%) blur(${data.blur ?? 0}px)`
    : undefined;

  const wrapperStyle = {
    left: data.x,
    top: data.y,
    zIndex: isSelected ? 10 : 2,
    opacity: data.opacity ?? 1,
    transform: [
      data.type === "image" ? `scale(${mediaScale})` : null,
      rotation ? `rotate(${rotation}deg)` : null,
    ].filter(Boolean).join(' ') || undefined,
    ...(data.type === "image"
      ? {
          width: mediaWidth,
          height: mediaHeight,
        }
      : rotation ? {} : null),
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

  // Track video time for seek bar
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isVideo) return;
    const onMeta = () => setVideoDuration(vid.duration || 0);
    const onTime = () => setCurrentTime(vid.currentTime || 0);
    vid.addEventListener("loadedmetadata", onMeta);
    vid.addEventListener("timeupdate", onTime);
    if (vid.duration) setVideoDuration(vid.duration);
    return () => {
      vid.removeEventListener("loadedmetadata", onMeta);
      vid.removeEventListener("timeupdate", onTime);
    };
  }, [isVideo, data.url]);

  const togglePlay = useCallback((e) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); setPlaying(true); }
    else { vid.pause(); setPlaying(false); }
  }, []);

  // ── Rotation handle drag ──
  const handleRotate = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setIsRotating(true);
    const elW = data.type === 'text' ? (data.boxWidth || 190) : (mediaWidth * mediaScale);
    const elH = data.type === 'text' ? 40 : (mediaHeight * mediaScale);
    const onMove = (mv) => {
      // Get canvas-space cursor position
      const canvasEl = e.target.closest('.canvas');
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const scaleX = canvasW / rect.width;
      const scaleY = canvasH / rect.height;
      const cursorX = (mv.clientX - rect.left) * scaleX;
      const cursorY = (mv.clientY - rect.top) * scaleY;
      const centerX = data.x + elW / 2;
      const centerY = data.y + elH / 2;
      let angle = Math.atan2(cursorY - centerY, cursorX - centerX) * (180 / Math.PI) + 90;
      // Normalize to 0-360
      angle = ((angle % 360) + 360) % 360;
      // Snap to 45-degree increments when shift is held
      if (mv.shiftKey) {
        const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
        for (const sa of snapAngles) {
          if (Math.abs(angle - sa) < 5) { angle = sa === 360 ? 0 : sa; break; }
        }
      }
      angle = Math.round(angle * 10) / 10;
      setRotationDisplay(angle);
      onUpdate({ rotation: angle });
    };
    const onUp = () => {
      setIsRotating(false);
      setRotationDisplay(null);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [data, mediaWidth, mediaHeight, mediaScale, onUpdate]);

  const handleDrag = (e) => {
    if (data.locked || isEditing) return;
    e.preventDefault(); e.stopPropagation();
    onSelect(data.id, e.shiftKey);
    const startMouseX = e.clientX, startMouseY = e.clientY;
    const startX = data.x, startY = data.y;
    const onMove = (mv) => {
      let nx = startX + (mv.clientX - startMouseX) / zoom;
      let ny = startY + (mv.clientY - startMouseY) / zoom;
      if (snapEnabled && siblings) {
        const snap = computeSnap({ ...data, x: nx, y: ny }, siblings, canvasW, canvasH);
        if (snap.x !== null) nx = snap.x;
        if (snap.y !== null) ny = snap.y;
        if (onGuides) onGuides(snap.guides);
      }
      // Multi-select: move all selected elements together
      if (onDragAll) {
        const dx = (mv.clientX - startMouseX) / zoom;
        const dy = (mv.clientY - startMouseY) / zoom;
        onDragAll(dx, dy);
      } else {
        onUpdate({ x: nx, y: ny });
      }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (onGuides) onGuides([]);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleResize = (corner) => (e) => {
    e.preventDefault(); e.stopPropagation();
    const startMouseX = e.clientX, startMouseY = e.clientY;
    const startScale = data.scale || 1;
    const startFontSize = data.fontSize || 14;
    const startX = data.x, startY = data.y;
    const w = data.width || 140, h = data.height || 140;

    // Which directions grow scale for this corner
    const signX = corner === 'se' || corner === 'ne' ? 1 : -1;
    const signY = corner === 'se' || corner === 'sw' ? 1 : -1;

    const onMove = (mv) => {
      // Convert screen-pixel delta to canvas-pixel delta by dividing by zoom
      const dx = (mv.clientX - startMouseX) / zoom;
      const dy = (mv.clientY - startMouseY) / zoom;
      // Project mouse movement onto the diagonal direction for this corner
      const delta = (dx * signX + dy * signY) / 2;

      if (data.type === 'text') {
        // Scale proportionally relative to current font size so feel is consistent
        const newSize = Math.max(6, Math.min(96, startFontSize * (1 + delta / 100)));
        onUpdate({ fontSize: newSize });
      } else {
        // Scale proportionally: delta in canvas-px relative to current element size
        const baseDim = Math.max(w, h) * startScale;
        const newScale = Math.max(0.1, Math.min(8, startScale * (1 + delta / baseDim)));
        const patch = { scale: newScale };
        // Anchor the opposite corner by adjusting position
        const dScale = newScale - startScale;
        if (corner === 'nw') { patch.x = startX - w * dScale; patch.y = startY - h * dScale; }
        else if (corner === 'ne') { patch.y = startY - h * dScale; }
        else if (corner === 'sw') { patch.x = startX - w * dScale; }
        // 'se' — top-left is already the anchor, no position adjustment needed
        onUpdate(patch);
      }
    };
    const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleResizeBox = (side) => (e) => {
    e.preventDefault(); e.stopPropagation();
    const startMouseX = e.clientX;
    const startW = data.boxWidth || 190;
    const startElX = data.x;
    const onMove = (mv) => {
      const dx = (mv.clientX - startMouseX) / zoom;
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
        {data.url && data.mediaType !== 'video' && <img src={data.url} className="canvas-img" alt="" draggable="false" onError={e=>{e.target.style.display='none';}}/>}
        {data.url && isVid && (
          <video ref={videoRef} src={data.url} className="canvas-img"
            autoPlay loop muted={muted} playsInline draggable={false}
            style={{objectFit:'cover'}}/>
        )}
        {data.url && <div className="canvas-ov" style={{background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.05) 50%,rgba(0,0,0,0.3) 100%)"}}/>}
        {data.url && isVid && (
          <button className="mute-toggle" style={{zIndex:60,opacity:1}} onClick={e=>{e.stopPropagation();setMuted(v=>!v);}} title={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX size={12}/> : <Volume2 size={12}/>}
          </button>
        )}
      </>
    );
  }

  // Drop-to-replace: drag a file onto an image/video element to swap media
  const handleDragOver = (e) => {
    if (data.type !== 'image' || data.locked) return;
    e.preventDefault();
    e.stopPropagation();
    setDropHover(true);
  };
  const handleDragLeave = (e) => {
    e.stopPropagation();
    setDropHover(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropHover(false);
    if (data.type !== 'image' || data.locked) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/"))) return;
    if (onDropReplace) onDropReplace(data.id, file);
  };

  return (
    <div
      className={"element-wrap " + (isSelected ? "element-selected" : "") + (isEditing ? " element-editing" : "")}
      style={wrapperStyle}
      onPointerDown={isEditing ? undefined : handleDrag}
      onClick={(e) => { e.stopPropagation(); onSelect(data.id, e.shiftKey); }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (data.type === 'text' && !isEditing && onStartEdit) onStartEdit();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="el-outline"/>
      {dropHover && data.type === 'image' && (
        <div style={{position:'absolute',inset:-2,borderRadius:4,border:'2px solid #0EA5E9',background:'rgba(14,165,233,0.15)',zIndex:30,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
          <span style={{fontSize:10,fontWeight:700,color:'#0EA5E9',fontFamily:"'JetBrains Mono',monospace",letterSpacing:0.5}}>Replace</span>
        </div>
      )}
      {data.type === 'text' ? (
        <div
          ref={editRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
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
            fontSize: data.fontSize,
            color: data.gradient ? 'transparent' : data.color,
            background: data.gradient || undefined,
            WebkitBackgroundClip: data.gradient ? 'text' : undefined,
            WebkitTextFillColor: data.gradient ? 'transparent' : undefined,
            fontFamily: `'${data.fontFamily}', sans-serif`,
            letterSpacing: data.letterSpacing || 0,
            fontWeight: data.fontWeight || 600,
            fontStyle: data.italic ? 'italic' : 'normal',
            textDecoration: [data.underline && 'underline', data.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
            lineHeight: data.lineHeight || 1.25,
            textAlign: data.textAlign || 'left',
            whiteSpace: 'pre-wrap',
            width: data.boxWidth || 190,
            textShadow: data.shadow ? '0 2px 12px rgba(0,0,0,0.8)' : undefined,
            WebkitTextStroke: data.outline ? `${data.outline}px ${data.outlineColor || "#000"}` : undefined,
            textRendering: 'optimizeLegibility',
            pointerEvents: isEditing ? 'auto' : 'none',
            outline: 'none',
            cursor: isEditing ? 'text' : 'move',
          }}
        >
          {data.content}
        </div>
      ) : isVideo ? (
        <div className="video-el">
          <video ref={videoRef} src={data.url}
            style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:4,display:'block',filter:filterStyle}}
            autoPlay={data.autoPlay!==false} loop={data.loop!==false}
            muted={data.muted!==false} playsInline draggable={false}
            onLoadedMetadata={(e)=>{
              const fitted = fitMediaBox(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
              if (fitted.width !== data.width || fitted.height !== data.height) onUpdate(fitted);
            }}/>
          <div className="video-badge">{data.trimLabel||'VID'}</div>
          {isSelected && (
            <div className="sd-video-controls" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
              <button className="sd-video-playpause" onClick={togglePlay}>
                {playing ? <Pause size={10}/> : <Play size={10}/>}
              </button>
              <input type="range" className="sd-video-seek" min={0} max={videoDuration || 1} step={0.01}
                value={currentTime}
                onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value); }}/>
              <span className="sd-video-time">{formatTime(currentTime)} / {formatTime(videoDuration)}</span>
              <button className="sd-video-mute" onClick={e=>{e.stopPropagation();onUpdate({muted:!data.muted});}}>
                {data.muted!==false ? <VolumeX size={10}/> : <Volume2 size={10}/>}
              </button>
            </div>
          )}
          {!isSelected && (
            <button className="mute-toggle" onClick={e=>{e.stopPropagation();onUpdate({muted:!data.muted});}} title={data.muted!==false ? "Unmute" : "Mute"}>
              {data.muted!==false ? <VolumeX size={12}/> : <Volume2 size={12}/>}
            </button>
          )}
        </div>
      ) : isGif ? (
        <img src={data.url} alt="" draggable="false"
          style={{display:'block',width:'100%',height:'100%',borderRadius:4,pointerEvents:'none',objectFit:'contain',filter:filterStyle}}
          onError={e=>{e.target.style.display='none';}}
          onLoad={(e)=>{
            const fitted = fitMediaBox(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
            if (fitted.width !== data.width || fitted.height !== data.height) onUpdate(fitted);
          }}/>
      ) : (
        <img src={data.url} alt="" draggable="false"
          style={{display:'block',width:'100%',height:'100%',borderRadius:4,pointerEvents:'none',filter:filterStyle}}
          onError={e=>{e.target.style.display='none';}}
          onLoad={(e)=>{
            const fitted = fitMediaBox(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
            if (fitted.width !== data.width || fitted.height !== data.height) onUpdate(fitted);
          }}/>
      )}
      {isSelected && (
        <>
          <div className="handle handle-nw" onPointerDown={handleResize('nw')}/>
          <div className="handle handle-ne" onPointerDown={handleResize('ne')}/>
          <div className="handle handle-sw" onPointerDown={handleResize('sw')}/>
          <div className="handle handle-se" onPointerDown={handleResize('se')}/>
          {data.type === 'text' && <>
            <div className="handle handle-e" onPointerDown={handleResizeBox('e')}/>
            <div className="handle handle-w" onPointerDown={handleResizeBox('w')}/>
          </>}
          {/* Rotation handle */}
          <div className="handle-rotate-line"/>
          <div className="handle-rotate" onPointerDown={handleRotate}/>
          {isRotating && rotationDisplay !== null && (
            <div className="rotation-tooltip">{Math.round(rotationDisplay)}°</div>
          )}
        </>
      )}
    </div>
  );
}
