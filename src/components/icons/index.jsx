import React from "react";

// Bespoke icon set — replaces lucide-react across the studio.
// Design language: 1.25px stroke, square caps, miter joins, 16px
// viewBox, no auto-rounded corners. Reads tighter and more authored
// than lucide's 2px rounded defaults.
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

// ─── Chrome ────────────────────────────────────────────────────────

export function Close(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M3 3 L13 13 M13 3 L3 13" /></svg>;
}

export function Check(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M3 8.5 L6.5 12 L13 4" /></svg>;
}

export function CheckCircle(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="M5 8.2 L7.2 10.4 L11 6" />
    </svg>
  );
}

export function Plus(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M8 3 V13 M3 8 H13" /></svg>;
}

export function Minus(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M3 8 H13" /></svg>;
}

export function ChevronDown(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M3 6 L8 11 L13 6" /></svg>;
}

export function ChevronUp(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M3 10 L8 5 L13 10" /></svg>;
}

export function ChevronLeft(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M10 3 L5 8 L10 13" /></svg>;
}

export function ChevronRight(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M6 3 L11 8 L6 13" /></svg>;
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

export function Menu(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M3 4 H13 M3 8 H13 M3 12 H13" /></svg>;
}

// Editorial AI mark — replaces Sparkles. Filled diamond inside a
// hairline circle. Reads as "considered, marked-up", not "magic dust."
export function AIMark(props) {
  const p = { ...asProps(props), strokeWidth: 1 };
  return (
    <svg {...p}>
      <circle cx="8" cy="8" r="6.5" />
      <rect x="5" y="5" width="6" height="6" transform="rotate(45 8 8)" fill={p.stroke} stroke="none" />
    </svg>
  );
}

// ─── Status / informational ────────────────────────────────────────

export function AlertTriangle(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M8 2 L14 13 L2 13 Z" />
      <path d="M8 6 V9" />
      <circle cx="8" cy="11" r="0.6" fill={p.stroke} stroke="none" />
    </svg>
  );
}

export function Clock(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5 V8 L10.5 9.5" />
    </svg>
  );
}

export function CalendarIcon(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <rect x="2.5" y="3.5" width="11" height="10" />
      <path d="M2.5 6.5 H13.5" />
      <path d="M5 2 V4 M11 2 V4" />
    </svg>
  );
}

// ─── Verbs / actions ───────────────────────────────────────────────

export function Upload(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M8 11 V3 M5 6 L8 3 L11 6" />
      <path d="M3 13 H13" />
    </svg>
  );
}

export function Download(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M8 3 V11 M5 8 L8 11 L11 8" />
      <path d="M3 13 H13" />
    </svg>
  );
}

export function Send(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M2.5 8 L13.5 3 L11 13 L7.5 9 L2.5 8 Z" />
    </svg>
  );
}

export function Share(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <circle cx="4" cy="8" r="1.4" />
      <circle cx="12" cy="4" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <path d="M5.2 7.3 L10.8 4.5 M5.2 8.7 L10.8 11.5" />
    </svg>
  );
}

export function Copy(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <rect x="5" y="5" width="8" height="8" />
      <path d="M3 11 V3 H11" />
    </svg>
  );
}

export function Trash(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 4 H13 M6 4 V2.5 H10 V4 M5 4 V13 H11 V4" />
    </svg>
  );
}

export function RotateCcw(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 4 V7.5 H6.5" />
      <path d="M3 7 A5 5 0 1 1 5 12.5" />
    </svg>
  );
}

export function RotateCw(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M13 4 V7.5 H9.5" />
      <path d="M13 7 A5 5 0 1 0 11 12.5" />
    </svg>
  );
}

export function Undo(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M2.5 6.5 L5 4 L7.5 6.5" />
      <path d="M5 4 H10 A3.5 3.5 0 1 1 10 11" />
    </svg>
  );
}

export function Redo(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M13.5 6.5 L11 4 L8.5 6.5" />
      <path d="M11 4 H6 A3.5 3.5 0 1 0 6 11" />
    </svg>
  );
}

export function Repeat(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 7 V5.5 H10.5 L9 4 M13 9 V10.5 H5.5 L7 12" />
    </svg>
  );
}

// ─── Drag handle ───────────────────────────────────────────────────

export function GripVertical(props) {
  const p = { ...asProps(props), strokeWidth: 0 };
  const dot = (cx, cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.9" fill={props.color || "currentColor"} />;
  return (
    <svg {...p}>
      {dot(6, 4)}{dot(10, 4)}
      {dot(6, 8)}{dot(10, 8)}
      {dot(6, 12)}{dot(10, 12)}
    </svg>
  );
}

// ─── Social / engagement glyphs (LinkedIn preview) ────────────────

export function ThumbsUp(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M5 13 V7 L8 3 L8 7 H12.5 L11 13 H5 Z" />
      <path d="M2.5 13 V7 H5" />
    </svg>
  );
}

export function Heart(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M8 13 L3 8.5 A2.8 2.8 0 0 1 8 5 A2.8 2.8 0 0 1 13 8.5 L8 13 Z" />
    </svg>
  );
}

export function MessageSquare(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 3 H13 V11 H7 L4 13.5 V11 H3 Z" />
    </svg>
  );
}

