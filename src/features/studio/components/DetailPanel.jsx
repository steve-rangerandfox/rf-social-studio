import React, { useState, useRef, useEffect } from "react";
import {
  T,
  PLATFORMS,
  STATUSES,
  uid,
  makeDefaultElements,
  getReadinessChecks,
  formatRelativeStamp,
} from "../shared.js";
import { TOAST } from "../copy.js";
import { useStudio } from "../StudioContext.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { StoryThumbnail } from "./StoryThumbnail.jsx";
import { AICaptionAssist } from "./AICaptionAssist.jsx";
import { canTransition, STATUS_ORDER } from "./StatusMachine.js";
import { uploadAssetWithProgress, checkFileSize } from "../../../lib/supabase.js";
import { AlertTriangle, CalendarIcon as Calendar, Check, CheckCircle as CheckCircle2, Close as X, ImageIcon, Plus, Share as Share2 } from "../../../components/icons/index.jsx";
import { CrossPostModal } from "./CrossPostModal.jsx";
import { NetworkPreview, PreviewEmptyState } from "./PostPreviews.jsx";
import { MediaGallery } from "./MediaGallery.jsx";

// Buffer-style post editor window: channels + composer on the left, live
// per-network previews on the right, publish controls in the footer.

export function DetailPanel() {
  const {
    selectedRowId, setSelectedRowId,
    rows, update, remove, showToast,
    setComposer, setStory, setCarousel, setPublishConfirm,
    connections, currentUser, team,
    addComment,
    approveAndSchedule,
  } = useStudio();

  const row = rows.find((r) => r.id === selectedRowId);

  const [commentText, setCommentText] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [pending, setPending] = useState([]); // in-flight uploads: { id, url, isVideo }
  const [activeIdx, setActiveIdx] = useState(0);
  const [mediaWarnings, setMediaWarnings] = useState([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const [outletPickerOpen, setOutletPickerOpen] = useState(false);
  const [isCrossPostOpen, setIsCrossPostOpen] = useState(false);

  const titleInputRef = useRef(null);
  const mediaRef = useRef(null);
  const thumbRef = useRef(null);
  const approvalRef = useRef(null);
  const assigneeRef = useRef(null);
  const platformDropdownRef = useRef(null);
  const outletPickerRef = useRef(null);
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  const hasConnectedAccount = connections.instagram || connections.linkedin;

  const handleClose = () => setSelectedRowId(null);

  // Reset local state when row changes
  useEffect(() => {
    setCommentText("");
    setIsEditingTitle(false);
    setIsApprovalOpen(false);
    setIsAssigneeOpen(false);
    setPending([]);
    setActiveIdx(0);
    setMediaWarnings([]);
    setPlatformDropdownOpen(false);
    setOutletPickerOpen(false);
  }, [selectedRowId]);

  // Restore originating focus on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    return () => {
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Escape key to close
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSelectedRowId]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!isApprovalOpen) return;
    const handler = (e) => { if (approvalRef.current && !approvalRef.current.contains(e.target)) setIsApprovalOpen(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [isApprovalOpen]);

  useEffect(() => {
    if (!isAssigneeOpen) return;
    const handler = (e) => { if (assigneeRef.current && !assigneeRef.current.contains(e.target)) setIsAssigneeOpen(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [isAssigneeOpen]);

  useEffect(() => {
    if (!platformDropdownOpen) return;
    const handler = (e) => { if (platformDropdownRef.current && !platformDropdownRef.current.contains(e.target)) setPlatformDropdownOpen(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [platformDropdownOpen]);

  useEffect(() => {
    if (!outletPickerOpen) return;
    const handler = (e) => { if (outletPickerRef.current && !outletPickerRef.current.contains(e.target)) setOutletPickerOpen(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [outletPickerOpen]);

  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  if (!row) return null;

  const onChange = (patch) => update(row.id, patch);
  const p = PLATFORMS[row.platform];
  const s = STATUSES[row.status];
  const assignee = row.assignee ? team.find((t) => t.id === row.assignee) : null;
  const storyElements = row.storyElements || makeDefaultElements(row.note);
  const isStory = row.platform === "ig_story";
  const isReel = row.platform === "ig_reel";
  const max = row.platform === "linkedin" ? 3000 : 2200;
  const capLen = (row.caption || "").length;
  const over = capLen > max;

  const outlets = Array.isArray(row.platforms) && row.platforms.length ? row.platforms : [row.platform];
  const extras = outlets.filter((k) => k !== row.platform && PLATFORMS[k]);
  const addable = Object.keys(PLATFORMS).filter((k) => !outlets.includes(k));

  // Feed platforms take multiple images (native carousel / multi-image);
  // stories + reels are single-frame / single-video.
  const allowsMulti = !isStory && !isReel;

  const urlIsVideo = (u, kind) => kind === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(u || "");
  // Canonical gallery for this row: mediaItems if present, else a single
  // item synthesized from the legacy mediaUrl.
  const rowItems = Array.isArray(row.mediaItems) && row.mediaItems.length
    ? row.mediaItems.map((it) => ({ url: it.url, isVideo: urlIsVideo(it.url, it.kind) }))
    : row.mediaUrl
      ? [{ url: row.mediaUrl, isVideo: urlIsVideo(row.mediaUrl, row.mediaKind) }]
      : [];
  // Hosted items + in-flight uploads, in one list for the gallery.
  const galleryItems = [
    ...rowItems.map((it, i) => ({ id: `row-${i}-${it.url}`, url: it.url, isVideo: it.isVideo, uploading: false })),
    ...pending.map((p) => ({ id: p.id, url: p.url, isVideo: p.isVideo, uploading: true })),
  ];
  const primary = galleryItems[0] || null;
  const displayMedia = primary ? { previewUrl: primary.url, isVideo: primary.isVideo } : (isStory && row.thumbnailUrl ? { previewUrl: row.thumbnailUrl, isVideo: false } : null);
  const galleryVideo = galleryItems.some((it) => it.isVideo);

  const hasMedia = galleryItems.length > 0 || (Array.isArray(row.carouselSlides) && row.carouselSlides.length > 0) || !!row.storyFrames;
  const checks = getReadinessChecks(row, hasMedia);
  const captionReady = !!checks.find((c) => c.label === "Caption")?.pass;
  const mediaReady = !!checks.find((c) => c.label === "Media")?.pass;
  const mediaRequired = row.platform !== "linkedin";
  const canPublish = captionReady && mediaReady && !mediaUploading;
  const missingRequired = [!captionReady && "a caption", !mediaReady && "media"].filter(Boolean);
  const updatedLabel = formatRelativeStamp(row.updatedAt);

  const validateMedia = (file) => {
    const warnings = [];
    const sizeMB = file.size / (1024 * 1024);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (isImage && sizeMB > 8) warnings.push(`Image is ${sizeMB.toFixed(1)}MB -- recommended under 8MB`);
    if (isVideo && sizeMB > 100) warnings.push(`Video is ${sizeMB.toFixed(0)}MB -- recommended under 100MB`);
    const ext = file.name.split(".").pop().toLowerCase();
    if (["bmp", "tiff", "tif", "webp"].includes(ext)) warnings.push(`${ext.toUpperCase()} may not be supported -- consider JPG or PNG`);
    return warnings;
  };

  // Grab a poster frame from a local video blob and upload it, so a video
  // post has a thumbnail for the queue / grid / publish previews. Best-effort.
  const captureVideoPoster = (blobUrl) => new Promise((resolve) => {
    try {
      const vid = document.createElement("video");
      vid.muted = true;
      vid.crossOrigin = "anonymous";
      vid.src = blobUrl;
      vid.onloadeddata = () => { try { vid.currentTime = Math.min(0.1, (vid.duration || 1) / 2); } catch { resolve(null); } };
      vid.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = vid.videoWidth || 1080;
          canvas.height = vid.videoHeight || 1080;
          canvas.getContext("2d").drawImage(vid, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
        } catch { resolve(null); }
      };
      vid.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 4000);
    } catch { resolve(null); }
  });

  // Persist the whole hosted gallery + every field the previews and the
  // scheduler read from it. IG posts with ≥2 images publish as a native
  // carousel via carouselFrameUrls (no render needed — they're real images).
  const commitItems = (list) => {
    const hasVideo = list.some((it) => it.kind === "video");
    const isCarousel = list.length >= 2;
    const firstImage = list.find((it) => it.kind !== "video");
    onChange({
      mediaItems: list.length ? list : null,
      mediaUrl: list[0]?.url || null,
      mediaKind: isCarousel ? "carousel" : hasVideo ? "video" : list.length ? "image" : null,
      // carouselFrameUrls is designer-rendered output only; the scheduler
      // falls back to mediaItems for a raw multi-image post.
      // Thumbnail: keep a custom one; else first image; else leave for the
      // video poster capture below.
      ...(row.thumbnailUrl && list.some((it) => it.url === row.thumbnailUrl) ? {}
        : firstImage ? { thumbnailUrl: firstImage.url } : {}),
    });
  };

  // Upload one or many files at once; images build a gallery, a lone video
  // is a single video post. Each shows instantly (blob) then swaps to its
  // hosted URL. Uploads run in parallel and accumulate onto ONE local list
  // (the row closure is stale mid-batch, so reading row.mediaItems per file
  // would make each upload clobber the previous — the multi-drop bug).
  const handleFiles = async (fileList) => {
    const all = Array.from(fileList || []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!all.length) return;
    if (isReel && !all[0].type.startsWith("video/")) { setMediaWarnings(["Reels need a video file"]); return; }
    setMediaWarnings([]); // fresh batch — don't pile old warnings
    const videoFile = all.find((f) => f.type.startsWith("video/"));
    const multi = allowsMulti && !videoFile;
    const chosen = multi ? all.filter((f) => f.type.startsWith("image/")) : [videoFile || all[0]];

    // Validate up front; collect unique warnings; drop hard-rejected files.
    const warnings = new Set();
    const accepted = [];
    for (const file of chosen) {
      try { checkFileSize(file); } catch (err) { warnings.add(err.message); continue; }
      validateMedia(file).forEach((w) => warnings.add(w));
      accepted.push(file);
    }
    if (warnings.size) setMediaWarnings([...warnings]);
    if (!accepted.length) return;

    // Seed the accumulator from what's already committed (multi appends;
    // a video/single replaces).
    const existing = Array.isArray(row.mediaItems) && row.mediaItems.length
      ? row.mediaItems.map((it) => ({ url: it.url, kind: it.kind || (urlIsVideo(it.url) ? "video" : "image") }))
      : row.mediaUrl ? [{ url: row.mediaUrl, kind: urlIsVideo(row.mediaUrl, row.mediaKind) ? "video" : "image" }] : [];
    let committed = multi ? [...existing] : [];

    // Blob previews for instant feedback.
    const jobs = accepted.map((file) => {
      const isVideo = file.type.startsWith("video/");
      const blobUrl = URL.createObjectURL(file);
      const pid = "p" + Math.random().toString(36).slice(2, 8);
      return { file, isVideo, blobUrl, pid };
    });
    setPending((prev) => [...prev, ...jobs.map((j) => ({ id: j.pid, url: j.blobUrl, isVideo: j.isVideo }))]);
    const firstVideo = jobs.find((j) => j.isVideo);
    if (firstVideo && isReel) {
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.onloadedmetadata = () => onChange({ reelDuration: Math.round(vid.duration) });
      vid.src = firstVideo.blobUrl;
    }
    setMediaUploading(true);
    setMediaProgress(0);

    // Upload in parallel; commit the growing list as each lands so previews
    // fill in progressively but never overwrite a sibling.
    await Promise.all(jobs.map(async (j) => {
      try {
        const publicUrl = await uploadAssetWithProgress(j.file, (pr) => setMediaProgress(pr));
        committed = [...committed, { url: publicUrl, kind: j.isVideo ? "video" : "image" }];
        commitItems(committed);
        setPending((prev) => prev.filter((p) => p.id !== j.pid));
        URL.revokeObjectURL(j.blobUrl);
        if (j.isVideo && !row.thumbnailUrl) {
          const posterBlob = await captureVideoPoster(j.blobUrl);
          if (posterBlob) {
            try {
              const posterFile = new File([posterBlob], `poster-${Date.now()}.jpg`, { type: "image/jpeg" });
              onChange({ thumbnailUrl: await uploadAssetWithProgress(posterFile, () => {}) });
            } catch { /* poster is best-effort */ }
          }
        }
      } catch (err) {
        setPending((prev) => prev.filter((p) => p.id !== j.pid));
        setMediaWarnings((w) => [...new Set([...w, err?.message || "Upload failed — re-attach before publishing"])]);
      }
    }));
    setMediaUploading(false);
    setMediaProgress(0);
  };

  const removeItem = (idx) => {
    const list = rowItems.map((it) => ({ url: it.url, kind: it.isVideo ? "video" : "image" }));
    if (idx >= list.length) return; // a pending upload — can't cancel mid-flight
    list.splice(idx, 1);
    commitItems(list);
    setActiveIdx((a) => Math.max(0, Math.min(a, list.length - 1)));
    if (!list.length) { setMediaWarnings([]); onChange({ thumbnailUrl: null, ...(isReel ? { reelDuration: null } : {}) }); }
  };

  const reorderItems = (nextGallery, nextActive) => {
    // Only the hosted items reorder; pending uploads sit at the end.
    const list = nextGallery.filter((it) => !it.uploading).map((it) => ({ url: it.url, kind: it.isVideo ? "video" : "image" }));
    commitItems(list);
    setActiveIdx(nextActive);
  };

  // Explicit custom thumbnail (poster) for a video post.
  const handleThumbFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    try { checkFileSize(file); } catch (err) { setMediaWarnings([err.message]); return; }
    setThumbUploading(true);
    try {
      const url = await uploadAssetWithProgress(file, () => {});
      onChange({ thumbnailUrl: url });
    } catch (err) {
      setMediaWarnings((w) => [...w, err?.message || "Thumbnail upload failed"]);
    }
    setThumbUploading(false);
  };

  const clearMedia = () => {
    setPending([]);
    setActiveIdx(0);
    setMediaWarnings([]);
    onChange({ mediaItems: null, mediaUrl: null, thumbnailUrl: null, mediaKind: null, carouselFrameUrls: null, ...(isReel ? { reelDuration: null } : {}) });
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    addComment(row.id, { id: uid(), author: currentUser, text: commentText, ts: new Date().toISOString() });
    setCommentText("");
  };
  const toggleResolved = (commentId) => {
    const updated = (row.comments || []).map((c) => c.id === commentId ? { ...c, resolved: !c.resolved } : c);
    onChange({ comments: updated });
  };

  const handleApprovalStatusChange = (toStatus) => {
    if (toStatus === row.status) { setIsApprovalOpen(false); return; }
    const check = canTransition(row.status, toStatus, row, hasConnectedAccount);
    if (check.allowed) onChange({ status: toStatus });
    setIsApprovalOpen(false);
  };

  const handlePostNow = () => {
    if (hasConnectedAccount) {
      setPublishConfirm(row);
    } else {
      setComposer({ row, postNow: true });
    }
    setSelectedRowId(null);
  };

  const handleDelete = () => {
    remove(row.id);
    showToast(TOAST.POST_REMOVED, T.red);
    setSelectedRowId(null);
  };

  return (
    <>
      <div className="overlay dp2-overlay" onClick={handleClose}>
        <div className="modal cpm dp2" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="detail-panel-title" onClick={(e) => e.stopPropagation()}>
          {/* ── Header ── */}
          <div className="cpm-head">
            <div className="dp2-head-left">
              <div className="dp2-kicker">
                <PlatformIcon platform={row.platform} size={14} />
                <span>{p.label}</span>
                <span className="dp2-kicker-dot" />
                <span className="s-dot" style={{ background: s.dot }} />
                <span>{s.label}</span>
                <span className="dp2-kicker-dot" />
                <span>Updated {updatedLabel}</span>
              </div>
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  id="detail-panel-title"
                  className="dp2-title-input"
                  value={row.note}
                  placeholder="Post title…"
                  onChange={(e) => onChange({ note: e.target.value })}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setIsEditingTitle(false); }}
                />
              ) : (
                <div id="detail-panel-title" className="dp2-title" onClick={() => setIsEditingTitle(true)} title="Click to edit">
                  {row.note || "Untitled post"}
                </div>
              )}
            </div>
            <div className="cpm-head-actions">
              <button type="button" className={"cpm-preview-toggle" + (showPreview ? " on" : "")}
                onClick={() => setShowPreview((v) => !v)} aria-pressed={showPreview}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>
                Preview
              </button>
              <button className="m-x" onClick={handleClose} title="Close (Esc)" aria-label="Close"><X size={15} /></button>
            </div>
          </div>

          <div className="cpm-body">
            {/* ── Composer column ── */}
            <div className="cpm-left">
              {row.publishError && row.status !== "posted" && (
                <section className="dp-publish-error">
                  <div className="dp-publish-error-title">Publishing failed{row.publishErrorAt ? ` · ${formatRelativeStamp(row.publishErrorAt)}` : ""}</div>
                  <div className="dp-publish-error-msg">{row.publishError}</div>
                  <div className="dp-publish-error-hint">Fix the issue, then approve &amp; reschedule — the scheduler will retry at the new time.</div>
                </section>
              )}

              {row.status === "posted" && (row.igMediaId || row.igPostId || row.igPublishedUrl) && (
                <section className="dp-published-banner">
                  <div className="dp-published-icon"><Check size={14} /></div>
                  <div className="dp-published-info">
                    <div className="dp-published-title">Published to Instagram</div>
                    <div className="dp-published-meta">
                      {row.postedAt && `Posted ${formatRelativeStamp(row.postedAt)}`}
                      {row.igPermalink && (
                        <>
                          {" · "}
                          <a href={row.igPermalink} target="_blank" rel="noopener noreferrer" className="dp-published-link">View on Instagram ↗</a>
                        </>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Channels — main channel icon (click to change), added
                  channels as equal icons, ⊕ adds another */}
              <div className="dp-outlets">
                <div className="dp-platform-anchor" ref={platformDropdownRef}>
                  <button
                    className="dp-outlet-ic dp-outlet-main"
                    onClick={() => setPlatformDropdownOpen((o) => !o)}
                    title={`${p.label} — main channel, click to change`}
                    aria-haspopup="listbox"
                    aria-expanded={platformDropdownOpen}
                  >
                    <PlatformIcon platform={row.platform} size={16} />
                  </button>
                  {platformDropdownOpen && (
                    <div className="dp-platform-popover" role="listbox">
                      {Object.entries(PLATFORMS).map(([key, platform]) => (
                        <button
                          key={key}
                          role="option"
                          aria-selected={row.platform === key}
                          className={`dp-platform-option${row.platform === key ? " active" : ""}`}
                          onClick={() => {
                            onChange({ platform: key, platforms: [key, ...(Array.isArray(row.platforms) ? row.platforms : []).filter((pl) => pl !== key)] });
                            setPlatformDropdownOpen(false);
                          }}
                        >
                          <PlatformIcon platform={key} size={16} />
                          <span>{platform.short}</span>
                          {row.platform === key && <Check size={12} className="dp-platform-check" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {extras.map((k) => (
                  <button
                    key={k}
                    className="dp-outlet-ic"
                    onClick={() => onChange({ platforms: outlets.filter((pl) => pl !== k) })}
                    title={`${PLATFORMS[k].label} — click to remove`}
                    aria-label={`Remove ${PLATFORMS[k].label} outlet`}
                  >
                    <PlatformIcon platform={k} size={16} />
                    <span className="dp-outlet-ic-x" aria-hidden="true"><X size={8} /></span>
                  </button>
                ))}
                <div className="dp-outlet-anchor" ref={outletPickerRef}>
                  <button
                    className="dp-outlet-add"
                    onClick={() => setOutletPickerOpen((o) => !o)}
                    title="Add a channel"
                    aria-label="Add a channel"
                    aria-haspopup="listbox"
                    aria-expanded={outletPickerOpen}
                  >
                    <Plus size={13} />
                  </button>
                  {outletPickerOpen && (
                    <div className="dp-platform-popover" role="listbox">
                      {addable.length === 0 && <div className="dp-outlet-none">Every channel is already on this post.</div>}
                      {addable.map((k) => (
                        <button key={k} role="option" aria-selected={false} className="dp-platform-option"
                          onClick={() => { onChange({ platforms: [...outlets, k] }); setOutletPickerOpen(false); }}>
                          <PlatformIcon platform={k} size={16} />
                          <span>{PLATFORMS[k].short}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Composer: caption + media */}
              <div className={"cpm-composer" + (dragOver ? " drag" : "")}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.types?.includes("application/x-mg-reorder")) return; handleFiles(e.dataTransfer?.files); }}>
                <textarea
                  className="cpm-txa"
                  value={row.caption || ""}
                  placeholder={`Write your ${p.label} caption…`}
                  onChange={(e) => onChange({ caption: e.target.value })}
                />
                <input ref={mediaRef} type="file" multiple={allowsMulti} accept={isReel ? "video/*" : "image/*,video/*,image/gif"} hidden
                  onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
                {isStory ? (
                  <div className="cpm-composer-foot">
                    <div className="dp2-story-slot">
                      <StoryThumbnail elements={storyElements} onClick={() => { setStory(row); setSelectedRowId(null); }} />
                      <span className="dp2-story-hint">Open the designer to edit frames</span>
                    </div>
                  </div>
                ) : galleryItems.length >= 2 ? (
                  // Multi-image / carousel: big active preview + reorderable strip.
                  <div className="dp2-gallery-wrap">
                    <MediaGallery
                      items={galleryItems}
                      activeIdx={Math.min(activeIdx, galleryItems.length - 1)}
                      onSelect={setActiveIdx}
                      onReorder={reorderItems}
                      onRemove={removeItem}
                      onAdd={allowsMulti ? () => mediaRef.current?.click() : undefined}
                    />
                    <div className="dp2-gallery-meta">
                      <span>{galleryItems.length} {galleryVideo ? "items" : "images"}{galleryItems.length > 10 ? " · over the 10-item limit" : ""}</span>
                      <button type="button" className="dp2-tile-action" onClick={clearMedia}>Remove all</button>
                    </div>
                  </div>
                ) : displayMedia ? (
                  <div className="cpm-composer-foot">
                    <div className="dp2-media-cluster">
                      <div className="dp2-tile-col">
                        <div className={"cpm-media-thumb" + (mediaUploading ? " uploading" : "")}>
                          {displayMedia.isVideo
                            ? <video src={displayMedia.previewUrl} muted loop playsInline autoPlay />
                            : <img src={displayMedia.previewUrl} alt="" />}
                          {mediaUploading && (
                            <>
                              <span className="dp2-tile-pct">{mediaProgress > 0 ? `${Math.round(mediaProgress * 100)}%` : "…"}</span>
                              <span className="dp2-tile-bar" style={{ width: `${Math.round(mediaProgress * 100)}%` }} />
                            </>
                          )}
                          <button type="button" className="cpm-media-rm" onClick={clearMedia} aria-label="Remove media"><X size={9} /></button>
                        </div>
                        <span className="dp2-tile-lbl">{displayMedia.isVideo ? "Video" : "Image"}</span>
                      </div>
                      {/* Add-more tile for multi-image feed posts */}
                      {allowsMulti && !displayMedia.isVideo && (
                        <div className="dp2-tile-col">
                          <button type="button" className="dp2-thumb-prev empty" onClick={() => mediaRef.current?.click()} title="Add more images">
                            <Plus size={15} />
                          </button>
                          <span className="dp2-tile-lbl">Add more</span>
                        </div>
                      )}
                      {/* Video posts carry a still thumbnail (auto-captured,
                          or set here) for every <img> preview + the feed. */}
                      {displayMedia.isVideo && (
                        <div className="dp2-tile-col">
                          <input ref={thumbRef} type="file" accept="image/*" hidden
                            onChange={(e) => { handleThumbFile(e.target.files?.[0]); e.target.value = ""; }} />
                          <button type="button" className={"dp2-thumb-prev" + (row.thumbnailUrl ? "" : " empty")}
                            onClick={() => thumbRef.current?.click()} disabled={thumbUploading}
                            title={row.thumbnailUrl ? "Change the video thumbnail" : "Set a video thumbnail"}>
                            {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="Video thumbnail" /> : <ImageIcon size={15} />}
                            {thumbUploading && <span className="dp2-tile-pct">…</span>}
                          </button>
                          <button type="button" className="dp2-tile-lbl dp2-tile-action" onClick={() => thumbRef.current?.click()} disabled={thumbUploading}>
                            {thumbUploading ? "Uploading…" : row.thumbnailUrl ? "Change thumbnail" : "Set thumbnail"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="cpm-composer-foot">
                    <button type="button" className="cpm-dropcard" onClick={() => mediaRef.current?.click()}>
                      <ImageIcon size={17} />
                      <span>Drag &amp; drop or <em>select {allowsMulti ? "files" : "a file"}</em>{mediaRequired && <b className={"dp-required" + (mediaReady ? " met" : "")}>*</b>}</span>
                    </button>
                  </div>
                )}
                <div className="dp2-count-row">
                  <span className={"cpm-count" + (over ? " over" : "")}>{capLen} / {max}</span>
                </div>
                {mediaWarnings.length > 0 && (
                  <div className="dp-warnings dp2-warnings">
                    {mediaWarnings.map((w, i) => (
                      <div key={i} className="dp-warning"><AlertTriangle size={10} /><span>{w}</span></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Designer entries — the media's "make it" path. Stories use
                  the thumbnail above; everything else gets explicit doors. */}
              {!isStory && (
                <div className="cpm-design-row">
                  <span className="cpm-design-label">Or design it:</span>
                  <button type="button" className="dp2-design-btn"
                    onClick={() => { setStory(row); setSelectedRowId(null); }}
                    title="Open the canvas designer — sizes follow this post's channels">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M11.3 2.2 13.8 4.7 5.5 13H3v-2.5L11.3 2.2Z"/><path d="M9.8 3.7l2.5 2.5"/></svg>
                    Design in canvas
                  </button>
                  {outlets.some((c) => c === "ig_post" || c === "linkedin") && (
                    <button type="button" className="dp2-design-btn"
                      onClick={() => { setCarousel({ row }); setSelectedRowId(null); }}
                      title="Open the carousel builder">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="3.5" width="8" height="9" rx="1"/><path d="M11.5 4.5h1a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1"/></svg>
                      Carousel
                    </button>
                  )}
                </div>
              )}

              {isReel && (
                <div className="dp-audio-credit">
                  <label className="dp-audio-credit-label">Audio credit</label>
                  <input className="inp dp-audio-credit-input" placeholder="Original audio or song name" value={row.reelAudio || ""} onChange={(e) => onChange({ reelAudio: e.target.value })} />
                </div>
              )}

              <AICaptionAssist platform={row.platform} note={row.note} caption={row.caption} onAccept={(t) => onChange({ caption: t })} variant="inline" />

              {/* Approval / owner */}
              <section className="stage-section dp2-section">
                <div className="stage-col-label">Approval</div>
                <div className="stage-governance">
                  <div className="stage-select" ref={approvalRef}>
                    <button className="stage-select-trigger" onClick={() => setIsApprovalOpen((c) => !c)}>
                      <span className="stage-select-copy">
                        <span className="stage-select-label">State</span>
                        <span className="stage-select-value">
                          <span className="s-dot" style={{ background: s.dot }} />
                          {s.label}
                        </span>
                      </span>
                      <span className="stage-select-caret" />
                    </button>
                    {isApprovalOpen && (
                      <div className="stage-select-menu">
                        {STATUS_ORDER.map((k) => {
                          const st = STATUSES[k];
                          const isCurrent = row.status === k;
                          const currentIdx = STATUS_ORDER.indexOf(row.status);
                          const targetIdx = STATUS_ORDER.indexOf(k);
                          const isBackward = targetIdx < currentIdx;
                          const isPosted = k === "posted";
                          const isForwardSkip = targetIdx > currentIdx + 1;
                          let itemAllowed = false;
                          let itemReason = "";
                          if (isCurrent) { itemReason = "Current status"; }
                          else if (isBackward) { itemReason = "Cannot go backward"; }
                          else if (isPosted) { itemReason = "System only"; }
                          else if (isForwardSkip) { itemReason = "Cannot skip steps"; }
                          else { const check = canTransition(row.status, k, row, hasConnectedAccount); itemAllowed = check.allowed; itemReason = check.reason; }
                          const isDisabled = isCurrent || !itemAllowed;
                          return (
                            <button key={k} className={`stage-select-option ${isCurrent ? "on" : ""}${isDisabled && !isCurrent ? " dp-disabled-option" : ""}`} disabled={isDisabled} title={itemReason} onClick={() => handleApprovalStatusChange(k)}>
                              <span className="dp-option-row">
                                <span className="s-dot" style={{ background: st.dot }} />
                                {st.label}
                              </span>
                              {isCurrent ? <span className="ops-option-mark">Current</span> : null}
                              {isDisabled && !isCurrent ? <span className="dp-disabled-reason">{itemReason}</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="stage-mini-stack">
                    <div className="stage-mini-row dp-assignee-row" ref={assigneeRef} onClick={() => setIsAssigneeOpen((c) => !c)}>
                      <span className="stage-mini-key">Owner</span>
                      <span className="stage-mini-val dp-assignee-val">
                        {assignee ? <><div className="av dp-avatar-sm" style={{ background: assignee.color + "22", color: assignee.color }}>{assignee.initials}</div>{assignee.name}</> : "Unassigned"}
                      </span>
                      {isAssigneeOpen && (
                        <div className="stage-select-menu dp-assignee-menu" onClick={(e) => e.stopPropagation()}>
                          <button className={"stage-select-option " + (!row.assignee ? "on" : "")} onClick={() => { onChange({ assignee: null }); setIsAssigneeOpen(false); }}>
                            <span className="dp-option-row">
                              <span className="dp-assignee-option-avatar">--</span>
                              Unassigned
                            </span>
                            {!row.assignee ? <span className="ops-option-mark">Current</span> : null}
                          </button>
                          {team.map((member) => (
                            <button key={member.id} className={"stage-select-option " + (row.assignee === member.id ? "on" : "")} onClick={() => { onChange({ assignee: member.id }); setIsAssigneeOpen(false); }}>
                              <span className="dp-option-row">
                                <div className="av dp-avatar-sm" style={{ background: member.color + "22", color: member.color }}>{member.initials}</div>
                                {member.name}
                              </span>
                              {row.assignee === member.id ? <span className="ops-option-mark">Current</span> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Comments */}
              <section className="stage-section dp2-section">
                <div className="stage-col-label">Comments</div>
                {(row.comments || []).length === 0 && (
                  <div className="cal-panel-empty dp-comments-empty">No comments yet. Keep approvals and notes here.</div>
                )}
                {(row.comments || []).map((c) => {
                  const m = team.find((t) => t.id === c.author) || { initials: "?", color: T.textDim, name: "Unknown" };
                  return (
                    <div key={c.id} className="dp-comment">
                      <div className="dp-comment-avatar" style={{ background: m.color + "22", color: m.color }}>{m.initials}</div>
                      <div className="dp-comment-body">
                        <div className="dp-comment-author">
                          {m.name} <span className="dp-comment-ts">{formatRelativeStamp(c.ts)}</span>
                        </div>
                        <div className={`dp-comment-text${c.resolved ? " resolved" : ""}`}>{c.text}</div>
                      </div>
                      <button onClick={() => toggleResolved(c.id)} title={c.resolved ? "Unresolve" : "Resolve"} className={`dp-comment-resolve${c.resolved ? " resolved" : ""}`}>
                        <CheckCircle2 size={15} />
                      </button>
                    </div>
                  );
                })}
                <div className="dp-comment-row">
                  <input className="comment-input" placeholder="Add a comment…" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitComment()} />
                  <button className="btn btn-ghost" onClick={submitComment}>Send</button>
                </div>
              </section>
            </div>

            {/* ── Preview rail ── */}
            {showPreview && (
              <div className="cpm-right">
                <div className="cpm-right-title">Post Previews</div>
                {(row.caption || "").trim() || displayMedia
                  ? outlets.filter((k) => PLATFORMS[k]).map((k) => (
                      <NetworkPreview key={k} platform={k} caption={(row.caption || "").trim()} items={galleryItems.map((it) => ({ previewUrl: it.url, isVideo: it.isVideo }))} />
                    ))
                  : <PreviewEmptyState />}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="cpm-foot">
            <div className="dp2-foot-left">
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
              <div className="dp-mode-toggle" role="group" aria-label="Publish mode" title="Auto — the scheduler publishes it. Manual — you post it by hand, then mark it Posted.">
                {["auto", "manual"].map((m) => {
                  const on = (row.publishMode || "auto") === m;
                  return (
                    <button key={m} className={"dp-mode-btn" + (on ? " on" : "")} aria-pressed={on}
                      onClick={() => onChange({ publishMode: m })}>{m}</button>
                  );
                })}
              </div>
              {row.publishMode === "manual" && row.status !== "posted" && row.scheduledAt && new Date(row.scheduledAt).getTime() <= Date.now() && (
                <span className="dp2-manual-due">Due now — post by hand, then mark Posted</span>
              )}
            </div>
            <div className="cpm-foot-right">
              <button className="btn btn-ghost" onClick={() => setIsCrossPostOpen(true)} title="Draft captions for the other platforms with AI">
                <Share2 size={13} style={{ marginRight: 6 }} />
                Cross-post
              </button>
              {row.status !== "posted" && row.status !== "scheduled" && (
                <button className="btn btn-ghost" onClick={() => approveAndSchedule(row.id)} title="Approve and auto-pick the next good time slot">
                  <Calendar size={13} style={{ marginRight: 6 }} />
                  Approve &amp; schedule
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={handlePostNow}
                disabled={!canPublish}
                title={canPublish ? undefined : mediaUploading ? "Media is still uploading" : `Add ${missingRequired.join(" and ")} before publishing`}
              >
                Post to {p.label}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isCrossPostOpen && (
        <CrossPostModal sourceRow={row} onClose={() => setIsCrossPostOpen(false)} />
      )}
    </>
  );
}
