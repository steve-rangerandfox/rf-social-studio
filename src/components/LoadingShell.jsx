import React from "react";

// Minimal brand-aligned loading indicator. Inline styles so it works
// outside the studio.css scope (e.g. AuthGate before the app mounts).
// Two variants: "page" fills the viewport, "overlay" sits centered on
// whatever parent it's rendered into (used for lazy-modal Suspense).

const SPINNER_KEYFRAMES = `
@keyframes rf-spinner-pulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
  40% { transform: scale(1); opacity: 1; }
}
`;

function Dot({ delay }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "#09090b",
        margin: "0 3px",
        animation: `rf-spinner-pulse 1.1s ${delay}s infinite ease-in-out both`,
      }}
    />
  );
}

export function LoadingShell({ variant = "page", label = "Loading\u2026" }) {
  const wrapperStyle = variant === "page"
    ? {
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "#ffffff",
        color: "#71717a",
        fontFamily: '"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif',
      }
    : {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "rgba(255, 255, 255, 0.78)",
        backdropFilter: "blur(4px)",
        color: "#71717a",
        fontFamily: '"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif',
        borderRadius: "inherit",
      };

  return (
    <div style={wrapperStyle} role="status" aria-live="polite">
      <style>{SPINNER_KEYFRAMES}</style>
      <div aria-hidden="true">
        <Dot delay={0} />
        <Dot delay={0.16} />
        <Dot delay={0.32} />
      </div>
      <span
        style={{
          fontSize: 13,
          fontFamily: '"Switzer", sans-serif',
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
    </div>
  );
}
