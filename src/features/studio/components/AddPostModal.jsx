import React, { useEffect, useMemo, useRef, useState } from "react";
import { AIMark, CalendarIcon, Check, ChevronDown, Close as X, ImageIcon, LayoutTemplate, Plus, Search } from "../../../components/icons/index.jsx";
import { NetworkPreview, PreviewEmptyState } from "./PostPreviews.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { AICaptionAssist } from "./AICaptionAssist.jsx";
import { PLATFORMS, nowPT, suggestBestSlot } from "../shared.js";
import { useStudio } from "../StudioContext.jsx";
import { uploadAssetWithProgress, checkFileSize } from "../../../lib/supabase.js";
import { planUpload } from "../capabilities.js";
import { probeFiles } from "../media-probe.js";
import { CapabilityDialog } from "./CapabilityDialog.jsx";
import { EditImageModal } from "./EditImageModal.jsx";
import { MoreHorizontal } from "../../../components/icons/index.jsx";

// Buffer-parity Create Post window: title + Tags up top-left; Templates /
// AI Assistant / Preview / expand on the right; avatar channel row with a
// searchable picker; one big composer card with media tiles + a toolbar
// (add / emoji / hashtag) inside it; live per-network previews on the
// right; Next Available scheduling in the footer. Our one addition to the
// Buffer flow: the Design door into the canvas designer.

const CAPTION_TEMPLATES = [
  { name: "Announcement", body: "Big news from the studio — {what}. {why it matters}. Full story at the link." },
  { name: "Behind the scenes", body: "A peek behind the curtain on {project}. {process detail}. More soon." },
  { name: "Motion tip", body: "Motion tip: {tip}. Try it on your next cut." },
  { name: "Work showcase", body: "New work: {project} for {client}. {one-line concept}. Watch the full piece — link in bio." },
];

const EMOJI = ["🔥", "✨", "🎬", "🎉", "🚀", "💡", "👏", "❤️", "😂", "😍", "🙌", "👀", "🎯", "💪", "🌟", "⚡", "🏆", "📽️", "🎨", "🤝", "✅", "➡️", "👇", "💬"];

