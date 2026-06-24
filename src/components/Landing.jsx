import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./landing.css";
import { Kicker, HeroArt, ChaosArt, CarouselArt, StoryArt } from "./LandingArt.jsx";

// Public landing — Relay editorial marketing site, ported from the
// design handoff. The prototype's Tweaks panel + accent/density toggles
// (design-tool scaffolding) and the placeholder social-proof logos are
// dropped. Pricing mirrors the real tiers in Pricing.jsx /
// server/entitlements.js — NOT the prototype's $79/$149 placeholders.

const PRIMARY_CTA = "Start a 14-day trial";

// Reveal-on-scroll, with a safety net so nothing stays hidden.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".lp-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.01 },
    );
    els.forEach((el) => io.observe(el));
    const fallback = setTimeout(() => {
      document.querySelectorAll(".lp-reveal:not(.is-in)").forEach((el) => el.classList.add("is-in"));
    }, 1400);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, []);
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav className={"lp-nav" + (scrolled ? " is-scrolled" : "")}>
      <div className="lp-container">
        <div className="lp-nav-row">
          <a href="#top" className="lp-logo">
            <span className="lp-logo-mark">R</span>
            <span>Relay</span>
          </a>
          <div className="lp-nav-links">
            <a href="#workflow" className="lp-nav-link">Workflow</a>
            <a href="#detail" className="lp-nav-link">Details</a>
            <a href="#pricing" className="lp-nav-link">Pricing</a>
            <Link to="/app" className="lp-nav-link">Sign in</Link>
            <Link to="/app" className="lp-nav-cta">{PRIMARY_CTA}</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="lp-hero" id="top">
      <div className="lp-container">
        <div className="lp-hero-grid">
          <div className="lp-hero-copy lp-reveal">
            <Kicker num="01" label="Editorial calendar for studios" />
            <h1>
              the calendar for studios that run client work.{" "}
              <em>your queue, finally readable.</em>
            </h1>
            <p className="lp-hero-sub">
              One workspace for boutique studios managing Instagram, LinkedIn, and
              TikTok for brand clients. One queue, one composer, no tab-switching.
            </p>
            <div className="lp-hero-ctas">
              <Link to="/app" className="lp-btn lp-btn-primary lp-btn-large">
                {PRIMARY_CTA}
              </Link>
              <a href="#workflow" className="lp-btn lp-btn-ghost lp-btn-large">
                See the workflow
              </a>
            </div>
            <div className="lp-hero-fineprint">
              No credit card<span className="lp-dot" />14 days, all features<span className="lp-dot" />built by a studio that uses it daily
            </div>
          </div>
          <div className="lp-reveal">
            <HeroArt />
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="lp-section lp-pad" id="problem">
      <div className="lp-container">
        <div className="lp-problem-grid">
          <div className="lp-reveal">
            <Kicker num="02" label="What we lived in before" />
            <p className="lp-problem-lead">
              Spreadsheets for briefs. Notion for drafts. Later for scheduling. Slack for approvals. <em>Three different tools for the client to look at the work in.</em> None of them designed for how a studio actually runs.
            </p>
            <p className="lp-problem-body">
              We built Relay because we run a production studio and were living in that stack. It&rsquo;s a single workspace for your team to plan, write, review and publish — without switching tabs or losing your mind in the cells of a sheet.
            </p>
          </div>
          <div className="lp-reveal">
            <ChaosArt />
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section className="lp-section lp-pad-lg" id="workflow">
      <div className="lp-container">
        <div className="lp-reveal" style={{ maxWidth: 720, marginBottom: 80 }}>
          <Kicker num="03" label="The workflow" />
          <h2 className="lp-pricing-h" style={{ fontSize: "clamp(32px, 4vw, 48px)", margin: "22px 0 14px" }}>
            design the post. don&rsquo;t just schedule it.
          </h2>
          <p className="lp-pricing-sub" style={{ margin: 0 }}>
            Most planners stop at a caption box. Relay has a full carousel composer and a story designer built in &mdash; so the creative happens where the calendar lives, with nothing exported to another app.
          </p>
        </div>

        <div className="lp-pair lp-reveal">
          <div className="lp-pair-copy">
            <Kicker num="3.1" label="Carousel designer" />
            <h3 className="lp-pair-h">build the whole carousel, slide by slide.</h3>
            <p className="lp-pair-body">
              Five editorial layouts, your palette, drag to reorder. Design a 2&ndash;10 slide carousel and publish it straight to Instagram &mdash; no separate canvas tool, no re-upload, no leaving the studio.
            </p>
            <div className="lp-pair-feature">Title · number · photo · quote · CTA layouts · live preview</div>
          </div>
          <div className="lp-pair-art"><CarouselArt /></div>
        </div>

        <div className="lp-pair lp-pair-r lp-reveal">
          <div className="lp-pair-copy">
            <Kicker num="3.2" label="Story designer" />
            <h3 className="lp-pair-h">stories, on a real canvas.</h3>
            <p className="lp-pair-body">
              A 9:16 editor with layers, snap, and live preview. Compose the story where you plan it, then send it live &mdash; the design and the schedule never leave the same place.
            </p>
            <div className="lp-pair-feature">Layers · snap-to-grid · type &amp; image · instant preview</div>
          </div>
          <div className="lp-pair-art"><StoryArt /></div>
        </div>
      </div>
    </section>
  );
}

