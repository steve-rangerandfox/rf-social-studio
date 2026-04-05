import React from "react";
import { useStudio } from "../StudioContext.jsx";
import { SaveStatusBadge } from "../../../components/SaveStatusBadge.jsx";
import { MONTHS_FULL } from "../shared.js";

export function Topbar() {
  const {
    timeScale, month, year, view, setView,
    saveState, showAssets, setAssets, isOnline,
  } = useStudio();

  return (
    <div className="topbar">
      {timeScale === "year"
        ? <><span className="tb-month">Year View</span><span className="tb-year">{year}</span></>
        : <><span className="tb-month">{MONTHS_FULL[month]}</span><span className="tb-year">{year}</span></>
      }
      <div className="tb-space" />
      <SaveStatusBadge saveState={saveState} isOnline={isOnline} />
      <div className="view-toggle">
        {[["list", "List", "1"], ["calendar", "Cal", "2"], ["grid", "Grid", "3"], ["analytics", "Stats", "4"]].map(([v, l, key]) => (
          <button key={v} className={"vt-btn " + (view === v ? "on" : "")} onClick={() => setView(v)} title={`${l} (${key})`}>{l}</button>
        ))}
      </div>
      <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setAssets(v => !v)}>
        {showAssets ? "Assets \u2715" : "Assets"}
      </button>
    </div>
  );
}
