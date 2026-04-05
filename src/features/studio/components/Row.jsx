import React, { useState, useRef, useEffect } from "react";
import {
  T,
  PLATFORMS,
  STATUSES,
  isRowNeedingAttention,
} from "../shared.js";
import { DateTimeCell } from "./DateTimeCell.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { canTransition, getAvailableTransitions } from "./StatusMachine.js";
import { AlertTriangle, X, GripVertical } from "lucide-react";

export const Row = React.memo(function Row({ row, sel, onSel, onChange, onDel, onSelect, isSelected, dragHandlers, hasConnectedAccount = false }) {
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

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isPlatformOpen) return undefined;
    const handlePointerDown = (event) => {
      if (platformRef.current && !platformRef.current.contains(event.target)) setIsPlatformOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isPlatformOpen]);

  useEffect(() => {
    if (!isStatusDropdownOpen) return undefined;
    const handlePointerDown = (event) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) setIsStatusDropdownOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isStatusDropdownOpen]);

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
    <div className={`t-row ${sel ? "sel" : ""} ${isSelected ? "row-selected" : ""} ${dragHandlers.isDragging ? "dragging" : ""} ${dragHandlers.isDragOver ? "drag-over" : ""}`}
      style={isMenuOpen || isStatusDropdownOpen || isPlatformOpen ? { zIndex: 20 } : undefined}
      onMouseEnter={dragHandlers.onMouseEnter}
      onClick={() => { if (!isEditingTitle) onSelect(); }}>
      <div className="row-cb-wrap" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="cb" checked={sel} onChange={e => onSel(e.target.checked)} /></div>
      <div
        className="drag-handle row-drag-wrap"
        onPointerDown={dragHandlers.onPointerDown}
        onClick={(e) => e.stopPropagation()}
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
        <button className="status-pill" onClick={() => setIsStatusDropdownOpen((c) => !c)} title="Change status">
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
                  <span className="s-dot" style={{ background: item.dot, marginRight: 0 }} />
                  {item.label}
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
          <AlertTriangle size={13} color={T.amber} className="row-attention-icon" />
        )}
      </div>

      <div className="ra" onClick={(e) => e.stopPropagation()}>
        {row.comments?.length > 0 && (
          <span className="row-comment-count">{row.comments.length}</span>
        )}
        <button className="ib d row-action-btn" title="Delete" onClick={onDel}>
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
    prev.hasConnectedAccount === next.hasConnectedAccount &&
    prev.dragHandlers.isDragging === next.dragHandlers.isDragging &&
    prev.dragHandlers.isDragOver === next.dragHandlers.isDragOver
  );
});
