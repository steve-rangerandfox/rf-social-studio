import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { nowPT, ptPickerToISO, MONTHS_SHORT, WD_SHORT } from "../shared.js";

export function DateTimePicker({ isoValue, onChange, onClose, anchorRef }) {
  const pt = nowPT();
  const initDate = isoValue ? (() => {
    const d = new Date(isoValue);
    const s = d.toLocaleString("en-US", { timeZone:"America/Los_Angeles", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false });
    const [datePart, timePart] = s.split(", ");
    const [m, dd, yyyy] = datePart.split("/");
    const [hh, mm] = timePart.split(":");
    return { year:parseInt(yyyy), month:parseInt(m)-1, day:parseInt(dd), hour:parseInt(hh)===24?0:parseInt(hh), minute:parseInt(mm) };
  })() : { year:pt.getFullYear(), month:pt.getMonth(), day:pt.getDate(), hour:9, minute:0 };

  const [viewYear,  setViewYear]  = useState(initDate.year);
  const [viewMonth, setViewMonth] = useState(initDate.month);
  const [selDay,    setSelDay]    = useState(initDate.day);
  const [selYear,   setSelYear]   = useState(initDate.year);
  const [selMonth,  setSelMonth]  = useState(initDate.month);
  const [timeVal,   setTimeVal]   = useState(`${String(initDate.hour).padStart(2,"0")}:${String(initDate.minute).padStart(2,"0")}`);

  const popRef = useRef(null);

  // Position below anchor
  const [pos, setPos] = useState({ top:0, left:0 });
  useEffect(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popW = 240, popH = 320;
    let top = rect.bottom + 6;
    let left = rect.left;
    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
    if (top + popH > window.innerHeight - 12) top = rect.top - popH - 6;
    setPos({ top, left });
  }, [anchorRef]);

  // Click outside close
  useEffect(() => {
    const h = (e) => { if (popRef.current && !popRef.current.contains(e.target) && !anchorRef?.current?.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("pointerdown", h), 10);
    return () => document.removeEventListener("pointerdown", h);
  }, [anchorRef, onClose]);

  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const todayPT     = nowPT();

  const apply = () => {
    const [h, m] = timeVal.split(":").map(Number);
    const iso = ptPickerToISO(selYear, selMonth, selDay, h, m);
    onChange(iso);
    onClose();
  };

  const pickDay = (d) => { setSelDay(d); setSelYear(viewYear); setSelMonth(viewMonth); };

  const prevMonth = () => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else{setViewMonth(m=>m-1);} };
  const nextMonth = () => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else{setViewMonth(m=>m+1);} };

  const cells = [];
  const dtPrevDays = new Date(viewYear, viewMonth, 0).getDate();
  for(let i=0;i<firstDay;i++) cells.push({ d: dtPrevDays - firstDay + 1 + i, type:'prev' });
  for(let d=1;d<=daysInMonth;d++) cells.push({ d, type:'curr' });
  const dtTotal = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for(let nd=1; cells.length < dtTotal; nd++) cells.push({ d: nd, type:'next' });

  const isSel = (d) => d && d===selDay && viewMonth===selMonth && viewYear===selYear;
  const isToday = (d) => d && todayPT.getDate()===d && todayPT.getMonth()===viewMonth && todayPT.getFullYear()===viewYear;

  return createPortal(
    <div ref={popRef} className="dt-popup" style={{ position:"fixed", top:pos.top, left:pos.left }}>
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft size={14}/></button>
        <span className="cal-nav-label">{MONTHS_SHORT[viewMonth]} {viewYear}</span>
        <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight size={14}/></button>
      </div>
      <div className="cal-wd-row">
        {WD_SHORT.map((w,i)=><div key={i} className="cal-wd-cell">{w}</div>)}
      </div>
      <div className="cal-days">
        {cells.map((cell,i)=>(
          <button key={i}
            className={`cal-day-btn ${!cell?.d?"empty":""} ${cell?.type !== "curr" ? "empty" : ""} ${isSel(cell?.d)?"sel":""} ${isToday(cell?.d)&&!isSel(cell?.d)?"today":""}`}
            onClick={()=>cell?.type === "curr" && pickDay(cell.d)}>
            {cell?.type === "curr" ? cell.d : ""}
          </button>
        ))}
      </div>
      <div className="cal-divider"/>
      <div className="time-row">
        <span className="time-lbl">Time</span>
        <input type="time" className="time-inp" value={timeVal} onChange={e=>setTimeVal(e.target.value)}/>
        <span className="tz-badge">PT</span>
      </div>
      <button className="dt-apply" onClick={apply}>Apply</button>
    </div>,
    document.body
  );
}
