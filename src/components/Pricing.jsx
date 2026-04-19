import React from "react";
import { PublicLayout } from "./PublicLayout.jsx";

// Public /pricing page. Hardcoded marketing copy — keeps the page
// renderable without an authenticated /api/billing fetch (visitors
// hit it before sign-in). Source of truth for entitlements lives in
// src/server/entitlements.js; if you change a tier there, mirror it
// here.

const PRICING_STYLES = `
.pricing-grid{
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:18px;
  margin:8px 0 12px;
}

.pricing-card{
  display:flex;
  flex-direction:column;
  gap:14px;
  padding:24px;
  border:1px solid rgba(24,23,20,0.1);
  border-radius:18px;
  background:rgba(255,255,255,0.5);
  position:relative;
}

.pricing-card.is-featured{
  border-color:rgba(24,23,20,0.4);
  background:rgba(255,255,255,0.85);
  box-shadow:0 12px 32px rgba(24,23,20,0.06);
}

.pricing-tag{
  font:600 10px/1 "JetBrains Mono", monospace;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:#8b8377;
}

/* Editorial accent — featured tag carries the signature orange.
   Single use per page keeps the surface calm. */
.pricing-card.is-featured .pricing-tag{ color:#FF7A00; }

.pricing-name{
  font:800 28px/0.95 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.04em;
  color:#111111;
  margin:0;
}

.pricing-price{
  display:flex;
  align-items:baseline;
  gap:6px;
  margin:0;
}

.pricing-price-num{
  font:800 38px/1 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.05em;
  color:#111111;
}

.pricing-price-unit{
  font:500 12px/1 "JetBrains Mono", monospace;
  letter-spacing:0.08em;
  text-transform:uppercase;
  color:#8b8377;
}

.pricing-pitch{
  font-size:14px;
  line-height:1.55;
  color:#5e584f;
  margin:0;
}

.pricing-features{
  list-style:none;
  padding:14px 0 0;
  margin:0;
  border-top:1px solid rgba(24,23,20,0.08);
  display:flex;
  flex-direction:column;
  gap:9px;
}

.pricing-features li{
  font-size:13px;
  line-height:1.5;
  color:#2e2c28;
  padding-left:18px;
  position:relative;
}

.pricing-features li::before{
  content:"";
  position:absolute;
  left:0;
  top:8px;
  width:8px;
  height:1px;
  background:#181714;
}

.pricing-features li.is-off{ color:#8b8377; }
.pricing-features li.is-off::before{ background:#c9c2b6; }

.pricing-cta{
  margin-top:auto;
  padding-top:14px;
}

.pricing-cta a{
  display:block;
  text-align:center;
  padding:13px 18px;
  border-radius:999px;
  font:700 13px/1 "Switzer", "Helvetica Neue", Arial, sans-serif;
  letter-spacing:0;
  text-decoration:none;
  border:1px solid rgba(24,23,20,0.18);
  color:#181714;
  background:rgba(255,255,255,0.6);
  transition:background 140ms ease, border-color 140ms ease, color 140ms ease;
}

.pricing-cta a:hover{
  border-color:#181714;
  background:#181714;
  color:#fbfaf6;
}

.pricing-cta.is-primary a{
  background:#181714;
  color:#fbfaf6;
  border-color:#181714;
}

.pricing-cta.is-primary a:hover{
  background:#2e2c28;
}

.pricing-trial{
  font:500 12px/1.5 "JetBrains Mono", monospace;
  letter-spacing:0.08em;
  text-transform:uppercase;
  color:#8b8377;
  margin:0;
}

/* Comparison block — single editorial table positioned vs Buffer.
   Designed as a typeset row pattern (no borders, no zebra stripes). */
.pricing-compare{
  margin-top:64px;
  padding-top:24px;
  border-top:1px solid rgba(24,23,20,0.12);
}

.pricing-compare-num{
  font:600 11px/1 "JetBrains Mono", monospace;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:#FF7A00;
  margin-bottom:14px;
  display:block;
}

.pricing-compare-title{
  font:700 clamp(24px, 3.4vw, 32px)/1.05 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.035em;
  color:#111111;
  margin:0 0 22px;
  max-width:24ch;
}

.pricing-compare-table{
  display:grid;
  grid-template-columns:minmax(140px, 1.2fr) 1fr 1fr;
  gap:0;
  border-top:1px solid rgba(24,23,20,0.1);
}

.pricing-compare-head{
  display:contents;
  font:600 10px/1.4 "JetBrains Mono", monospace;
  letter-spacing:0.14em;
  text-transform:uppercase;
  color:#8b8377;
}

.pricing-compare-head span{
  padding:14px 12px 10px;
  border-bottom:1px solid rgba(24,23,20,0.1);
}

.pricing-compare-row{
  display:contents;
}

.pricing-compare-row > span{
  padding:14px 12px;
  border-bottom:1px solid rgba(24,23,20,0.06);
  font-size:14px;
  line-height:1.45;
  color:#2e2c28;
}

.pricing-compare-row > span:first-child{
  font-weight:600;
  color:#111111;
}

.pricing-compare-row > span.is-us{
  color:#181714;
  font-weight:500;
}

@media (max-width:780px){
  .pricing-grid{ grid-template-columns:1fr; }
  .pricing-compare-table{ grid-template-columns:1fr 1fr 1fr; }
  .pricing-compare-row > span{ font-size:13px; padding:12px 8px; }
}
`;

