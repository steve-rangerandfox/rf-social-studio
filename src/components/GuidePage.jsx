import React from "react";
import { useParams, Link } from "react-router-dom";
import { Seo } from "./Seo.jsx";

// Programmatic SEO guides — real reference content for the queries Relay's
// buyers actually search. Data-driven: add an entry to GUIDES and it ships
// with title/meta/FAQ JSON-LD and shows up in the sitemap (update it!).

const GUIDES = {
  "seamless-carousel-instagram": {
    title: "How to Make a Seamless Instagram Carousel (2026 Guide) — Relay",
    description: "Step-by-step guide to seamless Instagram carousels: the right dimensions, how to split one image across slides so edges align perfectly, and how to schedule the result.",
    h1: "How to make a seamless Instagram carousel",
    updated: "July 2026",
    intro: "A seamless carousel is a single wide image split across 2–10 slides so that, as someone swipes, the picture flows edge-to-edge like one continuous frame. It’s one of the most reliable organic engagement patterns on Instagram — swipes count as interactions, and the format begs for them.",
    sections: [
      { h2: "1. Start with the right canvas", body: "Design one wide image at the full combined size. For a 3-panel portrait carousel that’s 3240×1350 (three 1080×1350 panels side by side). Portrait 4:5 panels get you the most screen space; square 1:1 also works. Keep faces and key copy away from the seams — anything on a panel border gets visually split." },
      { h2: "2. Split the image precisely", body: "Each panel must be an exact slice: cover-fit the image across the full combined width, then cut every 1080px. Off-by-a-pixel slices produce visible seams when swiping. Use a splitter that does the maths for you — our free carousel splitter runs in your browser and exports numbered panels ready to upload." },
      { h2: "3. Upload in order, never re-crop", body: "Post the panels as a carousel in their numbered order and don’t touch Instagram’s crop tool — any zoom breaks the alignment. If the first slide needs to work alone in the feed (it will be the preview), design your leftmost panel to stand on its own." },
      { h2: "4. Or skip the manual steps entirely", body: "Relay’s carousel designer does this end-to-end: fit one photo seamlessly across your slides, layer editorial text on top, and the carousel publishes itself to Instagram at its scheduled time — rendered at exactly 1080px per panel, no manual export or upload." },
    ],
    faq: [
      { q: "What size should a seamless Instagram carousel be?", a: "Each panel should be 1080×1350 (4:5 portrait) or 1080×1080 (square). Your source image should be the combined width — e.g. 3240px wide for three portrait panels." },
      { q: "How many slides can an Instagram carousel have?", a: "Up to 10 slides on a standard carousel. Seamless carousels work at any count from 2 to 10; 3–5 panels is the sweet spot for a readable swipe." },
      { q: "Why does my seamless carousel look misaligned?", a: "Almost always one of two things: the panels weren’t exact equal-width slices, or Instagram’s crop was adjusted during upload. Export precise slices and upload without re-cropping." },
    ],
    cta: { label: "Split an image free →", to: "/tools/carousel-splitter" },
    related: [["Instagram carousel sizes", "/guides/instagram-carousel-size"], ["Instagram story dimensions", "/guides/instagram-story-dimensions"]],
  },
  "instagram-carousel-size": {
    title: "Instagram Carousel Size & Dimensions (2026) — Relay",
    description: "The correct Instagram carousel dimensions for 2026: 1080×1350 portrait, 1080×1080 square, aspect ratios, slide limits, and safe zones — with a free splitter tool.",
    h1: "Instagram carousel sizes, all of them",
    updated: "July 2026",
    intro: "Instagram carousels support three aspect ratios, but every slide in one carousel must share the same ratio — Instagram crops all slides to match the first. Here are the numbers that matter.",
    sections: [
      { h2: "The dimensions", body: "Portrait (recommended): 1080×1350, 4:5 — the most screen real estate in feed. Square: 1080×1080, 1:1 — the classic, grid-friendly. Landscape: 1080×566, 1.91:1 — rarely worth it; it’s the smallest on screen. Instagram downsizes anything wider than 1080px, so always export at exactly 1080 wide." },
      { h2: "Slide limits and ordering", body: "Up to 10 slides per carousel. The first slide is the feed preview, so it has to work standalone. Mixed photo + video carousels are allowed; all slides still share one aspect ratio." },
      { h2: "Safe zones", body: "Keep text roughly 100px clear of the bottom edge (the caption/actions overlay sits there in some surfaces) and 60px from the sides. For seamless carousels, also keep key elements off the panel seams." },
      { h2: "Publishing at exact size", body: "Relay renders every carousel slide at exactly 1080px and publishes the whole carousel to Instagram on schedule — designed, rendered, and posted from one place." },
    ],
    faq: [
      { q: "What is the best Instagram carousel size?", a: "1080×1350 (4:5 portrait). It occupies the most feed space and is the default recommendation for 2026." },
      { q: "Can carousel slides have different sizes?", a: "No — Instagram crops every slide to the aspect ratio of the first slide. Design all slides at one ratio." },
      { q: "Do LinkedIn carousels use the same size?", a: "LinkedIn carousels are document posts (PDFs); 1080×1080 or 1080×1350 pages both work well there too." },
    ],
    cta: { label: "Make a seamless carousel →", to: "/tools/carousel-splitter" },
    related: [["Seamless carousel guide", "/guides/seamless-carousel-instagram"], ["Instagram story dimensions", "/guides/instagram-story-dimensions"]],
  },
  "instagram-story-dimensions": {
    title: "Instagram Story Dimensions & Safe Zones (2026) — Relay",
    description: "Instagram story size for 2026: 1080×1920, 9:16, plus the safe zones that keep text clear of the UI — and how multi-frame stories work.",
    h1: "Instagram story dimensions and safe zones",
    updated: "July 2026",
    intro: "Stories (and Reels) are 1080×1920 pixels at 9:16. Get the size right and one design works across Stories, Reels covers, and TikTok. The part people miss is the safe zones — Instagram’s own UI overlays eat into your canvas.",
    sections: [
      { h2: "The core numbers", body: "Canvas: 1080×1920 (9:16). Anything else gets letterboxed or cropped. Export as PNG or high-quality JPEG; videos up to 60s per story frame." },
      { h2: "Safe zones", body: "Top ~250px: your avatar, username, and the close button live here. Bottom ~310px: reply bar and actions. Keep headlines and CTAs in the middle ~1360px. Link stickers can go anywhere but are tappable — place them where thumbs already rest." },
      { h2: "Multi-frame stories", body: "A story “set” is just consecutive frames posted in order — great for narratives and panoramas, where one wide image pans across frames. Relay’s story designer works on side-by-side artboards: fit one image across all of them and every canvas publishes as its own story frame, in order, automatically." },
    ],
    faq: [
      { q: "What size is an Instagram story in 2026?", a: "1080×1920 pixels, 9:16 aspect ratio — unchanged for years and shared with Reels and TikTok." },
      { q: "Why is my story text getting covered?", a: "It’s inside a UI overlay zone. Keep text out of the top ~250px and bottom ~310px of the 1920px canvas." },
      { q: "Can I schedule Instagram stories?", a: "Yes — via the official API for professional accounts. Relay designs the frames and auto-publishes each one at the scheduled time." },
    ],
    cta: { label: "Design a story in Relay →", to: "/app" },
    related: [["Seamless carousel guide", "/guides/seamless-carousel-instagram"], ["Instagram carousel sizes", "/guides/instagram-carousel-size"]],
  },
};

