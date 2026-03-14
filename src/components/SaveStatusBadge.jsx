import { T } from "../features/studio/shared.js";

function formatSavedAt(timestamp) {
  if (!timestamp) {
    return "Not saved yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function SaveStatusBadge({ saveState }) {
  const status = saveState?.status || "idle";

  const ui = {
    idle: { label: "Local draft", color: T.textDim, bg: T.s3 },
    saving: { label: "Saving locally", color: T.blue, bg: "rgba(37,99,235,0.08)" },
    saved: { label: `Saved ${formatSavedAt(saveState.lastSavedAt)}`, color: T.ink, bg: T.s3 },
    error: { label: "Save failed", color: T.red, bg: "rgba(220,38,38,0.08)" },
  }[status];

  return (
    <div
      title={saveState?.error || "Browser-backed studio workspace"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.2,
        color: ui.color,
        background: ui.bg,
        border: `1px solid ${status === "error" ? "rgba(220,38,38,0.18)" : T.border}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: ui.color,
        }}
      />
      <span>{ui.label}</span>
    </div>
  );
}
