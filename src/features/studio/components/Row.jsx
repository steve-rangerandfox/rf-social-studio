import React, { useState, useRef, useEffect } from "react";
import {
  T,
  PLATFORMS,
  STATUSES,
  TEAM,
  uid,
  makeDefaultElements,
  getReadinessChecks,
  formatRelativeStamp,
} from "../shared.js";
import { DateTimeCell } from "./DateTimeCell.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { StoryThumbnail } from "./StoryThumbnail.jsx";
import { AICaptionAssist } from "./AICaptionAssist.jsx";
import { LinkedInPreview } from "./LinkedInPreview.jsx";
import { canTransition, getAvailableTransitions, STATUS_ORDER } from "./StatusMachine.js";
import { CheckCircle2 } from "lucide-react";

// Lucide-style inline SVG icons (avoids a package dependency for now)
function XIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function GripVerticalIcon({ size = 12, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="5" r="1.2" fill={color} /><circle cx="15" cy="5" r="1.2" fill={color} />
      <circle cx="9" cy="12" r="1.2" fill={color} /><circle cx="15" cy="12" r="1.2" fill={color} />
      <circle cx="9" cy="19" r="1.2" fill={color} /><circle cx="15" cy="19" r="1.2" fill={color} />
    </svg>
  );
}

