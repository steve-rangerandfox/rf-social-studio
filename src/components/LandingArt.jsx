import React from "react";

// Mini-app artwork for the landing — drawn in HTML/CSS, not screenshots.
// Ported from the Relay design handoff (landing-art.jsx).

export function Kicker({ num, label }) {
  return (
    <div className="lp-kicker">
      <span className="lp-kicker-num">{num}</span>
      <span className="lp-kicker-slash">/</span>
      <span className="lp-kicker-label">{label}</span>
    </div>
  );
}

function HeroRow({ d, n, t, title, tags, chans, status, sLabel, today }) {
  return (
    <div className={"lp-mini-postrow" + (today ? " is-today" : "")}>
      <div className="lp-mini-date">
        <span className="lp-mini-date-d">{d}</span>
        <span className="lp-mini-date-n">{n}</span>
      </div>
      <div className="lp-mini-time">{t}<br /><span style={{ fontSize: 9, color: "var(--text-faint)" }}>PT</span></div>
      <div>
        <div className="lp-mini-title">{title}</div>
        <div className="lp-mini-tags">
          {tags.map((tg, i) => (
            <span key={i}>{tg}{i < tags.length - 1 ? "  " : ""}</span>
          ))}
        </div>
      </div>
      <div className="lp-mini-chans">
        {chans.map((c) => <span key={c} className={"lp-mini-chip " + c}>{c === "li" ? "in" : ""}</span>)}
      </div>
      <div><span className={"lp-mini-status " + status}>{sLabel}</span></div>
    </div>
  );
}

// Hero artwork — a stylized queue list with a sidebar.
export function HeroArt() {
  return (
    <div className="lp-hero-art">
      <div className="lp-hero-art-frame">
        <div className="lp-mini">
          <aside className="lp-mini-side">
            <div className="lp-mini-brand">
              <span className="lp-mini-brand-mark">RF</span>
              <span className="lp-mini-brand-name">Relay</span>
            </div>
            <div className="lp-mini-newpost">
              <span style={{ fontSize: 11 }}>+</span>
              <span>New post</span>
            </div>
            <div className="lp-mini-section-label">
              <span className="lp-mini-num">01</span>
              <span style={{ color: "var(--text-faint)" }}>/</span>
              <span>Calendar</span>
            </div>
            <div className="lp-mini-row"><span>January</span><span className="lp-mini-row-c">—</span></div>
            <div className="lp-mini-row"><span>March</span><span className="lp-mini-row-c">—</span></div>
            <div className="lp-mini-row is-on"><span>April</span><span className="lp-mini-row-c">16</span></div>
            <div className="lp-mini-row"><span>May</span><span className="lp-mini-row-c">3</span></div>
            <div className="lp-mini-row"><span>June</span><span className="lp-mini-row-c">—</span></div>
            <div className="lp-mini-section-label" style={{ marginTop: 10 }}>
              <span className="lp-mini-num">02</span>
              <span style={{ color: "var(--text-faint)" }}>/</span>
              <span>Studio</span>
            </div>
            <div className="lp-mini-row"><span>Brand central</span></div>
            <div className="lp-mini-row"><span>Assets</span></div>
          </aside>
          <main className="lp-mini-main">
            <div className="lp-mini-top">
              <span>studio</span>
              <span style={{ color: "var(--text-faint)" }}>/</span>
              <span className="lp-mini-crumb-on">April</span>
              <span style={{ color: "var(--text-faint)" }}>/</span>
              <span>2026</span>
              <div className="lp-mini-tabs">
                <span className="lp-mini-tab">Calendar</span>
                <span className="lp-mini-tab is-on">Queue</span>
                <span className="lp-mini-tab">Grid</span>
              </div>
            </div>
            <div className="lp-mini-h">
              <div className="lp-mini-h-title">April <span>2026</span></div>
              <div className="lp-mini-h-stats">
                <div><b>8</b>posted</div>
                <div><b>4</b>queued</div>
              </div>
            </div>
            <div className="lp-mini-tablehead">
              <span>Date</span><span>Time</span><span>Post</span><span>Channels</span><span>Status</span>
            </div>
            <HeroRow d="Apr" n="02" t="09:30" title="A note on editorial neutrals — why we stopped chasing warm paper." tags={["#studio-notes", "#design"]} chans={["ig", "li"]} status="posted" sLabel="Posted" />
            <HeroRow d="Apr" n="04" t="12:00" title="Motion tip 014 — the case against easing overshoot on chrome." tags={["#motion", "#tips", " · reel"]} chans={["ig"]} status="posted" sLabel="Posted" />
            <HeroRow d="Apr" n="11" t="09:00" title="Case study — rebranding Nordlys Coffee, end to end." tags={["#case-study", "#client", " · 8-card carousel"]} chans={["ig", "tt"]} status="posted" sLabel="Posted" />
            <HeroRow d="Apr" n="23" t="13:30" today title="New work — the Whitworth identity, in public today." tags={["#client", "#release", " · 6-card carousel"]} chans={["ig", "li"]} status="scheduled" sLabel="Scheduled" />
            <HeroRow d="Apr" n="24" t="10:00" title="What we learned shipping Relay v1 — a retrospective." tags={["#studio-notes"]} chans={["ig", "li"]} status="approved" sLabel="Approved" />
            <HeroRow d="Apr" n="25" t="14:00" title="Behind the scenes — the Whitworth photo shoot." tags={["#behind-the-scenes", " · reel"]} chans={["ig", "tt"]} status="review" sLabel="Needs review" />
          </main>
        </div>
      </div>
    </div>
  );
}

