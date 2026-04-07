import React, { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown error",
    };
  }

  componentDidCatch(error, info) {
    console.error("[rf-studio] Uncaught render error:", error?.message || error, info?.componentStack?.slice(0, 400));
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

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
          background: "#F7F8FA",
          color: "#111318",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.3 }}>!</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Something went wrong</div>
        <div
          style={{
            fontSize: 13,
            color: "#6B7280",
            maxWidth: 420,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          The app hit an unexpected error. Local studio data is still recoverable from browser storage.
        </div>
        <button
          style={{
            marginTop: 8,
            padding: "9px 20px",
            background: "#111318",
            color: "#F7F8FA",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
          onClick={() => {
            this.setState({ hasError: false, errorMessage: "" });
            window.location.reload();
          }}
        >
          Reload App
        </button>
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
