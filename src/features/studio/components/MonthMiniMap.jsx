import React from "react";
import { MONTHS_FULL } from "../shared.js";

const MONTH_INITIALS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

export function MonthMiniMap({ rows, year, currentMonth, onJump }) {
  const counts = MONTH_INITIALS.map((_, i) =>
    rows.filter(r => {
      if (!r.scheduledAt) return false;
      const d = new Date(r.scheduledAt);
      return d.getFullYear()===year && d.getMonth()===i;
    }).length
  );
  return (
    <div className="minimap">
      {MONTH_INITIALS.map((init, i) => (
        <div key={i}
          className={`minimap-item ${counts[i]>0?'has-posts':''} ${currentMonth===i?'current-month':''}`}
          onClick={() => onJump(i)}
          title={MONTHS_FULL[i] + ' — ' + counts[i] + ' posts'}
        >
          {init}
        </div>
      ))}
    </div>
  );
}
