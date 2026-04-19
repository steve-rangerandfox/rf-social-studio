import React from "react";

// Editorial empty-state system. The default illustration ("dashed
// document") was the original; the variants below expand it into a
// per-context illustration set so each empty surface reads as
// authored, not as a generic placeholder.
//
// All illustrations share the same visual language:
//   - 120×120 viewBox, ink-line on warm paper
//   - 1.25px stroke, square caps, miter joins
//   - opacity-stepped from 0.6 to 0.25 to suggest depth
//   - one stroke uses --t-orange-bright as the editorial accent
//     (single-use rule that mirrors §C.3 of the aesthetic system)

const STROKE = "var(--t-border2)";
const ACCENT = "var(--t-orange-bright)";

function DefaultMark() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <rect x="14" y="22" width="68" height="48" rx="2" stroke={STROKE} strokeWidth="1.25" strokeDasharray="4 3" opacity="0.55" />
      <line x1="28" y1="40" x2="68" y2="40" stroke={STROKE} strokeWidth="1.25" opacity="0.35" />
      <line x1="28" y1="50" x2="58" y2="50" stroke={STROKE} strokeWidth="1.25" opacity="0.25" />
      <circle cx="48" cy="62" r="3" stroke={ACCENT} strokeWidth="1.25" />
    </svg>
  );
}

function CalendarMark() {
  // 4×3 grid abstract month — one cell highlighted with a small accent
  // mark to suggest "the first post sets the tone."
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true">
      <rect x="6" y="10" width="108" height="78" stroke={STROKE} strokeWidth="1.25" opacity="0.5" />
      <line x1="6" y1="22" x2="114" y2="22" stroke={STROKE} strokeWidth="1.25" opacity="0.4" />
      {[33, 60, 87].map((y) => (
        <line key={y} x1="6" y1={y} x2="114" y2={y} stroke={STROKE} strokeWidth="1" opacity="0.18" />
      ))}
      {[33, 60, 87].map((x) => (
        <line key={x} x1={x} y1="22" x2={x} y2="88" stroke={STROKE} strokeWidth="1" opacity="0.18" />
      ))}
      {/* accent: a single "post" mark in one cell */}
      <line x1="42" y1="40" x2="56" y2="40" stroke={ACCENT} strokeWidth="1.5" />
      <line x1="42" y1="44" x2="50" y2="44" stroke={ACCENT} strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

function GridMark() {
  // 3×3 IG-style grid; three cells carry abstract composition marks.
  return (
    <svg width="108" height="108" viewBox="0 0 108 108" fill="none" aria-hidden="true">
      {[0, 1, 2].map((r) => (
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={6 + c * 32}
            y={6 + r * 32}
            width="30"
            height="30"
            stroke={STROKE}
            strokeWidth="1.25"
            opacity={0.45}
          />
        ))
      ))}
      {/* a few "designed" cells */}
      <line x1="14" y1="20" x2="28" y2="20" stroke={STROKE} strokeWidth="1.25" opacity="0.35" />
      <circle cx="86" cy="22" r="6" stroke={STROKE} strokeWidth="1.25" opacity="0.4" />
      {/* accent — one cell carries the orange mark */}
      <path d="M50 76 L62 76 L56 84 Z" stroke={ACCENT} strokeWidth="1.25" />
    </svg>
  );
}

function AnalyticsMark() {
  // Labeled bars at three heights, all dimmed except one accent bar.
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden="true">
      <line x1="8" y1="64" x2="112" y2="64" stroke={STROKE} strokeWidth="1" opacity="0.4" />
      {[
        { x: 18, h: 28 },
        { x: 38, h: 44 },
        { x: 58, h: 18 },
        { x: 78, h: 36, accent: true },
        { x: 98, h: 24 },
      ].map(({ x, h, accent }, i) => (
        <rect
          key={i}
          x={x - 6}
          y={64 - h}
          width="12"
          height={h}
          stroke={accent ? ACCENT : STROKE}
          strokeWidth="1.25"
          opacity={accent ? 1 : 0.4}
        />
      ))}
      <text x="6" y="76" fontFamily="JetBrains Mono, monospace" fontSize="6" fill="currentColor" opacity="0.5" letterSpacing="1">M  T  W  T  F</text>
    </svg>
  );
}

function DetailMark() {
  // Five horizontal rule rows — readiness checks at rest.
  return (
    <svg width="100" height="96" viewBox="0 0 100 96" fill="none" aria-hidden="true">
      {[14, 30, 46, 62, 78].map((y, i) => (
        <g key={y}>
          <circle cx="14" cy={y} r="3.5" stroke={i === 2 ? ACCENT : STROKE} strokeWidth="1.25" opacity={i === 2 ? 1 : 0.45} />
          <line x1="26" y1={y} x2="86" y2={y} stroke={STROKE} strokeWidth="1.25" opacity={i === 2 ? 0.5 : 0.3} />
        </g>
      ))}
    </svg>
  );
}

function AssetsMark() {
  // Stacked paper sheets.
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <rect x="22" y="14" width="56" height="68" stroke={STROKE} strokeWidth="1.25" opacity="0.3" />
      <rect x="18" y="22" width="56" height="68" stroke={STROKE} strokeWidth="1.25" opacity="0.45" />
      <rect x="14" y="30" width="56" height="68" stroke={ACCENT} strokeWidth="1.25" />
      <line x1="22" y1="46" x2="60" y2="46" stroke={STROKE} strokeWidth="1.25" opacity="0.4" />
      <line x1="22" y1="56" x2="50" y2="56" stroke={STROKE} strokeWidth="1.25" opacity="0.3" />
    </svg>
  );
}

function TeamMark() {
  // Three abstract head-and-shoulders silhouettes.
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden="true">
      {[24, 60, 96].map((cx, i) => (
        <g key={cx} opacity={i === 1 ? 1 : 0.5}>
          <circle cx={cx} cy="22" r="8" stroke={i === 1 ? ACCENT : STROKE} strokeWidth="1.25" />
          <path d={`M${cx - 14} 56 Q${cx} 38 ${cx + 14} 56`} stroke={i === 1 ? ACCENT : STROKE} strokeWidth="1.25" fill="none" />
        </g>
      ))}
    </svg>
  );
}

function CommentsMark() {
  // Three speech-bubble outlines, the foreground one accented.
  return (
    <svg width="110" height="86" viewBox="0 0 110 86" fill="none" aria-hidden="true">
      <path d="M62 14 H100 V46 H82 L78 54 V46 H62 Z" stroke={STROKE} strokeWidth="1.25" opacity="0.35" />
      <path d="M50 22 H88 V54 H70 L66 62 V54 H50 Z" stroke={STROKE} strokeWidth="1.25" opacity="0.5" />
      <path d="M16 32 H68 V64 H42 L36 72 V64 H16 Z" stroke={ACCENT} strokeWidth="1.25" />
    </svg>
  );
}

const VARIANTS = {
  default: DefaultMark,
  calendar: CalendarMark,
  grid: GridMark,
  analytics: AnalyticsMark,
  detail: DetailMark,
  assets: AssetsMark,
  team: TeamMark,
  comments: CommentsMark,
};

export function EmptyState({ title, subtitle, actionLabel, onAction, variant = "default" }) {
  const Mark = VARIANTS[variant] || VARIANTS.default;
  return (
    <div className="empty-state">
      <div className="empty-state-graphic">
        <Mark />
      </div>
      <div className="empty-state-title">{title}</div>
      {subtitle && <div className="empty-state-sub">{subtitle}</div>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction} style={{ marginTop: 8 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
