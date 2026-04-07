import React, { useState } from "react";
import { X } from "lucide-react";
import { useStudio } from "../StudioContext.jsx";

const DISMISS_KEY = "rf_first_run_dismissed";

export function FirstRunHint() {
  const { studioDoc } = useStudio();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  // Only show when document is genuinely empty AND not dismissed
  const totalRows = studioDoc?.rows?.filter((r) => !r.deletedAt).length ?? 0;
  if (dismissed || totalRows > 0) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* */ }
    setDismissed(true);
  };

  return (
    <aside className="first-run-hint" role="complementary" aria-label="Getting started">
      <div className="first-run-hint-header">
        <span className="first-run-hint-title">Welcome to Social Studio</span>
        <button className="first-run-hint-close" onClick={dismiss} aria-label="Dismiss">
          <X size={12} />
        </button>
      </div>
      <ul className="first-run-hint-list">
        <li><kbd>N</kbd> Create a new post</li>
        <li><kbd>{"\u2318"}K</kbd> Open the command palette</li>
        <li><kbd>/</kbd> Search anything</li>
        <li><kbd>1</kbd>{"\u2013"}<kbd>4</kbd> Switch views</li>
      </ul>
      <div className="first-run-hint-footer">
        Connect Instagram from the sidebar to publish.
      </div>
    </aside>
  );
}
