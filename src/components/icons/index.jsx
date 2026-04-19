/* eslint-disable react-refresh/only-export-components */
import React from "react";

// Bespoke icon set — replaces lucide-react for the highest-traffic icons.
// Design language: 1.25px stroke, square caps, square line-joins (miter),
// 16px viewBox, no auto-rounded corners. Reads tighter and more
// considered than lucide's 2px rounded defaults — that's the point.
//
// API matches lucide: { size, color, className, style, ...rest } so
// drop-in replacement is mechanical.

function asProps({ size = 14, color, className, style, ...rest }) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: color || "currentColor",
    strokeWidth: 1.25,
    strokeLinecap: "square",
    strokeLinejoin: "miter",
    className,
    style,
    "aria-hidden": "true",
    ...rest,
  };
}

export function Close(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 3 L13 13 M13 3 L3 13" />
    </svg>
  );
}

export function Check(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 8.5 L6.5 12 L13 4" />
    </svg>
  );
}

export function Plus(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M8 3 V13 M3 8 H13" />
    </svg>
  );
}

export function ChevronDown(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 6 L8 11 L13 6" />
    </svg>
  );
}

export function Search(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L13.5 13.5" />
    </svg>
  );
}

// Editorial AI mark — replaces Sparkles. A small filled diamond inside
// a hairline circle. Reads as "considered, marked-up", not "magic dust."
export function AIMark(props) {
  const p = { ...asProps(props), strokeWidth: 1 };
  return (
    <svg {...p}>
      <circle cx="8" cy="8" r="6.5" />
      <rect x="5" y="5" width="6" height="6" transform="rotate(45 8 8)" fill={p.stroke} stroke="none" />
    </svg>
  );
}