// Calendar mini for workflow pair 2.
export function CalendarArt() {
  const days = [];
  for (let i = 30; i <= 31; i++) days.push({ n: i, out: true });
  for (let i = 1; i <= 30; i++) days.push({ n: i, out: false });
  for (let i = 1; i <= 35 - days.length; i++) days.push({ n: i, out: true });

  const events = {
    2: [{ k: "posted", l: "Editorial note" }],
    4: [{ k: "posted", l: "Motion tip 014" }],
    7: [{ k: "posted", l: "We're hiring" }],
    11: [{ k: "posted", l: "Nordlys case" }],
    14: [{ k: "posted", l: "Studio note" }],
    17: [{ k: "posted", l: "Motion tip 015" }],
    21: [{ k: "posted", l: "Cove Bookshop" }],
    23: [{ k: "scheduled", l: "Whitworth ID" }, { k: "scheduled", l: "Reel — logo" }],
    24: [{ k: "approved", l: "v1 retro" }],
    25: [{ k: "review", l: "BTS photo" }],
    26: [{ k: "approved", l: "Hiring update" }],
    28: [{ k: "draft", l: "Pairing study" }],
    29: [{ k: "draft", l: "Releases" }],
  };

  return (
    <div className="lp-art">
      <div className="lp-cal-top">
        <span>studio</span>
        <span style={{ color: "var(--text-faint)" }}>/</span>
        <span style={{ color: "var(--ink)" }}>April</span>
        <span>2026</span>
        <div className="lp-cal-top-arrows">
          <span className="lp-cal-arrow">{"‹"}</span>
          <span className="lp-cal-arrow" style={{ padding: "0 8px", width: "auto" }}>Today</span>
          <span className="lp-cal-arrow">{"›"}</span>
        </div>
      </div>
      <div className="lp-cal-h">
        <span className="lp-cal-h-m">April</span>
        <span className="lp-cal-h-y">2026</span>
      </div>
      <div className="lp-cal-grid">
        {days.map((d, i) => {
          const evs = !d.out ? (events[d.n] || []) : [];
          const isToday = !d.out && d.n === 23;
          return (
            <div key={i} className={"lp-cal-day" + (d.out ? " is-out" : "") + (isToday ? " is-today" : "")}>
              <div>{d.n}</div>
              {evs.slice(0, 2).map((e, j) => (
                <span key={j} className={"lp-cal-pill " + e.k}>{e.l}</span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Composer mini for workflow pair 3.
export function ComposerArt() {
  return (
    <div className="lp-art">
      <div className="lp-comp">
        <div className="lp-comp-stepper">
          <div className="lp-comp-step done"><span className="n">1</span><span>Content</span></div>
          <div className="lp-comp-line" />
          <div className="lp-comp-step on"><span className="n">2</span><span>Customize per channel</span></div>
        </div>

        <div className="lp-comp-label">Channels</div>
        <div className="lp-comp-channels">
          <div className="lp-comp-chan on"><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--ig-gradient)", display: "inline-block" }} />Instagram</div>
          <div className="lp-comp-chan"><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--platform-li)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>in</span>LinkedIn</div>
          <div className="lp-comp-chan"><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--ink)", display: "inline-block" }} />TikTok</div>
        </div>

        <div className="lp-comp-label" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Instagram caption</span>
          <span style={{ fontSize: 9, color: "var(--accent)", fontWeight: 500 }}>✦ Mirrors master</span>
        </div>
        <div className="lp-comp-cap">
          New work — the Whitworth identity, in public today. A six-card carousel walking through the wordmark, the type system, and the supporting palette. <em>Swipe through for the full set →</em>
        </div>
        <div className="lp-comp-tags">
          <span className="lp-comp-tag on">#client</span>
          <span className="lp-comp-tag on">#release</span>
          <span className="lp-comp-tag">#identity</span>
          <span className="lp-comp-tag">#typography</span>
          <span className="lp-comp-tag">#studio-work</span>
          <span className="lp-comp-tag">#wordmark</span>
        </div>
      </div>
    </div>
  );
}

// "Chaos" visual for the problem section — the before state.
export function ChaosArt() {
  return (
    <div className="lp-chaos">
      <div className="lp-chaos-card c1">
        <div className="lp-chaos-h">
          <span style={{ width: 12, height: 12, borderRadius: 3, background: "#0f9d58", display: "inline-block" }} />
          April brief — Sheet1
          <span className="lp-chaos-tag">.xlsx</span>
        </div>
        <div className="lp-chaos-row"><span>Apr 02 — IG</span><span>v3 final FINAL</span></div>
        <div className="lp-chaos-row"><span>Apr 04 — Reel</span><span>copy in B17</span></div>
        <div className="lp-chaos-row"><span>Apr 11</span><span>see C9? C12?</span></div>
      </div>
      <div className="lp-chaos-arrow a1">→ slack</div>
      <div className="lp-chaos-card c2">
        <div className="lp-chaos-h">
          <span style={{ width: 12, height: 12, borderRadius: 3, background: "#4a154b", display: "inline-block" }} />
          #social-approvals
          <span className="lp-chaos-tag">slack</span>
        </div>
        <div className="lp-chaos-row"><span>maya</span><span>v2 ok pending logo</span></div>
        <div className="lp-chaos-row"><span>client</span><span>can we re-tone?</span></div>
        <div className="lp-chaos-row"><span>maya</span><span>ack — repaste</span></div>
      </div>
      <div className="lp-chaos-arrow a2">→ later</div>
      <div className="lp-chaos-card c3">
        <div className="lp-chaos-h">
          <span style={{ width: 12, height: 12, borderRadius: 3, background: "#000", display: "inline-block" }} />
          Notion / drafts
          <span className="lp-chaos-tag">page</span>
        </div>
        <div className="lp-chaos-row"><span>Untitled (3)</span><span>edited 4d</span></div>
        <div className="lp-chaos-row"><span>Whitworth ID</span><span>edited 12h</span></div>
        <div className="lp-chaos-row"><span>BTS — photo</span><span>edited 2h</span></div>
      </div>
      <div className="lp-chaos-arrow a3">→ ig native</div>
      <div className="lp-chaos-card c4">
        <div className="lp-chaos-h">
          <span style={{ width: 12, height: 12, borderRadius: 3, background: "#0066ff", display: "inline-block" }} />
          Later — Apr queue
          <span className="lp-chaos-tag">tab 14</span>
        </div>
        <div className="lp-chaos-row"><span>Apr 23 IG</span><span>asset missing</span></div>
        <div className="lp-chaos-row"><span>Apr 24 IG</span><span>caption stale</span></div>
        <div className="lp-chaos-row"><span>Apr 25 IG</span><span>?</span></div>
      </div>
    </div>
  );
}
