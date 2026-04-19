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
import { LinkedInPreview } from "./LinkedInPreview.jsx";
import { canTransition, STATUS_ORDER } from "./StatusMachine.js";
import { AlertTriangle, CalendarIcon as Calendar, Check, CheckCircle as CheckCircle2, ChevronDown, Close as X, Play, Share as Share2, Upload } from "../../../components/icons/index.jsx";
import { CrossPostModal } from "./CrossPostModal.jsx";

export function DetailPanel() {
  const {
    selectedRowId, setSelectedRowId,
    rows, update, remove, showToast,
    setComposer, setStory, setPublishConfirm,
    connections, currentUser, team,
    addComment,
    approveAndSchedule,
  } = useStudio();

  const row = rows.find((r) => r.id === selectedRowId);

  const [commentText, setCommentText] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState([]);
  const [mediaTypes, setMediaTypes] = useState([]);
  const [mediaWarnings, setMediaWarnings] = useState([]);
  const [showLIPreview, setShowLIPreview] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const [isCrossPostOpen, setIsCrossPostOpen] = useState(false);

  const titleInputRef = useRef(null);
  const mediaRef = useRef(null);
  const approvalRef = useRef(null);
  const assigneeRef = useRef(null);
  const bodyRef = useRef(null);
  const platformDropdownRef = useRef(null);
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  const hasConnectedAccount = connections.instagram || connections.linkedin;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => setSelectedRowId(null), 200);
  };

  // Reset local state when row changes
  useEffect(() => {
    setCommentText("");
    setIsEditingTitle(false);
    setIsApprovalOpen(false);
    setIsAssigneeOpen(false);
    setMediaUrls([]);
    setMediaTypes([]);
    setMediaWarnings([]);
    setShowLIPreview(false);
    setIsClosing(false);
    setPlatformDropdownOpen(false);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [selectedRowId]);

  // Focus trap: save originating focus, focus first element, restore on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const panel = panelRef.current;
    if (panel) {
      const focusables = panel.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }
    return () => {
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Trap Tab key within the panel
  useEffect(() => {
    const handleTab = (e) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(panel.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((el) => !el.hasAttribute('aria-hidden'));

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, []);

  // Escape key to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSelectedRowId]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!isApprovalOpen) return;
    const handler = (e) => {
      if (approvalRef.current && !approvalRef.current.contains(e.target)) setIsApprovalOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [isApprovalOpen]);

  useEffect(() => {
    if (!isAssigneeOpen) return;
    const handler = (e) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) setIsAssigneeOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [isAssigneeOpen]);

  useEffect(() => {
    if (!platformDropdownOpen) return;
    const handler = (e) => {
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(e.target)) setPlatformDropdownOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [platformDropdownOpen]);

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
  const isLI = row.platform === "linkedin";
  const maxFiles = isLI ? 9 : 1;
  const max = row.platform === "linkedin" ? 3000 : 2200;
  const capLen = (row.caption || "").length;
  const over = capLen > max;
  const warn = capLen > max * 0.88;
  const checks = getReadinessChecks(row, mediaUrls.length > 0);
  const readyCount = checks.filter((c) => c.pass).length;
  const updatedLabel = formatRelativeStamp(row.updatedAt);

  const submitComment = () => {
    if (!commentText.trim()) return;
    addComment(row.id, { id: uid(), author: currentUser, text: commentText, ts: new Date().toISOString() });
    setCommentText("");
  };
  const toggleResolved = (commentId) => {
    const updated = (row.comments || []).map((c) =>
      c.id === commentId ? { ...c, resolved: !c.resolved } : c
    );
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

  return (
    <>
      <div className={`detail-panel-backdrop${isClosing ? " closing" : ""}`} onClick={handleClose} />
      <div
        className={`detail-panel${isClosing ? " closing" : ""}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-panel-title"
      >
        {/* Header */}
        <div className="detail-panel-header">
          <div className="dp-header-left">
            <div className="dp-header-row">
              <PlatformIcon platform={row.platform} size={18} />
              <span className="dp-meta-label">{p.label}</span>
            </div>
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                id="detail-panel-title"
                className="detail-panel-title-input"
                value={row.note}
                placeholder="Post title\u2026"
                onChange={(e) => onChange({ note: e.target.value })}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setIsEditingTitle(false); }}
              />
            ) : (
              <div id="detail-panel-title" className="detail-panel-title" onClick={() => setIsEditingTitle(true)} title="Click to edit">
                {row.note || "Untitled post"}
              </div>
            )}
          </div>
          <button className="m-x" onClick={handleClose} title="Close (Esc)">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="detail-panel-body" ref={bodyRef}>

          {row.status === "posted" && (row.igMediaId || row.igPublishedUrl) && (
            <section className="dp-published-banner">
              <div className="dp-published-icon">
                <Check size={14} />
              </div>
              <div className="dp-published-info">
                <div className="dp-published-title">Published to Instagram</div>
                <div className="dp-published-meta">
                  {row.postedAt && `Posted ${formatRelativeStamp(row.postedAt)}`}
                  {row.igPermalink && (
                    <>
                      {" \u00B7 "}
                      <a href={row.igPermalink} target="_blank" rel="noopener noreferrer" className="dp-published-link">
                        View on Instagram ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Media upload (with platform dropdown on top) */}
          <section className="stage-section">
            <div className="stage-col-label">Media</div>
            <div className="dp-platform-section">
              <div className="dp-platform-anchor" ref={platformDropdownRef}>
                <button
                  className="dp-platform-trigger"
                  onClick={() => setPlatformDropdownOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={platformDropdownOpen}
                >
                  <PlatformIcon platform={row.platform} size={18} />
                  <span className="dp-platform-trigger-label">{PLATFORMS[row.platform].short}</span>
                  <ChevronDown size={12} className="dp-platform-trigger-chevron" />
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
                          onChange({ platform: key });
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
            </div>
            {row.platform === "ig_story" ? (
              <StoryThumbnail elements={storyElements} onClick={() => { setStory(row); setSelectedRowId(null); }} />
            ) : row.platform === "ig_reel" ? (
              <div className="dp-media-section">
                <input ref={mediaRef} type="file" accept="video/*" className="dp-file-hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || []);
                    if (!picked.length) return;
                    const f = picked[0];
                    if (f.type.startsWith("video/")) {
                      const url = URL.createObjectURL(f);
                      setMediaUrls([url]);
                      setMediaWarnings(validateMedia(f));
                      const vid = document.createElement("video");
                      vid.preload = "metadata";
                      vid.onloadedmetadata = () => { onChange({ reelDuration: Math.round(vid.duration) }); URL.revokeObjectURL(vid.src); };
                      vid.src = url;
                    }
                    e.target.value = "";
                  }} />
                {mediaUrls.length > 0 ? (
                  <div className="stage-thumb">
                    <video src={mediaUrls[0]} className="dp-video-round" />
                    <div className="stage-thumb-overlay">
                      <button className="stage-thumb-btn" onClick={() => { setMediaUrls([]); onChange({ reelDuration: null }); }}>Remove</button>
                    </div>
                    {row.reelDuration != null && (
                      <div className="dp-duration-badge">
                        {Math.floor(row.reelDuration / 60)}:{String(row.reelDuration % 60).padStart(2, "0")}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="stage-post-placeholder" onClick={() => mediaRef.current?.click()}>
                    <Play size={22} className="dp-icon-dim" />
                    <span className="dp-upload-label">Upload Reel</span>
                    <span className="dp-upload-hint">9:16 video {"\u00B7"} MP4 {"\u00B7"} MOV</span>
                  </div>
                )}
                <div className="dp-audio-credit">
                  <label className="dp-audio-credit-label">Audio credit</label>
                  <input className="inp dp-audio-credit-input" placeholder="Original audio or song name" value={row.reelAudio || ""} onChange={(e) => onChange({ reelAudio: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="dp-media-section">
                <input ref={mediaRef} type="file" accept="image/*,video/*,image/gif" multiple={isLI} className="dp-file-hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || []);
                    if (!picked.length) return;
                    if (isLI) {
                      const remaining = maxFiles - mediaUrls.length;
                      const urls = picked.slice(0, remaining).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/")).map((f) => ({ url: URL.createObjectURL(f), isVideo: f.type.startsWith("video/") }));
                      setMediaUrls((prev) => [...prev, ...urls.map((u) => u.url)]);
                      setMediaTypes((prev) => [...prev, ...urls.map((u) => (u.isVideo ? "video" : "image"))]);
                      const allWarnings = picked.slice(0, remaining).flatMap((f) => validateMedia(f));
                      setMediaWarnings(allWarnings);
                    } else {
                      const f = picked[0];
                      if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
                        setMediaUrls([URL.createObjectURL(f)]);
                        setMediaWarnings(validateMedia(f));
                      }
                    }
                    e.target.value = "";
                  }} />
                {mediaUrls.length > 0 ? (
                  isLI ? (
                    <div>
                      <div className="dp-media-grid-info">
                        <span className="dp-media-grid-count">{mediaUrls.length}/{maxFiles} files</span>
                        <button className="btn btn-ghost dp-media-grid-preview" onClick={() => setShowLIPreview(true)}>Preview</button>
                      </div>
                      <div className="media-grid">
                        {mediaUrls.map((url, i) => (
                          <div key={i} className="media-grid-item">
                            {mediaTypes[i] === "video"
                              ? <video src={url} className="dp-media-video" muted playsInline />
                              : <img src={url} alt="" />}
                            <button className="media-rm" onClick={() => { setMediaUrls((prev) => prev.filter((_, j) => j !== i)); setMediaTypes((prev) => prev.filter((_, j) => j !== i)); }}>
                              <X size={11} color="#fff" />
                            </button>
                          </div>
                        ))}
                        {mediaUrls.length < maxFiles && (
                          <div className="media-add-btn" onClick={() => mediaRef.current?.click()}>
                            <span>+</span>
                            <span className="dp-media-add-label">Add</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="stage-thumb">
                      <img src={mediaUrls[0]} alt="" />
                      <div className="stage-thumb-overlay">
                        <button className="stage-thumb-btn" onClick={() => setMediaUrls([])}>Remove</button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="stage-post-placeholder" onClick={() => mediaRef.current?.click()}>
                    <Upload size={22} className="dp-icon-dim" />
                    <span className="dp-upload-label">Attach media</span>
                    <span className="dp-upload-hint">{isLI ? "Up to 9 files \u00B7 JPG \u00B7 PNG \u00B7 MP4" : "JPG \u00B7 PNG \u00B7 GIF \u00B7 MP4"}</span>
                  </div>
                )}
              </div>
            )}
            {mediaWarnings.length > 0 && (
              <div className="dp-warnings">
                {mediaWarnings.map((w, i) => (
                  <div key={i} className="dp-warning">
                    <AlertTriangle size={10} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Caption editor */}
          <section className="stage-section">
            <div className="stage-col-label">Caption</div>
            <textarea
              className="stage-txa"
              value={row.caption || ""}
              placeholder={`Write your ${p.label} caption...`}
              onChange={(e) => onChange({ caption: e.target.value })}
              rows={5}
            />
            <div className="dp-caption-footer">
              <span className={`stage-char ${over ? "over" : warn ? "warn" : ""}`}>{capLen} / {max}</span>
            </div>
            <AICaptionAssist platform={row.platform} note={row.note} caption={row.caption} onAccept={(t) => onChange({ caption: t })} variant="inline" />
          </section>

          {/* Comments */}
          <section className="stage-section">
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
              <input className="comment-input" placeholder="Add a comment\u2026" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitComment()} />
              <button className="btn btn-ghost" onClick={submitComment}>Send</button>
            </div>
          </section>

          {/* Approval / Status */}
          <section className="stage-section">
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
                <div className="stage-mini-row">
                  <span className="stage-mini-key">Updated</span>
                  <span className="stage-mini-val">{updatedLabel}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Readiness checklist */}
          <section className="stage-section">
            <div className="stage-col-label">Readiness</div>
            <div className="readiness-list">
              {checks.map((c, i) => (
                <div key={i} className={`readiness-item`}>
                  <span className="readiness-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="readiness-icon">{c.pass ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} color={T.amber} />}</span>
                  <span className="readiness-label">{c.label}</span>
                  <span className={`readiness-ok ${c.pass ? "pass" : "fail"}`}>{c.pass ? "Ready" : "Missing"}</span>
                </div>
              ))}
            </div>
            <div className="dp-readiness-count">
              {readyCount}/{checks.length} ready
            </div>
          </section>

          {/* Actions */}
          <div className="dp-actions">
            <button className="btn btn-primary dp-action-btn" onClick={handlePostNow}>
              Post to {PLATFORMS[row.platform].label}
            </button>
            {row.status !== "posted" && row.status !== "scheduled" && (
              <button
                className="btn btn-ghost dp-action-btn"
                onClick={() => approveAndSchedule(row.id)}
                title="Approve and auto-pick the next good time slot"
              >
                <Calendar size={13} style={{ marginRight: 6 }} />
                Approve &amp; schedule
              </button>
            )}
            <button
              className="btn btn-ghost dp-action-btn"
              onClick={() => setIsCrossPostOpen(true)}
              title="Draft captions for the other platforms with AI"
            >
              <Share2 size={13} style={{ marginRight: 6 }} />
              Cross-post with AI
            </button>
            <button className="btn btn-danger dp-action-btn" onClick={handleDelete}>
              Delete post
            </button>
          </div>
        </div>
      </div>

      {showLIPreview && <LinkedInPreview caption={row.caption} mediaUrls={mediaUrls} onClose={() => setShowLIPreview(false)} />}
      {isCrossPostOpen && (
        <CrossPostModal sourceRow={row} onClose={() => setIsCrossPostOpen(false)} />
      )}
    </>
  );
}
