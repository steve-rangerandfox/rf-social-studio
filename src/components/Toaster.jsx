/* eslint-disable react-refresh/only-export-components */
// Exports a React component (ToasterProvider) + hook (useToast) from the
// same file — standard React context pattern. The fast-refresh rule is
// intentionally relaxed here.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Close as X } from "./icons/index.jsx";

// Queued, variant-aware toast notifications.
//
// Usage:
//   const toast = useToast();
//   toast.success("Saved");
//   toast.error("Reconnect Instagram", { action: { label: "Reconnect", onClick: () => ... } });
//
// Replaces the previous single-slot Toast component. Stacks up to 4,
// pauses countdown on hover, supports explicit × dismiss and optional
// inline action buttons.

const MAX_STACK = 4;
const DEFAULT_DURATION = {
  success: 4000,
  info: 4000,
  neutral: 4000,
  warning: 5500,
  error: 7000,
};

// Mono-glyph per variant — replaces the colored dot with a typeset
// character set in JBM. Reads as a labeled status mark, not a UI light.
const GLYPH = {
  success: "S",
  error: "!",
  warning: "!",
  info: "i",
  neutral: "\u00B7",
};

const ToasterContext = createContext(null);

export function ToasterProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant, message, options = {}) => {
    idRef.current += 1;
    const id = `t-${idRef.current}`;
    setToasts((prev) => {
      const next = [{ id, variant, message, ...options }, ...prev];
      return next.slice(0, MAX_STACK);
    });
    return id;
  }, []);

  const api = useMemo(
    () => ({
      success: (msg, opts) => push("success", msg, opts),
      error: (msg, opts) => push("error", msg, opts),
      warning: (msg, opts) => push("warning", msg, opts),
      info: (msg, opts) => push("info", msg, opts),
      neutral: (msg, opts) => push("neutral", msg, opts),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToasterContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToasterContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToasterContext);
  if (!ctx) {
    // Fail soft in environments that haven't mounted the provider
    // (e.g. storybook, unit tests that render components in isolation).
    return {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      neutral: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}

function Toaster({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="rf-toaster" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ id, variant, message, action, duration, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const ttl = duration ?? DEFAULT_DURATION[variant] ?? DEFAULT_DURATION.neutral;
  const persistent = ttl === 0 || Boolean(action);

  useEffect(() => {
    if (paused || persistent) return undefined;
    const t = setTimeout(() => onDismiss(id), ttl);
    return () => clearTimeout(t);
  }, [paused, ttl, id, onDismiss, persistent]);

  const role = variant === "error" || variant === "warning" ? "alert" : "status";

  return (
    <div
      className={`rf-toast rf-toast-${variant}`}
      role={role}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className={`rf-toast-glyph rf-toast-glyph-${variant}`} aria-hidden="true">
        {GLYPH[variant] || GLYPH.neutral}
      </span>
      <span className="rf-toast-msg">{message}</span>
      {action && (
        <button
          type="button"
          className="rf-toast-action"
          onClick={() => {
            action.onClick();
            onDismiss(id);
          }}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        className="rf-toast-close"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        <X size={12} />
      </button>
    </div>
  );
}
