import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useStudio } from "../StudioContext.jsx";
import { YearlyKPISummary } from "./YearlyKPISummary.jsx";

export function StatsBar() {
  const {
    view, timeScale, rows, year, sorted,
    igC, liC, reviewC, readyC,
    jumpToStatsFilter,
  } = useStudio();

  const [expanded, setExpanded] = useState(false);

  if (view !== "list") return null;

  if (timeScale === "year") {
    return <YearlyKPISummary rows={rows} year={year} />;
  }

  if (!expanded) {
    return (
      <button className="stats-compact" onClick={() => setExpanded(true)}>
        <span className="stats-compact-item"><strong>{sorted.length}</strong> posts</span>
        <span className="stats-compact-dot" />
        <span className="stats-compact-item"><strong>{readyC}</strong> ready</span>
        {reviewC > 0 && (
          <>
            <span className="stats-compact-dot" />
            <span className="stats-compact-item stats-compact-attention"><strong>{reviewC}</strong> needs review</span>
          </>
        )}
        <ChevronDown size={12} className="stats-compact-chevron" />
      </button>
    );
  }

  return (
    <div className="stats" style={{ position: "relative" }}>
      <button className="stats-collapse-btn" onClick={() => setExpanded(false)}>
        <ChevronUp size={12} />
      </button>
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
