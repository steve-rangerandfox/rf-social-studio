import { SignIn, useAuth } from "@clerk/react";
import { Routes, Route } from "react-router-dom";

import App from "../App.jsx";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import { LoadingShell } from "./LoadingShell.jsx";

const AUTH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700&display=swap');

@font-face {
  font-family: 'Plaak Ney';
  src: url('/fonts/Plaak - 56-Ney-Heavy-205TF.otf') format('opentype');
  font-weight: 900;
  font-style: normal;
  font-display: swap;
}

.auth-shell{
  min-height:100vh;
  display:grid;
  grid-template-columns:minmax(280px, 0.95fr) minmax(420px, 0.9fr);
  background:linear-gradient(180deg, #f8f4ed 0%, #f1ece2 100%);
  color:#181714;
}

.auth-panel{
  position:relative;
  padding:56px 48px;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  border-right:1px solid rgba(24,23,20,0.08);
}

/* Editorial wordmark lockup — replaces the circular badge. The Bricolage
   display + JBM caption combo is the same vocabulary as the studio chrome,
   so the auth screen reads as the same authored system. */
.auth-mark{
  display:flex;
  flex-direction:column;
  gap:4px;
}

.auth-mark-name{
  font:800 28px/0.95 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.045em;
  color:#111111;
}

.auth-mark-sub{
  font:600 10px/1 "JetBrains Mono", monospace;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:#8b8377;
}

.auth-hero{
  position:relative;
  z-index:1;
  max-width:520px;
}

.auth-kicker{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:8px 12px;
  border:1px solid rgba(24,23,20,0.08);
  border-radius:999px;
  background:rgba(251,250,246,0.78);
  color:#4d463d;
  font:600 11px/1 "JetBrains Mono", monospace;
  letter-spacing:0.1em;
  text-transform:uppercase;
}

.auth-kicker-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#FF7A00;
}

.auth-title{
  margin-top:22px;
  max-width:10ch;
  font:800 clamp(48px, 6vw, 78px)/0.92 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.065em;
  color:#111111;
}

.auth-body{
  margin-top:20px;
  max-width:470px;
  color:#5e584f;
  font:400 17px/1.7 "Switzer", "Helvetica Neue", Arial, system-ui, sans-serif;
}

.auth-features{
  margin-top:32px;
  max-width:480px;
}

.auth-features-list{
  list-style:none;
  padding:0;
  margin:0;
  display:flex;
  flex-direction:column;
  gap:16px;
}

.auth-features-list li{
  font:400 15px/1.6 "Switzer", "Helvetica Neue", Arial, system-ui, sans-serif;
  color:#5e584f;
  padding-left:20px;
  position:relative;
}

.auth-features-list li::before{
  content:"";
  position:absolute;
  left:0;
  top:11px;
  width:6px;
  height:6px;
  border-radius:50%;
  background:#181714;
}

.auth-features-list li strong{
  color:#181714;
  font-weight:600;
  font-family:"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif;
}

/* Footer is now an editorial colophon-style lockup — pull-quote +
   typographic mark, set against a fine top rule. Replaces the
   conventional "Sign in to continue. Authentication is handled
   securely…" boilerplate. */
.auth-footnote{
  position:relative;
  max-width:480px;
  padding-top:24px;
  border-top:1px solid rgba(24,23,20,0.1);
  display:flex;
  flex-direction:column;
  gap:8px;
}

.auth-footnote-quote{
  font:500 16px/1.55 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.02em;
  color:#2e2c28;
}

.auth-footnote-attribution{
  font:600 10px/1 "JetBrains Mono", monospace;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:#8b8377;
}

.auth-stage{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:42px;
}

.auth-card-wrap{
  position:relative;
  width:min(100%, 460px);
}

@media (max-width: 980px){
  .auth-shell{
    grid-template-columns:1fr;
  }

  .auth-panel{
    border-right:none;
    border-bottom:1px solid rgba(24,23,20,0.08);
    min-height:auto;
    gap:28px;
  }

  .auth-stage{
    padding:28px 20px 36px;
  }

  .auth-stage::before{
    inset:10px;
    border-radius:24px;
  }
}

