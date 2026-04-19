import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  T,
  PLATFORMS,
  STATUSES,
  isRowNeedingAttention,
} from "../shared.js";
import { DateTimeCell } from "./DateTimeCell.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { canTransition, getAvailableTransitions } from "./StatusMachine.js";
import { useOutsideClick } from "../useOutsideClick.js";
import { AlertTriangle, Close as X, GripVertical } from "../../../components/icons/index.jsx";

export const Row = React.memo(function Row({ row, sel, onSel, onChange, onDel, onSelect, isSelected, isFocused, dragHandlers, hasConnectedAccount = false }) {
  const p = PLATFORMS[row.platform], s = STATUSES[row.status];
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const titleInputRef = useRef(null);
  const menuRef = useRef(null);
  const platformRef = useRef(null);
  const statusDropdownRef = useRef(null);

  const needsAttention = isRowNeedingAttention(row);

  const availableTransitions = getAvailableTransitions(row, hasConnectedAccount);

  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  useOutsideClick(menuRef, isMenuOpen, useCallback(() => setIsMenuOpen(false), []));
  useOutsideClick(platformRef, isPlatformOpen, useCallback(() => setIsPlatformOpen(false), []));
  useOutsideClick(
    statusDropdownRef,
    isStatusDropdownOpen,
    useCallback(() => setIsStatusDropdownOpen(false), []),
  );

  const handleStatusTransition = (toStatus) => {
    const check = canTransition(row.status, toStatus, row, hasConnectedAccount);
    if (check.allowed) onChange({ status: toStatus });
    setIsStatusDropdownOpen(false);
  };

  const statusDropdownItems = (() => {
    const items = [];
    items.push({
      status: row.status,
      label: s.label,
      dot: s.dot,
      isCurrent: true,
      allowed: false,
      reason: "Current status",
    });
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
    <div className={`t-row ${sel ? "sel" : ""} ${isSelected ? "row-selected" : ""} ${isFocused ? "row-focused" : ""} ${dragHandlers.isDragging ? "dragging" : ""} ${dragHandlers.isDragOver ? "drag-over" : ""}`}
      style={{
        // Status-as-left-stripe — the row carries its own status color as
        // a 3px left rule so the queue scans by hue without needing the
        // status pill in peripheral vision.
        "--row-stripe": s.dot,
        ...(isMenuOpen || isStatusDropdownOpen || isPlatformOpen ? { zIndex: 20 } : null),
      }}
      onMouseEnter={dragHandlers.onMouseEnter}
      onClick={() => { if (!isEditingTitle) onSelect(); }}>
      <div className="row-cb-wrap" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="cb" checked={sel} onChange={e => onSel(e.target.checked)} /></div>
      <div
        className="drag-handle row-drag-wrap"
        onPointerDown={dragHandlers.onPointerDown}
        onClick={(e) => e.stopPropagation()}
        title="Drag to reorder"
      >
        <GripVertical size={14} color={T.textDim} />
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <DateTimeCell isoValue={row.scheduledAt} onChange={v => onChange({ scheduledAt: v })} />
      </div>

      <div className="row-title-wrap" onClick={isEditingTitle ? (e) => e.stopPropagation() : undefined}>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="note-in"
            value={row.note}
            placeholder="Post title\u2026"
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

      {/* Platform pill */}
      <div onClick={(e) => e.stopPropagation()} ref={platformRef} className="row-dropdown-anchor">
        <button className="plat-pill" onClick={() => setIsPlatformOpen((c) => !c)} title={p.label}>
          <PlatformIcon platform={row.platform} size={18} />
        </button>
        {isPlatformOpen && (
          <div className="popover-menu">
            {Object.entries(PLATFORMS).map(([key, platform]) => (
              <button
                key={key}
                className={"popover-menu-item " + (row.platform === key ? "active" : "")}
                onClick={() => { onChange({ platform: key }); setIsPlatformOpen(false); }}
              >
                <span className="row-option-content">
                  <PlatformIcon platform={key} size={16} />
                  {platform.label}
                </span>
                {row.platform === key ? <span className="ops-option-mark">Current</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status pill */}
      <div onClick={(e) => e.stopPropagation()} ref={statusDropdownRef} className="row-dropdown-anchor">
        <button
          className="status-pill"
          onClick={() => setIsStatusDropdownOpen((c) => !c)}
          title={`${s.label} — ${s.description}`}
        >
          <span className="s-dot" style={{ background: s.dot }} />{s.label}
        </button>
        {isStatusDropdownOpen && (
          <div className="popover-menu popover-menu-wide">
            {statusDropdownItems.map((item) => (
              <button
                key={item.status}
                className={"popover-menu-item " + (item.isCurrent ? "active" : "") + ((!item.allowed && !item.isCurrent) ? " row-option-disabled" : "")}
                disabled={item.isCurrent || !item.allowed}
                title={item.reason}
                onClick={() => handleStatusTransition(item.status)}
              >
                <span className="row-option-content">
                  <span className="s-dot" style={{ background: item.dot }} />
                  <span className="row-option-text">
                    <span className="row-option-label">{item.label}</span>
                    {STATUSES[item.status]?.description && (
                      <span className="row-option-desc">{STATUSES[item.status].description}</span>
                    )}
                  </span>
                </span>
                {item.isCurrent ? <span className="ops-option-mark">Current</span> : null}
                {!item.isCurrent && !item.allowed ? (
                  <span className="row-disabled-reason">{item.reason}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
        {needsAttention && (
          <span title="Needs attention — missing caption, media, owner, or approval">
            <AlertTriangle size={13} color={T.amber} className="row-attention-icon" />
          </span>
        )}
      </div>

      <div className="ra" onClick={(e) => e.stopPropagation()}>
        {row.comments?.length > 0 && (
          <span
            className="row-comment-count"
            title={`${row.comments.length} comment${row.comments.length === 1 ? "" : "s"}`}
          >
            {row.comments.length}
          </span>
        )}
        <button className="ib d row-action-btn" title="Delete post" onClick={onDel}>
          <X size={13} color={T.textDim} />
        </button>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.row === next.row &&
    prev.sel === next.sel &&
    prev.isSelected === next.isSelected &&
    prev.isFocused === next.isFocused &&
    prev.hasConnectedAccount === next.hasConnectedAccount &&
    prev.dragHandlers.isDragging === next.dragHandlers.isDragging &&
    prev.dragHandlers.isDragOver === next.dragHandlers.isDragOver
  );
});
