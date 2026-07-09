import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Close as X, ImageIcon, Plus } from "../../../components/icons/index.jsx";
import { NetworkPreview, PreviewEmptyState } from "./PostPreviews.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { PLATFORMS, nowPT } from "../shared.js";
import { uploadAssetWithProgress, checkFileSize } from "../../../lib/supabase.js";

// Buffer-style Create Post window: channels across the top, a big composer
// with a drag-and-drop media card on the left, and a live per-network
// preview rail on the right. Creating drops you straight into the post
// editor (unless "Create another" is checked).

export function AddPostModal({ initialDate, onClose, onCreate }) {
  const captionRef = useRef(null);
  const fileRef = useRef(null);
  const pickerRef = useRef(null);
  const safeDate = initialDate || nowPT();

  const [caption, setCaption] = useState("");
  const [channels, setChannels] = useState(["ig_post"]); // ordered — first is the main channel
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [createAnother, setCreateAnother] = useState(false);
  // Media gallery: { id, url(blob), publicUrl, uploading, progress, isVideo, error }
  const [items, setItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [dateValue, setDateValue] = useState(() => {
    const y = safeDate.getFullYear();
    const m = String(safeDate.getMonth() + 1).padStart(2, "0");
    const d = String(safeDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [timeValue, setTimeValue] = useState("09:00");

  useEffect(() => { captionRef.current?.focus(); }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const h = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [pickerOpen]);

  const toggleChannel = (key) => {
    setChannels((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  // Feed channels take multiple images; a video is a single-video post.
  const allowsMulti = channels.length > 0 && channels.every((k) => k !== "ig_story" && k !== "ig_reel");

  // Upload one or many at once. Each tile shows instantly with its own
  // progress ring, then fills in its hosted URL — Buffer-style.
  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!files.length) return;
    const videoFile = files.find((f) => f.type.startsWith("video/"));
    const multi = allowsMulti && !videoFile;
    const chosen = multi ? files.filter((f) => f.type.startsWith("image/")) : [videoFile || files[0]];
    for (const file of chosen) {
      let err0 = null;
      try { checkFileSize(file); } catch (err) { err0 = err.message; }
      const isVideo = file.type.startsWith("video/");
      const blobUrl = URL.createObjectURL(file);
      const id = "m" + Math.random().toString(36).slice(2, 8);
      // A video / single-media post replaces the set; images append.
      setItems((prev) => (multi ? [...prev, { id, url: blobUrl, publicUrl: null, uploading: !err0, progress: 0, isVideo, error: err0 }]
        : [{ id, url: blobUrl, publicUrl: null, uploading: !err0, progress: 0, isVideo, error: err0 }]));
      if (err0) continue;
      uploadAssetWithProgress(file, (pr) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, progress: pr } : it))))
        .then((url) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, publicUrl: url, uploading: false } : it))))
        .catch((e) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, uploading: false, error: e?.message || "Upload failed" } : it))));
    }
  };

  const removeItem = (id) => setItems((prev) => {
    const it = prev.find((x) => x.id === id);
    if (it?.url?.startsWith("blob:")) URL.revokeObjectURL(it.url);
    return prev.filter((x) => x.id !== id);
  });
  const clearMedia = () => { items.forEach((it) => it.url?.startsWith("blob:") && URL.revokeObjectURL(it.url)); setItems([]); };

  // Derive the row's media fields from the hosted gallery.
  const mediaFields = () => {
    const hosted = items.filter((i) => i.publicUrl);
    const list = hosted.map((i) => ({ url: i.publicUrl, kind: i.isVideo ? "video" : "image" }));
    const isCarousel = list.length >= 2;
    const hasVideo = list.some((i) => i.kind === "video");
    return {
      mediaUrl: list[0]?.url || null,
      mediaItems: list.length ? list : null,
      mediaKind: isCarousel ? "carousel" : hasVideo ? "video" : list.length ? "image" : null,
      carouselFrameUrls: isCarousel && !hasVideo ? list.map((i) => i.url) : null,
      thumbnailUrl: list.find((i) => i.kind !== "video")?.url || null,
    };
  };
  const uploading = items.some((i) => i.uploading);

  // Character budget = the tightest limit among the selected channels.
  const capMax = useMemo(() => (
    channels.length && channels.every((k) => k === "linkedin") ? 3000 : 2200
  ), [channels]);

  const hasContent = !!caption.trim() || items.length > 0;
  const canCreate = caption.trim() && channels.length > 0 && dateValue && timeValue && !uploading;
  const whenLabel = useMemo(() => {
    if (!dateValue || !timeValue) return "Pick a time";
    const d = new Date(`${dateValue}T${timeValue}:00`);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }, [dateValue, timeValue]);

  const submit = (event) => {
    event.preventDefault();
    if (!canCreate) return;
    const firstLine = caption.trim().split("\n")[0].slice(0, 64);
    onCreate({
      title: firstLine,
      caption: caption.trim(),
      dateValue,
      timeValue,
      platform: channels[0],
      platforms: channels,
      ...mediaFields(),
      createAnother,
    });
    if (createAnother) { setCaption(""); clearMedia(); captionRef.current?.focus(); }
  };

  // "Design it" path: create the post with whatever's filled in (no caption
  // required yet) and land directly in the story/canvas designer or the
  // carousel builder for its media.
  const createAndOpen = (tool) => {
    if (channels.length === 0 || uploading) return;
    const trimmed = caption.trim();
    onCreate({
      title: trimmed.split("\n")[0].slice(0, 64) || "Untitled post",
      caption: trimmed,
      dateValue,
      timeValue,
      platform: channels[0],
      platforms: channels,
      ...mediaFields(),
      ...(tool === "carousel" ? { openCarousel: true } : { openDesigner: true }),
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal cpm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        {/* ── Header ── */}
        <div className="cpm-head">
          <div className="cpm-title">Create Post</div>
          <div className="cpm-head-actions">
            <button type="button" className={"cpm-preview-toggle" + (showPreview ? " on" : "")}
              onClick={() => setShowPreview((v) => !v)} aria-pressed={showPreview}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>
              Preview
            </button>
            <button type="button" className="m-x" onClick={onClose} aria-label="Close"><X size={15} /></button>
          </div>
        </div>

        <div className="cpm-body">
          {/* ── Composer ── */}
          <div className="cpm-left">
            <div className="cpm-channels">
              <div className="dp-outlet-anchor" ref={pickerRef}>
                <button type="button" className="cpm-channels-btn" onClick={() => setPickerOpen((o) => !o)}
                  aria-haspopup="listbox" aria-expanded={pickerOpen}>
                  <Plus size={13} /> Channels
                </button>
                {pickerOpen && (
                  <div className="dp-platform-popover" role="listbox">
                    {Object.entries(PLATFORMS).map(([key, pl]) => (
                      <button key={key} type="button" role="option" aria-selected={channels.includes(key)}
                        className={"dp-platform-option" + (channels.includes(key) ? " active" : "")}
                        onClick={() => toggleChannel(key)}>
                        <PlatformIcon platform={key} size={16} />
                        <span>{pl.short}</span>
                        {channels.includes(key) && <Check size={12} className="dp-platform-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {channels.map((k) => (
                <button key={k} type="button" className="dp-outlet-ic"
                  onClick={() => toggleChannel(k)}
                  title={`${PLATFORMS[k].label}${k === channels[0] ? " — main channel" : ""} · click to remove`}>
                  <PlatformIcon platform={k} size={16} />
                  <span className="dp-outlet-ic-x" aria-hidden="true"><X size={8} /></span>
                </button>
              ))}
            </div>

            <div className={"cpm-composer" + (dragOver ? " drag" : "")}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer?.files); }}>
              {dragOver && (
                <div className="cpm-dropveil"><ImageIcon size={22} /><span>Drop files to upload</span></div>
              )}
              <textarea ref={captionRef} className="cpm-txa" value={caption}
                placeholder="Start writing your post…"
                onChange={(e) => setCaption(e.target.value)} />
              <input ref={fileRef} type="file" multiple={allowsMulti} accept="image/*,video/*,image/gif" hidden
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
              {/* Inline media tiles + always-present add tile (Buffer pattern) */}
              <div className="cpm-tiles">
                {items.map((it) => (
                  <div key={it.id} className={"cpm-tile" + (it.error ? " err" : "")}>
                    {it.isVideo ? <video src={it.url} muted playsInline /> : <img src={it.url} alt="" />}
                    {it.uploading && (
                      <span className="cpm-tile-ring" style={{ "--p": Math.round(it.progress * 100) }}>
                        <span className="cpm-tile-ring-n">{Math.round(it.progress * 100)}%</span>
                      </span>
                    )}
                    {it.error && <span className="cpm-tile-err" title={it.error}>!</span>}
                    <button type="button" className="cpm-media-rm" onClick={() => removeItem(it.id)} aria-label="Remove"><X size={9} /></button>
                  </div>
                ))}
                {(allowsMulti || items.length === 0) && (
                  <button type="button" className="cpm-tile cpm-tile-add" onClick={() => fileRef.current?.click()}>
                    <ImageIcon size={17} />
                    <span>Drag &amp; drop or <em>select a file</em></span>
                  </button>
                )}
              </div>
              <div className="cpm-composer-foot">
                <span className="cpm-tiles-hint">{items.length > 1 ? `${items.length} images · drag to reorder in the editor` : ""}</span>
                <span className={"cpm-count" + (caption.length > capMax ? " over" : "")}>{caption.length} / {capMax}</span>
              </div>
            </div>

            {/* Design the media instead of uploading it */}
            <div className="cpm-design-row">
              <span className="cpm-design-label">Or design it:</span>
              <button type="button" className="dp2-design-btn" onClick={() => createAndOpen("designer")}
                title="Create the post and open the canvas designer (sizes follow your channels)">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M11.3 2.2 13.8 4.7 5.5 13H3v-2.5L11.3 2.2Z"/><path d="M9.8 3.7l2.5 2.5"/></svg>
                Design in canvas
              </button>
              {channels.some((c) => c === "ig_post" || c === "linkedin") && (
                <button type="button" className="dp2-design-btn" onClick={() => createAndOpen("carousel")}
                  title="Create the post and open the carousel builder">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="3.5" width="8" height="9" rx="1"/><path d="M11.5 4.5h1a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1"/></svg>
                  Carousel
                </button>
              )}
            </div>
          </div>

          {/* ── Preview rail ── */}
          {showPreview && (
            <div className="cpm-right">
              <div className="cpm-right-title">Post Previews</div>
              {channels.length === 0 || !hasContent ? (
                <PreviewEmptyState />
              ) : (
                channels.map((k) => <NetworkPreview key={k} platform={k} caption={caption.trim()} items={items.map((it) => ({ previewUrl: it.url, isVideo: it.isVideo }))} />)
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="cpm-foot">
          <label className="cpm-another">
            <input type="checkbox" checked={createAnother} onChange={(e) => setCreateAnother(e.target.checked)} />
            Create another
          </label>
          <div className="cpm-foot-right">
            <div className="cpm-when" title="Scheduled for (PT)">
              <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} aria-label="Date" />
              <input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} aria-label="Time (PT)" />
              <span className="cpm-when-label">{whenLabel}</span>
            </div>
            <button type="submit" className="btn btn-primary" disabled={!canCreate}
              title={canCreate ? undefined : uploading ? "Media is still uploading" : "Write a caption and pick at least one channel"}>
              Create post →
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
