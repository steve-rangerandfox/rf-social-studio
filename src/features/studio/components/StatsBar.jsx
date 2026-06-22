import React from "react";
import { useStudio } from "../StudioContext.jsx";
import { YearlyKPISummary } from "./YearlyKPISummary.jsx";

export function StatsBar() {
  const { view, timeScale, rows, year } = useStudio();

  // Month-scale stats now live in the editorial header inside ListView.
  // Keep the year-scale KPI summary here.
  if (view !== "list" || timeScale !== "year") return null;

  return <YearlyKPISummary rows={rows} year={year} />;
}
