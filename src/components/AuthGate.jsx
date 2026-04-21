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
  background:#ffffff;
  color:#09090b;
  font-family:"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif;
}

.auth-panel{
  position:relative;
  padding:56px 48px;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  border-right:1px solid #e4e4e7;
  background:#fafafa;
}

.auth-mark{
  display:flex;
  flex-direction:column;
  gap:2px;
}

.auth-mark-name{
  font:700 20px/1 "Switzer", "Helvetica Neue", Arial, sans-serif;
  letter-spacing:-0.02em;
  color:#09090b;
}

.auth-mark-sub{
  font:500 13px/1.4 "Switzer", "Helvetica Neue", Arial, sans-serif;
  color:#71717a;
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
  padding:6px 12px;
  border:1px solid #e4e4e7;
  border-radius:999px;
  background:#ffffff;
  color:#52525b;
  font:500 13px/1 "Switzer", "Helvetica Neue", Arial, sans-serif;
}

.auth-kicker-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#6366f1;
}

.auth-title{
  margin-top:24px;
  max-width:12ch;
  font:700 clamp(44px, 5.5vw, 68px)/1.02 "Bricolage Grotesque", "Switzer", sans-serif;
  letter-spacing:-0.035em;
  color:#09090b;
  text-wrap:balance;
}

.auth-body{
  margin-top:20px;
  max-width:480px;
  color:#52525b;
  font:400 16px/1.65 "Switzer", "Helvetica Neue", Arial, system-ui, sans-serif;
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
  gap:14px;
}

.auth-features-list li{
  font:400 14px/1.55 "Switzer", "Helvetica Neue", Arial, system-ui, sans-serif;
  color:#52525b;
  padding-left:22px;
  position:relative;
}

.auth-features-list li::before{
  content:"";
  position:absolute;
  left:0;
  top:8px;
  width:12px;
  height:7px;
  border-left:1.5px solid #09090b;
  border-bottom:1.5px solid #09090b;
  transform:rotate(-45deg);
}

.auth-features-list li strong{
  color:#09090b;
  font-weight:600;
}

.auth-footnote{
  position:relative;
  max-width:480px;
  padding-top:24px;
  border-top:1px solid #e4e4e7;
  display:flex;
  flex-direction:column;
  gap:6px;
}

.auth-footnote-quote{
  font:500 15px/1.55 "Switzer", "Helvetica Neue", Arial, sans-serif;
  letter-spacing:-0.005em;
  color:#3f3f46;
}

.auth-footnote-attribution{
  font:500 13px/1 "Switzer", "Helvetica Neue", Arial, sans-serif;
  color:#71717a;
}

.auth-stage{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:42px;
  background:#ffffff;
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
    colorPrimary: "#09090b",
    colorText: "#09090b",
    colorTextSecondary: "#52525b",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#09090b",
    borderRadius: "10px",
    fontFamily: '"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif',
  },
  elements: {
    rootBox: {
      width: "100%",
    },
    cardBox: {
      width: "100%",
      boxShadow: "0 12px 40px rgba(9,9,11,0.08)",
      border: "1px solid #e4e4e7",
      background: "#ffffff",
      backdropFilter: "none",
      borderRadius: "16px",
    },
    headerTitle: {
      fontFamily: '"Bricolage Grotesque", "Switzer", sans-serif',
      fontSize: "28px",
      lineHeight: "1.15",
      letterSpacing: "-0.025em",
      fontWeight: "700",
      color: "#09090b",
    },
    headerSubtitle: {
      fontSize: "14px",
      color: "#52525b",
      lineHeight: "1.55",
    },
    socialButtonsBlockButton: {
      minHeight: "44px",
      borderRadius: "10px",
      border: "1px solid #e4e4e7",
      boxShadow: "none",
      background: "#ffffff",
      fontSize: "14px",
      fontWeight: "500",
      transition: "background 120ms ease, border-color 120ms ease",
      "&:hover": {
        background: "#fafafa",
        borderColor: "#d4d4d8",
      },
    },
    socialButtonsBlockButtonText: {
      color: "#09090b",
      fontWeight: "500",
    },
    socialButtonsBlockButtonArrow: {
      color: "#71717a",
    },
    socialButtonsProviderIcon: {
      width: "18px",
      height: "18px",
    },
    dividerLine: {
      background: "#e4e4e7",
    },
    dividerText: {
      color: "#71717a",
      fontFamily: '"Switzer", sans-serif',
      fontSize: "13px",
      letterSpacing: "0",
      textTransform: "none",
    },
    formFieldLabel: {
      color: "#3f3f46",
      fontSize: "13px",
      fontWeight: "500",
      fontFamily: '"Switzer", sans-serif',
      letterSpacing: "0",
      textTransform: "none",
    },
    formFieldInput: {
      minHeight: "42px",
      borderRadius: "10px",
      border: "1px solid #e4e4e7",
      background: "#ffffff",
      boxShadow: "none",
      fontSize: "14px",
    },
    formButtonPrimary: {
      minHeight: "44px",
      borderRadius: "10px",
      background: "#09090b",
      boxShadow: "none",
      fontSize: "14px",
      fontWeight: "600",
      color: "#ffffff",
      transition: "background 120ms ease",
      "&:hover": {
        background: "#27272a",
      },
    },
    footer: {
      background: "#fafafa",
      borderTop: "1px solid #e4e4e7",
    },
    footerActionText: {
      color: "#52525b",
    },
    footerActionLink: {
      color: "#09090b",
      fontWeight: "600",
    },
    identityPreviewText: {
      color: "#52525b",
    },
    formResendCodeLink: {
      color: "#09090b",
      fontWeight: "600",
    },
    otpCodeFieldInput: {
      borderRadius: "10px",
      border: "1px solid #e4e4e7",
      background: "#ffffff",
    },
    alertText: {
      color: "#dc2626",
    },
    formFieldWarningText: {
      color: "#d97706",
    },
    formFieldSuccessText: {
      color: "#16a34a",
    },
    badge: {
      borderRadius: "999px",
      background: "#f4f4f5",
      color: "#52525b",
      fontFamily: '"Switzer", sans-serif',
      textTransform: "none",
      letterSpacing: "0",
      fontSize: "13px",
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
              <SignIn appearance={signInAppearance} afterSignInUrl="/app" afterSignUpUrl="/app" signUpUrl="/app/sign-up" />
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
