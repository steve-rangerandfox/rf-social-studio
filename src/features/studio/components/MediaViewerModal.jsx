import React, { useEffect, useState } from "react";
import { AIMark, Close as X } from "../../../components/icons/index.jsx";
import { generateAltText } from "../../../lib/api-client.js";

// Buffer-style media viewer: the image at full size on the left, an
// "Add a description" (alt text) panel on the right with an AI generate
// button. Videos get the viewer without the description panel tools.

const ALT_MAX = 4000;

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

export function MediaViewerModal({ item, initialAlt = "", onSave, onClose }) {
  const [alt, setAlt] = useState(initialAlt);
  const [dims, setDims] = useState(null); // { w, h }
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const isVideo = !!item.isVideo;

  useEffect(() => { setAlt(initialAlt); }, [initialAlt, item.url]);

  const onMediaLoad = (w, h) => {
    if (w && h) setDims({ w, h });
  };

  const ratio = dims ? (() => { const g = gcd(dims.w, dims.h); return `${dims.w / g}:${dims.h / g}`; })() : null;

  const generate = async () => {
    if (generating || isVideo) return;
    setGenerating(true);
    setGenError("");
    try {
      const data = await generateAltText({ imageUrl: item.url });
      if (data?.alt) setAlt(data.alt.slice(0, ALT_MAX));
    } catch (err) {
      setGenError(err?.message || "Couldn't reach AI.");
    }
    setGenerating(false);
  };

  return (
    <div className="overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="modal mvm" onClick={(e) => e.stopPropagation()}>
        <div className="mvm-media">
          {isVideo
            ? <video src={item.url} controls autoPlay onLoadedMetadata={(e) => onMediaLoad(e.currentTarget.videoWidth, e.currentTarget.videoHeight)} />
            : <img src={item.url} alt={alt || ""} onLoad={(e) => onMediaLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} />}
          {dims && (
            <span className="mvm-dims">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="m4.5 10 2.5-3 2 2.4L10.5 8 13 11"/></svg>
              {dims.w}×{dims.h}px{ratio ? `, ${ratio}` : ""}
            </span>
          )}
        </div>
        <div className="mvm-side">
          <button type="button" className="m-x mvm-x" onClick={onClose} aria-label="Close"><X size={15} /></button>
          <div className="mvm-title">Add a description</div>
          <p className="mvm-copy">Alt text helps people with visual impairments understand the image. The text will also appear in place of the image if it fails to load.</p>
          <div className="mvm-field">
            <textarea value={alt} maxLength={ALT_MAX} disabled={isVideo}
              placeholder={isVideo ? "Descriptions apply to images" : "Add a description for people with visual impairments"}
              onChange={(e) => setAlt(e.target.value)} />
            <span className="mvm-count">{ALT_MAX - alt.length}</span>
          </div>
          {!isVideo && (
            <button type="button" className="mvm-generate" onClick={generate} disabled={generating}>
              <AIMark size={14} /> {generating ? "Generating…" : "Generate with AI"}
            </button>
          )}
          {genError && <div className="mvm-error">{genError}</div>}
          <div className="mvm-spacer" />
          <button type="button" className="mvm-save" onClick={() => { onSave?.(alt.trim()); onClose(); }} disabled={isVideo}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