const DETAIL_ITEMS = [
  { n: "04.1", t: "Command palette", p: "Every action, one keystroke away. ⌘K opens commands across navigation, filter, status and publish — no menus, no hunt." },
  { n: "04.2", t: "Calendar view", p: "Month, week, day. Quiet weeks read quiet. Drag a card to reschedule; the composer follows." },
  { n: "04.3", t: "Bulk operations", p: "Multi-select across clients. Change status, reassign, reschedule in one action. Ten-second undo on everything." },
  { n: "04.4", t: "Offline-first", p: "Works on the train. Every edit persists locally and syncs the moment you're back." },
  { n: "04.5", t: "Story designer", p: "A small canvas tool for designing Instagram stories without leaving the workspace." },
  { n: "04.6", t: "Team & assignees", p: "Every post belongs to a person. Avatar in the row, color in the calendar, no wondering who's on what." },
];

function DetailIcon({ i }) {
  const props = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (i) {
    case 0: return (<svg {...props}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M8 11l2 2-2 2" /><path d="M12 15h4" /></svg>);
    case 1: return (<svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M8 3v4M16 3v4" /><circle cx="8" cy="14" r="1.2" fill="currentColor" /><circle cx="13" cy="14" r="1.2" fill="currentColor" /></svg>);
    case 2: return (<svg {...props}><rect x="3" y="4" width="14" height="3" rx="1" /><rect x="3" y="10" width="14" height="3" rx="1" /><rect x="3" y="16" width="14" height="3" rx="1" /><path d="M20 5l1.5 1.5" /><path d="M20 11l1.5 1.5" /><path d="M20 17l1.5 1.5" /></svg>);
    case 3: return (<svg {...props}><path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18" /><path d="M12 3a14 14 0 0 0 0 18" /><path d="M5 8l3 1.5" /></svg>);
    case 4: return (<svg {...props}><rect x="6" y="3" width="12" height="18" rx="2" /><circle cx="12" cy="9" r="2" /><path d="M9 15l3-2 3 2" /></svg>);
    case 5: return (<svg {...props}><circle cx="9" cy="9" r="3.5" /><circle cx="17" cy="11" r="2.5" /><path d="M3 19c0-3 3-5 6-5s6 2 6 5" /><path d="M14 19c0-2 2-3 3-3s3 1 3 3" /></svg>);
    default: return null;
  }
}

function Detail() {
  return (
    <section className="lp-section lp-dark lp-pad-lg" id="detail">
      <div className="lp-container">
        <div className="lp-reveal" style={{ maxWidth: 640, marginBottom: 0 }}>
          <Kicker num="04" label="Depth, without the feature list" />
          <h2 className="lp-dark-h">the things you only notice on day three.</h2>
          <p className="lp-dark-sub">
            The obvious surfaces sell the tool. These are the small ones that make studios stay.
          </p>
        </div>
        <div className="lp-detail-grid lp-reveal">
          {DETAIL_ITEMS.map((it, i) => (
            <div className="lp-detail" key={it.n}>
              <div className="lp-detail-num">{it.n}</div>
              <div className="lp-detail-icon"><DetailIcon i={i} /></div>
              <h3>{it.t}</h3>
              <p>{it.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Real tiers — mirrors Pricing.jsx / server/entitlements.js.
const TIERS = [
  {
    name: "Free", tag: "Start here", amt: "$0", unit: "forever",
    pitch: "Plan, draft, and preview without spending a cent.",
    feats: ["Up to 5 scheduled posts", "1 connected account", "Calendar, queue, grid views"],
    cta: { label: "Sign in to start", to: "/app" }, pro: false, primary: false,
  },
  {
    name: "Essentials", tag: "Most popular", amt: "$5", unit: "/ month",
    pitch: "AI captions, cross-post variants, and brand learning from a URL.",
    feats: ["Up to 100 scheduled posts", "3 connected accounts", "AI captions + variants", "Brand learning from website", "14-day free trial — no card"],
    cta: { label: PRIMARY_CTA, to: "/app?upgrade=essentials" }, pro: true, primary: true,
  },
  {
    name: "Team", tag: "For studios", amt: "$10", unit: "/ seat / month",
    pitch: "Monthly strategy generation, unlimited posts, and seats for the studio.",
    feats: ["Unlimited scheduled posts", "All connections, all platforms", "AI monthly strategy generator", "Approval flow + comments", "14-day free trial — no card"],
    cta: { label: PRIMARY_CTA, to: "/app?upgrade=team" }, pro: false, primary: false,
  },
];

function Pricing() {
  return (
    <section className="lp-section lp-pad-lg" id="pricing">
      <div className="lp-container">
        <div className="lp-reveal" style={{ maxWidth: 720, marginBottom: 64 }}>
          <Kicker num="05" label="Pricing" />
          <h2 className="lp-pricing-h">priced like a studio tool, not a platform.</h2>
          <p className="lp-pricing-sub">Three flat tiers, no per-post fees. Paid plans include a 14-day trial — no card up front.</p>
        </div>
        <div className="lp-price-grid lp-reveal">
          {TIERS.map((t) => (
            <div className={"lp-price" + (t.pro ? " is-pro" : "")} key={t.name}>
              {t.pro && <div className="lp-price-flag">{t.tag}</div>}
              <div className="lp-price-name">{t.name}</div>
              <div className="lp-price-amt">{t.amt}<span>{t.unit}</span></div>
              <div className="lp-price-tag">{t.pitch}</div>
              <ul className="lp-price-feats">
                {t.feats.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link to={t.cta.to} className={"lp-btn lp-price-cta " + (t.primary ? "lp-btn-primary" : "lp-btn-ghost")}>
                {t.cta.label}
              </Link>
            </div>
          ))}
        </div>
        <p className="lp-price-fineprint lp-reveal">
          Free forever for solo planning. Trials don&rsquo;t require a card. Switch tiers or cancel anytime from Settings → Billing.
          {" "}
          <Link to="/pricing" className="lp-compare-link">See the full comparison →</Link>
        </p>
      </div>
    </section>
  );
}

function Founder() {
  return (
    <section className="lp-section lp-pad" id="founder" style={{ background: "var(--surface)" }}>
      <div className="lp-founder lp-reveal">
        <Kicker num="06" label="Why we built it" />
        <p className="lp-founder-quote">
          We were managing Instagram for six brand clients out of a spreadsheet, three Slack threads and four browser tabs. It was embarrassing. Relay is what we actually use every day at Ranger &amp; Fox — we opened it to other studios because we figured we weren&rsquo;t the only ones living like that.
        </p>
        <div className="lp-founder-attr">
          <span className="lp-founder-attr-line" />
          <span><b style={{ color: "var(--ink)", fontWeight: 600 }}>Stephen Jelley</b>, Ranger &amp; Fox · co-founder</span>
        </div>
      </div>
    </section>
  );
}

function Final() {
  return (
    <section className="lp-final">
      <div className="lp-container">
        <h2 className="lp-final-h">
          built for studios. <em>priced for studios.</em><br />ready when you are.
        </h2>
        <div className="lp-final-cta">
          <Link to="/app" className="lp-btn lp-btn-accent lp-btn-large">
            {PRIMARY_CTA}
          </Link>
        </div>
        <div className="lp-final-fine">
          no credit card · no setup fee · just the tool
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-row">
          <div>
            <a href="#top" className="lp-logo" style={{ fontSize: 16 }}>
              <span className="lp-logo-mark">R</span>
              <span>Relay</span>
            </a>
            <div className="lp-footer-tag">
              The editorial content calendar for studios that run client social.
            </div>
          </div>
          <div className="lp-footer-links">
            <a href="#workflow">Workflow</a>
            <a href="#detail">Details</a>
            <Link to="/pricing">Pricing</Link>
            <Link to="/about">About</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/data-deletion">Data deletion</Link>
          </div>
          <div className="lp-footer-made">
            made by <a href="#top">Ranger &amp; Fox</a>
          </div>
        </div>
        <div className="lp-footer-bot">
          <span>© 2026 Ranger &amp; Fox Ltd</span>
          <span>Relay</span>
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  useReveal();
  return (
    <div className="lp-root">
      <div className="lp-grain" />
      <Nav />
      <Hero />
      <Problem />
      <Workflow />
      <Detail />
      <Pricing />
      <Founder />
      <Final />
      <Footer />
    </div>
  );
}
