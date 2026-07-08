import React from "react";
import { ImageIcon, MessageSquare, Repeat as Repeat2, Send, ThumbsUp } from "../../../components/icons/index.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { PLATFORMS } from "../shared.js";

// Live per-network post previews (Buffer-style rail). Shared by the Create
// Post window and the post editor. `media` is { previewUrl, isVideo } or null.

const VERTICAL = new Set(["ig_story", "ig_reel", "tiktok"]);

export function NetworkPreview({ platform, caption, media }) {
  const p = PLATFORMS[platform];
  const mediaEl = media ? (
    media.isVideo
      ? <video src={media.previewUrl} muted loop playsInline autoPlay />
      : <img src={media.previewUrl} alt="" />
  ) : null;

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
          {mediaEl && <div className="cpm-li-media">{mediaEl}</div>}
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
          {mediaEl || <div className="cpm-story-empty"><ImageIcon size={20} /></div>}
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
        <div className="cpm-ig-media">
          {mediaEl || <div className="cpm-story-empty"><ImageIcon size={20} /></div>}
        </div>
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