export function Row({ row, sel, onSel, onChange, onDel, onStory, onPostNow, dragHandlers, showComments, onAddComment, currentUser, hasConnectedAccount = false }) {
  const p = PLATFORMS[row.platform], s = STATUSES[row.status];
  const nextP = () => { const ks = Object.keys(PLATFORMS); onChange({ platform: ks[(ks.indexOf(row.platform) + 1) % ks.length] }); };
  const nextAssignee = () => {
    const all = [{ id: null }, ...TEAM]; const cur = all.findIndex(t => t.id === row.assignee);
    onChange({ assignee: all[(cur + 1) % all.length].id });
  };
  const assignee = row.assignee ? TEAM.find(t => t.id === row.assignee) : null;
  const [commentText, setCommentText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState([]);
  const [showLIPreview, setShowLIPreview] = useState(false);
  const storyElements = row.storyElements || makeDefaultElements(row.note);
  const mediaRef = useRef(null);
  const isLI = row.platform === "linkedin";
  const maxFiles = isLI ? 9 : 1;
  const titleInputRef = useRef(null);
  const menuRef = useRef(null);
  const approvalRef = useRef(null);
  const statusDropdownRef = useRef(null);

  const submitComment = () => { if (!commentText.trim()) return; onAddComment({ id: uid(), author: currentUser, text: commentText, ts: new Date().toISOString() }); setCommentText(""); };
  const toggleResolved = (commentId) => {
    const updated = (row.comments || []).map(c => c.id === commentId ? { ...c, resolved: !c.resolved } : c);
    onChange({ comments: updated });
  };
  const max = row.platform === "linkedin" ? 3000 : 2200;
  const capLen = (row.caption || "").length;
  const over = capLen > max, warn = capLen > max * 0.88;
  const checks = getReadinessChecks(row, mediaUrls.length > 0);
  const readyCount = checks.filter((check) => check.pass).length;
  const updatedLabel = formatRelativeStamp(row.updatedAt);

  // Compute available transitions for the status dropdown
  const availableTransitions = getAvailableTransitions(row, hasConnectedAccount);

  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isApprovalOpen) return undefined;
    const handlePointerDown = (event) => {
      if (approvalRef.current && !approvalRef.current.contains(event.target)) {
        setIsApprovalOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isApprovalOpen]);

  useEffect(() => {
    if (!isStatusDropdownOpen) return undefined;
    const handlePointerDown = (event) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isStatusDropdownOpen]);

  // Attempt a status transition via the status pill dropdown
  const handleStatusTransition = (toStatus) => {
    const check = canTransition(row.status, toStatus, row, hasConnectedAccount);
    if (check.allowed) {
      onChange({ status: toStatus });
    }
    // If not allowed, the dropdown already shows the reason — do nothing
    setIsStatusDropdownOpen(false);
  };

  // For the approval section dropdown: validate before changing
  const handleApprovalStatusChange = (toStatus) => {
    // Allow selecting current status (no-op)
    if (toStatus === row.status) {
      setIsApprovalOpen(false);
      return;
    }

    // Only allow forward transitions, validated by the machine
    const check = canTransition(row.status, toStatus, row, hasConnectedAccount);
    if (check.allowed) {
      onChange({ status: toStatus });
    }
    setIsApprovalOpen(false);
  };

  // Build the status pill dropdown items: current status + next valid transition
  const statusDropdownItems = (() => {
    const items = [];
    // Show current status
    items.push({
      status: row.status,
      label: s.label,
      dot: s.dot,
      isCurrent: true,
      allowed: false,
      reason: "Current status",
    });
    // Show available forward transitions
    for (const t of availableTransitions) {
      const st = STATUSES[t.status];
      items.push({
        status: t.status,
        label: t.label,
        dot: st?.dot || T.textDim,
        isCurrent: false,
        allowed: t.allowed,
        reason: t.reason,
      });
    }
    return items;
  })();

  return (
    <>
    <div className={"row-container " + (isExpanded ? "is-open" : "")}>
      <div className={`t-row ${sel ? "sel" : ""} ${dragHandlers.isDragging ? "dragging" : ""} ${dragHandlers.isDragOver ? "drag-over" : ""}`}
        style={isMenuOpen || isStatusDropdownOpen ? { zIndex: 20 } : undefined}
        onMouseEnter={dragHandlers.onMouseEnter}
        onClick={() => { if (!isEditingTitle) setIsExpanded((current) => !current); }}>
        <div style={{ display: "flex", alignItems: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="cb" checked={sel} onChange={e => onSel(e.target.checked)} /></div>
        <div
          className="drag-handle"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.35 }}
          onPointerDown={dragHandlers.onPointerDown}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVerticalIcon size={14} color={T.textDim} />
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <DateTimeCell isoValue={row.scheduledAt} onChange={v => onChange({ scheduledAt: v })} />
        </div>

        <div style={{ minWidth: 0 }} onClick={isEditingTitle ? (e) => e.stopPropagation() : undefined}>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              className="note-in"
              value={row.note}
              placeholder="Post title..."
              onChange={e => onChange({ note: e.target.value })}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setIsEditingTitle(false); if (e.key === "Escape") setIsEditingTitle(false); }}
              title={row.note}
            />
          ) : (
            <div className="note-display" title={row.note || "Untitled post"}>
              {row.note || "Untitled post"}
            </div>
          )}
        </div>

        <div className="row-menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button className="row-menu-trigger" onClick={() => setIsMenuOpen((current) => !current)}>
            <span className="row-menu-dots"><span /><span /><span /></span>
          </button>
          {isMenuOpen && (
            <div className="row-menu-popover">
              <button className="row-menu-option" onClick={() => { setIsMenuOpen(false); setIsEditingTitle(true); }}>
                Edit title
              </button>
            </div>
          )}
        </div>

        <div onClick={(e) => e.stopPropagation()}><button className="plat-pill" onClick={nextP} title={p.label}><PlatformIcon platform={row.platform} size={18} /></button></div>

        {/* Status pill — opens a dropdown instead of cycling */}
        <div onClick={(e) => e.stopPropagation()} ref={statusDropdownRef} style={{ position: "relative" }}>
          <button className="status-pill" onClick={() => setIsStatusDropdownOpen((c) => !c)} title="Change status">
            <span className="s-dot" style={{ background: s.dot }} />{s.label}
          </button>
          {isStatusDropdownOpen && (
            <div className="stage-select-menu" style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, minWidth: 180 }}>
              {statusDropdownItems.map((item) => (
                <button
                  key={item.status}
                  className={"stage-select-option " + (item.isCurrent ? "on" : "")}
                  disabled={item.isCurrent || !item.allowed}
                  style={(!item.allowed && !item.isCurrent) ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                  title={item.reason}
                  onClick={() => handleStatusTransition(item.status)}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span className="s-dot" style={{ background: item.dot, marginRight: 0 }} />
                    {item.label}
                  </span>
                  {item.isCurrent ? <span className="ops-option-mark">Current</span> : null}
                  {!item.isCurrent && !item.allowed ? (
                    <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: T.textDim, marginLeft: "auto", paddingLeft: 8 }}>{item.reason}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ra" onClick={(e) => e.stopPropagation()}>
          {row.comments?.length > 0 && (
            <span style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace", padding: "2px 6px", background: T.s3, borderRadius: 10, border: "1px solid " + T.border, color: T.textDim }}>{row.comments.length}</span>
          )}
          <button className="ib d" title="Delete" onClick={onDel} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <XIcon size={13} color={T.textDim} />
          </button>
        </div>
      </div>

      {/* -- STAGE WELL -- */}
      <div className={"stage-reveal-wrapper " + (isExpanded ? "open" : "")}>
        <div className="stage-content-well">
          <div className="stage-stack">
            <div className="stage-summary">
              <div>
                <div className="stage-summary-title">{row.note || "Untitled post"}</div>
                <div className="stage-summary-meta">
                  <span>{p.label}</span>
                  <span>{STATUSES[row.status]?.label}</span>
                  <span>{readyCount}/{checks.length} ready</span>
                  <span>Updated {updatedLabel}</span>
                </div>
              </div>
              <div className="stage-summary-actions">
                <button className="btn btn-primary" style={{ padding: "8px 12px" }} onClick={() => { onPostNow(); setIsExpanded(false); }}>
                  Post now
                </button>
              </div>
            </div>

            <div className="stage-grid">
              <section className="stage-section">
                <div className="stage-col-label">Media & Placement</div>
                <div style={{display:"flex",gap:12,alignItems:"stretch",flex:1}}>
                {/* Platform selector — vertical list with icons */}
                <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0,width:90}}>
                  {Object.entries(PLATFORMS).map(([key, platform]) => (
                    <button
                      key={key}
                      onClick={() => onChange({ platform: key })}
                      style={{
                        display:"flex",alignItems:"center",gap:6,padding:"6px 8px",
                        borderRadius:8,border:"none",cursor:"pointer",transition:"all 0.1s",
                        background:row.platform===key ? platform.bg : "transparent",
                        color:row.platform===key ? T.text : T.textDim,
                        fontWeight:row.platform===key ? 700 : 500,
                        fontSize:11,textAlign:"left",width:"100%",
                      }}>
                      <PlatformIcon platform={key} size={16}/>
                      <span>{platform.short}</span>
                    </button>
                  ))}
                </div>
                {/* Media content area */}
                <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column"}}>
                {row.platform === "ig_story" ? (
                  <StoryThumbnail elements={storyElements} onClick={onStory} />
                ) : row.platform === "ig_reel" ? (
                  <div style={{display:"flex",flexDirection:"column",flex:1}}>
                    <input ref={mediaRef} type="file" accept="video/*" style={{ display: "none" }}
                      onChange={e => {
                        const picked = Array.from(e.target.files || []);
                        if (!picked.length) return;
                        const f = picked[0];
                        if (f.type.startsWith("video/")) {
                          const url = URL.createObjectURL(f);
                          setMediaUrls([url]);
                          // Read video duration
                          const vid = document.createElement("video");
                          vid.preload = "metadata";
                          vid.onloadedmetadata = () => {
                            onChange({ reelDuration: Math.round(vid.duration) });
                            URL.revokeObjectURL(vid.src);
                          };
                          vid.src = url;
                        }
                        e.target.value = "";
                      }} />
                    {mediaUrls.length > 0 ? (
                      <div className="stage-thumb">
                        <video src={mediaUrls[0]} style={{ width: "100%", borderRadius: 8 }} />
                        <div className="stage-thumb-overlay">
                          <button className="stage-thumb-btn" onClick={() => { setMediaUrls([]); onChange({ reelDuration: null }); }}>Remove</button>
                        </div>
                        {row.reelDuration != null && (
                          <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", padding: "2px 6px", borderRadius: 4 }}>
                            {Math.floor(row.reelDuration / 60)}:{String(row.reelDuration % 60).padStart(2, "0")}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="stage-post-placeholder" onClick={() => mediaRef.current?.click()}>
                        <span style={{ fontSize: 22, opacity: 0.22 }}>&#9654;</span>
                        <span style={{ fontSize: 11.5, color: T.textSub, fontWeight: 500 }}>Upload Reel</span>
                        <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'JetBrains Mono',monospace" }}>9:16 video {"\u00B7"} MP4 {"\u00B7"} MOV</span>
                      </div>
                    )}
                    <div style={{ marginTop: 10 }}>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Audio credit</label>
                      <input
                        className="inp"
                        style={{ width: "100%", fontSize: 12, padding: "7px 10px" }}
                        placeholder="Original audio or song name"
                        value={row.reelAudio || ""}
                        onChange={e => onChange({ reelAudio: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",flex:1}}>
                    <input ref={mediaRef} type="file" accept="image/*,video/*,image/gif" multiple={isLI} style={{ display: "none" }}
                      onChange={e => {
                        const picked = Array.from(e.target.files || []);
                        if (!picked.length) return;
                        if (isLI) {
                          const remaining = maxFiles - mediaUrls.length;
                          const urls = picked.slice(0, remaining).filter(f => f.type.startsWith("image/")).map(f => URL.createObjectURL(f));
                          setMediaUrls(prev => [...prev, ...urls]);
                        } else {
                          const f = picked[0];
                          if (f.type.startsWith("image/") || f.type.startsWith("video/")) setMediaUrls([URL.createObjectURL(f)]);
                        }
                        e.target.value = "";
                      }} />
                    {mediaUrls.length > 0 ? (
                      isLI ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.textDim }}>{mediaUrls.length}/{maxFiles} images</span>
                            <button className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 11 }} onClick={() => setShowLIPreview(true)}>Preview</button>
                          </div>
                          <div className="media-grid">
                            {mediaUrls.map((url, i) => (
                              <div key={i} className="media-grid-item">
                                <img src={url} alt="" />
                                <button className="media-rm" onClick={() => setMediaUrls(prev => prev.filter((_, j) => j !== i))}>
                                  <XIcon size={11} color="#fff" />
                                </button>
                              </div>
                            ))}
                            {mediaUrls.length < maxFiles && (
                              <div className="media-add-btn" onClick={() => mediaRef.current?.click()}>
                                <span>+</span>
                                <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }}>Add</span>
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
                        <span style={{ fontSize: 22, opacity: 0.22 }}>&#8593;</span>
                        <span style={{ fontSize: 11.5, color: T.textSub, fontWeight: 500 }}>Attach media</span>
                        <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'JetBrains Mono',monospace" }}>{isLI ? "Up to 9 images \u00B7 JPG \u00B7 PNG" : "JPG \u00B7 PNG \u00B7 GIF \u00B7 MP4"}</span>
                      </div>
                    )}
                  </div>
                )}
                </div>{/* end media content area */}
                </div>{/* end flex row */}
              </section>

              <section className="stage-section">
                <div className="stage-col-label">Caption</div>
                <textarea className="stage-txa"
                  value={row.caption || ""}
                  placeholder={`Write your ${p.label} caption in a calm, ready-to-publish draft`}
                  onChange={e => onChange({ caption: e.target.value })}
                  rows={5} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: -4 }}>
                  <span className={`stage-char ${over ? "over" : warn ? "warn" : ""}`}>{capLen} / {max}</span>
                </div>
                <AICaptionAssist platform={row.platform} note={row.note} caption={row.caption}
                  onAccept={t => onChange({ caption: t })} variant="inline" />
              </section>
            </div>

            <div className="stage-dual">
              <section className="stage-section">
                <div className="stage-col-label">Comments</div>
                {(row.comments || []).slice(-3).map(c => {
                  const m = TEAM.find(t => t.id === c.author) || { initials: "?", color: T.textDim, name: "Unknown" };
                  return (
                    <div key={c.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 2 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 7, background: m.color + "22", color: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, fontWeight: 700, flexShrink: 0 }}>{m.initials}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 2 }}>{m.name} <span style={{ color: T.textDim, fontWeight: 400, fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>{formatRelativeStamp(c.ts)}</span></div>
                        <div style={{ fontSize: 12.5, color: T.textSub, lineHeight: 1.55, opacity: c.resolved ? 0.45 : 1, textDecoration: c.resolved ? "line-through" : "none" }}>{c.text}</div>
                      </div>
                      <button onClick={() => toggleResolved(c.id)} title={c.resolved ? "Unresolve" : "Resolve"} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0, color: c.resolved ? "#5E6659" : T.textDim, opacity: c.resolved ? 1 : 0.5 }}>
                        <CheckCircle2 size={15} />
                      </button>
                    </div>
                  );
                })}
                {(row.comments || []).length === 0 && <div className="cal-panel-empty" style={{ padding: "10px 0 0" }}>No comments yet. Keep approvals and notes here.</div>}
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <input className="comment-input" style={{ fontSize: 12, padding: "9px 11px" }} placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitComment()} />
                  <button className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 11.5, flexShrink: 0 }} onClick={submitComment}>Send</button>
                </div>
              </section>

              <section className="stage-section">
                <div className="stage-col-label">Approval</div>
                <div className="stage-governance">
                  <div className="stage-select" ref={approvalRef}>
                    <button className="stage-select-trigger" onClick={() => setIsApprovalOpen((current) => !current)}>
                      <span className="stage-select-copy">
                        <span className="stage-select-label">State</span>
                        <span className="stage-select-value">
                          <span className="s-dot" style={{ background: s.dot, marginRight: 0 }} />
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
                          // Only show current and the next forward status
                          // Hide posted (system-only) and backward statuses
                          const isBackward = targetIdx < currentIdx;
                          const isPosted = k === "posted";
                          const isForwardSkip = targetIdx > currentIdx + 1;

                          let itemAllowed = false;
                          let itemReason = "";
                          if (isCurrent) {
                            itemReason = "Current status";
                          } else if (isBackward) {
                            itemReason = "Cannot go backward";
                          } else if (isPosted) {
                            itemReason = "System only";
                          } else if (isForwardSkip) {
                            itemReason = "Cannot skip steps";
                          } else {
                            const check = canTransition(row.status, k, row, hasConnectedAccount);
                            itemAllowed = check.allowed;
                            itemReason = check.reason;
                          }

                          const isDisabled = isCurrent || !itemAllowed;

                          return (
                            <button
                              key={k}
                              className={"stage-select-option " + (isCurrent ? "on" : "")}
                              disabled={isDisabled}
                              style={isDisabled && !isCurrent ? { opacity: 0.45, cursor: "not-allowed" } : {}}
                              title={itemReason}
                              onClick={() => handleApprovalStatusChange(k)}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <span className="s-dot" style={{ background: st.dot, marginRight: 0 }} />
                                {st.label}
                              </span>
                              {isCurrent ? <span className="ops-option-mark">Current</span> : null}
                              {isDisabled && !isCurrent ? (
                                <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: T.textDim, marginLeft: "auto", paddingLeft: 8 }}>{itemReason}</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="stage-mini-stack">
                    <div className="stage-mini-row" onClick={nextAssignee} style={{ cursor: "pointer" }}>
                      <span className="stage-mini-key">Owner</span>
                      <span className="stage-mini-val" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {assignee ? <><div className="av" style={{ width: 16, height: 16, background: assignee.color + "22", color: assignee.color, fontSize: 7, borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{assignee.initials}</div>{assignee.name}</> : "Unassigned"}
                      </span>
                    </div>
                    <div className="stage-mini-row">
                      <span className="stage-mini-key">Updated</span>
                      <span className="stage-mini-val">{updatedLabel}</span>
                    </div>
                    <div className="stage-mini-row">
                      <span className="stage-mini-key">Readiness</span>
                      <span className="stage-mini-val">{readyCount}/{checks.length} ready</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Comment thread (legacy -- only shown when opened from comment button) */}
      {showComments && (
        <div className="thread" style={{ gridColumn: "1/-1" }}>
          {(row.comments || []).length === 0 && <div style={{ fontSize: 12, color: T.textDim }}>No comments yet</div>}
          {(row.comments || []).map(c => { const m = TEAM.find(t => t.id === c.author) || { initials: "?", color: T.textDim, name: "Unknown" }; return (
            <div key={c.id} className="comment" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div className="comment-av" style={{ background: m.color + "22", color: m.color }}>{m.initials}</div>
              <div style={{ flex: 1 }}><div className="comment-meta"><span className="comment-name">{m.name}</span><span className="comment-ts">{formatRelativeStamp(c.ts)}</span></div><div className="comment-text" style={{ opacity: c.resolved ? 0.45 : 1, textDecoration: c.resolved ? "line-through" : "none" }}>{c.text}</div></div>
              <button onClick={() => toggleResolved(c.id)} title={c.resolved ? "Unresolve" : "Resolve"} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0, color: c.resolved ? "#5E6659" : T.textDim, opacity: c.resolved ? 1 : 0.5 }}>
                <CheckCircle2 size={15} />
              </button>
            </div>
          ); })}
          <div className="comment-input-row">
            <input className="comment-input" placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitComment()} />
            <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={submitComment}>Send</button>
          </div>
        </div>
      )}
    </div>
    {showLIPreview && <LinkedInPreview caption={row.caption} mediaUrls={mediaUrls} onClose={() => setShowLIPreview(false)} />}
    </>
  );
}
