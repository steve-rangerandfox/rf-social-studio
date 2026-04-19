import React from "react";
import { PublicLayout } from "./PublicLayout.jsx";

// Public landing page. Editorial front door — same chrome as the
// legal pages (PublicLayout) but with marketing-tier typography
// blocks. No tracking pixels, no animated hero — calm by default.

const LANDING_STYLES = `
.landing-hero{
  margin-top:8px;
  margin-bottom:48px;
}

.landing-hero-line{
  font:800 clamp(56px, 9vw, 112px)/0.92 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.06em;
  color:#111111;
  margin:0 0 22px;
  max-width:14ch;
}

.landing-hero-line em{
  font-style:normal;
  color:#5e584f;
  font-weight:500;
}

.landing-hero-pitch{
  font-size:18px;
  line-height:1.55;
  color:#5e584f;
  max-width:50ch;
  margin:0 0 28px;
}

.landing-cta-row{
  display:flex;
  gap:12px;
  align-items:center;
  flex-wrap:wrap;
}

.landing-cta{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:14px 22px;
  border-radius:999px;
  font:700 14px/1 "Switzer", "Helvetica Neue", Arial, sans-serif;
  text-decoration:none;
  border:1px solid transparent;
  transition:background 140ms ease, border-color 140ms ease, color 140ms ease;
}

.landing-cta-primary{
  background:#181714;
  color:#fbfaf6;
}

.landing-cta-primary:hover{
  background:#2e2c28;
}

.landing-cta-ghost{
  background:transparent;
  border-color:rgba(24,23,20,0.18);
  color:#181714;
}

.landing-cta-ghost:hover{
  border-color:#181714;
}

.landing-cta-meta{
  font:600 11px/1 "JetBrains Mono", monospace;
  letter-spacing:0.14em;
  text-transform:uppercase;
  color:#8b8377;
  margin-left:8px;
}

.landing-section{
  margin-top:64px;
  padding-top:24px;
  border-top:1px solid rgba(24,23,20,0.1);
}

.landing-section-num{
  font:600 11px/1 "JetBrains Mono", monospace;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:#FF7A00;
  margin-bottom:14px;
  display:block;
}

.landing-section-title{
  font:700 clamp(28px, 4vw, 38px)/1.05 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.04em;
  color:#111111;
  margin:0 0 14px;
  max-width:22ch;
}

.landing-section-body{
  font-size:16px;
  line-height:1.65;
  color:#2e2c28;
  max-width:60ch;
  margin:0;
}

.landing-feature-grid{
  margin-top:24px;
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:24px;
}

.landing-feature{
  padding:20px 0 0;
  border-top:1px solid rgba(24,23,20,0.1);
}

.landing-feature-num{
  font:600 10px/1 "JetBrains Mono", monospace;
  letter-spacing:0.14em;
  text-transform:uppercase;
  color:#8b8377;
  display:block;
  margin-bottom:8px;
}

.landing-feature-name{
  font:700 18px/1.2 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.025em;
  color:#111111;
  margin:0 0 6px;
}

.landing-feature-pitch{
  font-size:14px;
  line-height:1.55;
  color:#5e584f;
  margin:0;
}

.landing-quote{
  margin:48px 0 0;
  padding:20px 0 0;
  border-top:1px solid rgba(24,23,20,0.1);
}

.landing-quote-text{
  font:500 22px/1.4 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.025em;
  color:#2e2c28;
  margin:0 0 12px;
  max-width:36ch;
}

.landing-quote-attr{
  font:600 10px/1 "JetBrains Mono", monospace;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:#8b8377;
}

@media (max-width:640px){
  .landing-feature-grid{ grid-template-columns:1fr; }
  .landing-hero-line{ font-size:48px; }
}
`;

