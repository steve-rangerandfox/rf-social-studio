import React, { useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Heart, ImageIcon, MessageSquare, MoreHorizontal, Repeat as Repeat2, Send, ThumbsUp } from "../../../components/icons/index.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { PLATFORMS } from "../shared.js";
import { useStudio } from "../StudioContext.jsx";

// Avatar for the IG previews: the connected account's profile picture if we
// have it, else initials derived from the handle.
function Avatar({ url, handle, className }) {
  if (url) {
    return <span className={className}><img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }} /></span>;
  }
  const initials = (handle || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "IG";
  return <span className={className}>{initials}</span>;
}

// Product-accurate per-network previews (Buffer-style rail). Shared by the
// Create Post window and the post editor. `items` is [{ previewUrl, isVideo }]
// (a single-item array for one-media posts); `media` is the legacy single form.

// Carousel paging shared by the feed shapes: active item + arrows + dots.
function MediaFrame({ items, className, showCounter }) {
  const [idx, setIdx] = useState(0);
  if (!items.length) return <div className={className}><div className="cpm-story-empty"><ImageIcon size={20} /></div></div>;
  const cur = Math.min(idx, items.length - 1);
  const active = items[cur];
  const multi = items.length > 1;
  const go = (d, e) => { e.stopPropagation(); e.preventDefault(); setIdx((i) => (i + d + items.length) % items.length); };
  return (
    <div className={className + " cpm-frame"}>
      {active.isVideo
        ? <video src={active.previewUrl} muted loop playsInline autoPlay />
        : <img src={active.previewUrl} alt="" />}
      {multi && (
        <>
          {showCounter && <span className="cpm-frame-count">{cur + 1}/{items.length}</span>}
          <button type="button" className="cpm-frame-arw left" onClick={(e) => go(-1, e)} aria-label="Previous image"><ChevronLeft size={14} /></button>
          <button type="button" className="cpm-frame-arw right" onClick={(e) => go(1, e)} aria-label="Next image"><ChevronRight size={14} /></button>
          <div className="cpm-frame-dots">{items.map((_, i) => <span key={i} className={i === cur ? "on" : ""} />)}</div>
        </>
      )}
    </div>
  );
}

// Instagram feed post — header, media, action row, likes, caption.
function FeedPreview({ caption, items, handle, avatarUrl }) {
  return (
    <div className="igp">
      <div className="igp-head">
        <Avatar url={avatarUrl} handle={handle} className="igp-avatar" />
        <b className="igp-name">{handle}</b>
        <MoreHorizontal size={15} className="igp-more" />
      </div>
      <MediaFrame items={items} className="igp-media" showCounter />
      <div className="igp-actions">
        <Heart size={20} />
        <MessageSquare size={19} />
        <Send size={19} />
        <Bookmark size={19} className="igp-save" />
      </div>
      <div className="igp-likes">128 likes</div>
      {caption && <div className="igp-caption"><b>{handle}</b> {caption}</div>}
      <div className="igp-time">2 hours ago</div>
    </div>
  );
}

// Instagram story — tall frame, segment progress, playable video, message bar.
function StoryPreview({ items, handle, avatarUrl }) {
  const [idx, setIdx] = useState(0);
  const cur = Math.min(idx, Math.max(items.length - 1, 0));
  const active = items[cur];
  const multi = items.length > 1;
  const go = (d, e) => { e.stopPropagation(); e.preventDefault(); setIdx((i) => (i + d + items.length) % items.length); };
  return (
    <div className="igs">
      <div className="igs-top">
        <div className="igs-progress">{(multi ? items : [1]).map((_, i) => <span key={i} className={i <= cur ? "on" : ""} />)}</div>
        <div className="igs-head">
          <Avatar url={avatarUrl} handle={handle} className="igp-avatar sm" />
          <span className="igs-name">{handle}</span>
          <span className="igs-time">21h</span>
          <svg className="igs-mute" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2.5 6v4h2.5L9 13V3L5 6H2.5Z" fill="currentColor" stroke="none"/><path d="M11.5 6.5l3 3M14.5 6.5l-3 3"/></svg>
        </div>
      </div>
      <div className="igs-media">
        {active
          ? (active.isVideo
            ? <video src={active.previewUrl} controls playsInline preload="metadata" />
            : <img src={active.previewUrl} alt="" />)
          : <div className="cpm-story-empty"><ImageIcon size={20} /></div>}
      </div>
      {multi && (
        <>
          <button type="button" className="cpm-frame-arw left" onClick={(e) => go(-1, e)} aria-label="Previous frame"><ChevronLeft size={14} /></button>
          <button type="button" className="cpm-frame-arw right" onClick={(e) => go(1, e)} aria-label="Next frame"><ChevronRight size={14} /></button>
        </>
      )}
      <div className="igs-foot">
        <span className="igs-msg">Send message</span>
        <Heart size={20} />
        <Send size={19} />
      </div>
    </div>
  );
}

