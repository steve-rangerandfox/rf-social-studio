import React, { useRef, useEffect } from "react";
import { useStudio } from "../StudioContext.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { STATUSES } from "../shared.js";

export function InlineCreateRow() {
  const { commitInlineCreate, cancelInlineCreate } = useStudio();
  const inputRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      const title = inputRef.current?.value.trim();
      if (title) commitInlineCreate(title);
      else cancelInlineCreate();
    }
    if (e.key === "Escape") cancelInlineCreate();
  };

  return (
    <div className="t-row inline-create-row">
      <div /> {/* checkbox */}
      <div className="dt-badge dt-badge-auto" title="Auto-scheduled">
        <span className="dt-badge-empty">—</span>
      </div>
      <div className="row-time"><span className="dt-time">auto</span></div>
      <div className="inline-create-input-wrap">
        <input
          ref={inputRef}
          className="inline-create-input"
          placeholder="What are you planning?"
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            if (!e.target.value.trim()) cancelInlineCreate();
          }}
        />
      </div>
      <div className="plat-pill"><PlatformIcon platform="ig_post" size={20} /></div>
      <div className="row-status-cell">
        <span className="status-pill">
          <span className="s-dot" style={{ background: STATUSES.idea.dot }} />
          {STATUSES.idea.label}
        </span>
      </div>
      <div /> {/* grip */}
    </div>
  );
}
