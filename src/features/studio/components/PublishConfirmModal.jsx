import React from "react";
import { AlertTriangle, Check, Clock, Close as X, Send } from "../../../components/icons/index.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { T, PLATFORMS, toPTDisplay, getReadinessChecks } from "../shared.js";

const CAPTION_PREVIEW_LIMIT = 200;

export function PublishConfirmModal({ row, platform, mediaUrls, onConfirm, onCancel, isPublishing }) {
  const platMeta = PLATFORMS[platform] || PLATFORMS.ig_post;
  const caption = row.caption || "";
  const truncatedCaption = caption.length > CAPTION_PREVIEW_LIMIT
    ? caption.slice(0, CAPTION_PREVIEW_LIMIT) + "\u2026"
    : caption;
  const scheduleParts = toPTDisplay(row.scheduledAt);
  const hasMedia = !!(mediaUrls && mediaUrls.length > 0);
  const checks = getReadinessChecks(row, hasMedia);
  const allPassing = checks.every((c) => c.pass);
  const mediaCheck = checks.find((c) => c.label === "Media");
  const mediaBlocking = mediaCheck ? !mediaCheck.pass : false;
  const canConfirm = !mediaBlocking;

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="m-head">
          <div>
            <div className="m-title">Confirm Publishing</div>
            <div className="m-sub">Review the details below before going live.</div>
          </div>
          <button className="m-x" onClick={onCancel} disabled={isPublishing}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="m-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Platform + Account */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PlatformIcon platform={platform} size={28} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{platMeta.label}</div>
              <div style={{ fontSize: 12, color: T.textDim }}>Ranger & Fox</div>
            </div>
          </div>

          {/* Scheduled time */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: T.s2,
            }}
          >
            <Clock size={14} style={{ color: T.textDim, flexShrink: 0 }} />
            {scheduleParts ? (
              <span style={{ fontSize: 13, color: T.text }}>
                {scheduleParts.month}/{scheduleParts.day} at {scheduleParts.hour}:{scheduleParts.minute} {scheduleParts.ampm} PT
              </span>
            ) : (
              <span style={{ fontSize: 13, color: T.amber }}>No schedule set</span>
            )}
          </div>

          {/* Caption preview */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              Caption
            </div>
            {caption ? (
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: T.text,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {truncatedCaption}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: T.amber, fontStyle: "italic" }}>No caption provided</div>
            )}
          </div>

          {/* Media thumbnails */}
          {mediaUrls && mediaUrls.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                Media
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {mediaUrls.map((url, i) => (
                  <div
                    key={i}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 6,
                      overflow: "hidden",
                      border: `1px solid ${T.border}`,
                      background: T.s2,
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={url}
                      alt={`Media ${i + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Readiness checklist */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Readiness
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: T.surface,
              }}
            >
              {checks.map((check) => (
                <div key={check.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  {check.pass ? (
                    <Check size={14} style={{ color: "#5E6659", flexShrink: 0 }} />
                  ) : check.warn ? (
                    <AlertTriangle size={14} style={{ color: T.amber, flexShrink: 0 }} />
                  ) : (
                    <X size={14} style={{ color: T.red, flexShrink: 0 }} />
                  )}
                  <span style={{ color: T.textSub }}>{check.label}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 12,
                      color: check.pass ? T.textDim : check.warn ? T.amber : T.red,
                    }}
                  >
                    {check.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Warning banner if not all checks pass */}
          {!allPassing && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(220,38,38,0.06)",
                border: `1px solid rgba(220,38,38,0.15)`,
              }}
            >
              <AlertTriangle size={14} style={{ color: T.red, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.red }}>
                Some readiness checks are not passing. Publishing may produce unexpected results.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="m-foot">
          <button className="btn btn-ghost" onClick={onCancel} disabled={isPublishing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={isPublishing || !canConfirm}
            title={mediaBlocking ? "Add media in the composer before publishing" : undefined}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, opacity: canConfirm ? 1 : 0.6, cursor: canConfirm ? "pointer" : "not-allowed" }}
          >
            {isPublishing ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
                Publishing\u2026
              </>
            ) : (
              <>
                <Send size={14} />
                Publish Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