// Reel / TikTok — vertical frame with the right-side action rail.
function ReelPreview({ caption, items, handle, avatarUrl }) {
  const active = items[0];
  return (
    <div className="igr">
      <div className="igr-media">
        {active
          ? (active.isVideo
            ? <video src={active.previewUrl} muted loop playsInline autoPlay controls />
            : <img src={active.previewUrl} alt="" />)
          : <div className="cpm-story-empty"><ImageIcon size={20} /></div>}
      </div>
      <div className="igr-rail">
        <Heart size={20} />
        <MessageSquare size={19} />
        <Repeat2 size={19} />
        <Send size={19} />
        <MoreHorizontal size={17} />
        <span className="igr-album">{active && !active.isVideo ? <img src={active.previewUrl} alt="" /> : <span className="igr-album-fill" />}</span>
      </div>
      <div className="igr-foot">
        <Avatar url={avatarUrl} handle={handle} className="igp-avatar sm" />
        <span className="igs-name">{handle}</span>
      </div>
      {caption && <div className="igr-caption">{caption}</div>}
    </div>
  );
}

export function NetworkPreview({ platform, caption, media, items }) {
  const p = PLATFORMS[platform];
  const list = Array.isArray(items) && items.length ? items : media ? [media] : [];
  const hasMedia = list.length > 0;
  // IG previews show the CONNECTED account, not a hardcoded handle.
  const { igConfig } = useStudio();
  const igHandle = igConfig?.username || "your_handle";
  const igAvatar = igConfig?.profilePictureUrl || null;

  let body;
  if (platform === "linkedin" || platform === "facebook") {
    body = (
      <div className="li-card cpm-li">
        <div className="li-header">
          <div className="li-avatar">RF</div>
          <div className="li-header-info">
            <div className="li-name">Ranger &amp; Fox</div>
            <div className="li-meta">1h · 🌐</div>
          </div>
        </div>
        {caption && <div className="li-caption">{caption.split("\n").map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</div>}
        {hasMedia && <MediaFrame items={list} className="cpm-li-media" showCounter />}
        <div className="li-actions">
          <button className="li-action-btn" type="button"><ThumbsUp size={13} /> Like</button>
          <button className="li-action-btn" type="button"><MessageSquare size={13} /> Comment</button>
          <button className="li-action-btn" type="button"><Repeat2 size={13} /> Repost</button>
          <button className="li-action-btn" type="button"><Send size={13} /> Send</button>
        </div>
      </div>
    );
  } else if (platform === "ig_story") {
    body = <StoryPreview items={list} handle={igHandle} avatarUrl={igAvatar} />;
  } else if (platform === "ig_reel") {
    body = <ReelPreview caption={caption} items={list} handle={igHandle} avatarUrl={igAvatar} />;
  } else if (platform === "tiktok") {
    body = <ReelPreview caption={caption} items={list} handle="your_handle" avatarUrl={null} />;
  } else {
    body = <FeedPreview caption={caption} items={list} handle={igHandle} avatarUrl={igAvatar} />;
  }

  return (
    <div className="cpm-net">
      <div className="cpm-net-label"><PlatformIcon platform={platform} size={13} /> {p.label}</div>
      {body}
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
