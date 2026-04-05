import React, { useState, useEffect, useRef } from "react";
import { T } from "../features/studio/shared.js";

function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return "Not saved yet";
  }

  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 5_000) return "Just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatAbsoluteTime(timestamp) {
  if (!timestamp) return "Never saved";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

export function SaveStatusBadge({ saveState, isOnline = true }) {
  const status = saveState?.status || "idle";
  const [relTime, setRelTime] = useState(() => formatRelativeTime(saveState?.lastSavedAt));
  const [showConflictResolved, setShowConflictResolved] = useState(false);
  const prevStatusRef = useRef(status);
  const [showTooltip, setShowTooltip] = useState(false);

  // Track conflict resolution: when status goes from saving -> saved after a conflict
  useEffect(() => {
    if (prevStatusRef.current === "saving" && status === "saved" && saveState?._conflictResolved) {
      setShowConflictResolved(true);
      const id = setTimeout(() => setShowConflictResolved(false), 3000);
      return () => clearTimeout(id);
    }
    prevStatusRef.current = status;
  }, [status, saveState]);

  // Refresh relative time every 15s
  useEffect(() => {
    setRelTime(formatRelativeTime(saveState?.lastSavedAt));
    const id = setInterval(() => {
      setRelTime(formatRelativeTime(saveState?.lastSavedAt));
    }, 15_000);
    return () => clearInterval(id);
  }, [saveState?.lastSavedAt]);

  // Determine effective display status
  const effectiveStatus = !isOnline && status !== "error"
    ? "offline"
    : showConflictResolved
      ? "conflict_resolved"
      : status;

  const ui = {
    idle: { label: "Local draft", color: T.textDim, bg: T.s3, dot: T.textDim },
    saving: { label: "Saving...", color: T.blue, bg: "rgba(37,99,235,0.08)", dot: T.blue },
    saved: { label: `Saved ${relTime}`, color: T.ink, bg: T.s3, dot: "#22c55e" },
    error: { label: "Save failed", color: T.red, bg: "rgba(220,38,38,0.08)", dot: T.red },
    offline: { label: "Offline", color: T.amber, bg: "rgba(201,106,18,0.08)", dot: T.amber },
    syncing: { label: "Syncing...", color: T.blue, bg: "rgba(37,99,235,0.08)", dot: T.blue },
    conflict_resolved: { label: "Conflict resolved", color: "#22c55e", bg: "rgba(34,197,94,0.08)", dot: "#22c55e" },
  }[effectiveStatus] || { label: effectiveStatus, color: T.textDim, bg: T.s3, dot: T.textDim };

  const tooltipText = (() => {
    if (saveState?.error) return saveState.error;
    if (effectiveStatus === "offline") return "Network unavailable. Changes are saved locally and will sync when reconnected.";
    if (effectiveStatus === "syncing") return "Replaying offline changes to the server...";
    if (effectiveStatus === "conflict_resolved") return "A version conflict was detected and resolved automatically.";
    if (effectiveStatus === "error") return "Save failed. Your changes are stored locally in the browser.";
    if (effectiveStatus === "saved") return `Last saved: ${formatAbsoluteTime(saveState?.lastSavedAt)}`;
    if (effectiveStatus === "saving") return "Writing changes to server...";
    return "Browser-backed studio workspace";
  })();

  const isPulsing = effectiveStatus === "saving" || effectiveStatus === "syncing";
  const badgeClass = `save-badge ${effectiveStatus === "offline" ? "offline" : ""} ${isPulsing ? "syncing" : ""}`.trim();

  return (
    <div
      className={badgeClass}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.2,
        color: ui.color,
        background: ui.bg,
        border: `1px solid ${effectiveStatus === "error" ? "rgba(220,38,38,0.18)" : effectiveStatus === "offline" ? "rgba(201,106,18,0.18)" : T.border}`,
        cursor: "default",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: ui.dot,
          flexShrink: 0,
        }}
      />
      <span>{ui.label}</span>
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 200,
            maxWidth: 280,
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.4,
            color: T.ink,
            background: T.surface,
            border: `1px solid ${T.border}`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            zIndex: 9999,
            whiteSpace: "normal",
            pointerEvents: "none",
          }}
        >
          {tooltipText}
        </div>
      )}
    </div>
  );
}
