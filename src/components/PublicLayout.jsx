import React from "react";

// Shared chrome for legal / public pages (Privacy, Terms, Data Deletion,
// future /pricing). Replaces three near-identical inline-styled shells
// with a single editorial layout — wordmark + kicker + fine rule above
// content, mono colophon below — so the unsigned-out surface area reads
// as one authored system.

const PUBLIC_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700&display=swap');

.public-shell{
  min-height:100vh;
  background:#ffffff;
  color:#09090b;
  font-family:"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif;
  font-feature-settings:"ss01", "cv11";
}

.public-inner{
  max-width:740px;
  margin:0 auto;
  padding:72px 24px 96px;
}

.public-mark{
  display:flex;
  flex-direction:column;
  gap:2px;
  margin-bottom:56px;
  text-decoration:none;
}

.public-mark-name{
  font:700 20px/1 "Switzer", "Helvetica Neue", Arial, sans-serif;
  letter-spacing:-0.02em;
  color:#09090b;
}

.public-mark-sub{
  font:500 13px/1.4 "Switzer", "Helvetica Neue", Arial, sans-serif;
  letter-spacing:-0.005em;
  color:#71717a;
}

.public-eyebrow{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:6px 12px;
  border:1px solid #e4e4e7;
  border-radius:999px;
  background:#fafafa;
  font:500 13px/1 "Switzer", "Helvetica Neue", Arial, sans-serif;
  color:#52525b;
  margin-bottom:20px;
}

.public-eyebrow-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#6366f1;
}

.public-title{
  font:700 clamp(40px, 5vw, 56px)/1.02 "Bricolage Grotesque", "Switzer", sans-serif;
  letter-spacing:-0.035em;
  color:#09090b;
  margin:0 0 16px;
  text-wrap:balance;
}

.public-meta{
  font:500 14px/1.4 "Switzer", "Helvetica Neue", Arial, sans-serif;
  color:#71717a;
  margin:0 0 40px;
}

.public-rule{
  height:1px;
  background:#e4e4e7;
  margin:0 0 40px;
}

.public-body{
  font-size:15px;
  line-height:1.7;
  color:#3f3f46;
}

.public-body h2{
  font:600 22px/1.25 "Switzer", "Helvetica Neue", Arial, sans-serif;
  letter-spacing:-0.02em;
  color:#09090b;
  margin:36px 0 12px;
}

.public-body p{ margin:0 0 16px; }

.public-body ul, .public-body ol{
  margin:0 0 16px;
  padding-left:22px;
}

.public-body li{ margin-bottom:6px; }

.public-body strong{
  color:#09090b;
  font-weight:600;
}

.public-body a{
  color:#09090b;
  text-decoration:underline;
  text-decoration-color:#d4d4d8;
  text-underline-offset:3px;
}

.public-body a:hover{
  text-decoration-color:#09090b;
}

.public-colophon{
  margin-top:72px;
  padding-top:24px;
  border-top:1px solid #e4e4e7;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:24px;
  flex-wrap:wrap;
}

.public-colophon-mark{
  font:500 13px/1.4 "Switzer", "Helvetica Neue", Arial, sans-serif;
  color:#52525b;
}

.public-colophon-meta{
  font:500 13px/1 "Switzer", "Helvetica Neue", Arial, sans-serif;
  color:#71717a;
}

@media (max-width:640px){
  .public-inner{ padding:36px 18px 64px; }
  .public-mark{ margin-bottom:32px; }
  .public-rule{ margin-bottom:24px; }
}
`;

export function PublicLayout({ eyebrow, title, meta, children, colophonMeta = "House voice \u00B7 2026" }) {
  return (
    <>
      <style>{PUBLIC_STYLES}</style>
      <div className="public-shell">
        <div className="public-inner">
          <a href="/" className="public-mark" aria-label="Ranger & Fox Social Studio — home">
            <span className="public-mark-name">Ranger &amp; Fox</span>
            <span className="public-mark-sub">Social Studio</span>
          </a>

          {eyebrow && (
            <div className="public-eyebrow">
              <span className="public-eyebrow-dot" />
              {eyebrow}
            </div>
          )}

          {title && <h1 className="public-title">{title}</h1>}
          {meta && <p className="public-meta">{meta}</p>}

          <div className="public-rule" />

          <div className="public-body">{children}</div>

          <div className="public-colophon">
            <div className="public-colophon-mark">Ranger &amp; Fox Social Studio</div>
            <div className="public-colophon-meta">{colophonMeta}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export function PublicSection({ title, children }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
