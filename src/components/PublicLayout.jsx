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
  background:linear-gradient(180deg, #f8f4ed 0%, #f1ece2 100%);
  color:#181714;
  font-family:"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif;
}

.public-inner{
  max-width:740px;
  margin:0 auto;
  padding:64px 24px 96px;
}

.public-mark{
  display:flex;
  flex-direction:column;
  gap:4px;
  margin-bottom:48px;
}

.public-mark-name{
  font:800 22px/0.95 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.04em;
  color:#111111;
  text-decoration:none;
}

.public-mark-sub{
  font:600 10px/1 "JetBrains Mono", monospace;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:#8b8377;
}

.public-eyebrow{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:6px 10px;
  border:1px solid rgba(24,23,20,0.1);
  border-radius:999px;
  background:rgba(251,250,246,0.7);
  font:600 10px/1 "JetBrains Mono", monospace;
  letter-spacing:0.14em;
  text-transform:uppercase;
  color:#4d463d;
  margin-bottom:18px;
}

.public-eyebrow-dot{
  width:5px;
  height:5px;
  border-radius:50%;
  background:#181714;
}

.public-title{
  font:800 clamp(40px, 5vw, 56px)/0.95 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.05em;
  color:#111111;
  margin:0 0 14px;
  text-wrap:balance;
}

.public-meta{
  font:500 12px/1 "JetBrains Mono", monospace;
  letter-spacing:0.12em;
  text-transform:uppercase;
  color:#8b8377;
  margin:0 0 32px;
}

.public-rule{
  height:1px;
  background:rgba(24,23,20,0.1);
  margin:0 0 36px;
}

.public-body{
  font-size:15px;
  line-height:1.75;
  color:#2e2c28;
}

.public-body h2{
  font:700 19px/1.25 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.02em;
  color:#111111;
  margin:32px 0 10px;
}

.public-body p{ margin:0 0 14px; }

.public-body ul, .public-body ol{
  margin:0 0 14px;
  padding-left:20px;
}

.public-body li{ margin-bottom:6px; }

.public-body strong{
  color:#111111;
  font-weight:600;
}

.public-body a{
  color:#181714;
  text-decoration:underline;
  text-decoration-color:rgba(24,23,20,0.25);
  text-underline-offset:3px;
}

.public-body a:hover{
  text-decoration-color:#181714;
}

.public-colophon{
  margin-top:64px;
  padding-top:24px;
  border-top:1px solid rgba(24,23,20,0.1);
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:24px;
  flex-wrap:wrap;
}

.public-colophon-mark{
  font:600 12px/1.4 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.02em;
  color:#2e2c28;
}

.public-colophon-meta{
  font:600 10px/1 "JetBrains Mono", monospace;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:#8b8377;
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
