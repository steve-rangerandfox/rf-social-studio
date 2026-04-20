import React, { useEffect, useState, useCallback } from "react";
import { Close as X } from "../../../components/icons/index.jsx";

// Editorial keyboard-shortcut reference. Global `?` key opens the
// overlay. Presented as a colophon — two-column typeset list, no
// icons, no cards. Linear-tier touch.

const GROUPS = [
  {
    name: "Navigation",
    shortcuts: [
      { keys: ["1"], label: "List view" },
      { keys: ["2"], label: "Calendar view" },
      { keys: ["3"], label: "Grid view" },
      { keys: ["4"], label: "Analytics" },
    ],
  },
  {
    name: "Actions",
    shortcuts: [
      { keys: ["\u2318", "K"], label: "Command palette" },
      { keys: ["/"], label: "Search posts" },
      { keys: ["N"], label: "New post" },
      { keys: ["\u2318", "S"], label: "Acknowledge save" },
    ],
  },
  {
    name: "List",
    shortcuts: [
      { keys: ["J"], label: "Focus next row" },
      { keys: ["K"], label: "Focus previous row" },
      { keys: ["\u21B5"], label: "Open focused row" },
    ],
  },
  {
    name: "Global",
    shortcuts: [
      { keys: ["?"], label: "This reference" },
      { keys: ["Esc"], label: "Close overlay / modal" },
    ],
  },
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.contentEditable === "true";
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && !inField) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className="shortcuts-backdrop" onClick={handleBackdrop}>
      <div className="shortcuts-sheet" role="dialog" aria-label="Keyboard shortcuts">
        <header className="shortcuts-head">
          <div>
            <div className="shortcuts-kicker">Colophon \u00B7 Keyboard</div>
            <h2 className="shortcuts-title">Shortcuts</h2>
          </div>
          <button className="shortcuts-close" onClick={() => setOpen(false)} aria-label="Close">
            <X size={14} />
          </button>
        </header>
        <div className="shortcuts-body">
          {GROUPS.map((group) => (
            <section key={group.name} className="shortcuts-group">
              <div className="shortcuts-group-name">{group.name}</div>
              <dl className="shortcuts-list">
                {group.shortcuts.map((s) => (
                  <React.Fragment key={s.label}>
                    <dt>{s.label}</dt>
                    <dd>
                      {s.keys.map((k, i) => (
                        <React.Fragment key={`${k}-${i}`}>
                          <kbd>{k}</kbd>
                          {i < s.keys.length - 1 && <span className="shortcuts-plus">+</span>}
                        </React.Fragment>
                      ))}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <footer className="shortcuts-foot">
          <span>Press <kbd>?</kbd> anywhere to open this reference.</span>
        </footer>
      </div>
    </div>
  );
}
