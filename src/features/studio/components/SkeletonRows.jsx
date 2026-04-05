import React from "react";

export function SkeletonRows({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="t-row" style={{ pointerEvents: "none" }}>
          {/* checkbox col */}
          <div />
          {/* drag handle col */}
          <div />
          {/* date badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="skeleton-bar" style={{ width: 48, height: 52, borderRadius: 16 }} />
          </div>
          {/* title */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 8px" }}>
            <div className="skeleton-bar" style={{ width: "70%", height: 14 }} />
            <div className="skeleton-bar" style={{ width: "40%", height: 10 }} />
          </div>
          {/* platform icon */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="skeleton-bar" style={{ width: 28, height: 28, borderRadius: "50%" }} />
          </div>
          {/* spacer */}
          <div />
          {/* status pill */}
          <div>
            <div className="skeleton-bar" style={{ width: 80, height: 24, borderRadius: 999 }} />
          </div>
          {/* actions */}
          <div />
        </div>
      ))}
    </>
  );
}