export function GuidePage() {
  const { slug } = useParams();
  const g = GUIDES[slug];
  if (!g) return (
    <div className="gd-root"><style>{GUIDE_CSS}</style>
      <main className="gd-main"><h1 className="gd-h1">Guide not found</h1>
        <p className="gd-body"><Link className="gd-link" to="/tools/carousel-splitter">Try the free carousel splitter instead →</Link></p>
      </main>
    </div>
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="gd-root">
      <style>{GUIDE_CSS}</style>
      <Seo title={g.title} description={g.description} path={`/guides/${slug}`} jsonLd={jsonLd} />
      <header className="gd-head">
        <Link className="gd-brand" to="/">Relay</Link>
        <Link className="gd-cta-link" to="/app">Open the studio →</Link>
      </header>
      <main className="gd-main">
        <div className="gd-kicker">Guide · updated {g.updated}</div>
        <h1 className="gd-h1">{g.h1}</h1>
        <p className="gd-intro">{g.intro}</p>
        {g.sections.map((s) => (
          <section key={s.h2}>
            <h2 className="gd-h2">{s.h2}</h2>
            <p className="gd-body">{s.body}</p>
          </section>
        ))}
        <Link className="gd-btn" to={g.cta.to}>{g.cta.label}</Link>
        <section className="gd-faq">
          <h2 className="gd-h2">Frequently asked</h2>
          {g.faq.map((f) => (
            <div key={f.q} className="gd-faq-item">
              <h3 className="gd-q">{f.q}</h3>
              <p className="gd-body">{f.a}</p>
            </div>
          ))}
        </section>
        <nav className="gd-related">
          <span className="gd-kicker">Related</span>
          {g.related.map(([label, to]) => <Link key={to} className="gd-link" to={to}>{label}</Link>)}
        </nav>
        <footer className="gd-foot">
          Written by the team at <Link to="/" className="gd-link">Relay</Link> — the design-first social studio. Plan, design, and publish carousels and stories in one place.
        </footer>
      </main>
    </div>
  );
}

const GUIDE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700&display=swap');
.gd-root{min-height:100vh;background:#fafafa;color:#09090b;font-family:'Switzer','Helvetica Neue',Arial,system-ui,sans-serif}
.gd-head{display:flex;align-items:baseline;justify-content:space-between;max-width:720px;margin:0 auto;padding:28px 24px 0}
.gd-brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;letter-spacing:-0.03em;color:#09090b;text-decoration:none}
.gd-cta-link{font-size:13px;font-weight:600;color:#52525b;text-decoration:none}
.gd-cta-link:hover{color:#09090b}
.gd-main{max-width:720px;margin:0 auto;padding:40px 24px 64px}
.gd-kicker{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#71717a;margin-bottom:10px}
.gd-h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(28px,4.6vw,44px);letter-spacing:-0.04em;line-height:1.05;margin:0 0 16px}
.gd-h2{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:21px;letter-spacing:-0.02em;margin:34px 0 8px}
.gd-intro{font-size:16px;line-height:1.65;color:#3f3f46;margin:0}
.gd-body{font-size:15px;line-height:1.7;color:#52525b;margin:0}
.gd-btn{display:inline-block;margin-top:30px;padding:11px 22px;border-radius:999px;background:#09090b;color:#fff;font-size:14px;font-weight:600;text-decoration:none}
.gd-btn:hover{background:#27272a}
.gd-faq{margin-top:20px}
.gd-faq-item{padding:14px 0;border-bottom:1px solid #e4e4e7}
.gd-q{font-size:15px;font-weight:600;margin:0 0 6px}
.gd-related{display:flex;gap:16px;align-items:baseline;margin-top:36px;flex-wrap:wrap}
.gd-link{color:#09090b;font-weight:600;font-size:14px}
.gd-foot{margin-top:44px;padding-top:18px;border-top:1px solid #e4e4e7;font-size:13px;color:#71717a;line-height:1.6}
`;
