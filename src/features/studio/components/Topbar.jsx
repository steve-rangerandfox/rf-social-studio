import React from "react";
import { AIMark, Menu } from "../../../components/icons/index.jsx";
import { useStudio } from "../StudioContext.jsx";
import { SaveStatusBadge } from "../../../components/SaveStatusBadge.jsx";
import { MONTHS_FULL } from "../shared.js";

function ViewIcon({ view }) {
  const p = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  if (view === "calendar") return (<svg {...p}><rect x="2.5" y="3" width="11" height="10.5" rx="1.5" /><path d="M2.5 6h11M5.5 1.5v3M10.5 1.5v3" /></svg>);
  if (view === "grid") return (<svg {...p}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></svg>);
  return (<svg {...p}><path d="M3 4h10M3 8h10M3 12h10" /></svg>);
}

export function Topbar({ onOpenNav, onOpenStrategy }) {
  const {
    timeScale, month, year, view, setView,
    saveState, showAssets, setAssets, isOnline, setCommandPalette,
  } = useStudio();

  return (
    <div className="topbar">
      {onOpenNav && (
        <button
          type="button"
          className="nav-drawer-trigger"
          onClick={onOpenNav}
          aria-label="Open navigation"
          title="Menu"
        >
          <Menu size={16} />
        </button>
      )}
      {timeScale === "year"
        ? <><span className="tb-month">Year View</span><span className="tb-year">{year}</span></>
        : <><span className="tb-month">{MONTHS_FULL[month]}</span><span className="tb-year">{year}</span></>
      }
      <div className="tb-space" />
      {onOpenStrategy && (
        <button
          type="button"
          className="btn btn-ghost btn-sm topbar-plan-btn"
          onClick={onOpenStrategy}
          title="Plan the month with AI"
        >
          <AIMark size={12} style={{ marginRight: 4 }} />
          Plan month
        </button>
      )}
      <SaveStatusBadge saveState={saveState} isOnline={isOnline} />
      <button
        type="button"
        className="topbar-cmdk-hint"
        onClick={() => setCommandPalette(true)}
        title={"Open command palette (\u2318K)"}
      >
        <kbd>{"\u2318"}</kbd>K
      </button>
      <div className="view-toggle">
        {[["calendar", "Calendar"], ["list", "Queue"], ["grid", "Grid"]].map(([v, l]) => (
          <button key={v} className={"vt-btn " + (view === v ? "on" : "")} onClick={() => setView(v)} title={l}>
            <ViewIcon view={v} />
            <span className="vt-btn-label">{l}</span>
          </button>
        ))}
      </div>
      <button
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "6px 12px" }}
        onClick={() => setAssets(v => !v)}
        title="Toggle asset library"
      >
        {showAssets ? "Assets \u2715" : "Assets"}
      </button>
    </div>
  );
}
