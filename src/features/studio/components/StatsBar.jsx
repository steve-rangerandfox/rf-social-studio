import React from "react";
import { useStudio } from "../StudioContext.jsx";
import { YearlyKPISummary } from "./YearlyKPISummary.jsx";

export function StatsBar() {
  const {
    view, timeScale, rows, year, sorted,
    reviewC, readyC,
  } = useStudio();

  if (view !== "list") return null;

  if (timeScale === "year") {
    return <YearlyKPISummary rows={rows} year={year} />;
  }

  return (
    <div className="stats-compact">
      <span className="stats-compact-item"><strong>{sorted.length}</strong> posts</span>
      <span className="stats-compact-dot" />
      <span className="stats-compact-item"><strong>{readyC}</strong> ready</span>
      {reviewC > 0 && (
        <>
          <span className="stats-compact-dot" />
          <span className="stats-compact-item stats-compact-attention"><strong>{reviewC}</strong> needs review</span>
        </>
      )}
    </div>
  );
}