@media (max-width: 640px){
  .auth-panel{
    padding:28px 20px;
  }

  .auth-title{
    font-size:38px;
  }

  .auth-body{
    font-size:15px;
  }

  .auth-stage{
    padding:16px 12px 24px;
  }
}
`;

const signInAppearance = {
  variables: {
    colorPrimary: "#FF7A00",
    colorText: "#181714",
    colorTextSecondary: "#5E584F",
    colorBackground: "#FBFAF6",
    colorInputBackground: "#F7F4EE",
    colorInputText: "#181714",
    borderRadius: "18px",
    fontFamily: '"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif',
  },
  elements: {
    rootBox: {
      width: "100%",
    },
    cardBox: {
      width: "100%",
      boxShadow: "0 22px 70px rgba(24,23,20,0.12)",
      border: "1px solid rgba(24,23,20,0.10)",
      background: "rgba(251,250,246,0.96)",
      backdropFilter: "blur(16px)",
      borderRadius: "26px",
    },
    headerTitle: {
      fontFamily: '"Bricolage Grotesque", sans-serif',
      fontSize: "40px",
      lineHeight: "0.94",
      letterSpacing: "-0.065em",
      fontWeight: "800",
      color: "#111111",
    },
    headerSubtitle: {
      fontSize: "14px",
      color: "#5E584F",
      lineHeight: "1.6",
    },
    socialButtonsBlockButton: {
      minHeight: "52px",
      borderRadius: "999px",
      border: "1px solid rgba(24,23,20,0.12)",
      boxShadow: "0 8px 20px rgba(24,23,20,0.05)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,241,232,0.96))",
      fontSize: "14px",
      fontWeight: "700",
      transition: "background 120ms ease, border-color 120ms ease, transform 120ms ease",
    },
    socialButtonsBlockButtonText: {
      color: "#181714",
      fontWeight: "600",
    },
    socialButtonsBlockButtonArrow: {
      color: "#5E584F",
    },
    socialButtonsProviderIcon: {
      width: "18px",
      height: "18px",
    },
    dividerLine: {
      background: "rgba(24,23,20,0.08)",
    },
    dividerText: {
      color: "#8B8377",
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: "10px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
    },
    formFieldLabel: {
      color: "#5E584F",
      fontSize: "11px",
      fontWeight: "600",
      fontFamily: '"JetBrains Mono", monospace',
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
    formFieldInput: {
      minHeight: "50px",
      borderRadius: "16px",
      border: "1px solid rgba(24,23,20,0.08)",
      background: "#F7F4EE",
      boxShadow: "none",
    },
    formButtonPrimary: {
      minHeight: "52px",
      borderRadius: "999px",
      // Single-color CTA — strips the gradient (kept once, on the brand
      // mark in marketing surfaces). Premium products commit to one
      // brand color on primary actions; the gradient is reserved as a
      // signature surface.
      background: "#181714",
      boxShadow: "0 12px 28px rgba(24,23,20,0.18)",
      fontSize: "14px",
      fontWeight: "700",
      color: "#FBFAF6",
      transition: "background 140ms ease, box-shadow 140ms ease, transform 140ms ease",
      "&:hover": {
        background: "#2E2C28",
      },
    },
    footer: {
      background: "linear-gradient(180deg, rgba(240,234,225,0.42) 0%, rgba(240,234,225,0.72) 100%)",
      borderTop: "1px solid rgba(24,23,20,0.06)",
    },
    footerActionText: {
      color: "#5E584F",
    },
    footerActionLink: {
      color: "#181714",
      fontWeight: "600",
    },
    identityPreviewText: {
      color: "#5E584F",
    },
    formResendCodeLink: {
      color: "#181714",
      fontWeight: "600",
    },
    otpCodeFieldInput: {
      borderRadius: "16px",
      border: "1px solid rgba(24,23,20,0.08)",
      background: "#F7F4EE",
    },
    alertText: {
      color: "#DC2626",
    },
    formFieldWarningText: {
      color: "#9B7441",
    },
    formFieldSuccessText: {
      color: "#5E6659",
    },
    badge: {
      borderRadius: "999px",
      background: "rgba(155,116,65,0.1)",
      color: "#9B7441",
      fontFamily: '"JetBrains Mono", monospace',
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    },
  },
};

export function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <LoadingShell label="Signing you in" />;
  }

  if (!isSignedIn) {
    return (
      <>
        <style>{AUTH_STYLES}</style>
        <div className="auth-shell">
          <section className="auth-panel">
            <div className="auth-mark">
              <div className="auth-mark-name">Ranger &amp; Fox</div>
              <div className="auth-mark-sub">Social Studio</div>
            </div>

            <div className="auth-hero">
              <div className="auth-kicker">
                <span className="auth-kicker-dot" />
                Publishing workspace
              </div>
              <h1 className="auth-title">Calm operations for a sharper content system.</h1>
              <p className="auth-body">
                Review the queue, shape story assets, and keep approvals moving in a workspace that feels
                considered from the first screen to the final post.
              </p>
              <div className="auth-features">
                <ul className="auth-features-list">
                  <li><strong>One workspace.</strong> Calendar, grid, story design, asset library.</li>
                  <li><strong>Low-noise UX.</strong> Editorial rhythm — calm by default, dense when you need it.</li>
                  <li><strong>Team ready.</strong> Comments, approval flow, ownership tracking.</li>
                </ul>
              </div>
            </div>

            <div className="auth-footnote">
              <p className="auth-footnote-quote">
                &ldquo;Editorial rhythm, calm by default — dense when you need it.&rdquo;
              </p>
              <p className="auth-footnote-attribution">House voice · 2026</p>
            </div>
          </section>

          <section className="auth-stage">
            <div className="auth-card-wrap">
              <SignIn appearance={signInAppearance} />
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/*" element={<App />} />
      </Routes>
    </ErrorBoundary>
  );
}
