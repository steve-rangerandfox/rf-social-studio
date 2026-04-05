import React from "react";
import { useStudio } from "../StudioContext.jsx";
import { YearlyKPISummary } from "./YearlyKPISummary.jsx";

export function StatsBar() {
  const {
    view, timeScale, rows, year, sorted,
    igC, liC, reviewC, readyC,
    jumpToStatsFilter,
  } = useStudio();

  if (view !== "list") return null;

  if (timeScale === "year") {
    return <YearlyKPISummary rows={rows} year={year} />;
  }

  return (
    <div className="stats">
      {[
        { val: sorted.length, key: "Total posts", onClick: () => jumpToStatsFilter({}) },
        { val: igC, key: "Instagram", onClick: () => jumpToStatsFilter({ platform: "instagram" }) },
        { val: liC, key: "LinkedIn", onClick: () => jumpToStatsFilter({ platform: "linkedin" }) },
        { val: reviewC, key: "Needs review", onClick: () => jumpToStatsFilter({ status: "needs_review" }) },
        { val: readyC, key: "Ready", onClick: () => jumpToStatsFilter({ status: "ready" }) },
      ].map((s, i) => (
        <button key={i} className="stat clickable" onClick={s.onClick}>
          <div className="stat-val">{s.val}</div>
          <div className="stat-key">{s.key}</div>
        </button>
      ))}
    </div>
  );
}
