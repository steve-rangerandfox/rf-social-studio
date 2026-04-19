import React from "react";
import { Menu, Sparkles } from "lucide-react";
import { useStudio } from "../StudioContext.jsx";
import { SaveStatusBadge } from "../../../components/SaveStatusBadge.jsx";
import { MONTHS_FULL } from "../shared.js";

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
          <Sparkles size={12} style={{ marginRight: 4 }} />
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
        {[["list", "List", "1"], ["calendar", "Calendar", "2"], ["grid", "Grid", "3"], ["analytics", "Analytics", "4"]].map(([v, l, key]) => (
          <button key={v} className={"vt-btn " + (view === v ? "on" : "")} onClick={() => setView(v)} title={`${l} (${key})`}>
            <span className="vt-btn-num">0{key}</span>
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
