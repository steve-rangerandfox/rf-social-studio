import React, { Component } from "react";

// Recoverable error boundary. Two recovery paths:
//   1. Reset (local) — clears the error and re-renders children, so the
//      rest of the app (IndexedDB draft state, offline queue, etc.) is
//      preserved. Use this as the first try.
//   2. Reload — only offered as a last resort, since reload wipes
//      in-flight mutations.
//
// Props:
//   scope    — short label shown in the headline ("Calendar", "Analytics")
//   fallback — optional ({ error, reset }) => ReactNode to fully replace the
//              default fallback UI. Useful for compact in-view fallbacks
//              that don't take over the viewport.
//   onReset  — optional callback invoked when reset is clicked.

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown error",
    };
  }

  componentDidCatch(error, info) {
    console.error(
      "[rf-studio] Uncaught render error:",
      this.props.scope ? `[${this.props.scope}]` : "",
      error?.message || error,
      info?.componentStack?.slice(0, 400),
    );
  }

  reset() {
    this.setState({ hasError: false, errorMessage: "" });
    if (typeof this.props.onReset === "function") {
      this.props.onReset();
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (typeof this.props.fallback === "function") {
      return this.props.fallback({ error: this.state.errorMessage, reset: this.reset });
    }

    const scope = this.props.scope;
    const kicker = scope ? scope : "Studio";
    const headline = scope
      ? `${scope} tripped on its way in.`
      : "Something tripped on its way in.";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: 18,
          padding: 32,
          fontFamily: '"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif',
          background: "#ffffff",
          color: "#09090b",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            border: "1px solid #e4e4e7",
            borderRadius: 999,
            background: "#fafafa",
            fontFamily: '"Switzer", sans-serif',
            fontSize: 13,
            fontWeight: 500,
            color: "#52525b",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1" }} />
          {kicker} · Recoverable
        </div>
        <div
          style={{
            fontFamily: '"Bricolage Grotesque", "Switzer", sans-serif',
            fontSize: "clamp(28px, 3.6vw, 40px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            color: "#09090b",
            textAlign: "center",
            maxWidth: "20ch",
          }}
        >
          {headline}
        </div>
        <div
          style={{
            fontSize: 15,
            color: "#52525b",
            maxWidth: 480,
            textAlign: "center",
            lineHeight: 1.65,
          }}
        >
          Local drafts are safe. Try this view again first &mdash; reloading the studio is the last resort and will wipe in-flight changes in this tab.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            style={{
              padding: "11px 22px",
              background: "#09090b",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={this.reset}
          >
            Try this view again
          </button>
          <button
            style={{
              padding: "11px 22px",
              background: "#ffffff",
              color: "#09090b",
              border: "1px solid #e4e4e7",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
            onClick={() => window.location.reload()}
          >
            Reload the studio
          </button>
        </div>
        {import.meta.env.DEV && (
          <pre
            style={{
              marginTop: 16,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 12,
              color: "#dc2626",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "12px 16px",
              maxWidth: 640,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {this.state.errorMessage}
          </pre>
        )}
      </div>
    );
  }
}
