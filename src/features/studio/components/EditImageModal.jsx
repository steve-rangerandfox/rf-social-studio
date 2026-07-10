import React, { useEffect, useRef, useState } from "react";
import { Check, Close as X } from "../../../components/icons/index.jsx";
import { rotatedDims, cropRectPx, clampCrop } from "../image-edit.js";

// Buffer-style Edit Image modal: crop (1:1 / custom) + rotate + flip.
// The crop rect is normalized against the displayed (rotated/flipped)
// image; Apply renders the transformed image to a canvas, crops it and
// hands the JPEG blob back to the caller for re-upload.

const VIEW = 560; // max px of the preview area's long edge

export function EditImageModal({ src, onCancel, onApply }) {
  const [img, setImg] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspect, setAspect] = useState("1:1"); // "1:1" | "custom"
  const [crop, setCrop] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [busy, setBusy] = useState(false);
  const frameRef = useRef(null);
  const dragRef = useRef(null); // { mode: "move"|"nw"|"ne"|"sw"|"se", startX, startY, start: crop }

  useEffect(() => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => setImg(el);
    el.src = src;
  }, [src]);

  // Displayed size of the (rotated) image, fitted into the view box.
  const natural = img ? rotatedDims(img.naturalWidth, img.naturalHeight, rotation) : { w: 1, h: 1 };
  const fit = Math.min(VIEW / natural.w, VIEW / natural.h, 1);
  const dispW = Math.max(1, Math.round(natural.w * fit));
  const dispH = Math.max(1, Math.round(natural.h * fit));

  // Default crop: biggest centered square (like the reference).
  useEffect(() => {
    if (!img) return;
    const side = Math.min(natural.w, natural.h);
    setCrop(clampCrop({
      x: (natural.w - side) / 2 / natural.w,
      y: (natural.h - side) / 2 / natural.h,
      w: side / natural.w,
      h: side / natural.h,
    }));
    // Recenter whenever the geometry flips between portrait/landscape.
  }, [img, rotation]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSquare = () => {
    setAspect("1:1");
    const sideN = Math.min(crop.w * dispW, crop.h * dispH); // px
    setCrop((c) => clampCrop({ ...c, w: sideN / dispW, h: sideN / dispH }));
  };

  const startDrag = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: crop };
    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.startX) / dispW;
      const dy = (ev.clientY - d.startY) / dispH;
      const s = d.start;
      if (d.mode === "move") {
        setCrop(clampCrop({ ...s, x: s.x + dx, y: s.y + dy }));
        return;
      }
      // Corner resize; for 1:1 the box stays square in PIXELS.
      let { x, y, w, h } = s;
      if (d.mode.includes("e")) w = s.w + dx;
      if (d.mode.includes("s")) h = s.h + dy;
      if (d.mode.includes("w")) { x = s.x + dx; w = s.w - dx; }
      if (d.mode.includes("n")) { y = s.y + dy; h = s.h - dy; }
      if (aspect === "1:1") {
        const sidePx = Math.max(w * dispW, h * dispH);
        const nw = sidePx / dispW;
        const nh = sidePx / dispH;
        if (d.mode.includes("w")) x = s.x + s.w - nw;
        if (d.mode.includes("n")) y = s.y + s.h - nh;
        w = nw; h = nh;
      }
      setCrop(clampCrop({ x, y, w, h }));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const apply = async () => {
    if (!img || busy) return;
    setBusy(true);
    try {
      // 1. Render the rotated/flipped image at natural scale.
      const t = rotatedDims(img.naturalWidth, img.naturalHeight, rotation);
      const c1 = document.createElement("canvas");
      c1.width = t.w; c1.height = t.h;
      const ctx1 = c1.getContext("2d");
      ctx1.translate(t.w / 2, t.h / 2);
      ctx1.rotate((rotation * Math.PI) / 180);
      ctx1.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx1.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      // 2. Crop.
      const { sx, sy, sw, sh } = cropRectPx(crop, t.w, t.h);
      const out = document.createElement("canvas");
      out.width = sw; out.height = sh;
      out.getContext("2d").drawImage(c1, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise((res) => out.toBlob(res, "image/jpeg", 0.92));
      if (blob) await onApply(blob);
      else onCancel();
    } catch {
      // Tainted canvas or decode failure — bail without breaking the tile.
      onCancel();
    }
  };

  const box = {
    left: crop.x * dispW,
    top: crop.y * dispH,
    width: crop.w * dispW,
    height: crop.h * dispH,
  };

  return (
    <div className="overlay" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div className="modal eim" onClick={(e) => e.stopPropagation()}>
        <div className="eim-title">Edit Image</div>
        <div className="eim-stage">
          {img ? (
            <div className="eim-frame" ref={frameRef} style={{ width: dispW, height: dispH }}>
              <img src={src} alt="" draggable={false} crossOrigin="anonymous"
                style={{
                  width: rotation % 180 === 0 ? dispW : dispH,
                  height: rotation % 180 === 0 ? dispH : dispW,
                  transform: `translate(-50%,-50%) rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
                }} />
              <div className="eim-shade" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 ${box.top}px,${box.left}px ${box.top}px,${box.left}px ${box.top + box.height}px,${box.left + box.width}px ${box.top + box.height}px,${box.left + box.width}px ${box.top}px,0 ${box.top}px)` }} />
              <div className="eim-crop" style={box} onPointerDown={startDrag("move")}>
                <span className="eim-handle nw" onPointerDown={startDrag("nw")} />
                <span className="eim-handle ne" onPointerDown={startDrag("ne")} />
                <span className="eim-handle sw" onPointerDown={startDrag("sw")} />
                <span className="eim-handle se" onPointerDown={startDrag("se")} />
              </div>
            </div>
          ) : (
            <div className="eim-loading">Loading…</div>
          )}
        </div>
        <div className="eim-toolbar">
          <button type="button" className={"eim-chip" + (aspect === "1:1" ? " on" : "")} onClick={setSquare}>
            <span className="eim-chip-square" /> 1:1
          </button>
          <button type="button" className={"eim-chip" + (aspect === "custom" ? " on" : "")} onClick={() => setAspect("custom")}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"/></svg>
            Custom
          </button>
          <span className="eim-toolbar-sep" />
          <button type="button" className="eim-tool" title="Rotate 90°" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3"/></svg>
          </button>
          <button type="button" className="eim-tool" title="Flip horizontal" onClick={() => setFlipH((v) => !v)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 1.5v13M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4"/></svg>
          </button>
          <button type="button" className="eim-tool" title="Flip vertical" onClick={() => setFlipV((v) => !v)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1.5 8h13M4 5.5 8 2l4 3.5M4 10.5 8 14l4-3.5"/></svg>
          </button>
        </div>
        <div className="eim-foot">
          <button type="button" className="eim-tool" onClick={onCancel} aria-label="Cancel"><X size={16} /></button>
          <span className="eim-foot-mode">Crop</span>
          <button type="button" className="eim-apply" onClick={apply} disabled={!img || busy} aria-label="Apply">
            {busy ? <span className="eim-busy" /> : <Check size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
