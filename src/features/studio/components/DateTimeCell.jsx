import React, { useState, useRef } from "react";
import { toPTDisplay, MONTHS_SHORT } from "../shared.js";
import { DateTimePicker } from "./DateTimePicker.jsx";

export function DateTimeCell({ isoValue, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const disp = isoValue ? toPTDisplay(isoValue) : null;
  const weekday = isoValue
    ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(new Date(isoValue))
    : null;
  const monthLabel = disp ? MONTHS_SHORT[Math.max(0, Number(disp.month) - 1)] : null;

  return (
    <div style={{position:"relative"}} ref={ref}>
      <div className="dt-cell" onClick={()=>setOpen(v=>!v)}>
        {disp ? <>
          <div className="dt-badge">
            <div className="dt-badge-month">{monthLabel}</div>
            <div className="dt-badge-day">{disp.day}</div>
          </div>
          <div className="dt-copy">
            <div className="dt-date">{weekday}</div>
            <div className="dt-time">{disp.hour}:{disp.minute} {disp.ampm}</div>
            <div className="dt-zone">Pacific Time</div>
          </div>
        </> : <div className="dt-empty"><div className="dt-empty-title">Set schedule</div><div className="dt-empty-sub">Date and time</div></div>}
      </div>
      {open && <DateTimePicker isoValue={isoValue} onChange={onChange} onClose={()=>setOpen(false)} anchorRef={ref}/>}
    </div>
  );
}
