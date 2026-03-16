import { SignIn, useAuth } from "@clerk/react";

import App from "../App.jsx";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

const AUTH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=JetBrains+Mono:wght@400;500&display=swap');

.auth-shell{
  min-height:100vh;
  display:grid;
  grid-template-columns:minmax(280px, 0.95fr) minmax(420px, 0.9fr);
  background:
    radial-gradient(circle at 18% 16%, rgba(210,200,186,0.52), transparent 26%),
    radial-gradient(circle at 78% 22%, rgba(118,104,97,0.12), transparent 20%),
    linear-gradient(180deg, #f8f4ed 0%, #f1ece2 100%);
  color:#181714;
}

.auth-panel{
  position:relative;
  overflow:hidden;
  padding:48px 42px;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  border-right:1px solid rgba(24,23,20,0.08);
}

.auth-panel::after{
  content:"";
  position:absolute;
  inset:auto -80px -90px 30%;
  height:260px;
  border-radius:999px;
  background:radial-gradient(circle, rgba(24,23,20,0.08) 0%, rgba(24,23,20,0) 72%);
  pointer-events:none;
}

.auth-mark{
  display:flex;
  align-items:center;
  gap:12px;
}

.auth-mark-badge{
  width:38px;
  height:38px;
  border-radius:50%;
  background:#181714;
  color:#fbfaf6;
  display:flex;
  align-items:center;
  justify-content:center;
  font:600 11px/1 "JetBrains Mono", monospace;
  letter-spacing:0.12em;
}

.auth-mark-copy strong{
  display:block;
  font:600 14px/1.2 "Inter", sans-serif;
  letter-spacing:-0.02em;
}

.auth-mark-copy span{
  display:block;
  margin-top:2px;
  color:#8b8377;
  font:500 11px/1.4 "JetBrains Mono", monospace;
  letter-spacing:0.08em;
  text-transform:uppercase;
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
  background:rgba(251,250,246,0.62);
  color:#5e584f;
  font:500 11px/1 "JetBrains Mono", monospace;
  letter-spacing:0.1em;
  text-transform:uppercase;
}

.auth-kicker-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#5e6659;
}

.auth-title{
  margin-top:22px;
  font:600 clamp(42px, 6vw, 72px)/0.95 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.05em;
}

.auth-body{
  margin-top:20px;
  max-width:470px;
  color:#5e584f;
  font:400 17px/1.7 "Inter", sans-serif;
}

.auth-metrics{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
  margin-top:28px;
}

.auth-metric{
  min-width:132px;
  padding:14px 16px;
  border:1px solid rgba(24,23,20,0.08);
  border-radius:18px;
  background:rgba(251,250,246,0.7);
  backdrop-filter:blur(12px);
}

.auth-metric strong{
  display:block;
  font:600 22px/1 "Bricolage Grotesque", sans-serif;
  letter-spacing:-0.04em;
}

.auth-metric span{
  display:block;
  margin-top:7px;
  color:#8b8377;
  font:500 10px/1.4 "JetBrains Mono", monospace;
  letter-spacing:0.12em;
  text-transform:uppercase;
}

.auth-footnote{
  position:relative;
  z-index:1;
  max-width:420px;
  color:#8b8377;
  font:400 12px/1.7 "Inter", sans-serif;
}

.auth-stage{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:42px;
}

.auth-stage::before{
  content:"";
  position:absolute;
  inset:28px;
  border-radius:30px;
  background:
    linear-gradient(135deg, rgba(251,250,246,0.7), rgba(240,234,225,0.68)),
    repeating-linear-gradient(-45deg, rgba(24,23,20,0.02) 0, rgba(24,23,20,0.02) 10px, transparent 10px, transparent 20px);
  border:1px solid rgba(24,23,20,0.06);
  box-shadow:0 24px 80px rgba(24,23,20,0.08);
}

.auth-card-wrap{
  position:relative;
  z-index:1;
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
    colorPrimary: "#181714",
    colorText: "#181714",
    colorTextSecondary: "#5E584F",
    colorBackground: "#FBFAF6",
    colorInputBackground: "#F7F4EE",
    colorInputText: "#181714",
    borderRadius: "18px",
    fontFamily: '"Inter", sans-serif',
  },
  elements: {
    rootBox: {
      width: "100%",
    },
    cardBox: {
      width: "100%",
      boxShadow: "0 22px 70px rgba(24,23,20,0.10)",
      border: "1px solid rgba(24,23,20,0.08)",
      background: "rgba(251,250,246,0.96)",
      backdropFilter: "blur(16px)",
      borderRadius: "26px",
    },
    headerTitle: {
      fontFamily: '"Bricolage Grotesque", sans-serif',
      fontSize: "36px",
      lineHeight: "1",
      letterSpacing: "-0.05em",
      fontWeight: "600",
    },
    headerSubtitle: {
      fontSize: "14px",
      color: "#5E584F",
      lineHeight: "1.6",
    },
    socialButtonsBlockButton: {
      minHeight: "52px",
      borderRadius: "999px",
      border: "1px solid rgba(24,23,20,0.08)",
      boxShadow: "none",
      background: "#FBFAF6",
      fontSize: "14px",
      fontWeight: "600",
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
      background: "#181714",
      boxShadow: "none",
      fontSize: "14px",
      fontWeight: "600",
      transition: "transform 120ms ease, opacity 120ms ease",
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
    return null;
  }

  if (!isSignedIn) {
    return (
      <>
        <style>{AUTH_STYLES}</style>
        <div className="auth-shell">
          <section className="auth-panel">
            <div className="auth-mark">
              <div className="auth-mark-badge">RF</div>
              <div className="auth-mark-copy">
                <strong>Ranger & Fox</strong>
                <span>Social Studio</span>
              </div>
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
              <div className="auth-metrics">
                <div className="auth-metric">
                  <strong>One place</strong>
                  <span>Calendar, grid, assets</span>
                </div>
                <div className="auth-metric">
                  <strong>Low-noise</strong>
                  <span>Editorial rhythm</span>
                </div>
                <div className="auth-metric">
                  <strong>Team ready</strong>
                  <span>Comments, status, ownership</span>
                </div>
              </div>
            </div>

            <p className="auth-footnote">
              Sign in to continue into the studio. Authentication is handled securely through Clerk, while the
              product shell keeps the same visual language as the rest of the planning experience.
            </p>
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
      <App />
    </ErrorBoundary>
  );
}