// ─── Media controls ────────────────────────────────────────────────

export function Play(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M5 3 L13 8 L5 13 Z" fill={p.stroke} stroke="none" /></svg>;
}

export function Pause(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <rect x="4" y="3" width="3" height="10" fill={p.stroke} stroke="none" />
      <rect x="9" y="3" width="3" height="10" fill={p.stroke} stroke="none" />
    </svg>
  );
}

export function Volume(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M2.5 6 H5 L8 3.5 V12.5 L5 10 H2.5 Z" />
      <path d="M10 6 A2.5 2.5 0 0 1 10 10" />
      <path d="M11.5 4.5 A4.5 4.5 0 0 1 11.5 11.5" />
    </svg>
  );
}

export function VolumeMute(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M2.5 6 H5 L8 3.5 V12.5 L5 10 H2.5 Z" />
      <path d="M10.5 6 L13.5 9 M13.5 6 L10.5 9" />
    </svg>
  );
}

// ─── StoryDesigner editor toolbar ─────────────────────────────────

export function Bold(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M4 3 H8.5 A2.25 2.25 0 0 1 8.5 7.5 H4 Z" />
      <path d="M4 7.5 H9 A2.25 2.25 0 0 1 9 12 H4 Z" />
    </svg>
  );
}

export function Italic(props) {
  const p = asProps(props);
  return <svg {...p}><path d="M6 3 H12 M4 13 H10 M9.5 3 L6.5 13" /></svg>;
}

export function Underline(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M4.5 3 V8.5 A3.5 3.5 0 0 0 11.5 8.5 V3" />
      <path d="M3 13 H13" />
    </svg>
  );
}

export function Strikethrough(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 8 H13" />
      <path d="M5 5 A3 2 0 0 1 11 5" />
      <path d="M5 11 A3 2 0 0 0 11 11" />
    </svg>
  );
}

export function TypeIcon(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 4 V3 H13 V4" />
      <path d="M8 3 V13" />
      <path d="M5 13 H11" />
    </svg>
  );
}

export function AArrowDown(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M2 11 L5 4 L8 11 M3 9 H7" />
      <path d="M11 5 V12 M9.5 10.5 L11 12 L12.5 10.5" />
    </svg>
  );
}

export function ImageIcon(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <rect x="2.5" y="3" width="11" height="10" />
      <circle cx="6" cy="6.5" r="1" />
      <path d="M3 11.5 L6.5 8 L9.5 10.5 L11 9 L13 11" />
    </svg>
  );
}

export function Film(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <rect x="2.5" y="3" width="11" height="10" />
      <path d="M2.5 5.5 H4 V3 M12 3 V5.5 H13.5 M2.5 8 H13.5 M2.5 10.5 H4 V13 M12 13 V10.5 H13.5" />
    </svg>
  );
}

export function Wallpaper(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <circle cx="6" cy="6" r="1" />
      <path d="M3 12 L6.5 8.5 L10 11 L13 8" />
    </svg>
  );
}

export function Layers(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M8 2.5 L13.5 5.5 L8 8.5 L2.5 5.5 Z" />
      <path d="M2.5 8 L8 11 L13.5 8" />
      <path d="M2.5 10.5 L8 13.5 L13.5 10.5" />
    </svg>
  );
}

export function LayoutTemplate(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M2.5 6 H13.5 M6.5 6 V13.5" />
    </svg>
  );
}

export function PanelLeftClose(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M6.5 2.5 V13.5" />
      <path d="M11 6 L9 8 L11 10" />
    </svg>
  );
}

export function Sliders(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M3 5 H8 M11 5 H13" />
      <circle cx="9.5" cy="5" r="1.2" />
      <path d="M3 11 H5 M8 11 H13" />
      <circle cx="6.5" cy="11" r="1.2" />
    </svg>
  );
}

export function Grid3(props) {
  const p = { ...asProps(props), strokeWidth: 0 };
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cells.push(<circle key={`${r}-${c}`} cx={4 + c * 4} cy={4 + r * 4} r="0.9" fill={props.color || "currentColor"} />);
    }
  }
  return <svg {...p}>{cells}</svg>;
}

export function AlignLeft(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M2.5 4 H10 M2.5 8 H13.5 M2.5 12 H8" />
    </svg>
  );
}

export function AlignCenter(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M4 4 H12 M2.5 8 H13.5 M5 12 H11" />
    </svg>
  );
}

export function AlignRight(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M6 4 H13.5 M2.5 8 H13.5 M8 12 H13.5" />
    </svg>
  );
}

export function AlignStartVertical(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M2.5 2.5 V13.5" />
      <rect x="3.5" y="4" width="6" height="3" />
      <rect x="3.5" y="9" width="9" height="3" />
    </svg>
  );
}

export function AlignCenterVertical(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M8 2.5 V13.5" />
      <rect x="5" y="4" width="6" height="3" />
      <rect x="3.5" y="9" width="9" height="3" />
    </svg>
  );
}

export function AlignEndVertical(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M13.5 2.5 V13.5" />
      <rect x="6.5" y="4" width="6" height="3" />
      <rect x="3.5" y="9" width="9" height="3" />
    </svg>
  );
}
