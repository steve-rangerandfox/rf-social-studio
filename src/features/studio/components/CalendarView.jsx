import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Plus } from "../../../components/icons/index.jsx";
import { useStudio } from "../StudioContext.jsx";
import {
  MONTHS_FULL,
  PLATFORMS,
  STATUSES,
  WEEKDAYS,
  toPTDisplay,
} from "../shared.js";

export function CalendarView({ rows, month: initMonth, year: initYear, onAddDay, onSelectRow }) {
  const { createPostForDate } = useStudio();
  const [calMonth, setCalMonth] = useState(initMonth);
  const [calYear,  setCalYear]  = useState(initYear);
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date();
    return today.getMonth() === initMonth && today.getFullYear() === initYear ? today.getDate() : 1;
  });
  const [inlineDay, setInlineDay] = useState(null);

  const prevMonth = () => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); };

  const firstDay = new Date(calYear,calMonth,1).getDay();
  const days = new Date(calYear,calMonth+1,0).getDate();
  const today = new Date();
  const isToday = d => today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===d;

  const rowDay = (r) => {
    if(!r.scheduledAt) return null;
    const d = new Date(r.scheduledAt);
    if(d.getFullYear()!==calYear || d.getMonth()!==calMonth) return null;
    return parseInt(new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",day:"numeric"}).format(d), 10);
  };

  const cells = [];
  const prevDays = new Date(calYear, calMonth, 0).getDate();
  for(let i=0;i<firstDay;i++) cells.push({ d: prevDays - firstDay + 1 + i, type:'prev' });
  for(let d=1;d<=days;d++) cells.push({ d, type:'curr' });
  const total = Math.ceil((firstDay + days) / 7) * 7;
  for(let d=1; cells.length < total; d++) cells.push({ d, type:'next' });

  useEffect(() => {
    setSelectedDay((current) => Math.min(current, days));
  }, [days]);

  const dayRows = rows
    .filter((row) => rowDay(row) === selectedDay)
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));

  return (
    <div className="cal-area">
      <div className="cal-shell">
        <div className="cal-main">
          <div className="cal-topline">
            <div>
              <div className="cal-title">{MONTHS_FULL[calMonth]} {calYear}</div>
              <div className="cal-subtitle">Select a day to review timing, readiness, and post details.</div>
            </div>
            <div className="cal-nav-actions">
              <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft size={14}/></button>
              <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight size={14}/></button>
            </div>
          </div>
          <div className="cal-header">{WEEKDAYS.map(w=><div key={w} className="cal-wd">{w}</div>)}</div>
          <div className="cal-grid">
            {cells.map((cell,i)=>{
              const { d, type } = cell;
              const isCurr = type==='curr';
              const isOther = type==='prev' || type==='next';
              const count = isCurr ? rows.filter((row) => rowDay(row) === d).length : 0;
              return (
                <div
                  key={i}
                  className={`cal-cell ${isOther?"other":""} ${isCurr&&isToday(d)?"today":""} ${isCurr&&selectedDay===d?"selected":""}`}
                  onClick={() => {
                    if (!isCurr) {
                      return;
                    }
                    setSelectedDay(d);
                  }}
                >
                  <div className="cal-cell-head">
                    <div className="cal-dn" style={{color: isOther ? 'var(--t-border)' : undefined}}>{d}</div>
                    {isCurr && count > 0 && <div className="cal-count">{count}</div>}
                  </div>
                  {isCurr && <>
                    <div className="cal-posts">
                      {rows.filter(r=>rowDay(r)===d).slice(0, 4).map(r=>{
                        const p=PLATFORMS[r.platform];
                        const t=toPTDisplay(r.scheduledAt);
                        return (
                          <div
                            key={r.id}
                            className="cal-post"
                            style={{background:p.bg,color:p.color}}
                            onClick={e=>{e.stopPropagation();setSelectedDay(d);onSelectRow(r.id);}}
                          >
                            <span style={{width:4,height:4,borderRadius:"50%",background:p.color,flexShrink:0,display:"inline-block"}}/>
                            <span className="cal-post-label">{r.note||p.short}</span>
                            {t && <span className="cal-post-time">{t.hour}:{t.minute}{t.ampm.toLowerCase()}</span>}
                          </div>
                        );
                      })}
                      {count > 4 && <div className="cal-more">+{count - 4} more</div>}
                    </div>
                    {inlineDay?.day === d && inlineDay?.month === calMonth && inlineDay?.year === calYear && (
                      <CalInlineCreate
                        onCommit={(title) => {
                          createPostForDate(new Date(calYear, calMonth, d, 9, 0), title);
                          setInlineDay(null);
                        }}
                        onCancel={() => setInlineDay(null)}
                      />
                    )}
                    <div className="cal-add"><button className="cal-add-btn" onClick={(event)=>{event.stopPropagation();setSelectedDay(d);setInlineDay({ day: d, month: calMonth, year: calYear });}}><Plus size={12}/></button></div>
                  </>}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="cal-panel">
          <div className="cal-panel-header">
            <div className="cal-panel-day">{MONTHS_FULL[calMonth]} {selectedDay}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => onAddDay(selectedDay, calMonth, calYear)}>Add post</button>
          </div>
          <div className="cal-panel-sub">Posts scheduled for the selected day appear here so details stay out of the grid.</div>

          <div className="cal-panel-section">
            <div className="an-title" style={{marginBottom:10}}>Day Queue</div>
            {dayRows.length === 0 && <div className="cal-panel-empty">No posts are scheduled for this day yet.</div>}
            {dayRows.map((row) => {
              const time = toPTDisplay(row.scheduledAt);
              return (
                <button
                  key={row.id}
                  className="cal-panel-item"
                  onClick={() => onSelectRow(row.id)}
                >
                  <div>
                    <div className="cal-panel-item-title">{row.note || "Untitled post"}</div>
                    <div className="cal-panel-item-meta">
                      {PLATFORMS[row.platform].short} • {STATUSES[row.status]?.label}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span className="cal-panel-item-time">{time?.hour}:{time?.minute} {time?.ampm}</span>
                    <span className="cal-panel-edit-hint">Click to edit</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CalInlineCreate({ onCommit, onCancel }) {
  const inputRef = useRef(null);
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const value = inputRef.current?.value || "";
      if (value.trim()) onCommit(value);
      else onCancel();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="cal-inline-create" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="cal-inline-create-input"
        placeholder="What are you planning?"
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          if (!e.target.value.trim()) onCancel();
        }}
      />
    </div>
  );
}
