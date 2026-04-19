import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AIMark, Check, Close, Copy } from "../../../components/icons/index.jsx";

import { useStudio } from "../StudioContext.jsx";
import { generateCaptionVariants } from "../../../lib/api-client.js";
import { createAuditEntry } from "../document-store.js";
import { PLATFORMS, T } from "../shared.js";
import { PlatformIcon } from "./PlatformIcon.jsx";

// Cross-post / variant-spin modal. Given a source row, asks Anthropic
// to produce one caption per checked platform, then drops each accepted
// variant into the document as a new draft row at the same scheduledAt.

export function CrossPostModal({ sourceRow, onClose }) {
  const { brandProfile, updateDocument, currentUser } = useStudio();
  const sourcePlatform = sourceRow?.platform;

  const defaultTargets = useMemo(() => {
    return Object.keys(PLATFORMS).filter((k) => k !== sourcePlatform);
  }, [sourcePlatform]);

  const [targets, setTargets] = useState(() => new Set(defaultTargets));
  const [variants, setVariants] = useState([]);   // [{ platform, caption, added: bool }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleTarget = (key) => {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const generate = useCallback(async () => {
    setError("");
    setLoading(true);
    setVariants([]);
    try {
      const platforms = [...targets];
      const result = await generateCaptionVariants({
        sourceNote: sourceRow?.note || "",
        sourceCaption: sourceRow?.caption || "",
        platforms,
        brandProfile,
      });
      const list = Array.isArray(result?.variants) ? result.variants : [];
      setVariants(list.map((v) => ({ ...v, added: false })));
      if (list.length === 0) {
        setError("The model didn't return any variants — try rewording the source.");
      }
    } catch (err) {
      setError(err?.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  }, [brandProfile, sourceRow, targets]);

  const addVariantAsDraft = useCallback((variant) => {
    if (!sourceRow) return;
    updateDocument(
      (current) => {
        const rows = current.rows || [];
        const newRow = {
          ...sourceRow,
          id: `${sourceRow.id}-${variant.platform}-${Date.now()}`,
          platform: variant.platform,
          caption: variant.caption,
          status: "draft",
          scheduledAt: sourceRow.scheduledAt ?? null,
          comments: [],
          storyElements: null,
          createdAt: new Date().toISOString(),
          createdBy: currentUser,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser,
          deletedAt: null,
          deletedBy: null,
          postedAt: null,
          igMediaId: null,
          igPublishedUrl: null,
          igPermalink: null,
          version: 1,
          order: rows.length,
        };
        return { ...current, rows: [...rows, newRow] };
      },
      () => createAuditEntry(
        "post.cross_posted",
        currentUser,
        `Cross-posted from ${sourcePlatform} to ${variant.platform}`,
        { fromRowId: sourceRow.id, platform: variant.platform },
      ),
    );
    setVariants((prev) => prev.map((v) => (
      v.platform === variant.platform ? { ...v, added: true } : v
    )));
  }, [sourceRow, sourcePlatform, updateDocument, currentUser]);

  const addAll = () => {
    variants.filter((v) => !v.added).forEach(addVariantAsDraft);
  };

  // Esc to close
  useEffect(() => {
    const handler = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!sourceRow) return null;
  const sourceMeta = PLATFORMS[sourceRow.platform];

  return (
    <div className="overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal crosspost-modal" role="dialog" aria-modal="true" aria-labelledby="crosspost-title">
        <div className="m-head">
          <div>
            <div id="crosspost-title" className="m-title">Cross-post with AI</div>
            <div className="m-sub">
              Start from <strong>{sourceMeta?.short || sourceRow.platform}</strong> and draft
              platform-tuned captions for the rest.
            </div>
          </div>
          <button className="m-x" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <Close size={15} />
          </button>
        </div>

        <div className="m-body">
          <div className="crosspost-source">
            <div className="crosspost-source-label">Source</div>
            <div className="crosspost-source-card">
              <PlatformIcon platform={sourceRow.platform} size={16} />
              <div className="crosspost-source-text">
                <div className="crosspost-source-title">{sourceRow.note || "Untitled post"}</div>
                {sourceRow.caption && (
                  <div className="crosspost-source-caption">{sourceRow.caption}</div>
                )}
              </div>
            </div>
          </div>

          <div className="field">
            <div className="lbl">Target platforms</div>
            <div className="crosspost-platform-grid">
              {Object.entries(PLATFORMS).map(([key, meta]) => {
                if (key === sourcePlatform) return null;
                const on = targets.has(key);
                return (
                  <button
                    type="button"
                    key={key}
                    className={`crosspost-platform-chip ${on ? "on" : ""}`}
                    onClick={() => toggleTarget(key)}
                    aria-pressed={on}
                  >
                    <PlatformIcon platform={key} size={14} />
                    <span>{meta.short || meta.label}</span>
                    {on && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="crosspost-error" role="alert">{error}</div>
          )}

          {variants.length > 0 && (
            <div className="crosspost-results">
              <div className="lbl">Generated variants</div>
              {variants.map((variant) => {
                const meta = PLATFORMS[variant.platform];
                return (
                  <div className="crosspost-variant" key={variant.platform}>
                    <div className="crosspost-variant-head">
                      <PlatformIcon platform={variant.platform} size={14} />
                      <span className="crosspost-variant-label">{meta?.label || variant.platform}</span>
                      <span className="crosspost-variant-len">{variant.caption.length} chars</span>
                    </div>
                    <div className="crosspost-variant-body">{variant.caption}</div>
                    <div className="crosspost-variant-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigator.clipboard?.writeText(variant.caption)}
                        title="Copy caption to clipboard"
                      >
                        <Copy size={12} style={{ marginRight: 4 }} />
                        Copy
                      </button>
                      <button
                        type="button"
                        className={`btn ${variant.added ? "btn-ghost" : "btn-primary"} btn-sm`}
                        onClick={() => addVariantAsDraft(variant)}
                        disabled={variant.added}
                      >
                        {variant.added ? (
                          <>
                            <Check size={12} style={{ marginRight: 4 }} />
                            Added
                          </>
                        ) : "Add draft"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="m-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          {variants.length > 0 && variants.some((v) => !v.added) && (
            <button type="button" className="btn btn-ghost" onClick={addAll}>Add all as drafts</button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={generate}
            disabled={loading || targets.size === 0}
            title={targets.size === 0 ? "Pick at least one platform" : undefined}
            style={{ color: loading ? T.textDim : undefined }}
          >
            <AIMark size={13} style={{ marginRight: 6 }} />
            {loading ? "Generating\u2026" : variants.length ? "Regenerate" : "Generate variants"}
          </button>
        </div>
      </div>
    </div>
  );
}
