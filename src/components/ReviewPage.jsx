import React, { useEffect, useMemo, useState } from "react";

// Public client-approval page. Opened from a capability URL
// (/review?t=<token>) — no login. Shows posts awaiting approval; the client
// can approve or request changes. Self-contained styling (public pages don't
// load studio.css) using the same design tokens by value.

const PLATFORM_LABELS = {
  ig_post: "Instagram post",
  ig_reel: "Instagram reel",
  ig_story: "Instagram story",
  linkedin: "LinkedIn",
};

function formatWhen(iso) {
  if (!iso) return "Unscheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unscheduled";
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function api(path, options) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "Something went wrong — try again.");
  return body;
}

export function ReviewPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("t") || "", []);
  const [state, setState] = useState({ loading: true, error: "", studio: "", pending: [], recent: [] });
  const [clientName, setClientName] = useState(() => localStorage.getItem("rf_review_name") || "");
  const [decided, setDecided] = useState({}); // rowId -> "approved" | "changes"
  const [changeFor, setChangeFor] = useState(null); // rowId with the changes box open
  const [changeNote, setChangeNote] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!token) { setState((s) => ({ ...s, loading: false, error: "This link is missing its key — ask the studio to resend it." })); return; }
    api(`/api/review?t=${encodeURIComponent(token)}`)
      .then((data) => setState({ loading: false, error: "", studio: data.studio, pending: data.pending || [], recent: data.recent || [] }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
  }, [token]);

  const rememberName = (name) => {
    setClientName(name);
    try { localStorage.setItem("rf_review_name", name); } catch { /* private mode */ }
  };

  const act = async (rowId, action, note = "") => {
    setBusyId(rowId);
    try {
      await api("/api/review", {
        method: "POST",
        body: JSON.stringify({ t: token, rowId, action, note, clientName }),
      });
      setDecided((d) => ({ ...d, [rowId]: action === "approve" ? "approved" : "changes" }));
      setChangeFor(null);
      setChangeNote("");
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setBusyId(null);
    }
  };

  const remaining = state.pending.filter((p) => !decided[p.id]).length;

  return (
    <div className="rvw-root">
      <style>{REVIEW_CSS}</style>
      <header className="rvw-head">
        <div className="rvw-brand">Relay</div>
        <div className="rvw-studio">{state.studio || "Content review"}</div>
      </header>

      {state.loading ? (
        <div className="rvw-empty">Loading the queue…</div>
      ) : state.error ? (
        <div className="rvw-error">{state.error}</div>
      ) : (
        <main className="rvw-main">
          <div className="rvw-kicker">For approval</div>
          <h1 className="rvw-title">
            {state.pending.length === 0
              ? "Nothing waiting on you."
              : remaining === 0
                ? "All reviewed — thank you."
                : `${remaining} ${remaining === 1 ? "post needs" : "posts need"} your sign-off.`}
          </h1>

          <div className="rvw-name-row">
            <label className="rvw-name-label" htmlFor="rvw-name">Reviewing as</label>
            <input id="rvw-name" className="rvw-name-input" placeholder="Your name" value={clientName}
              onChange={(e) => rememberName(e.target.value)} />
          </div>

          <section className="rvw-list">
            {state.pending.map((post) => {
              const outcome = decided[post.id];
              return (
                <article key={post.id} className={"rvw-card" + (outcome ? " done" : "")}>
                  {post.thumbnailUrl && <img className="rvw-thumb" src={post.thumbnailUrl} alt="" loading="lazy" />}
                  <div className="rvw-card-body">
                    <div className="rvw-card-meta">
                      <span className="rvw-chip">{PLATFORM_LABELS[post.platform] || post.platform}</span>
                      <span className="rvw-when">{formatWhen(post.scheduledAt)}</span>
                    </div>
                    <div className="rvw-card-title">{post.note || "Untitled post"}</div>
                    {post.caption && <p className="rvw-caption">{post.caption}</p>}

                    {outcome === "approved" && <div className="rvw-outcome ok">Approved ✓</div>}
                    {outcome === "changes" && <div className="rvw-outcome">Changes requested — the studio will follow up.</div>}

                    {!outcome && changeFor !== post.id && (
                      <div className="rvw-actions">
                        <button className="rvw-btn primary" disabled={busyId === post.id} onClick={() => act(post.id, "approve")}>
                          {busyId === post.id ? "Sending…" : "Approve"}
                        </button>
                        <button className="rvw-btn" disabled={busyId === post.id} onClick={() => { setChangeFor(post.id); setChangeNote(""); }}>
                          Request changes
                        </button>
                      </div>
                    )}
                    {!outcome && changeFor === post.id && (
                      <div className="rvw-changes">
                        <textarea className="rvw-changes-input" rows={3} autoFocus placeholder="What should change?"
                          value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
                        <div className="rvw-actions">
                          <button className="rvw-btn primary" disabled={!changeNote.trim() || busyId === post.id}
                            onClick={() => act(post.id, "request_changes", changeNote.trim())}>
                            {busyId === post.id ? "Sending…" : "Send to studio"}
                          </button>
                          <button className="rvw-btn" onClick={() => setChangeFor(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          {state.recent.length > 0 && (
            <section className="rvw-recent">
              <div className="rvw-kicker">Recently locked in</div>
              <ul className="rvw-recent-list">
                {state.recent.map((post) => (
                  <li key={post.id} className="rvw-recent-item">
                    <span className="rvw-recent-title">{post.note || "Untitled post"}</span>
                    <span className="rvw-recent-meta">{PLATFORM_LABELS[post.platform] || post.platform} · {post.status} · {formatWhen(post.scheduledAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="rvw-foot">Powered by <a href="/" className="rvw-foot-link">Relay</a> — plan, design, and publish in one studio.</footer>
        </main>
      )}
    </div>
  );
}

const REVIEW_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700&display=swap');
.rvw-root{min-height:100vh;background:#fafafa;color:#09090b;font-family:'Switzer','Helvetica Neue',Arial,system-ui,sans-serif}
.rvw-head{display:flex;align-items:baseline;justify-content:space-between;max-width:720px;margin:0 auto;padding:28px 24px 0}
.rvw-brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;letter-spacing:-0.03em}
.rvw-studio{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#71717a}
.rvw-main{max-width:720px;margin:0 auto;padding:36px 24px 64px}
.rvw-kicker{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#71717a;margin-bottom:10px}
.rvw-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(26px,4.5vw,40px);letter-spacing:-0.04em;line-height:1.05;margin:0 0 22px}
.rvw-name-row{display:flex;align-items:center;gap:10px;margin-bottom:26px}
.rvw-name-label{font-size:13px;color:#52525b}
.rvw-name-input{padding:8px 12px;border:1px solid #e4e4e7;border-radius:6px;font-size:14px;background:#fff;outline:none;width:200px}
.rvw-name-input:focus{border-color:#a1a1aa}
.rvw-list{display:flex;flex-direction:column;gap:16px}
.rvw-card{display:flex;gap:16px;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:16px;transition:opacity .2s}
.rvw-card.done{opacity:.62}
.rvw-thumb{width:96px;height:96px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid #e4e4e7;background:#f4f4f5}
.rvw-card-body{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px}
.rvw-card-meta{display:flex;align-items:center;gap:10px}
.rvw-chip{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;background:#f4f4f5;border:1px solid #e4e4e7;color:#52525b}
.rvw-when{font-family:'JetBrains Mono',monospace;font-size:11px;color:#a1a1aa}
.rvw-card-title{font-weight:600;font-size:15px}
.rvw-caption{margin:0;font-size:13px;line-height:1.55;color:#52525b;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.rvw-actions{display:flex;gap:8px;margin-top:4px}
.rvw-btn{padding:8px 16px;border-radius:999px;border:1px solid #e4e4e7;background:#fff;font-size:13px;font-weight:600;cursor:pointer;color:#09090b}
.rvw-btn:hover:not(:disabled){border-color:#a1a1aa}
.rvw-btn.primary{background:#09090b;border-color:#09090b;color:#fff}
.rvw-btn.primary:hover:not(:disabled){background:#27272a}
.rvw-btn:disabled{opacity:.5;cursor:default}
.rvw-changes{display:flex;flex-direction:column;gap:8px}
.rvw-changes-input{width:100%;padding:10px 12px;border:1px solid #e4e4e7;border-radius:12px;font-size:13px;font-family:inherit;resize:vertical;outline:none;background:#fff}
.rvw-changes-input:focus{border-color:#a1a1aa}
.rvw-outcome{font-size:13px;font-weight:600;color:#52525b}
.rvw-outcome.ok{color:#0c8f5f}
.rvw-recent{margin-top:44px}
.rvw-recent-list{list-style:none;margin:0;padding:0}
.rvw-recent-item{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid #e4e4e7;font-size:13px}
.rvw-recent-title{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rvw-recent-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:#a1a1aa;white-space:nowrap}
.rvw-empty,.rvw-error{max-width:720px;margin:80px auto;padding:0 24px;text-align:center;color:#71717a;font-size:15px}
.rvw-error{color:#dc2626}
.rvw-foot{margin-top:56px;font-size:12px;color:#a1a1aa;text-align:center}
.rvw-foot-link{color:#71717a;font-weight:600;text-decoration:none}
@media (max-width:540px){.rvw-card{flex-direction:column}.rvw-thumb{width:100%;height:160px}}
`;
