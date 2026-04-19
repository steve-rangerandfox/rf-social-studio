import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Sparkles, Check } from "lucide-react";

import { useStudio } from "../StudioContext.jsx";
import { generateMonthlyStrategy } from "../../../lib/api-client.js";
import { createAuditEntry, createNewRow } from "../document-store.js";
import { MONTHS_FULL, PLATFORMS, ptPickerToISO } from "../shared.js";
import { PlatformIcon } from "./PlatformIcon.jsx";

// Monthly strategy generator modal. Given brand profile + cadence, asks
// Anthropic for N post briefs spread across the target month and adds
// the accepted ones as `idea`-status rows on the calendar.

export function StrategyModal({ onClose, initialMonth, initialYear }) {
  const { brandProfile, rows, updateDocument, currentUser } = useStudio();

  const now = new Date();
  const [month, setMonth] = useState(() => initialMonth ?? now.getMonth());
  const [year, setYear] = useState(() => initialYear ?? now.getFullYear());
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const defaultPlatforms = useMemo(
    () => ["ig_post", "linkedin"],
    [],
  );
  const [platforms, setPlatforms] = useState(() => new Set(defaultPlatforms));
  const [briefs, setBriefs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedCount, setAddedCount] = useState(0);

  const togglePlatform = (key) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleBrief = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const generate = useCallback(async () => {
    setError("");
    setLoading(true);
    setBriefs([]);
    setSelected(new Set());
    setAddedCount(0);
    try {
      const result = await generateMonthlyStrategy({
        year,
        month,
        postsPerWeek,
        platforms: [...platforms],
        brandProfile,
        existingRows: rows.map((row) => ({
          scheduledAt: row.scheduledAt,
          platform: row.platform,
          note: row.note,
          caption: row.caption,
          deletedAt: row.deletedAt,
        })),
      });
      const list = Array.isArray(result?.briefs) ? result.briefs : [];
      const keyed = list.map((brief, idx) => ({ ...brief, id: `brief-${idx}-${brief.date || "tbd"}` }));
      setBriefs(keyed);
      setSelected(new Set(keyed.map((b) => b.id)));
      if (keyed.length === 0) {
        setError("The model didn't return a usable plan — try different platforms or cadence.");
      }
    } catch (err) {
      setError(err?.message || "Strategy generation failed");
    } finally {
      setLoading(false);
    }
  }, [year, month, postsPerWeek, platforms, rows, brandProfile]);

  const addSelected = () => {
    const chosen = briefs.filter((brief) => selected.has(brief.id));
    if (chosen.length === 0) return;

    updateDocument(
      (current) => {
        const baseOrder = (current.rows || []).length;
        const newRows = chosen.map((brief, idx) => {
          const [yy, mm, dd] = (brief.date || "").split("-").map(Number);
          const iso = Number.isFinite(yy) && Number.isFinite(mm) && Number.isFinite(dd)
            ? ptPickerToISO(yy, mm - 1, dd, 10, 0)
            : null;
          const noteParts = [];
          if (brief.topic) noteParts.push(brief.topic);
          if (brief.note) noteParts.push(brief.note);
          return createNewRow({
            note: noteParts.join(" — ").slice(0, 240) || "Untitled concept",
            platform: brief.platform,
            status: "idea",
            scheduledAt: iso,
            caption: brief.hook ? brief.hook : "",
          }, currentUser, baseOrder + idx);
        });
        return { ...current, rows: [...(current.rows || []), ...newRows] };
      },
      () => createAuditEntry(
        "strategy.added",
        currentUser,
        `Added ${chosen.length} AI-suggested posts to ${MONTHS_FULL[month]} ${year}`,
        { month, year, count: chosen.length },
      ),
    );

    setAddedCount((prev) => prev + chosen.length);
    setBriefs((prev) => prev.filter((brief) => !selected.has(brief.id)));
    setSelected(new Set());
  };

  // Esc closes
  useEffect(() => {
    const handler = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const briefsByDate = useMemo(() => {
    const copy = [...briefs];
    copy.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return copy;
  }, [briefs]);

  return (
    <div className="overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal strategy-modal" role="dialog" aria-modal="true" aria-labelledby="strategy-title">
        <div className="m-head">
          <div>
            <div id="strategy-title" className="m-title">Plan the month with AI</div>
            <div className="m-sub">
              Uses your brand profile to draft a batch of post ideas. Review, deselect anything
              that doesn&apos;t fit, then add them to the calendar as ideas.
            </div>
          </div>
          <button className="m-x" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <X size={15} />
          </button>
        </div>

        <div className="m-body">
          <div className="strategy-controls">
            <div className="field">
              <div className="lbl">Month</div>
              <select
                className="inp"
                value={`${year}-${String(month).padStart(2, "0")}`}
                onChange={(event) => {
                  const [y, m] = event.target.value.split("-").map(Number);
                  setYear(y); setMonth(m);
                }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => (
                  <option key={m} value={`${now.getFullYear()}-${String(m).padStart(2, "0")}`}>
                    {MONTHS_FULL[m]} {now.getFullYear()}
                  </option>
                ))}
                {[0, 1, 2].map((m) => (
                  <option key={`next-${m}`} value={`${now.getFullYear() + 1}-${String(m).padStart(2, "0")}`}>
                    {MONTHS_FULL[m]} {now.getFullYear() + 1}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="lbl">Posts per week</div>
              <select className="inp" value={postsPerWeek} onChange={(event) => setPostsPerWeek(Number(event.target.value))}>
                {[2, 3, 4, 5, 7].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <div className="lbl">Platforms</div>
            <div className="crosspost-platform-grid">
              {Object.entries(PLATFORMS).map(([key, meta]) => {
                const on = platforms.has(key);
                return (
                  <button
                    type="button"
                    key={key}
                    className={`crosspost-platform-chip ${on ? "on" : ""}`}
                    onClick={() => togglePlatform(key)}
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

          {error && <div className="crosspost-error" role="alert">{error}</div>}

          {addedCount > 0 && briefs.length === 0 && !loading && (
            <div className="strategy-success">
              Added {addedCount} idea{addedCount === 1 ? "" : "s"} to {MONTHS_FULL[month]}. Close this to review them on the calendar.
            </div>
          )}

          {briefs.length > 0 && (
            <div className="strategy-briefs">
              <div className="lbl">Suggested posts ({briefs.length})</div>
              {briefsByDate.map((brief) => {
                const meta = PLATFORMS[brief.platform];
                const on = selected.has(brief.id);
                return (
                  <button
                    type="button"
                    key={brief.id}
                    className={`strategy-brief ${on ? "on" : ""}`}
                    onClick={() => toggleBrief(brief.id)}
                    aria-pressed={on}
                  >
                    <div className="strategy-brief-date">
                      {brief.date ? new Date(`${brief.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }) : "TBD"}
                    </div>
                    <div className="strategy-brief-platform">
                      <PlatformIcon platform={brief.platform} size={12} />
                      <span>{meta?.short || brief.platform}</span>
                    </div>
                    <div className="strategy-brief-body">
                      {brief.topic && <div className="strategy-brief-topic">{brief.topic}</div>}
                      {brief.note && <div className="strategy-brief-note">{brief.note}</div>}
                      {brief.hook && <div className="strategy-brief-hook">&ldquo;{brief.hook}&rdquo;</div>}
                    </div>
                    <div className="strategy-brief-tick">{on ? <Check size={14} /> : null}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="m-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          {briefs.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={addSelected}
              disabled={selected.size === 0}
            >
              Add {selected.size} to calendar
            </button>
          )}
          {briefs.length === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={generate}
              disabled={loading || platforms.size === 0}
            >
              <Sparkles size={13} style={{ marginRight: 6 }} />
              {loading ? "Planning\u2026" : "Generate plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
