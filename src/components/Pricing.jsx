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

.pricing-card.is-featured .pricing-tag{ color:#181714; }

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

@media (max-width:780px){
  .pricing-grid{ grid-template-columns:1fr; }
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
    cta: { label: "Sign in to start", href: "/" },
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
    cta: { label: "Start 14-day trial", href: "/?upgrade=essentials" },
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
    cta: { label: "Start 14-day trial", href: "/?upgrade=team" },
    primary: false,
  },
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
