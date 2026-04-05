import React from "react";

export function EmptyState({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state-graphic">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="12" y="20" width="56" height="40" rx="8" stroke="var(--t-border2)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" opacity="0.5" />
          <line x1="24" y1="34" x2="56" y2="34" stroke="var(--t-border2)" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
          <line x1="24" y1="42" x2="48" y2="42" stroke="var(--t-border2)" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
          <circle cx="40" cy="52" r="3" fill="none" stroke="var(--t-border2)" strokeWidth="1.5" opacity="0.3" />
        </svg>
      </div>
      <div className="empty-state-title">{title}</div>
      {subtitle && <div className="empty-state-sub">{subtitle}</div>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction} style={{ marginTop: 8 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
