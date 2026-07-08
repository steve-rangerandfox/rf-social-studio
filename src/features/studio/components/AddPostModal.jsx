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
  const [media, setMedia] = useState(null); // { previewUrl, publicUrl, uploading, isVideo, name, error }
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

  const handleFile = (file) => {
    if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/"))) return;
    try { checkFileSize(file); } catch (err) { setMedia({ error: err.message }); return; }
    const previewUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    setMedia({ previewUrl, publicUrl: null, uploading: true, isVideo, name: file.name });
    uploadAssetWithProgress(file, () => {})
      .then((url) => setMedia((m) => (m?.previewUrl === previewUrl ? { ...m, publicUrl: url, uploading: false } : m)))
      .catch((err) => setMedia((m) => (m?.previewUrl === previewUrl ? { ...m, uploading: false, error: err?.message || "Upload failed" } : m)));
  };

  const clearMedia = () => {
    if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl);
    setMedia(null);
  };

  // Character budget = the tightest limit among the selected channels.
  const capMax = useMemo(() => (
    channels.length && channels.every((k) => k === "linkedin") ? 3000 : 2200
  ), [channels]);

  const hasContent = !!caption.trim() || !!media?.previewUrl;
  const canCreate = caption.trim() && channels.length > 0 && dateValue && timeValue && !media?.uploading;
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
      mediaUrl: media?.publicUrl || null,
      thumbnailUrl: media?.publicUrl && !media.isVideo ? media.publicUrl : null,
      createAnother,
    });
    if (createAnother) { setCaption(""); clearMedia(); captionRef.current?.focus(); }
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
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer?.files?.[0]); }}>
              <textarea ref={captionRef} className="cpm-txa" value={caption}
                placeholder="Start writing your post…"
                onChange={(e) => setCaption(e.target.value)} />
              <div className="cpm-composer-foot">
                <input ref={fileRef} type="file" accept="image/*,video/*,image/gif" hidden
                  onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                {media?.previewUrl ? (
                  <div className={"cpm-media-thumb" + (media.uploading ? " uploading" : "")}>
                    {media.isVideo ? <video src={media.previewUrl} muted playsInline /> : <img src={media.previewUrl} alt="" />}
                    {media.uploading && <span className="cpm-media-state">Uploading…</span>}
                    <button type="button" className="cpm-media-rm" onClick={clearMedia} aria-label="Remove media"><X size={9} /></button>
                  </div>
                ) : (
                  <button type="button" className="cpm-dropcard" onClick={() => fileRef.current?.click()}>
                    <ImageIcon size={17} />
                    <span>Drag &amp; drop or <em>select a file</em></span>
                  </button>
                )}
                <span className={"cpm-count" + (caption.length > capMax ? " over" : "")}>{caption.length} / {capMax}</span>
              </div>
              {media?.error && <div className="cpm-media-error">{media.error}</div>}
            </div>
          </div>

          {/* ── Preview rail ── */}
          {showPreview && (
            <div className="cpm-right">
              <div className="cpm-right-title">Post Previews</div>
              {channels.length === 0 || !hasContent ? (
                <PreviewEmptyState />
              ) : (
                channels.map((k) => <NetworkPreview key={k} platform={k} caption={caption.trim()} media={media?.previewUrl ? media : null} />)
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
              title={canCreate ? undefined : media?.uploading ? "Media is still uploading" : "Write a caption and pick at least one channel"}>
              Create post →
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
