import React, { useState, useRef, useCallback } from "react";
import {
  T,
  PLATFORMS,
  STATUSES,
  MONTHS_SHORT,
  toPTDisplay,
  isRowNeedingAttention,
} from "../shared.js";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { DateTimePicker } from "./DateTimePicker.jsx";
import { canTransition, getAvailableTransitions } from "./StatusMachine.js";
import { useOutsideClick } from "../useOutsideClick.js";
import { AlertTriangle } from "../../../components/icons/index.jsx";

// Drag grip — 6-dot SVG, matches the Relay handoff (right-aligned, hover-only).
function Grip() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      {[[6, 4], [10, 4], [6, 8], [10, 8], [6, 12], [10, 12]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.9" fill="currentColor" />
      ))}
    </svg>
  );
}

export const Row = React.memo(function Row({ row, sel, onSel, onChange, onSchedule, onSelect, isSelected, isFocused, dragHandlers, hasConnectedAccount = false }) {
  const s = STATUSES[row.status];
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const dateRef = useRef(null);
  const platformRef = useRef(null);
  const statusDropdownRef = useRef(null);

  const needsAttention = isRowNeedingAttention(row);
  const disp = row.scheduledAt ? toPTDisplay(row.scheduledAt) : null;
  const monthLabel = disp ? MONTHS_SHORT[Math.max(0, Number(disp.month) - 1)] : null;
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const mediaNote = row.platform === "ig_reel"
    ? "· reel"
    : Array.isArray(row.carouselSlides) && row.carouselSlides.length >= 2
      ? `· ${row.carouselSlides.length}-card carousel`
      : "";
  const platforms = Array.isArray(row.platforms) && row.platforms.length ? row.platforms : [row.platform];

  const availableTransitions = getAvailableTransitions(row, hasConnectedAccount);

  useOutsideClick(dateRef, isPickerOpen, useCallback(() => setIsPickerOpen(false), []));
  useOutsideClick(platformRef, isPlatformOpen, useCallback(() => setIsPlatformOpen(false), []));
  useOutsideClick(
    statusDropdownRef,
    isStatusDropdownOpen,
    useCallback(() => setIsStatusDropdownOpen(false), []),
  );

  const handleStatusTransition = (toStatus) => {
    const check = canTransition(row.status, toStatus, row, hasConnectedAccount);
    if (check.allowed) {
      // Scheduling goes through the canonical operation so legacy carousels are
      // materialized before scheduled state is persisted.
      if (toStatus === "scheduled" && onSchedule) onSchedule(row.scheduledAt);
      else onChange({ status: toStatus });
    }
    setIsStatusDropdownOpen(false);
  };

  const statusDropdownItems = (() => {
    const items = [{
      status: row.status,
      label: s.label,
      dot: s.dot,
      isCurrent: true,
      allowed: false,
      reason: "Current status",
    }];
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

  const openPicker = (e) => { e.stopPropagation(); setIsPickerOpen((c) => !c); };

  return (
    <div className={`t-row ${sel ? "sel" : ""} ${isSelected ? "row-selected" : ""} ${isFocused ? "row-focused" : ""} ${dragHandlers.isDragging ? "dragging" : ""} ${dragHandlers.isDragOver ? "drag-over" : ""}`}
      style={{
        "--row-stripe": s.dot,
        ...(isStatusDropdownOpen || isPlatformOpen || isPickerOpen ? { zIndex: 20 } : null),
      }}
      onMouseEnter={dragHandlers.onMouseEnter}
      onClick={onSelect}>

      {/* Checkbox */}
      <div className="row-cb-wrap" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="cb" checked={sel} onChange={e => onSel(e.target.checked)} />
      </div>

      {/* Date badge */}
      <div className="row-dropdown-anchor" ref={dateRef} onClick={(e) => e.stopPropagation()}>
        <button className="dt-badge" onClick={openPicker} title="Edit date & time">
          {disp ? (
            <>
              <span className="dt-badge-month">{monthLabel}</span>
              <span className="dt-badge-day">{disp.day}</span>
            </>
          ) : <span className="dt-badge-empty">+</span>}
        </button>
        {isPickerOpen && (
          <DateTimePicker isoValue={row.scheduledAt} onChange={v => onChange({ scheduledAt: v })} onClose={() => setIsPickerOpen(false)} anchorRef={dateRef} />
        )}
      </div>

      {/* Time */}
      <div className="row-time" onClick={openPicker}>
        <span className="dt-time">{disp ? `${disp.hour}:${disp.minute} ${disp.ampm}` : "—"}</span>
      </div>

      {/* Post (title + meta) */}
      <div className="row-cap">
        <div className="note-display" title={row.note || "Untitled post"}>{row.note || "Untitled post"}</div>
        {(tags.length > 0 || mediaNote) && (
          <div className="row-meta">
            {tags.slice(0, 2).map((t) => (<span key={t} className="row-tag">#{t}</span>))}
            {mediaNote && <span className="row-meta-media">{mediaNote}</span>}
          </div>
        )}
      </div>

      {/* Channels (multi-select) */}
      <div onClick={(e) => e.stopPropagation()} ref={platformRef} className="row-dropdown-anchor">
        <button className="plat-pill" onClick={() => setIsPlatformOpen((c) => !c)} title={platforms.map((pl) => PLATFORMS[pl]?.short).join(", ")}>
          {platforms.map((pl) => <PlatformIcon key={pl} platform={pl} size={20} />)}
        </button>
        {isPlatformOpen && (
          <div className="popover-menu">
            {Object.entries(PLATFORMS).filter(([key]) => key !== "ig_story").map(([key, platform]) => {
              const on = platforms.includes(key);
              return (
                <button
                  key={key}
                  className={"popover-menu-item " + (on ? "active" : "")}
                  onClick={() => {
                    let next = on ? platforms.filter((x) => x !== key) : [...platforms, key];
                    if (next.length === 0) next = [key];
                    onChange({ platforms: next, platform: next[0] });
                  }}
                >
                  <span className="row-option-content">
                    <PlatformIcon platform={key} size={16} />
                    {platform.label}
                  </span>
                  {on ? <span className="ops-option-mark">On</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Status */}
      <div onClick={(e) => e.stopPropagation()} ref={statusDropdownRef} className="row-dropdown-anchor row-status-cell">
        <button
          className="status-pill"
          onClick={() => setIsStatusDropdownOpen((c) => !c)}
          title={`${s.label} — ${s.description}`}
        >
          <span className="s-dot" style={{ background: s.dot }} />{s.label}
        </button>
        {row.publishError && row.status !== "posted" && (
          <span title={`Publishing failed: ${row.publishError}`}>
            <AlertTriangle size={13} color={T.red} className="row-attention-icon" />
          </span>
        )}
        {needsAttention && !(row.publishError && row.status !== "posted") && (
          <span title="Needs attention — missing caption, media, owner, or approval">
            <AlertTriangle size={13} color={T.amber} className="row-attention-icon" />
          </span>
        )}
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
      </div>

      {/* Drag grip (hover-only, right) */}
      <div
        className="row-grip"
        onPointerDown={dragHandlers.onPointerDown}
        onClick={(e) => e.stopPropagation()}
        title="Drag to reorder"
      >
        <Grip />
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
