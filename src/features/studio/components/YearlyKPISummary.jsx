import React from "react";
import { T } from "../shared.js";

export function YearlyKPISummary({ rows, year }) {
  const yr = rows.filter(r => r.scheduledAt && new Date(r.scheduledAt).getFullYear() === year);
  const total     = yr.length;
  const posted    = yr.filter(r => r.status==='posted').length;
  const scheduled = yr.filter(r => r.status==='scheduled'||r.status==='approved').length;
  const igCount   = yr.filter(r => r.platform.startsWith('ig')).length;
  const liCount   = yr.filter(r => r.platform==='linkedin').length;
  const pct = (v) => total > 0 ? Math.round((v/total)*100) : 0;

  const stats = [
    { val:total,     label:"Yearly Total",      color:T.text,   fill:100 },
    { val:posted,    label:"Successfully Posted",color:T.ink,   fill:pct(posted) },
    { val:scheduled, label:"Approved / Sched",  color:T.blue,   fill:pct(scheduled) },
    { val:igCount,   label:"Instagram",          color:T.pink,   fill:pct(igCount) },
    { val:liCount,   label:"LinkedIn",           color:T.blue,   fill:pct(liCount) },
  ];

  return (
    <div className="year-kpi">
      {stats.map((s,i) => (
        <div key={i} className="year-kpi-item">
          <div className="year-kpi-val" style={{color:s.color}}>{s.val}</div>
          <div className="year-kpi-label">{s.label}</div>
          <div className="year-kpi-bar">
            <div className="year-kpi-bar-fill" style={{width:`${s.fill}%`,background:s.color}}/>
          </div>
        </div>
      ))}
    </div>
  );
}