export function AddPostModal({ initialDate, onClose, onCreate }) {
  const { rows, connections, setShowConn } = useStudio();
  const captionRef = useRef(null);
  const fileRef = useRef(null);
  const safeDate = initialDate || nowPT();

  const [caption, setCaption] = useState("");
  const [channels, setChannels] = useState(["ig_post"]); // ordered — first is the main channel
  const [showPreview, setShowPreview] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [createAnother, setCreateAnother] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  // Media gallery: { id, url(blob), publicUrl, uploading, progress, isVideo, error }
  const [items, setItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  // Capability violation awaiting a user decision: { files, plan }
  const [capIssue, setCapIssue] = useState(null);
  // Tile interactions: per-tile ⋯ menu, lightbox, image editor
  const [menuFor, setMenuFor] = useState(null);
  const [expand, setExpand] = useState(null); // { url, isVideo }
  const [editItem, setEditItem] = useState(null); // item id
  // Customize-for-each-network step: one draft per selected channel,
  // forked from the shared caption/media, edited independently, and
  // created as one post per channel on Schedule Posts (Buffer flow).
  const [mode, setMode] = useState("compose"); // "compose" | "customize"
  const [drafts, setDrafts] = useState([]); // [{ channel, caption, firstComment, items }]
  const [expandedIdx, setExpandedIdx] = useState(0);
  const draftFileRef = useRef(null);
  const [draftDragOver, setDraftDragOver] = useState(false);
  const [dateValue, setDateValue] = useState(() => {
    const y = safeDate.getFullYear();
    const m = String(safeDate.getMonth() + 1).padStart(2, "0");
    const d = String(safeDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [timeValue, setTimeValue] = useState("09:00");

  // One popover open at a time (Buffer behavior); each has an anchor ref
  // for outside-click dismissal.
  const [openPop, setOpenPop] = useState(null); // "picker"|"tags"|"templates"|"emoji"|"when"|"addMenu"
  const pickerRef = useRef(null);
  const tagsRef = useRef(null);
  const templatesRef = useRef(null);
  const emojiRef = useRef(null);
  const whenRef = useRef(null);
  const addMenuRef = useRef(null);
  const popRefs = useRef({ picker: pickerRef, tags: tagsRef, templates: templatesRef, emoji: emojiRef, when: whenRef, addMenu: addMenuRef });
  const togglePop = (k) => setOpenPop((p) => (p === k ? null : k));

  useEffect(() => {
    if (!openPop) return;
    const h = (e) => {
      const anchor = popRefs.current[openPop]?.current;
      if (anchor && !anchor.contains(e.target)) setOpenPop(null);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [openPop]);

  useEffect(() => { captionRef.current?.focus(); }, []);

  const toggleChannel = (key) => {
    setChannels((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  // Feed channels take multiple images; a video is a single-video post.
  const allowsMulti = channels.length > 0 && channels.every((k) => k !== "ig_story" && k !== "ig_reel");

  // Upload one or many at once. Each tile shows instantly with its own
  // progress ring, then fills in its hosted URL — Buffer-style.
  // channelList is passed explicitly when the capability dialog just
  // changed the channels (the closure's `channels` would be stale).
  const startUpload = (files, channelList = channels) => {
    const videoFile = files.find((f) => f.type.startsWith("video/"));
    const canMulti = channelList.length > 0 && channelList.every((k) => k !== "ig_story" && k !== "ig_reel");
    const multi = canMulti && !videoFile;
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

  // Capability gate: every drop / file-pick lands here first. If the
  // prospective media breaks a selected channel, raise the dialog naming
  // the channel instead of uploading.
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!files.length) return;
    const additions = await probeFiles(files);
    const existing = items.map((it) => ({ kind: it.isVideo ? "video" : "image" }));
    const plan = planUpload(channels, existing, additions);
    if (!plan.ok) { setCapIssue({ files, plan }); return; }
    startUpload(files);
  };

  const removeItem = (id) => setItems((prev) => {
    const it = prev.find((x) => x.id === id);
    if (it?.url?.startsWith("blob:")) URL.revokeObjectURL(it.url);
    return prev.filter((x) => x.id !== id);
  });

  // Close any open per-tile ⋯ menu on an outside click.
  useEffect(() => {
    if (!menuFor) return;
    const h = (e) => { if (!e.target.closest?.(".cpm-tile-more")) setMenuFor(null); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [menuFor]);

  // Edited image comes back as a JPEG blob: swap the tile's preview to it
  // instantly and re-upload for a fresh hosted URL.
  const applyEdit = async (blob) => {
    const it = items.find((x) => x.id === editItem);
    setEditItem(null);
    if (!it) return;
    const file = new File([blob], `edit-${Date.now()}.jpg`, { type: "image/jpeg" });
    const blobUrl = URL.createObjectURL(blob);
    if (it.url?.startsWith("blob:")) URL.revokeObjectURL(it.url);
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, url: blobUrl, publicUrl: null, uploading: true, progress: 0, error: null } : x)));
    try {
      const url = await uploadAssetWithProgress(file, (pr) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, progress: pr } : x))));
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, publicUrl: url, uploading: false } : x)));
    } catch (e) {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, uploading: false, error: e?.message || "Upload failed" } : x)));
    }
  };
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
      // carouselFrameUrls stays a designer-render artifact; the scheduler
      // falls back to mediaItems for raw multi-image posts.
      thumbnailUrl: list.find((i) => i.kind !== "video")?.url || null,
    };
  };
  const uploading = items.some((i) => i.uploading);

  // Character budget = the tightest limit among the selected channels.
  const capMax = useMemo(() => (
    channels.length && channels.every((k) => k === "linkedin") ? 3000 : 2200
  ), [channels]);
  const nearLimit = caption.length > capMax * 0.88;

  const insertAtCursor = (text) => {
    const ta = captionRef.current;
    const start = ta?.selectionStart ?? caption.length;
    const end = ta?.selectionEnd ?? caption.length;
    setCaption(caption.slice(0, start) + text + caption.slice(end));
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const applyTemplate = (body) => {
    setCaption((prev) => (prev.trim() ? `${prev}\n\n${body}` : body));
    setOpenPop(null);
    captionRef.current?.focus();
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const useNextAvailable = () => {
    const iso = suggestBestSlot(channels[0] || "ig_post", rows);
    const d = new Date(iso);
    setDateValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setTimeValue(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setOpenPop(null);
  };

  // ── Customize step ──────────────────────────────────────────────
  const enterCustomize = () => {
    if (channels.length === 0) return;
    setDrafts((prev) => {
      // Keep per-network edits when re-entering with the same channel set.
      if (prev.length && prev.map((d) => d.channel).join() === channels.join()) return prev;
      return channels.map((k) => ({ channel: k, caption, firstComment: "", items: [...items] }));
    });
    setExpandedIdx(0);
    setMode("customize");
  };

  const setDraft = (idx, patch) => setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  const setDraftItems = (idx, updater) => setDrafts((prev) => prev.map((d, i) =>
    (i === idx ? { ...d, items: typeof updater === "function" ? updater(d.items) : updater } : d)));

  // Draft-scoped upload — same tile pipeline as the shared composer but
  // writing into one draft's gallery.
  const draftUpload = (idx, files, channel) => {
    const videoFile = files.find((f) => f.type.startsWith("video/"));
    const single = channel === "ig_story" || channel === "ig_reel";
    const multi = !single && !videoFile;
    const chosen = multi ? files.filter((f) => f.type.startsWith("image/")) : [videoFile || files[0]];
    for (const file of chosen) {
      let err0 = null;
      try { checkFileSize(file); } catch (err) { err0 = err.message; }
      const isVideo = file.type.startsWith("video/");
      const blobUrl = URL.createObjectURL(file);
      const id = "m" + Math.random().toString(36).slice(2, 8);
      const tile = { id, url: blobUrl, publicUrl: null, uploading: !err0, progress: 0, isVideo, error: err0 };
      setDraftItems(idx, (prev) => (multi ? [...prev, tile] : [tile]));
      if (err0) continue;
      uploadAssetWithProgress(file, (pr) => setDraftItems(idx, (prev) => prev.map((it) => (it.id === id ? { ...it, progress: pr } : it))))
        .then((url) => setDraftItems(idx, (prev) => prev.map((it) => (it.id === id ? { ...it, publicUrl: url, uploading: false } : it))))
        .catch((e) => setDraftItems(idx, (prev) => prev.map((it) => (it.id === id ? { ...it, uploading: false, error: e?.message || "Upload failed" } : it))));
    }
  };

  const handleDraftFiles = async (idx, fileList) => {
    const d = drafts[idx];
    if (!d) return;
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!files.length) return;
    const additions = await probeFiles(files);
    const existing = d.items.map((it) => ({ kind: it.isVideo ? "video" : "image" }));
    const plan = planUpload([d.channel], existing, additions);
    if (!plan.ok) { setCapIssue({ files, plan, draftIdx: idx }); return; }
    draftUpload(idx, files, d.channel);
  };

  const removeDraftItem = (idx, id) => setDraftItems(idx, (prev) => {
    const it = prev.find((x) => x.id === id);
    if (it?.url?.startsWith("blob:")) URL.revokeObjectURL(it.url);
    return prev.filter((x) => x.id !== id);
  });

  const draftsUploading = drafts.some((d) => d.items.some((it) => it.uploading));

  const draftMediaFields = (d) => {
    const list = d.items.filter((x) => x.publicUrl).map((x) => ({ url: x.publicUrl, kind: x.isVideo ? "video" : "image" }));
    const isCarousel = list.length >= 2;
    const hasVideo = list.some((x) => x.kind === "video");
    return {
      mediaUrl: list[0]?.url || null,
      mediaItems: list.length ? list : null,
      mediaKind: isCarousel ? "carousel" : hasVideo ? "video" : list.length ? "image" : null,
      thumbnailUrl: list.find((x) => x.kind !== "video")?.url || null,
    };
  };

  // One post per channel — the scheduler already publishes per row, so
  // customized posts need no new publish paths.
  const scheduleAll = () => {
    if (!drafts.length || draftsUploading) return;
    drafts.forEach((d, i) => {
      onCreate({
        title: (d.caption || caption).trim().split("\n")[0].slice(0, 64) || "Untitled post",
        caption: d.caption.trim(),
        dateValue,
        timeValue,
        platform: d.channel,
        platforms: [d.channel],
        ...(tags.length ? { tags } : {}),
        ...(d.firstComment.trim() ? { firstComment: d.firstComment.trim() } : {}),
        ...draftMediaFields(d),
        // Keep the window open for every post but the last (and for the
        // last too when Create Another is checked).
        createAnother: i < drafts.length - 1 || createAnother,
      });
    });
    if (createAnother) {
      setCaption(""); clearMedia(); setTags([]); setDrafts([]); setMode("compose");
      captionRef.current?.focus();
    }
  };

  const canSchedule = drafts.length > 0 && drafts.every((d) => d.caption.trim()) && dateValue && timeValue && !draftsUploading;

  const hasContent = !!caption.trim() || items.length > 0;
  const whenLabel = useMemo(() => {
    if (!dateValue || !timeValue) return "Pick a time";
    const d = new Date(`${dateValue}T${timeValue}:00`);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }, [dateValue, timeValue]);

  const payload = () => ({
    caption: caption.trim(),
    dateValue,
    timeValue,
    platform: channels[0],
    platforms: channels,
    ...(tags.length ? { tags } : {}),
    ...mediaFields(),
  });

  // Enter (form submit) follows the Buffer flow: compose → customize
  // step; customize → Schedule Posts.
  const submit = (event) => {
    event.preventDefault();
    if (mode === "compose") enterCustomize();
    else scheduleAll();
  };

  // "Design it" path: create the post with whatever's filled in (no caption
  // required yet) and land directly in the canvas designer with the
  // uploaded images already seeded, one canvas each.
  const createAndOpen = () => {
    if (channels.length === 0 || uploading) return;
    const trimmed = caption.trim();
    onCreate({
      title: trimmed.split("\n")[0].slice(0, 64) || "Untitled post",
      ...payload(),
      openDesigner: true,
    });
  };

  const filteredPlatforms = Object.entries(PLATFORMS).filter(([, pl]) =>
    !pickerSearch.trim() || pl.label.toLowerCase().includes(pickerSearch.toLowerCase()) || pl.short.toLowerCase().includes(pickerSearch.toLowerCase()));

  const connectNext = () => {
    const k = Object.keys(connections).find((c) => !connections[c]) || "instagram";
    setOpenPop(null);
    setShowConn(k);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <form className={"modal cpm" + (expanded ? " cpm-max" : "")} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        {/* ── Header ── */}
        <div className="cpm-head">
          <div className="cpm-head-left">
            {mode === "customize" && (
              <button type="button" className="cpm-back" onClick={() => setMode("compose")} aria-label="Back">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M10.5 3 5.5 8l5 5"/></svg>
              </button>
            )}
            <div className="cpm-title">Create Post</div>
            <div className="cpm-pop-anchor" ref={tagsRef}>
              <button type="button" className="cpm-chip" onClick={() => togglePop("tags")} aria-expanded={openPop === "tags"}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 2h5.6L14 8.4a1.4 1.4 0 0 1 0 2L10.4 14a1.4 1.4 0 0 1-2 0L2 7.6V2Z"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none"/></svg>
                Tags{tags.length > 0 ? ` · ${tags.length}` : ""}
                <ChevronDown size={11} />
              </button>
              {openPop === "tags" && (
                <div className="cpm-pop cpm-tags-pop">
                  <div className="cpm-tags-row">
                    <input value={tagInput} placeholder="Add a tag…"
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                    <button type="button" className="btn btn-ghost cpm-tag-add" onClick={addTag}>Add</button>
                  </div>
                  {tags.length > 0 && (
                    <div className="cpm-tag-chips">
                      {tags.map((t) => (
                        <span key={t} className="cpm-tag-chip">{t}
                          <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={8} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="cpm-head-actions">
            <div className="cpm-pop-anchor" ref={templatesRef}>
              <button type="button" className="cpm-hbtn" onClick={() => togglePop("templates")} aria-expanded={openPop === "templates"}>
                <LayoutTemplate size={13} /> Templates
              </button>
              {openPop === "templates" && (
                <div className="cpm-pop cpm-templates-pop">
                  {CAPTION_TEMPLATES.map((t) => (
                    <button key={t.name} type="button" className="cpm-template-row" onClick={() => applyTemplate(t.body)}>
                      <span className="cpm-template-name">{t.name}</span>
                      <span className="cpm-template-body">{t.body}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className={"cpm-hbtn" + (aiOpen ? " on" : "")} onClick={() => setAiOpen((o) => !o)} aria-pressed={aiOpen}>
              <AIMark size={13} /> AI Assistant
            </button>
            <button type="button" className={"cpm-preview-toggle" + (showPreview ? " on" : "")}
              onClick={() => setShowPreview((v) => !v)} aria-pressed={showPreview}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>
              Preview
            </button>
            <button type="button" className="m-x" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Shrink" : "Expand"} aria-pressed={expanded}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M9.5 6.5 14 2m0 0h-4m4 0v4M6.5 9.5 2 14m0 0h4m-4 0v-4"/></svg>
            </button>
            <button type="button" className="m-x" onClick={onClose} aria-label="Close"><X size={15} /></button>
          </div>
        </div>

        <div className="cpm-body">
          {/* ── Composer ── */}
          {mode === "compose" ? (
          <div className="cpm-left">
            {/* Channel avatars — click to toggle; + opens the searchable picker */}
            <div className="cpm-channels">
              {Object.keys(PLATFORMS).map((k) => (
                <button key={k} type="button" className={"cpm-av" + (channels.includes(k) ? " on" : "")}
                  onClick={() => toggleChannel(k)}
                  title={`${PLATFORMS[k].label}${k === channels[0] ? " — main channel" : ""}`}
                  aria-pressed={channels.includes(k)}>
                  <PlatformIcon platform={k} size={18} />
                  {channels.includes(k) && <span className="cpm-av-badge"><Check size={8} /></span>}
                </button>
              ))}
              <div className="cpm-pop-anchor" ref={pickerRef}>
                <button type="button" className="cpm-av cpm-av-add" onClick={() => togglePop("picker")}
                  aria-haspopup="listbox" aria-expanded={openPop === "picker"} title="Channels">
                  <Plus size={14} />
                </button>
                {openPop === "picker" && (
                  <div className="cpm-pop cpm-picker" role="listbox">
                    <div className="cpm-picker-search">
                      <Search size={13} />
                      <input value={pickerSearch} placeholder="Search channels" onChange={(e) => setPickerSearch(e.target.value)} />
                    </div>
                    <div className="cpm-picker-head">
                      <span>Channels</span>
                      <button type="button" onClick={() => setChannels([])}>Deselect all</button>
                    </div>
                    {filteredPlatforms.map(([key, pl]) => (
                      <button key={key} type="button" role="option" aria-selected={channels.includes(key)}
                        className={"cpm-picker-row" + (channels.includes(key) ? " active" : "")}
                        onClick={() => toggleChannel(key)}>
                        <PlatformIcon platform={key} size={16} />
                        <span>{pl.label}</span>
                        <span className={"cpm-picker-check" + (channels.includes(key) ? " on" : "")}>
                          {channels.includes(key) && <Check size={10} />}
                        </span>
                      </button>
                    ))}
                    <button type="button" className="cpm-picker-connect" onClick={connectNext}>
                      <span className="cpm-picker-connect-plus"><Plus size={12} /></span> Connect a channel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {aiOpen && (
              <div className="cpm-ai">
                <AICaptionAssist platform={channels[0] || "ig_post"} note={caption} onAccept={setCaption} variant="inline" />
              </div>
            )}

            <div className={"cpm-composer" + (dragOver ? " drag" : "")}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer?.files); }}>
              {dragOver && (
                <div className="cpm-dropveil"><ImageIcon size={22} /><span>Drop files to upload</span></div>
              )}
              <textarea ref={captionRef} className="cpm-txa" value={caption}
                placeholder="Start writing or get inspired with Templates…"
                onChange={(e) => setCaption(e.target.value)} />
              <input ref={fileRef} type="file" multiple={allowsMulti} accept="image/*,video/*,image/gif" hidden
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
              {/* Media tiles + always-present add tile (Buffer pattern) */}
              <div className="cpm-tiles">
                {items.map((it) => (
                  <div key={it.id} className={"cpm-tile" + (it.error ? " err" : "")} title="Click to expand"
                    role="button" tabIndex={0}
                    onClick={() => setExpand({ url: it.url, isVideo: it.isVideo })}
                    onKeyDown={(e) => { if (e.key === "Enter") setExpand({ url: it.url, isVideo: it.isVideo }); }}>
                    {it.isVideo ? <video src={it.url} muted playsInline /> : <img src={it.url} alt="" />}
                    {it.uploading && (
                      <span className="cpm-tile-ring" style={{ "--p": Math.round(it.progress * 100) }}>
                        <span className="cpm-tile-ring-n">{Math.round(it.progress * 100)}%</span>
                      </span>
                    )}
                    {it.error && <span className="cpm-tile-err" title={it.error}>!</span>}
                    <span className="cpm-tile-more">
                      <button type="button" className="cpm-tile-ctl cpm-tile-dots" title="More"
                        onClick={(e) => { e.stopPropagation(); setMenuFor((m) => (m === it.id ? null : it.id)); }}>
                        <MoreHorizontal size={11} />
                      </button>
                      {menuFor === it.id && (
                        <div className="cpm-tile-menu" onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => { setMenuFor(null); setExpand({ url: it.url, isVideo: it.isVideo }); }}>Expand</button>
                          {!it.isVideo && <button type="button" onClick={() => { setMenuFor(null); setEditItem(it.id); }}>Edit image</button>}
                          <button type="button" onClick={() => { setMenuFor(null); removeItem(it.id); }}>Remove</button>
                        </div>
                      )}
                    </span>
                    <button type="button" className="cpm-media-rm" onClick={(e) => { e.stopPropagation(); removeItem(it.id); }} aria-label="Remove"><X size={9} /></button>
                    {!it.isVideo && !it.uploading && (
                      <button type="button" className="cpm-tile-ctl cpm-tile-edit" title="Edit image"
                        onClick={(e) => { e.stopPropagation(); setEditItem(it.id); }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M11.3 2.2 13.8 4.7 5.5 13H3v-2.5L11.3 2.2Z"/><path d="M9.8 3.7l2.5 2.5"/></svg>
                      </button>
                    )}
                  </div>
                ))}
                {(allowsMulti || items.length === 0) && (
                  <button type="button" className="cpm-tile cpm-tile-add" onClick={() => fileRef.current?.click()}>
                    <ImageIcon size={17} />
                    <span>Drag &amp; drop or <em>select a file</em></span>
                  </button>
                )}
              </div>
              {/* In-composer toolbar (Buffer: + ▾ · emoji · #) */}
              <div className="cpm-tools">
                <div className="cpm-tools-left">
                  <button type="button" className="cpm-tool" onClick={() => fileRef.current?.click()} title="Add media"><Plus size={14} /></button>
                  <div className="cpm-pop-anchor" ref={addMenuRef}>
                    <button type="button" className="cpm-tool cpm-tool-caret" onClick={() => togglePop("addMenu")} aria-expanded={openPop === "addMenu"} title="More ways to add">
                      <ChevronDown size={12} />
                    </button>
                    {openPop === "addMenu" && (
                      <div className="cpm-pop cpm-add-menu">
                        <button type="button" onClick={() => { setOpenPop(null); fileRef.current?.click(); }}><ImageIcon size={13} /> Upload files</button>
                        <button type="button" onClick={() => { setOpenPop(null); createAndOpen(); }} disabled={uploading}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M11.3 2.2 13.8 4.7 5.5 13H3v-2.5L11.3 2.2Z"/><path d="M9.8 3.7l2.5 2.5"/></svg>
                          Design in canvas
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="cpm-tools-sep" />
                  <div className="cpm-pop-anchor" ref={emojiRef}>
                    <button type="button" className="cpm-tool" onClick={() => togglePop("emoji")} aria-expanded={openPop === "emoji"} title="Emoji">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="6.5"/><path d="M5.5 9.5s.9 1.5 2.5 1.5 2.5-1.5 2.5-1.5"/><circle cx="6" cy="6.3" r=".6" fill="currentColor" stroke="none"/><circle cx="10" cy="6.3" r=".6" fill="currentColor" stroke="none"/></svg>
                    </button>
                    {openPop === "emoji" && (
                      <div className="cpm-pop cpm-emoji">
                        {EMOJI.map((em) => (
                          <button key={em} type="button" onClick={() => insertAtCursor(em)}>{em}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" className="cpm-tool" onClick={() => insertAtCursor("#")} title="Add hashtag">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M6 2 4.5 14M11.5 2 10 14M2.5 5.5h11M2 10.5h11"/></svg>
                  </button>
                </div>
                {nearLimit && (
                  <span className={"cpm-count" + (caption.length > capMax ? " over" : "")}>{caption.length} / {capMax}</span>
                )}
              </div>
            </div>

            {/* One universal Design door — creates the post and opens the
                designer with your uploaded images already in place. */}
            <div className="cpm-design-row">
              <button type="button" className="dp2-design-btn" onClick={createAndOpen} disabled={uploading}
                title={uploading ? "Waiting for images to finish uploading…" : "Create the post and open the designer — your uploaded images come with you"}
                style={uploading ? { opacity: 0.5, cursor: "default" } : undefined}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M11.3 2.2 13.8 4.7 5.5 13H3v-2.5L11.3 2.2Z"/><path d="M9.8 3.7l2.5 2.5"/></svg>
                {uploading ? "Uploading…" : "Open Designer"}
              </button>
            </div>
          </div>
          ) : (
          /* ── Customize for each network: one editor per channel ── */
          <div className="cpm-left cpm-custom">
            {drafts.map((d, idx) => {
              const isIG = d.channel.startsWith("ig_");
              const max = d.channel === "linkedin" ? 3000 : 2200;
              if (idx !== expandedIdx) {
                const thumb = d.items[0];
                return (
                  <button key={idx} type="button" className="cpm-net-collapsed" onClick={() => setExpandedIdx(idx)}>
                    <PlatformIcon platform={d.channel} size={18} />
                    <span className="cpm-net-collapsed-txt">{d.caption.trim() || "No caption yet"}</span>
                    {thumb && (thumb.isVideo
                      ? <video src={thumb.url} muted playsInline />
                      : <img src={thumb.url} alt="" />)}
                  </button>
                );
              }
              return (
                <div key={idx} className={"cpm-net-editor" + (draftDragOver ? " drag" : "")}
                  onDragOver={(e) => { e.preventDefault(); setDraftDragOver(true); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDraftDragOver(false); }}
                  onDrop={(e) => { e.preventDefault(); setDraftDragOver(false); handleDraftFiles(idx, e.dataTransfer?.files); }}>
                  {draftDragOver && (
                    <div className="cpm-dropveil"><ImageIcon size={22} /><span>Drop files to upload</span></div>
                  )}
                  <div className="cpm-net-editor-head">
                    <PlatformIcon platform={d.channel} size={18} />
                    {isIG && (
                      <div className="cpm-ig-type" role="radiogroup" aria-label="Instagram type">
                        {[["ig_post", "Post"], ["ig_reel", "Reel"], ["ig_story", "Story"]].map(([key, label]) => (
                          <label key={key} className={"cpm-radio" + (d.channel === key ? " on" : "")}>
                            <input type="radio" name={`igtype-${idx}`} checked={d.channel === key} onChange={() => setDraft(idx, { channel: key })} />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea className="cpm-txa cpm-txa-net" value={d.caption} placeholder="Write this network's caption…"
                    onChange={(e) => setDraft(idx, { caption: e.target.value })} />
                  <div className="cpm-tiles">
                    {d.items.map((it) => (
                      <div key={it.id} className={"cpm-tile" + (it.error ? " err" : "")}>
                        {it.isVideo ? <video src={it.url} muted playsInline /> : <img src={it.url} alt="" />}
                        {it.uploading && (
                          <span className="cpm-tile-ring" style={{ "--p": Math.round(it.progress * 100) }}>
                            <span className="cpm-tile-ring-n">{Math.round(it.progress * 100)}%</span>
                          </span>
                        )}
                        {it.error && <span className="cpm-tile-err" title={it.error}>!</span>}
                        <button type="button" className="cpm-media-rm" onClick={() => removeDraftItem(idx, it.id)} aria-label="Remove"><X size={9} /></button>
                      </div>
                    ))}
                    <button type="button" className="cpm-tile cpm-tile-add" onClick={() => draftFileRef.current?.click()}>
                      <ImageIcon size={17} />
                      <span>Drag &amp; drop or <em>select a file</em></span>
                    </button>
                  </div>
                  <div className="cpm-tools">
                    <div className="cpm-tools-left">
                      <button type="button" className="cpm-tool" onClick={() => draftFileRef.current?.click()} title="Add media"><Plus size={14} /></button>
                      <button type="button" className="cpm-tool" onClick={() => setDraft(idx, { caption: d.caption + "#" })} title="Add hashtag">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M6 2 4.5 14M11.5 2 10 14M2.5 5.5h11M2 10.5h11"/></svg>
                      </button>
                    </div>
                    <span className={"cpm-count" + (d.caption.length > max ? " over" : "")}>{max - d.caption.length}</span>
                  </div>
                  <div className="cpm-field-row">
                    <label htmlFor={`fc-${idx}`}>First Comment</label>
                    <input id={`fc-${idx}`} value={d.firstComment} placeholder="Your comment"
                      onChange={(e) => setDraft(idx, { firstComment: e.target.value })} />
                  </div>
                </div>
              );
            })}
            <input ref={draftFileRef} type="file" multiple accept="image/*,video/*,image/gif" hidden
              onChange={(e) => { handleDraftFiles(expandedIdx, e.target.files); e.target.value = ""; }} />
          </div>
          )}

          {/* ── Preview rail ── */}
          {showPreview && (
            <div className="cpm-right">
              <div className="cpm-right-title">
                {mode === "customize" && drafts[expandedIdx]
                  ? `${PLATFORMS[drafts[expandedIdx].channel]?.label || "Post"} Preview`
                  : "Post Previews"}
                <span className="cpm-info" title="Previews approximate how each network renders your post.">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="6.5"/><path d="M8 7.2v3.6"/><circle cx="8" cy="5" r=".6" fill="currentColor" stroke="none"/></svg>
                </span>
              </div>
              {mode === "customize" && drafts[expandedIdx] ? (
                <NetworkPreview platform={drafts[expandedIdx].channel} caption={drafts[expandedIdx].caption.trim()}
                  items={drafts[expandedIdx].items.map((it) => ({ previewUrl: it.url, isVideo: it.isVideo }))} />
              ) : channels.length === 0 || !hasContent ? (
                <PreviewEmptyState />
              ) : (
                channels.map((k) => <NetworkPreview key={k} platform={k} caption={caption.trim()} items={items.map((it) => ({ previewUrl: it.url, isVideo: it.isVideo }))} />)
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="cpm-foot">
          <div className="cpm-foot-left">
            <label className="cpm-another">
              <input type="checkbox" checked={createAnother} onChange={(e) => setCreateAnother(e.target.checked)} />
              Create Another
            </label>
            {mode === "customize" && (
              <button type="button" className="cpm-savedrafts" onClick={scheduleAll} disabled={!canSchedule}
                title="Save one draft post per network">
                Save Drafts
              </button>
            )}
          </div>
          <div className="cpm-foot-right">
            <div className="cpm-pop-anchor" ref={whenRef}>
              <button type="button" className="cpm-when-btn" onClick={() => togglePop("when")} aria-expanded={openPop === "when"} title="Scheduled for (PT)">
                <CalendarIcon size={13} />
                {whenLabel}
                <ChevronDown size={11} />
              </button>
              {openPop === "when" && (
                <div className="cpm-pop cpm-when-pop">
                  <button type="button" className="cpm-when-next" onClick={useNextAvailable}>
                    <CalendarIcon size={13} /> Next Available
                  </button>
                  <div className="cpm-when-custom">
                    <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} aria-label="Date" />
                    <input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} aria-label="Time (PT)" />
                  </div>
                </div>
              )}
            </div>
            {mode === "compose" ? (
              <button type="submit" className="btn btn-primary" disabled={channels.length === 0 || uploading}
                title={channels.length === 0 ? "Pick at least one channel" : uploading ? "Media is still uploading" : "Fine-tune the caption and media per network"}>
                Customize for each network →
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={!canSchedule}
                title={canSchedule ? undefined : draftsUploading ? "Media is still uploading" : "Every network needs a caption"}>
                Schedule Posts
              </button>
            )}
          </div>
        </div>
      </form>

      {expand && (
        <div className="overlay cpm-lightbox" onClick={(e) => { e.stopPropagation(); setExpand(null); }}>
          {expand.isVideo
            ? <video src={expand.url} controls autoPlay onClick={(e) => e.stopPropagation()} />
            : <img src={expand.url} alt="" onClick={(e) => e.stopPropagation()} />}
          <button type="button" className="cpm-lightbox-x" aria-label="Close"><X size={16} /></button>
        </div>
      )}

      {editItem && (() => {
        const it = items.find((x) => x.id === editItem);
        // Edit from the local blob preview — same-origin, no canvas taint.
        return it ? <EditImageModal src={it.url} onCancel={() => setEditItem(null)} onApply={applyEdit} /> : null;
      })()}

      {capIssue && (
        <CapabilityDialog plan={capIssue.plan}
          onRemoveChannels={() => {
            setChannels(capIssue.plan.remainingChannels);
            startUpload(capIssue.files, capIssue.plan.remainingChannels);
            setCapIssue(null);
          }}
          onReplace={() => {
            if (capIssue.draftIdx != null) {
              const idx = capIssue.draftIdx;
              const channel = drafts[idx]?.channel;
              setDraftItems(idx, (prev) => { prev.forEach((it) => it.url?.startsWith("blob:") && URL.revokeObjectURL(it.url)); return []; });
              if (channel) draftUpload(idx, capIssue.files, channel);
            } else {
              clearMedia();
              startUpload(capIssue.files);
            }
            setCapIssue(null);
          }}
          onCancel={() => setCapIssue(null)} />
      )}
    </div>
  );
}