const TIERS = [
  {
    id: "free",
    name: "Free",
    tag: "Start here",
    price: "$0",
    unit: "forever",
    pitch: "Plan, draft, and preview without spending a cent. Best for solo creators who want a calm second brain.",
    features: [
      { on: true, text: "Up to 5 scheduled posts" },
      { on: true, text: "1 connected account" },
      { on: true, text: "Calendar, list, and grid views" },
      { on: false, text: "AI captions, variants, strategy" },
      { on: false, text: "Brand learning from website" },
    ],
    cta: { label: "Sign in to start", href: "/app" },
    primary: false,
  },
  {
    id: "essentials",
    name: "Essentials",
    tag: "Most popular",
    price: "$5",
    unit: "/month",
    pitch: "Everything in Free, plus AI captions, variants for every platform, and brand learning from a single URL.",
    features: [
      { on: true, text: "Up to 100 scheduled posts" },
      { on: true, text: "3 connected accounts" },
      { on: true, text: "AI captions + cross-post variants" },
      { on: true, text: "Brand learning from website" },
      { on: false, text: "AI monthly strategy + team seats" },
    ],
    cta: { label: "Start 14-day trial", href: "/app?upgrade=essentials" },
    primary: true,
  },
  {
    id: "team",
    name: "Team",
    tag: "For studios",
    price: "$10",
    unit: "/seat / month",
    pitch: "Everything in Essentials, plus monthly strategy generation, unlimited posts, and seats for the rest of the studio.",
    features: [
      { on: true, text: "Unlimited scheduled posts" },
      { on: true, text: "All connections, all platforms" },
      { on: true, text: "AI monthly strategy generator" },
      { on: true, text: "Up to 3 seats included" },
      { on: true, text: "Approval flow + comments" },
    ],
    cta: { label: "Start 14-day trial", href: "/app?upgrade=team" },
    primary: false,
  },
];

const COMPARISON = [
  { feature: "Free tier", us: "Yes \u2014 5 posts", buffer: "Limited \u2014 10 posts, 3 channels" },
  { feature: "AI captions on entry tier", us: "Included at $5/mo", buffer: "$6/mo Essentials add-on" },
  { feature: "Cross-post variants", us: "One click, all platforms", buffer: "Per-post manual" },
  { feature: "AI monthly strategy", us: "Built into Team tier", buffer: "Not offered" },
  { feature: "Story design canvas", us: "Built-in (9:16)", buffer: "External tool" },
  { feature: "Per-seat pricing", us: "$10 / seat (Team only)", buffer: "$6 / channel" },
  { feature: "Trial card required", us: "No", buffer: "Yes" },
];

export function Pricing() {
  return (
    <PublicLayout
      eyebrow="Pricing"
      title="Calm pricing for a working studio."
      meta="Three tiers \u00B7 14-day trial on paid plans \u00B7 cancel anytime"
    >
      <style>{PRICING_STYLES}</style>

      <p>
        One workspace for planning, designing, and publishing across Instagram,
        LinkedIn, TikTok, and Facebook. No per-post fees, no surprise charges.
      </p>

      <div className="pricing-grid">
        {TIERS.map((tier) => (
          <article key={tier.id} className={`pricing-card${tier.primary ? " is-featured" : ""}`}>
            <span className="pricing-tag">{tier.tag}</span>
            <h2 className="pricing-name">{tier.name}</h2>
            <p className="pricing-price">
              <span className="pricing-price-num">{tier.price}</span>
              <span className="pricing-price-unit">{tier.unit}</span>
            </p>
            <p className="pricing-pitch">{tier.pitch}</p>
            <ul className="pricing-features">
              {tier.features.map((f, i) => (
                <li key={i} className={f.on ? "" : "is-off"}>{f.text}</li>
              ))}
            </ul>
            <div className={`pricing-cta${tier.primary ? " is-primary" : ""}`}>
              <a href={tier.cta.href}>{tier.cta.label}</a>
            </div>
          </article>
        ))}
      </div>

      <p className="pricing-trial">
        Trials don&rsquo;t require a card up front \u00B7 Switch tiers or cancel from Settings &rarr; Billing
      </p>

      <section className="pricing-compare">
        <span className="pricing-compare-num">02 \u00B7 vs Buffer</span>
        <h2 className="pricing-compare-title">Same job, different opinion.</h2>
        <div className="pricing-compare-table" role="table">
          <div className="pricing-compare-head" role="row">
            <span role="columnheader">Feature</span>
            <span role="columnheader">RF Social Studio</span>
            <span role="columnheader">Buffer</span>
          </div>
          {COMPARISON.map((row) => (
            <div key={row.feature} className="pricing-compare-row" role="row">
              <span role="cell">{row.feature}</span>
              <span role="cell" className="is-us">{row.us}</span>
              <span role="cell">{row.buffer}</span>
            </div>
          ))}
        </div>
      </section>

      <h2>Questions worth answering</h2>
      <p>
        <strong>Do I need a credit card to start the trial?</strong> No &mdash; sign in,
        click upgrade, and you&rsquo;re in. We ask for billing details at the end of
        the 14 days, and only if you stay.
      </p>
      <p>
        <strong>What happens at the end of the trial?</strong> If you don&rsquo;t add a
        card, your account drops back to Free. Your drafts and brand profile
        stay put.
      </p>
      <p>
        <strong>Can I switch plans?</strong> Yes &mdash; upgrade or downgrade from
        Settings &rarr; Billing. Pro-rated mid-cycle.
      </p>
      <p>
        <strong>What payment methods?</strong> Cards via Stripe (worldwide).
        Apple Pay and Google Pay supported in checkout.
      </p>
    </PublicLayout>
  );
}
