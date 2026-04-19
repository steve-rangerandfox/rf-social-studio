import React from "react";

// Per-surface skeletons. Each one mirrors the actual layout it stands
// in for so the loading state reads as "the surface is composing
// itself" rather than a generic shimmer block. Mirrors the editorial
// state-language spec in AESTHETIC-AUDIT.md §2 TELL #7.
//
// .skeleton-bar carries the shimmer animation; it lives in studio.css.

// 7-column calendar grid skeleton — matches CalendarView's structure
// so the transition into the real view is shape-stable.
export function CalendarSkeleton() {
  const cells = Array.from({ length: 35 });
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="cal-area" aria-hidden="true">
      <div className="cal-shell">
        <div className="cal-main">
          <div className="cal-topline">
            <div>
              <div className="skeleton-bar" style={{ width: 220, height: 28, borderRadius: 6 }} />
              <div className="skeleton-bar" style={{ width: 320, height: 12, borderRadius: 4, marginTop: 10 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skeleton-bar" style={{ width: 28, height: 28, borderRadius: 8 }} />
              <div className="skeleton-bar" style={{ width: 28, height: 28, borderRadius: 8 }} />
            </div>
          </div>
          <div className="cal-header">
            {days.map((d) => <div key={d} className="cal-wd">{d}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((_, i) => (
              <div key={i} className="cal-cell" style={{ pointerEvents: "none" }}>
                <div className="cal-cell-head">
                  <div className="skeleton-bar" style={{ width: 18, height: 14, borderRadius: 4 }} />
                </div>
                {/* Distribute placeholder chips like a real busy week. */}
                {(i % 5 === 1 || i % 7 === 3) && (
                  <div className="skeleton-bar" style={{ width: "78%", height: 18, borderRadius: 8, marginTop: 6 }} />
                )}
                {i % 6 === 2 && (
                  <div className="skeleton-bar" style={{ width: "60%", height: 18, borderRadius: 8, marginTop: 4 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 3-column 1:1 grid — matches IGGridView.
export function GridSkeleton({ count = 12 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 4,
        padding: 24,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-bar"
          style={{ aspectRatio: "1", borderRadius: 4 }}
        />
      ))}
    </div>
  );
}

// Analytics — one typographic-number block + chart bars. Matches the
// editorial-column layout (max-width 880).
export function AnalyticsSkeleton() {
  return (
    <div className="analytics-area" aria-hidden="true">
      <div className="analytics-hero">
        <div className="skeleton-bar" style={{ width: 320, height: 36, borderRadius: 6 }} />
        <div className="skeleton-bar" style={{ width: 480, height: 14, borderRadius: 4, marginTop: 12 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="skeleton-bar" style={{ width: 80, height: 56, borderRadius: 6 }} />
            <div className="skeleton-bar" style={{ width: 120, height: 10, borderRadius: 3, marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 140, marginTop: 16 }}>
        {[0.6, 0.85, 0.45, 0.95, 0.7, 0.5, 0.8].map((h, i) => (
          <div
            key={i}
            className="skeleton-bar"
            style={{ flex: 1, height: `${h * 100}%`, borderRadius: 4 }}
          />
        ))}
      </div>
    </div>
  );
}

// DetailPanel — title + readiness rows. Used while a row's data hydrates.
export function DetailPanelSkeleton() {
  return (
    <div style={{ padding: 24 }} aria-hidden="true">
      <div className="skeleton-bar" style={{ width: "68%", height: 28, borderRadius: 6 }} />
      <div className="skeleton-bar" style={{ width: "40%", height: 12, borderRadius: 4, marginTop: 10 }} />
      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="skeleton-bar" style={{ width: 22, height: 22, borderRadius: "50%" }} />
            <div className="skeleton-bar" style={{ flex: 1, height: 14, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Hairline progress at the top of <main> — used for global pending
// state (e.g. background AI requests). Slow indeterminate sweep.
export function HairlineProgress() {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 2,
        overflow: "hidden",
        zIndex: 50,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <div
        style={{
          height: "100%",
          width: "30%",
          background: "var(--t-orange-bright)",
          opacity: 0.6,
          animation: "rfHairlineSweep 1.6s cubic-bezier(0.65,0,0.35,1) infinite",
        }}
      />
      <style>{`
        @keyframes rfHairlineSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
