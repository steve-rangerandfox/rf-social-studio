import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./landing.css";
import { Kicker, HeroArt, ChaosArt, CarouselArt, StoryArt } from "./LandingArt.jsx";
import { Seo } from "./Seo.jsx";
import { Keyboard, CalendarIcon, Stack, Globe, CheckCircle, Person } from "./icons/index.jsx";

// Public landing — Relay editorial marketing site, ported from the
// design handoff. The prototype's Tweaks panel + accent/density toggles
// (design-tool scaffolding) and the placeholder social-proof logos are
// dropped. Pricing mirrors the real tiers in Pricing.jsx /
// server/entitlements.js — NOT the prototype's $79/$149 placeholders.

const PRIMARY_CTA = "Start a 14-day trial";
const DEMO_URL = import.meta.env.VITE_DEMO_URL || "mailto:steve@rangerandfox.tv?subject=Relay%20demo";

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
            <Kicker num="01" label="The design-first social studio" />
            <h1>
              design seamless carousels and stories.{" "}
              <em>publish them on schedule.</em>
            </h1>
            <p className="lp-hero-sub">
              Relay is one workspace for studios running client social — a real canvas
              for carousels and multi-frame stories, an editorial queue your clients can
              approve from a link, and Instagram + LinkedIn publishing built in.
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
            Most planners stop at a caption box. Relay has a full carousel designer and a multi-artboard story canvas built in &mdash; so the creative happens where the calendar lives, and publishes itself on schedule.
          </p>
        </div>

        <div className="lp-pair lp-reveal">
          <div className="lp-pair-copy">
            <Kicker num="3.1" label="Seamless carousels" />
            <h3 className="lp-pair-h">one photo, split seamlessly across every slide.</h3>
            <p className="lp-pair-body">
              Fit a single image edge-to-edge across a 2&ndash;10 slide carousel &mdash; the swipe reads as one continuous frame. Five editorial layouts on top, then Relay renders every slide and publishes the carousel to Instagram at its scheduled time.
            </p>
            <div className="lp-pair-feature">Seamless photo split · title / number / quote / CTA layouts · auto-publish</div>
            <Link to="/tools/carousel-splitter" className="lp-pair-toollink">
              Just need the split? Use the free carousel splitter →
            </Link>
          </div>
          <div className="lp-pair-art"><CarouselArt /></div>
        </div>

        <div className="lp-pair lp-pair-r lp-reveal">
          <div className="lp-pair-copy">
            <Kicker num="3.2" label="Story artboards" />
            <h3 className="lp-pair-h">stories on artboards &mdash; published as every frame.</h3>
            <p className="lp-pair-body">
              A Figma-style canvas with side-by-side artboards: pan one image across all of them, layer type over video, and Relay publishes each canvas as its own story frame, in order, at the scheduled time.
            </p>
            <div className="lp-pair-feature">Multi-canvas artboards · panorama fit · layers &amp; snap · multi-frame auto-publish</div>
          </div>
          <div className="lp-pair-art"><StoryArt /></div>
        </div>

        <div className="lp-pair lp-reveal">
          <div className="lp-pair-copy">
            <Kicker num="3.3" label="Client approvals" />
            <h3 className="lp-pair-h">clients approve from a link. no login, no exports.</h3>
            <p className="lp-pair-body">
              Send one private link &mdash; your client sees everything awaiting sign-off, taps Approve or requests changes, and their notes land on the post as comments. No accounts to manage, no screenshots in Slack, no &ldquo;which version is this?&rdquo;
            </p>
            <div className="lp-pair-feature">One shareable link · approve / request changes · revoke anytime</div>
          </div>
          <div className="lp-pair-art">
            <div className="lp-approve-mock">
              <div className="lp-approve-head">
                <span className="lp-approve-brand">Relay</span>
                <span className="lp-approve-studio">@rangerandfox</span>
              </div>
              <div className="lp-approve-title">2 posts need your sign-off.</div>
              <div className="lp-approve-card">
                <div className="lp-approve-thumb" />
                <div className="lp-approve-body">
                  <div className="lp-approve-meta">Instagram post · Thu, Jul 16, 9:30 AM</div>
                  <div className="lp-approve-note">New work — the Whitworth identity, in public today.</div>
                  <div className="lp-approve-actions">
                    <span className="lp-approve-btn primary">Approve</span>
                    <span className="lp-approve-btn">Request changes</span>
                  </div>
                </div>
              </div>
              <div className="lp-approve-card done">
                <div className="lp-approve-thumb alt" />
                <div className="lp-approve-body">
                  <div className="lp-approve-meta">Instagram carousel · Fri, Jul 17, 10:00 AM</div>
                  <div className="lp-approve-note">Case study — rebranding Nordlys Coffee.</div>
                  <div className="lp-approve-ok">Approved ✓</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const DETAIL_ITEMS = [
  { n: "04.1", t: "Command palette", p: "Every action, one keystroke away. ⌘K opens commands across navigation, filter, status and publish — no menus, no hunt.", Icon: Keyboard },
  { n: "04.2", t: "Calendar view", p: "Month, week, day. Quiet weeks read quiet. Drag a card to reschedule; the composer follows.", Icon: CalendarIcon },
  { n: "04.3", t: "Bulk operations", p: "Multi-select across clients. Change status, reassign, reschedule in one action. Ten-second undo on everything.", Icon: Stack },
  { n: "04.4", t: "Offline-first", p: "Works on the train. Every edit persists locally and syncs the moment you're back.", Icon: Globe },
  { n: "04.5", t: "Publish receipts", p: "Every scheduled post reports back — posted with a link, or exactly why it didn't and how to fix it. No silent failures.", Icon: CheckCircle },
  { n: "04.6", t: "Team & assignees", p: "Every post belongs to a person. Avatar in the row, color in the calendar, no wondering who's on what.", Icon: Person },
];

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
          {DETAIL_ITEMS.map((it) => (
            <div className="lp-detail" key={it.n}>
              <div className="lp-detail-num">{it.n}</div>
              <div className="lp-detail-icon"><it.Icon size={22} /></div>
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
    name: "Solo", tag: "Most popular", amt: "$24", unit: "/ month",
    pitch: "The full design-first studio for one brand — design it, schedule it, it publishes itself.",
    feats: ["Unlimited scheduled posts", "Seamless carousels + multi-frame stories", "AI captions + variants", "Brand learning from website", "14-day free trial — no card"],
    cta: { label: PRIMARY_CTA, to: "/app?upgrade=essentials" }, pro: true, primary: true,
  },
  {
    name: "Studio", tag: "For client work", amt: "$59", unit: "/ month",
    pitch: "Client approval links, monthly strategy, and seats for the studio.",
    feats: ["Everything in Solo", "Client approval links — no client logins", "AI monthly strategy generator", "Up to 3 seats included", "14-day free trial — no card"],
    cta: { label: PRIMARY_CTA, to: "/app?upgrade=team" }, pro: false, primary: false, demo: true,
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
              {t.demo && <a className="lp-demo-link" href={DEMO_URL}>Running client accounts? Book a demo →</a>}
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
            <Link to="/tools/carousel-splitter">Free carousel splitter</Link>
            <Link to="/guides/seamless-carousel-instagram">Guides</Link>
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
      <Seo
        title="Relay — Design seamless carousels and stories. Publish on schedule."
        description="The design-first social studio: seamless Instagram carousels, multi-frame stories on artboards, client approvals from a link, and scheduled publishing to Instagram and LinkedIn."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Relay",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: "Design-first social media studio for carousels, stories, scheduling, and client approvals.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free tier; paid plans with 14-day trial." },
          publisher: { "@type": "Organization", name: "Ranger & Fox" },
        }}
      />
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
