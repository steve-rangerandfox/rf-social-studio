import React, { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, MessageSquare, Repeat as Repeat2, Send, ThumbsUp } from "../../../components/icons/index.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { PLATFORMS } from "../shared.js";

// Live per-network post previews (Buffer-style rail). Shared by the Create
// Post window and the post editor. `items` is [{ previewUrl, isVideo }] (a
// single-item array for one-media posts); `media` is the legacy single form.

const VERTICAL = new Set(["ig_story", "ig_reel", "tiktok"]);

// Active carousel item + prev/next arrows, shared by every network shape.
function MediaFrame({ items, className }) {
  const [idx, setIdx] = useState(0);
  if (!items.length) return <div className={className}><div className="cpm-story-empty"><ImageIcon size={20} /></div></div>;
  const active = items[Math.min(idx, items.length - 1)];
  const multi = items.length > 1;
  const go = (d, e) => { e.stopPropagation(); e.preventDefault(); setIdx((i) => (i + d + items.length) % items.length); };
  return (
    <div className={className + " cpm-frame"}>
      {active.isVideo
        ? <video src={active.previewUrl} muted loop playsInline autoPlay />
        : <img src={active.previewUrl} alt="" />}
      {multi && (
        <>
          <button type="button" className="cpm-frame-arw left" onClick={(e) => go(-1, e)} aria-label="Previous image"><ChevronLeft size={14} /></button>
          <button type="button" className="cpm-frame-arw right" onClick={(e) => go(1, e)} aria-label="Next image"><ChevronRight size={14} /></button>
          <div className="cpm-frame-dots">{items.map((_, i) => <span key={i} className={i === Math.min(idx, items.length - 1) ? "on" : ""} />)}</div>
        </>
      )}
    </div>
  );
}

export function NetworkPreview({ platform, caption, media, items }) {
  const p = PLATFORMS[platform];
  const list = Array.isArray(items) && items.length ? items : media ? [media] : [];
  const hasMedia = list.length > 0;

  if (platform === "linkedin" || platform === "facebook") {
    return (
      <div className="cpm-net">
        <div className="cpm-net-label"><PlatformIcon platform={platform} size={13} /> {p.label}</div>
        <div className="li-card cpm-li">
          <div className="li-header">
            <div className="li-avatar">RF</div>
            <div className="li-header-info">
              <div className="li-name">Ranger &amp; Fox</div>
              <div className="li-meta">1h · 🌐</div>
            </div>
          </div>
          {caption && <div className="li-caption">{caption.split("\n").map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</div>}
          {hasMedia && <MediaFrame items={list} className="cpm-li-media" />}
          <div className="li-actions">
            <button className="li-action-btn" type="button"><ThumbsUp size={13} /> Like</button>
            <button className="li-action-btn" type="button"><MessageSquare size={13} /> Comment</button>
            <button className="li-action-btn" type="button"><Repeat2 size={13} /> Repost</button>
            <button className="li-action-btn" type="button"><Send size={13} /> Send</button>
          </div>
        </div>
      </div>
    );
  }

  if (VERTICAL.has(platform)) {
    return (
      <div className="cpm-net">
        <div className="cpm-net-label"><PlatformIcon platform={platform} size={13} /> {p.label}</div>
        <div className="cpm-story">
          <MediaFrame items={list} className="cpm-story-media" />
          {caption && <div className="cpm-story-caption">{caption}</div>}
        </div>
      </div>
    );
  }

  // Instagram feed / anything square
  return (
    <div className="cpm-net">
      <div className="cpm-net-label"><PlatformIcon platform={platform} size={13} /> {p.label}</div>
      <div className="cpm-ig">
        <div className="cpm-ig-head">
          <span className="cpm-ig-avatar">RF</span>
          <span className="cpm-ig-name">rangerandfox</span>
        </div>
        <MediaFrame items={list} className="cpm-ig-media" />
        {caption && <div className="cpm-ig-caption"><b>rangerandfox</b> {caption}</div>}
      </div>
    </div>
  );
}

export function PreviewEmptyState() {
  return (
    <div className="cpm-preview-empty">
      <div className="cpm-skel">
        <span className="cpm-skel-dot" />
        <span className="cpm-skel-line" />
        <span className="cpm-skel-line short" />
        <span className="cpm-skel-block" />
      </div>
      <div className="cpm-preview-empty-text">See your post&rsquo;s preview here</div>
    </div>
  );
}
