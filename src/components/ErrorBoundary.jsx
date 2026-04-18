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
    const headline = scope ? `${scope} failed to render` : "Something went wrong";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 16,
          padding: 32,
          fontFamily: '"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif',
          background: "#F3EEE5",
          color: "#181714",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.3 }}>!</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{headline}</div>
        <div
          style={{
            fontSize: 13,
            color: "#5E574C",
            maxWidth: 420,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Try again to recover without losing in-progress work. Reload is a last resort — it wipes unsaved changes in this tab.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            style={{
              padding: "9px 20px",
              background: "#181714",
              color: "#FEFCF8",
              border: "none",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={this.reset}
          >
            Try again
          </button>
          <button
            style={{
              padding: "9px 20px",
              background: "transparent",
              color: "#5E574C",
              border: "1px solid rgba(24,23,20,0.18)",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
        </div>
        {import.meta.env.DEV && (
          <pre
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "#DC2626",
              background: "#FFF1F2",
              border: "1px solid #FCA5A5",
              borderRadius: 6,
              padding: "10px 14px",
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
