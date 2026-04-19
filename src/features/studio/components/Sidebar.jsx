import React, { useState } from "react";
import { ChevronDown } from "../../../components/icons/index.jsx";
import { useStudio } from "../StudioContext.jsx";
import { MONTHS_FULL, T } from "../shared.js";

const SIDEBAR_STATE_KEY = "rf_sidebar_state";

function loadSidebarState() {
  try {
    return JSON.parse(localStorage.getItem(SIDEBAR_STATE_KEY)) || {};
  } catch { return {}; }
}

function saveSidebarState(state) {
  try { localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(state)); } catch { /* */ }
}

const DEFAULT_COLLAPSED = { calendar: false, team: true, connections: true };

export function Sidebar() {
  const {
    month, setMonth, timeScale, setTimeScale,
    monthCounts, team, connections, view,
    add, startInlineCreate, jumpToMonth, setShowConn, setSettings,
  } = useStudio();

  const [collapsed, setCollapsed] = useState(() => {
    const saved = loadSidebarState();
    return { ...DEFAULT_COLLAPSED, ...saved };
  });
  const toggleSection = (key) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveSidebarState(next);
      return next;
    });
  };

  return (
    <aside className="sidebar">
      <div className="s-logo">
        <div className="logo-mark">RF</div>
        <div>
          <div className="logo-name">Ranger &amp; Fox</div>
          <div className="logo-sub">Social Studio</div>
        </div>
      </div>

      <div className="s-sect">
        <button
          className="btn btn-primary sidebar-add-btn"
          onClick={() => view === "list" ? startInlineCreate() : add(month)}
          title="Create new post (N)"
        >
          + Add post
        </button>

        <button className="s-lbl s-lbl-toggle" onClick={() => toggleSection("calendar")}>
          <span><span className="s-lbl-num">01 /</span> Calendar</span>
          <ChevronDown size={10} className={`s-lbl-chevron${collapsed.calendar ? " collapsed" : ""}`} />
        </button>

        {!collapsed.calendar && (
          <>
            {/* Time scale toggle */}
            <div className="time-toggle">
              {[["month", "Month"], ["year", "Year"]].map(([v, l]) => (
                <button key={v} className={"time-toggle-btn " + (timeScale === v ? "on" : "")}
                  onClick={() => setTimeScale(v)}>{l}</button>
              ))}
            </div>

            {MONTHS_FULL.map((m, i) => {
              const cnt = monthCounts[i];
              return (
                <div key={i} className={"m-item " + (timeScale === "month" && month === i ? "on" : "")}
                  onClick={() => { jumpToMonth(i); if (timeScale === "month") setMonth(i); }}>
                  <span>{m}</span>
                  <span className="m-ct">{cnt > 0 ? cnt : ""}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="s-div" />

      <div className="s-team">
        <button className="s-lbl s-lbl-toggle" onClick={() => toggleSection("team")}>
          <span><span className="s-lbl-num">02 /</span> Team</span>
          <ChevronDown size={10} className={`s-lbl-chevron${collapsed.team ? " collapsed" : ""}`} />
        </button>
        {!collapsed.team && team.map(t => (
          <div key={t.id} className="team-row" title={t.name}>
            <div className="av" style={{ background: t.color + "22", color: t.color }} title={t.name}>{t.initials}</div>
            <span className="team-name">{t.name}</span>
            <div className="online-dot" style={{ background: t.id === "stephen" ? T.mint : T.textDim, boxShadow: t.id === "stephen" ? `0 0 5px ${T.mint}` : undefined }} />
          </div>
        ))}
      </div>

      <div className="s-div" />

      <div className="s-bottom">
        <button className="s-lbl s-lbl-toggle" onClick={() => toggleSection("connections")}>
          <span><span className="s-lbl-num">03 /</span> Connections</span>
          <ChevronDown size={10} className={`s-lbl-chevron${collapsed.connections ? " collapsed" : ""}`} />
        </button>
        {!collapsed.connections && (
          <>
            {[
              { key: "instagram", label: "Instagram" },
              { key: "tiktok", label: "TikTok" },
              { key: "facebook", label: "Facebook" },
              { key: "linkedin", label: "LinkedIn" },
            ].map(c => {
              const on = connections[c.key];
              return (
                <div key={c.key} className="conn-row" onClick={() => setShowConn(c.key)} title={`Connect ${c.label}`}>
                  <div className={"conn-dot " + (on ? "on" : "off")} />
                  <span className="conn-name">{c.label}</span>
                  <span className={"conn-st " + (on ? "on" : "off")}>{on ? "Live" : "Setup \u2192"}</span>
                </div>
              );
            })}
          </>
        )}
        <div style={{ height: 6 }} />
        <button className="s-settings-btn" onClick={() => setSettings(true)} title="Settings">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, opacity: .6 }}>
            <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6.5 1v1.2M6.5 10.8V12M1 6.5h1.2M10.8 6.5H12M2.4 2.4l.85.85M9.75 9.75l.85.85M9.75 3.25l-.85.85M3.25 9.75l-.85.85" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}
