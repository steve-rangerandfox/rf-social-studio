import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { Sidebar } from "./Sidebar.jsx";

// Mobile / narrow-viewport navigation. Renders the existing Sidebar
// inside a slide-in drawer so month-jump / team / connections /
// settings stay reachable when .sidebar itself is display:none.

export function NavDrawer({ open, onClose }) {
  const panelRef = useRef(null);

  // Esc to close + focus the panel on open.
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="nav-drawer-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="nav-drawer"
        role="dialog"
        aria-label="Navigation"
        aria-modal="true"
      >
        <button
          type="button"
          className="nav-drawer-close"
          onClick={onClose}
          aria-label="Close navigation"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
        <Sidebar />
      </aside>
    </div>
  );
}
