import React, { useState, useEffect, useRef } from "react";

export function FilterMenu({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="ops-group">
      <span className="ops-label">{label}</span>
      <div className="ops-menu" ref={ref}>
        <button className={`ops-trigger ${open ? "open" : ""}`} onClick={() => setOpen((current) => !current)}>
          <span>{active?.label}</span>
          <span className="ops-trigger-caret" />
        </button>
        {open && (
          <div className="ops-popover">
            {options.map((option) => (
              <button
                key={option.value}
                className={`ops-option ${value === option.value ? "on" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                <span className="ops-option-mark">{value === option.value ? "Set" : ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
