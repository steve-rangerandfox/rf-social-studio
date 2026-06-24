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
              <span className="lp-mini-brand-mark">R</span>
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

// Carousel designer mini — a designed slide + thumbnail rail.
export function CarouselArt() {
  const thumbs = [
    "linear-gradient(135deg, #e8dccd 0%, #8a6f52 100%)",
    "#fafafa",
    "#09090b",
    "#ff5a1f",
  ];
  return (
    <div className="lp-art" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ width: "100%", maxWidth: 300, aspectRatio: "1 / 1", borderRadius: 16, background: "linear-gradient(135deg, #e8dccd 0%, #8a6f52 100%)", color: "#09090b", padding: "9%", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "var(--shadow-md)" }}>
        <div style={{ font: "500 11px var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.8 }}>Ranger &amp; Fox · 014</div>
        <div style={{ font: "700 clamp(22px, 3vw, 30px) var(--font-display)", letterSpacing: "-0.03em", lineHeight: 1.05 }}>Three notes on editorial calm.</div>
        <div style={{ font: "500 10px var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.6 }}>Swipe to read</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {thumbs.map((_, i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === 0 ? "var(--accent)" : "var(--surface-3)" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 300 }}>
        {thumbs.map((bg, i) => (
          <div key={i} style={{ flex: 1, aspectRatio: "1 / 1", borderRadius: 8, background: bg, border: "1px solid var(--surface-2)" }} />
        ))}
      </div>
    </div>
  );
}

// Story designer mini — a 9:16 canvas with layered type.
export function StoryArt() {
  return (
    <div className="lp-art" style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: 210, aspectRatio: "9 / 16", borderRadius: 26, background: "linear-gradient(160deg, #1f2937 0%, #0f172a 100%)", color: "#f1f5f9", padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
        <div style={{ font: "500 9px var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.7 }}>Story · 9:16</div>
        <div>
          <div style={{ font: "700 clamp(22px, 4vw, 28px) var(--font-display)", letterSpacing: "-0.03em", lineHeight: 1.04 }}>The Whitworth, in public today.</div>
          <div style={{ marginTop: 12, width: 36, height: 2, background: "var(--accent)" }} />
          <div style={{ marginTop: 12, font: "400 12px var(--font-body)", opacity: 0.85 }}>Six months. One wordmark.</div>
        </div>
        <div style={{ font: "500 9px var(--font-mono)", letterSpacing: "0.04em", opacity: 0.6 }}>Layers · snap · live preview</div>
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