const FEATURES = [
  {
    num: "01",
    name: "Calendar",
    pitch: "A month read like a typeset publication, not a Jira board. Chips show platform and time at a glance.",
  },
  {
    num: "02",
    name: "Studio queue",
    pitch: "Status as a quiet left rule, not a loud pill. Drag to reorder. J/K to move row by row.",
  },
  {
    num: "03",
    name: "Story designer",
    pitch: "9:16 canvas with snap, layers, and instant preview. Built to shape stories, not configure software.",
  },
  {
    num: "04",
    name: "AI captions",
    pitch: "Captions that sound like you, sourced from a brand profile you control. Cross-post variants in one click.",
  },
  {
    num: "05",
    name: "Monthly strategy",
    pitch: "Generate the month\u2019s posting plan from your brand and last month\u2019s rhythm. Edit, then publish.",
  },
  {
    num: "06",
    name: "One-click approve",
    pitch: "Approve a draft and the studio finds the next available slot. No hunting, no second-guessing.",
  },
];

export function Landing() {
  return (
    <PublicLayout
      eyebrow="Social Studio"
      colophonMeta="Ranger &amp; Fox \u00B7 House voice 2026"
    >
      <style>{LANDING_STYLES}</style>

      <section className="landing-hero">
        <h1 className="landing-hero-line">
          Calm operations for a <em>sharper content system.</em>
        </h1>
        <p className="landing-hero-pitch">
          One workspace for planning, designing, and publishing across Instagram,
          LinkedIn, TikTok, and Facebook. Editorial rhythm by default &mdash;
          dense when you need it.
        </p>
        <div className="landing-cta-row">
          <a className="landing-cta landing-cta-primary" href="/app">Open the studio</a>
          <a className="landing-cta landing-cta-ghost" href="/pricing">See pricing</a>
          <span className="landing-cta-meta">Free tier \u00B7 No card required</span>
        </div>
      </section>

      <section className="landing-section">
        <span className="landing-section-num">01 \u00B7 What it is</span>
        <h2 className="landing-section-title">Six surfaces. One authored system.</h2>
        <p className="landing-section-body">
          Most social tools chase feature parity. We chased a working studio &mdash;
          the kind a small team can run a brand from without losing the thread.
          Calendar, queue, grid, story canvas, asset library, analytics. They share
          a vocabulary so the work flows between them.
        </p>

        <div className="landing-feature-grid">
          {FEATURES.map((f) => (
            <article key={f.num} className="landing-feature">
              <span className="landing-feature-num">{f.num}</span>
              <h3 className="landing-feature-name">{f.name}</h3>
              <p className="landing-feature-pitch">{f.pitch}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <span className="landing-section-num">02 \u00B7 Who it\u2019s for</span>
        <h2 className="landing-section-title">In-house teams who care how their channel reads.</h2>
        <p className="landing-section-body">
          We built it for the way a small studio actually works: a person
          drafting, a person reviewing, an owner pressing publish. Approval flow,
          comments, and ownership are first-class &mdash; not an enterprise
          add-on you negotiate for. If you publish under a brand that has a
          point of view, this is your tool.
        </p>
      </section>

      <section className="landing-section">
        <span className="landing-section-num">03 \u00B7 What it costs</span>
        <h2 className="landing-section-title">Three flat tiers. No per-post fees.</h2>
        <p className="landing-section-body">
          Free for solo planning. <strong>$5/mo</strong> for AI captions and
          variants. <strong>$10/mo per seat</strong> for the strategy generator
          and your studio. 14-day trial on paid plans. Cancel from settings.
        </p>
        <div className="landing-cta-row" style={{ marginTop: 18 }}>
          <a className="landing-cta landing-cta-primary" href="/pricing">Compare plans</a>
        </div>
      </section>

      <div className="landing-quote">
        <p className="landing-quote-text">
          &ldquo;Editorial rhythm, calm by default &mdash; dense when you need it.&rdquo;
        </p>
        <p className="landing-quote-attr">House voice \u00B7 2026</p>
      </div>
    </PublicLayout>
  );
}
