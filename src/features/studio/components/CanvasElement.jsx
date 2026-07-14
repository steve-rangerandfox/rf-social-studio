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

export function CanvasElement({ data, isSelected, onSelect, onUpdate, onDragAll, snapEnabled, siblings, onGuides, isEditing, onStartEdit, onStopEdit, onDropReplace, onContextMenu, zoom = 1, canvasW = CANVAS_W, canvasH = CANVAS_H, bgSpanTotal, bgSpanIndex, ghost = false }) {
  const videoRef = useRef(null);
  const editRef = useRef(null);
  // Live text while editing, kept in a ref so it survives DOM clobbering:
  // clicking out clears editingId, which re-renders the box with the OLD
  // data.content back in the DOM BEFORE blur fires — so reading innerText on
  // blur returned the pre-edit text. The ref holds what was actually typed.
  const liveTextRef = useRef('');
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
    // Selection must NOT jump the layer stack — array/DOM order is the
    // z-order, and the ghost overlay already carries chrome + interaction
    // above everything. Inline text editing is the one exception (the
    // ghost steps aside, so the editable copy needs to win pointer events
    // over anything overlapping it).
    zIndex: isEditing ? 10 : 2,
    opacity: data.opacity ?? 1,
    // Selection chrome (outline + handles) renders at constant screen size:
    // this divisor carries everything that scales the wrap — the canvas zoom
    // AND the element's own transform scale (images/shapes scale the wrapper,
    // so their chrome would balloon/shrink with the artwork otherwise).
    "--sd-zoom": zoom * ((data.type === "image" || data.type === "shape") ? mediaScale : 1),
    transform: [
      (data.type === "image" || data.type === "shape") ? `scale(${mediaScale})` : null,
      rotation ? `rotate(${rotation}deg)` : null,
    ].filter(Boolean).join(' ') || undefined,
    ...((data.type === "image" || data.type === "shape")
      ? {
          width: mediaWidth,
          height: mediaHeight,
        }
      : rotation ? {} : null),
  };

  // Focus contentEditable when entering edit mode
  useEffect(() => {
    if (isEditing && editRef.current) {
      // Seed the DOM text ONCE, then let the contentEditable own it while
      // editing (JSX renders no child in edit mode). Rendering data.content
      // as a React child instead lets any mid-edit re-render (toolbar click,
      // auto-save, selection change) reset the DOM back to the old text and
      // lose the user's typing — which blur then commits, so edits "revert".
      editRef.current.innerText = data.content || '';
      liveTextRef.current = data.content || '';
      editRef.current.focus();
      // Place cursor at end
      const sel = window.getSelection();
      sel.selectAllChildren(editRef.current);
      sel.collapseToEnd();
    }
    // Intentionally depends on isEditing only — re-seeding on data.content
    // changes would fight the user's live typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (isEditing) return;
    e.preventDefault(); e.stopPropagation();
    onSelect(data.id, e.shiftKey);
    if (data.locked) return; // locked (background): selectable, but not draggable
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

    // Which directions grow for this corner
    const signX = corner === 'se' || corner === 'ne' ? 1 : -1;
    const signY = corner === 'se' || corner === 'sw' ? 1 : -1;

    const onMove = (mv) => {
      // Convert screen-pixel delta to canvas-pixel delta by dividing by zoom
      const dx = (mv.clientX - startMouseX) / zoom;
      const dy = (mv.clientY - startMouseY) / zoom;

      if (data.type === 'text') {
        // Scale proportionally relative to current font size so feel is consistent
        const delta = (dx * signX + dy * signY) / 2;
        const newSize = Math.max(6, Math.min(96, startFontSize * (1 + delta / 100)));
        onUpdate({ fontSize: newSize });
      } else if (data.type === 'shape') {
        // Shapes stretch X and Y independently (Figma-style) — corners move
        // both axes without uniform scale-up. Legacy scale folds into
        // width/height so the geometry stays literal.
        const startW = w * startScale, startH = h * startScale;
        const minH = data.shape === 'line' ? 1 : 4;
        const newW = Math.max(4, startW + dx * signX);
        const newH = Math.max(minH, startH + dy * signY);
        const patch = { width: newW, height: newH, scale: 1 };
        if (signX < 0) patch.x = startX + (startW - newW);
        if (signY < 0) patch.y = startY + (startH - newH);
        onUpdate(patch);
      } else {
        // Media keeps proportional scaling (photos shouldn't distort)
        const delta = (dx * signX + dy * signY) / 2;
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

  // Single-axis stretch for shapes (edge midpoint handles + line endpoint
  // nodes). Anchors the opposite edge; normalizes legacy scale into w/h.
  const handleStretchShape = (side) => (e) => {
    e.preventDefault(); e.stopPropagation();
    const startMouseX = e.clientX, startMouseY = e.clientY;
    const startScale = data.scale || 1;
    const startW = (data.width || 140) * startScale;
    const startH = (data.height || 140) * startScale;
    const startX = data.x, startY = data.y;
    const minH = data.shape === 'line' ? 1 : 4;
    const onMove = (mv) => {
      const dx = (mv.clientX - startMouseX) / zoom;
      const dy = (mv.clientY - startMouseY) / zoom;
      const patch = { scale: 1 };
      if (side === 'e') patch.width = Math.max(4, startW + dx);
      else if (side === 'w') { patch.width = Math.max(4, startW - dx); patch.x = startX + (startW - patch.width); }
      else if (side === 's') patch.height = Math.max(minH, startH + dy);
      else if (side === 'n') { patch.height = Math.max(minH, startH - dy); patch.y = startY + (startH - patch.height); }
      onUpdate(patch);
    };
    const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleResizeBox = (side) => (e) => {
    e.preventDefault(); e.stopPropagation();
    const startMouseX = e.clientX;
    // Auto-width text starts from its rendered width, so grabbing a width
    // handle doesn't jump to the old 190px default.
    const startW = data.boxWidth || editRef.current?.offsetWidth || 190;
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

  // BG layer (locked image or video, or a solid background color)
  if (data.locked) {
    const isVid = data.mediaType === 'video';
    const bgFill = !data.url && data.fill ? <div style={{position:'absolute',inset:0,background:data.fill}}/> : null;
    // Panorama span: when this background is one slice of an image fitted
    // across N canvases, render the image N canvases wide and shift it so
    // only this page's slice shows.
    const spanStyle = bgSpanTotal > 1
      ? { position:'absolute', top:0, left:`${-bgSpanIndex * 100}%`, right:'auto', width:`${bgSpanTotal * 100}%`, height:'100%', objectFit:'cover' }
      : undefined;
    return (
      <>
        {bgFill}
        {data.url && data.mediaType !== 'video' && <img src={data.url} className="canvas-img" style={spanStyle} alt="" draggable="false" onError={e=>{e.target.style.display='none';}}/>}
        {data.url && isVid && (
          <video ref={videoRef} src={data.url} className="canvas-img"
            autoPlay loop muted={muted} playsInline draggable={false}
            style={spanStyle ? {...spanStyle} : {objectFit:'cover'}}/>
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
      className={"element-wrap " + (isSelected ? "element-selected" : "") + (isEditing ? " element-editing" : "") + (data.type === 'shape' && data.shape === 'line' ? " el-linear" : "") + (ghost ? " el-ghost" : "")}
      data-elid={data.id}
      style={wrapperStyle}
      onPointerDown={isEditing ? undefined : handleDrag}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (data.type === 'text' && !isEditing && onStartEdit) onStartEdit();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => { if (onContextMenu) onContextMenu(e, data.id); }}
    >
      <div className="el-outline"/>
      {dropHover && data.type === 'image' && (
        <div style={{position:'absolute',inset:-2,borderRadius:4,border:'2px solid #0EA5E9',background:'rgba(14,165,233,0.15)',zIndex:30,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
          <span style={{fontSize:10,fontWeight:700,color:'#0EA5E9',fontFamily:"'JetBrains Mono',monospace",letterSpacing:0.5}}>Replace</span>
        </div>
      )}
      {data.type === 'shape' ? (
        <ShapeSVG shape={data.shape} fill={data.fill || '#FFFFFF'} stroke={data.stroke} strokeWidth={data.strokeWidth || 0} strokeCap={data.strokeCap} strokeAlign={data.strokeAlign} strokeStyle={data.strokeStyle} opacity={data.opacity} clipId={'sclip-' + data.id} />
      ) : data.type === 'text' ? (
        <div
          ref={editRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onInput={() => {
            // Commit on EVERY keystroke. Blur is not a reliable commit point:
            // clicking the empty canvas clears editingId first, the re-render
            // flips contentEditable off, and Chrome then drops focus WITHOUT
            // firing blur — so a blur-only commit silently loses the edit
            // (reproduced in dev-harness). Live commit is safe because the
            // JSX renders no child while editing, so this re-render can't
            // clobber the DOM text being typed.
            liveTextRef.current = editRef.current?.innerText ?? '';
            onUpdate({ content: liveTextRef.current });
          }}
          onBlur={() => {
            // Belt-and-braces: commit the ref (idempotent after onInput) and
            // exit edit mode on the paths where blur DOES fire.
            onUpdate({ content: liveTextRef.current });
            onStopEdit();
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
            // Auto-width until the user drags the width handles: the box hugs
            // the glyphs instead of a fixed 190px column. Fixed width wraps.
            whiteSpace: data.boxWidth ? 'pre-wrap' : 'pre',
            width: data.boxWidth || 'max-content',
            // Trim the line box to cap-height/baseline (Chromium/Safari) so
            // the bounding box adheres to the visible letterforms — the
            // flattened export draws with the same cap-top anchor.
            textBox: 'trim-both cap alphabetic',
            textTransform: data.uppercase ? 'uppercase' : undefined,
            textShadow: data.shadow ? '0 2px 12px rgba(0,0,0,0.8)' : undefined,
            WebkitTextStroke: data.outline ? `${data.outline}px ${data.outlineColor || "#000"}` : undefined,
            textRendering: 'optimizeLegibility',
            pointerEvents: isEditing ? 'auto' : 'none',
            outline: 'none',
            cursor: isEditing ? 'text' : 'move',
          }}
        >
          {isEditing
            ? null // DOM owns the text while editing (seeded in the focus effect)
            : !data.listStyle
              ? data.content
              : String(data.content || '').split('\n').map((ln, i) =>
                  (data.listStyle === 'number' ? `${i + 1}. ` : '\u2022 ') + ln).join('\n')}
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
          {data.type === 'shape' && data.shape === 'line' ? (
            <>
              {/* Lines: no bounding box — just the two endpoint nodes on the
                  path itself (Canva-style). Dragging extends the line. */}
              <div className="handle handle-pt-w" onPointerDown={handleStretchShape('w')}/>
              <div className="handle handle-pt-e" onPointerDown={handleStretchShape('e')}/>
            </>
          ) : (
            <>
              <div className="handle handle-nw" onPointerDown={handleResize('nw')}/>
              <div className="handle handle-ne" onPointerDown={handleResize('ne')}/>
              <div className="handle handle-sw" onPointerDown={handleResize('sw')}/>
              <div className="handle handle-se" onPointerDown={handleResize('se')}/>
              {data.type === 'text' && <>
                <div className="handle handle-e" onPointerDown={handleResizeBox('e')}/>
                <div className="handle handle-w" onPointerDown={handleResizeBox('w')}/>
              </>}
              {data.type === 'shape' && <>
                <div className="handle handle-n" onPointerDown={handleStretchShape('n')}/>
                <div className="handle handle-s" onPointerDown={handleStretchShape('s')}/>
                <div className="handle handle-e" onPointerDown={handleStretchShape('e')}/>
                <div className="handle handle-w" onPointerDown={handleStretchShape('w')}/>
              </>}
            </>
          )}
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

// Unit-space (100×100) star points, stretched by the viewBox — 5 outer
// points, standard 0.38 inner radius ratio.
export function starPoints() {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 19 : 50;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

// Vector shapes drawn as fills in unit space and stretched to the element's
// box (preserveAspectRatio none) — no strokes, so non-uniform resize never
// distorts line weights. "line" is simply a thin filled box.
export function ShapeSVG({ shape, fill, stroke, strokeWidth, strokeCap, strokeAlign, strokeStyle, opacity, clipId }) {
  const common = { width: "100%", height: "100%", viewBox: "0 0 100 100", preserveAspectRatio: "none", style: { display: "block", opacity: opacity ?? 1, pointerEvents: "none", overflow: "visible" } };
  const sw = strokeWidth > 0 ? strokeWidth : 0;
  const cap = (strokeCap === "round" || strokeStyle === "dot") ? "round" : "butt";
  const su = Math.max(strokeWidth || 1, 1);
  const dash = strokeStyle === "dash" ? `${su*3} ${su*2}` : strokeStyle === "minidash" ? `${su*1.5} ${su*1.5}` : strokeStyle === "dot" ? `0.01 ${su*2.2}` : undefined;
  const join = strokeCap === "round" ? "round" : "miter";
  const sc = stroke || "#FFFFFF";
  // A line IS a stroke: no fill, minimum 1px, drawn across the box middle.
  if (shape === "line") {
    return <svg {...common}><line x1="0" y1="50" x2="100" y2="50" stroke={sc} strokeWidth={Math.max(sw, 1)} strokeLinecap={cap} strokeDasharray={dash} vectorEffect="non-scaling-stroke" /></svg>;
  }
  const geom = (props) =>
    shape === "ellipse" ? <ellipse cx="50" cy="50" rx="50" ry="50" {...props} /> :
    shape === "polygon" ? <polygon points="50,0 100,100 0,100" {...props} /> :
    shape === "star" ? <polygon points={starPoints()} {...props} /> :
    shape === "arrow" ? <path d="M0,38 H74 V8 L100,50 L74,92 V62 H0 Z" {...props} /> :
    <rect width="100" height="100" {...props} />;
  const sp = { fill: "none", stroke: sc, strokeLinecap: cap, strokeLinejoin: join, strokeDasharray: dash, vectorEffect: "non-scaling-stroke" };
  const align = strokeAlign || "center";
  // No native SVG stroke-align: outside = 2x stroke painted UNDER the fill;
  // inside = 2x stroke clipped to the shape, over it; center = normal stroke.
  return (
    <svg {...common}>
      {sw > 0 && align === "outside" && geom({ ...sp, strokeWidth: sw * 2 })}
      {geom({ fill })}
      {sw > 0 && align === "center" && geom({ ...sp, strokeWidth: sw })}
      {sw > 0 && align === "inside" && (<>
        <clipPath id={clipId}>{geom({})}</clipPath>
        <g clipPath={"url(#" + clipId + ")"}>{geom({ ...sp, strokeWidth: sw * 2 })}</g>
      </>)}
    </svg>
  );
}
