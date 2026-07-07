import React, { useState, useEffect, useRef } from "react";
import { AIMark, Close, Plus } from "../../../components/icons/index.jsx";
import {
  ACCENTS,
  PLATFORMS,
  T,
  TEAM,
  createTeamMember,
} from "../shared.js";
import { useStudio } from "../StudioContext.jsx";
import { track } from "@vercel/analytics";
import {
  fetchBilling,
  learnBrandFromUrl,
  manageReviewLink,
  openBillingPortal,
  startBillingCheckout,
} from "../../../lib/api-client.js";

// Client approval link: a no-login capability URL a client can open to see
// posts awaiting approval and approve / request changes. Creating a new link
// rotates the token, which turns every previously shared link off.
function ReviewLinkCard() {
  const { reviewConfig, showToast } = useStudio();
  const [busy, setBusy] = useState(false);
  // Server-confirmed state wins once the user acts; falls back to the doc.
  const [local, setLocal] = useState(null);
  const active = local ?? (reviewConfig?.enabled ? { token: reviewConfig.token } : null);
  const url = active?.token ? `${window.location.origin}/review?t=${active.token}` : null;

  const enable = async () => {
    setBusy(true);
    try {
      const { token } = await manageReviewLink("enable");
      track("review_link_created");
      setLocal({ token });
      try { await navigator.clipboard.writeText(`${window.location.origin}/review?t=${token}`); showToast("Review link copied — send it to your client.", T.mint); }
      catch { showToast("Review link created.", T.mint); }
    } catch (err) {
      showToast(err?.message || "Couldn't create the link — try again.", T.red);
    } finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true);
    try {
      await manageReviewLink("revoke");
      setLocal(false); // explicit off
      showToast("Review link turned off.");
    } catch (err) {
      showToast(err?.message || "Couldn't turn the link off — try again.", T.red);
    } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); showToast("Link copied.", T.mint); }
    catch { showToast("Couldn't copy — select the link text instead.", T.red); }
  };

  const isOn = local === false ? false : !!(active?.token);
  return (
    <div className="settings-card settings-mt-8">
      <div className="settings-card-title">Client review link</div>
      <div className="settings-field-sub settings-mt-0">
        A private link your client can open — no account needed — to see posts awaiting approval and approve or request changes. Creating a new link turns the old one off.
      </div>
      {isOn && url && (
        <div className="review-link-row settings-mt-12">
          <input className="inp review-link-input" readOnly value={url} onFocus={(e) => e.target.select()} />
          <button className="btn btn-ghost btn-sm" onClick={copy}>Copy</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={enable}>
          {busy ? "Working…" : isOn ? "Create new link" : "Create review link"}
        </button>
        {isOn && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={revoke}>Turn off</button>}
      </div>
    </div>
  );
}

// Editorial numbered tabs — extends the "01 / Calendar" Sidebar motif
// so chrome reads as one authored system. Render label = "01 General" etc.
const SETTINGS_TABS = [
  { key: "General", num: "01" },
  { key: "Brand", num: "02" },
  { key: "Team", num: "03" },
  { key: "Billing", num: "04" },
  { key: "Appearance", num: "05" },
];

// Accent + density live in the studio document (synced like everything
// else). This tab is the home the floating "Tweaks" prototype panel
// folds into — no extra always-on chrome.
function AppearanceTab() {
  const { appearance, updateAppearance } = useStudio();
  return (
    <div className="settings-stack">
      <div className="settings-card">
        <div className="settings-card-title">Accent</div>
        <div className="settings-field-sub settings-mt-0">A single signature color — used once per surface (kicker, today marker, AI mark).</div>
        <div className="appearance-swatches settings-mt-12">
          {Object.entries(ACCENTS).map(([key, a]) => (
            <button
              key={key}
              className={"appearance-swatch " + (appearance.accent === key ? "on" : "")}
              style={{ background: a.hex }}
              onClick={() => updateAppearance({ accent: key })}
              title={a.label}
              aria-label={a.label}
            />
          ))}
        </div>
      </div>
      <div className="settings-card settings-mt-8">
        <div className="settings-card-title">Density</div>
        <div className="settings-field-sub settings-mt-0">Comfy gives rows room to breathe; dense fits more on screen.</div>
        <div className="plat-tabs settings-mt-12">
          {[["comfy", "Comfy"], ["dense", "Dense"]].map(([k, l]) => (
            <button
              key={k}
              className={"plat-tab " + (appearance.density === k ? "on" : "")}
              onClick={() => updateAppearance({ density: k })}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function listToCsv(list) {
  return Array.isArray(list) ? list.join(", ") : "";
}
function csvToList(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function BrandTab({ brandProfile, onBrandProfileUpdate }) {
  const [draft, setDraft] = useState(() => ({
    businessName: brandProfile?.businessName || "",
    tagline: brandProfile?.tagline || "",
    description: brandProfile?.description || "",
    audience: brandProfile?.audience || "",
    toneVoice: brandProfile?.toneVoice || "",
    callToAction: brandProfile?.callToAction || "",
    keyTopicsCsv: listToCsv(brandProfile?.keyTopics),
    defaultHashtagsCsv: listToCsv(brandProfile?.defaultHashtags),
    bannedPhrasesCsv: listToCsv(brandProfile?.bannedPhrases),
  }));
  const [saved, setSaved] = useState(false);
  const [learnUrl, setLearnUrl] = useState("");
  const [learnState, setLearnState] = useState({ loading: false, error: "", success: false });
  const [showLearn, setShowLearn] = useState(false);

  const set = (key) => (event) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleLearn = async () => {
    const url = learnUrl.trim();
    if (!url) return;
    setLearnState({ loading: true, error: "", success: false });
    try {
      const result = await learnBrandFromUrl(url);
      const profile = result?.profile || {};
      setDraft((prev) => ({
        businessName: profile.businessName || prev.businessName,
        tagline: profile.tagline || prev.tagline,
        description: profile.description || prev.description,
        audience: profile.audience || prev.audience,
        toneVoice: profile.toneVoice || prev.toneVoice,
        callToAction: profile.callToAction || prev.callToAction,
        keyTopicsCsv: profile.keyTopics?.length ? listToCsv(profile.keyTopics) : prev.keyTopicsCsv,
        defaultHashtagsCsv: profile.defaultHashtags?.length ? listToCsv(profile.defaultHashtags) : prev.defaultHashtagsCsv,
        bannedPhrasesCsv: prev.bannedPhrasesCsv,
      }));
      setLearnState({ loading: false, error: "", success: true });
      setTimeout(() => setLearnState((s) => ({ ...s, success: false })), 2500);
    } catch (err) {
      setLearnState({ loading: false, error: err?.message || "Failed to learn from that URL", success: false });
    }
  };

  const save = () => {
    if (!onBrandProfileUpdate) return;
    onBrandProfileUpdate({
      businessName: draft.businessName.trim(),
      tagline: draft.tagline.trim(),
      description: draft.description.trim(),
      audience: draft.audience.trim(),
      toneVoice: draft.toneVoice.trim(),
      callToAction: draft.callToAction.trim(),
      keyTopics: csvToList(draft.keyTopicsCsv),
      defaultHashtags: csvToList(draft.defaultHashtagsCsv).map((t) =>
        t.startsWith("#") ? t : `#${t}`,
      ),
      bannedPhrases: csvToList(draft.bannedPhrasesCsv),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="settings-stack">
      <div className="settings-card">
        <div className="settings-card-title">Brand identity</div>
        <div className="settings-field-sub settings-mt-0">
          Fed into every AI caption and strategy suggestion. The richer this is, the more
          the generated posts sound like you.
        </div>

        <div className="field settings-mt-8">
          <div className="lbl">Business name</div>
          <input className="inp" placeholder="Ranger &amp; Fox" value={draft.businessName} onChange={set("businessName")} />
        </div>

        <div className="field settings-mt-8">
          <div className="lbl">Tagline</div>
          <input className="inp" placeholder="Premium motion graphics studio" value={draft.tagline} onChange={set("tagline")} />
        </div>

        <div className="field settings-mt-8">
          <div className="lbl">Description</div>
          <textarea
            className="txa"
            rows={3}
            placeholder="One or two sentences about what the business actually does."
            value={draft.description}
            onChange={set("description")}
          />
        </div>

        <div className="field settings-mt-8">
          <div className="lbl">Audience</div>
          <textarea
            className="txa"
            rows={2}
            placeholder="Creative directors, brand leads, agencies shipping high-end motion work."
            value={draft.audience}
            onChange={set("audience")}
          />
        </div>
      </div>

      <div className="settings-card settings-mt-8">
        <div className="settings-card-title">Voice + topics</div>

        <div className="field settings-mt-0">
          <div className="lbl">Tone of voice</div>
          <textarea
            className="txa"
            rows={3}
            placeholder="Calm, confident, bold, understated. No emojis in LinkedIn. 2-3 in IG. Avoid hype language."
            value={draft.toneVoice}
            onChange={set("toneVoice")}
          />
        </div>

        <div className="field settings-mt-8">
          <div className="lbl">Key topics (comma-separated)</div>
          <input
            className="inp"
            placeholder="motion design, case studies, process insights, team culture"
            value={draft.keyTopicsCsv}
            onChange={set("keyTopicsCsv")}
          />
        </div>

        <div className="field settings-mt-8">
          <div className="lbl">Default hashtags (comma-separated, # optional)</div>
          <input
            className="inp"
            placeholder="motiondesign, creative, animation"
            value={draft.defaultHashtagsCsv}
            onChange={set("defaultHashtagsCsv")}
          />
        </div>

        <div className="field settings-mt-8">
          <div className="lbl">Banned phrases (comma-separated)</div>
          <input
            className="inp"
            placeholder="dive deep, game-changer, circle back"
            value={draft.bannedPhrasesCsv}
            onChange={set("bannedPhrasesCsv")}
          />
        </div>

        <div className="field settings-mt-8">
          <div className="lbl">Call to action</div>
          <input
            className="inp"
            placeholder="Link in bio, DM us, book a call"
            value={draft.callToAction}
            onChange={set("callToAction")}
          />
        </div>
      </div>

      {showLearn ? (
        <div className="settings-card settings-mt-8" style={{ borderColor: "rgba(255,90,31,0.28)" }}>
          <div className="settings-card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AIMark size={12} /> Learn from website
          </div>
          <div className="settings-field-sub settings-mt-0">
            Paste a URL to your own site; Anthropic will read it and pre-fill the fields above.
            Nothing saves until you review and hit Save.
          </div>
          <div className="field settings-mt-8" style={{ display: "flex", gap: 6 }}>
            <input
              className="inp"
              style={{ flex: 1 }}
              value={learnUrl}
              onChange={(event) => setLearnUrl(event.target.value)}
              placeholder="https://yourbrand.com"
              autoFocus
              onKeyDown={(event) => { if (event.key === "Enter") handleLearn(); }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleLearn}
              disabled={learnState.loading || !learnUrl.trim()}
            >
              {learnState.loading ? "Reading\u2026" : "Import"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setShowLearn(false); setLearnState({ loading: false, error: "", success: false }); }}
            >
              Cancel
            </button>
          </div>
          {learnState.error && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--t-red)" }}>{learnState.error}</div>
          )}
          {learnState.success && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--success)" }}>
              Imported — review the fields above, then Save brand profile.
            </div>
          )}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", marginTop: 4 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowLearn((v) => !v)}
          title="Import positioning from a URL"
        >
          <AIMark size={12} style={{ marginRight: 4 }} />
          {showLearn ? "Close importer" : "Learn from website"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && <span style={{ fontSize: 12, color: "var(--success)" }}>Saved</span>}
          {brandProfile?.updatedAt && !saved && (
            <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: '"JetBrains Mono", monospace' }}>
              Last saved {new Date(brandProfile.updatedAt).toLocaleDateString()}
            </span>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>
            Save brand profile
          </button>
        </div>
      </div>
    </div>
  );
}

function BillingTab() {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let alive = true;
    fetchBilling()
      .then((data) => { if (alive) setState({ loading: false, error: "", data }); })
      .catch((err) => { if (alive) setState({ loading: false, error: err?.message || "Could not load billing", data: null }); });
    return () => { alive = false; };
  }, []);

  const handleUpgrade = async (plan) => {
    setBusy(`upgrade:${plan}`);
    try {
      const { url } = await startBillingCheckout({ plan });
      if (url) window.location.href = url;
    } catch (err) {
      setState((s) => ({ ...s, error: err?.message || "Could not start checkout" }));
    } finally {
      setBusy("");
    }
  };

  const handlePortal = async () => {
    setBusy("portal");
    try {
      const { url } = await openBillingPortal();
      if (url) window.location.href = url;
    } catch (err) {
      setState((s) => ({ ...s, error: err?.message || "Could not open portal" }));
    } finally {
      setBusy("");
    }
  };

  if (state.loading) {
    return <div className="settings-stack"><div className="settings-card">Loading billing\u2026</div></div>;
  }

  const data = state.data || {};
  const currentPlan = data.plan || "free";
  const status = data.status || "none";
  const trialEnd = data.trialEnd ? new Date(data.trialEnd) : null;
  const periodEnd = data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null;
  const cancelAt = data.cancelAtPeriodEnd;
  const plans = data.plans || [];
  const planLabel = plans.find((p) => p.id === currentPlan)?.label || currentPlan;

  const statusLine = (() => {
    if (status === "trialing" && trialEnd) return `Trial \u00B7 ends ${trialEnd.toLocaleDateString()}`;
    if (status === "active" && cancelAt && periodEnd) return `Active \u00B7 cancels ${periodEnd.toLocaleDateString()}`;
    if (status === "active" && periodEnd) return `Active \u00B7 renews ${periodEnd.toLocaleDateString()}`;
    if (status === "past_due") return "Past due \u00B7 update payment to keep access";
    if (status === "canceled") return "Canceled \u00B7 dropped to Free";
    return "Free tier";
  })();

  return (
    <div className="settings-stack">
      <div className="settings-card">
        <div className="settings-card-title">Current plan</div>
        <div className="settings-field-row settings-mt-0">
          <div>
            <div className="settings-field-label">{planLabel}</div>
            <div className="settings-field-sub">{statusLine}</div>
          </div>
          {currentPlan !== "free" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handlePortal}
              disabled={busy === "portal"}
            >
              {busy === "portal" ? "Opening\u2026" : "Manage billing"}
            </button>
          )}
        </div>
      </div>

      {plans.filter((p) => p.id !== "free" && p.id !== currentPlan).map((p) => (
        <div key={p.id} className="settings-card">
          <div className="settings-card-title">{p.label} \u2014 ${p.priceMonthly}{p.perSeat ? "/seat" : ""}/mo</div>
          <div className="settings-field-sub settings-mt-0">
            {p.id === "essentials" && "AI captions, variants, and brand learning. Best for solo creators."}
            {p.id === "team" && "Adds monthly strategy generation, unlimited posts, and seats for the studio."}
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleUpgrade(p.id)}
              disabled={busy === `upgrade:${p.id}`}
            >
              {busy === `upgrade:${p.id}` ? "Starting\u2026" : (status === "none" || status === "canceled" ? `Start 14-day trial` : `Switch to ${p.label}`)}
            </button>
          </div>
        </div>
      ))}

      {state.error && (
        <div className="settings-card" style={{ borderColor: "rgba(220,38,38,0.28)" }}>
          <div style={{ color: "var(--t-red)", fontSize: 13 }}>{state.error}</div>
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ onClose, onExport, team = TEAM, onTeamUpdate, brandProfile, onBrandProfileUpdate, initialTab = "General" }) {
  const [tab, setTab] = useState(initialTab);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 200);
  };

  // Focus trap: save originating focus, focus first element, restore on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const panel = panelRef.current;
    if (panel) {
      const focusables = panel.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }
    return () => {
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Trap Tab within the panel
  useEffect(() => {
    const handleTab = (e) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((el) => !el.hasAttribute('aria-hidden'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, []);

  // Escape to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const handleInviteSubmit = () => {
    const trimmed = inviteName.trim();
    if (!trimmed || !onTeamUpdate) return;
    onTeamUpdate([...team, createTeamMember({ name: trimmed, role: inviteRole.trim() })]);
    setInviteName("");
    setInviteRole("");
    setShowInvite(false);
  };

  return (
    <>
      <div className={`settings-panel-backdrop${isClosing ? " closing" : ""}`} onClick={handleClose} />
      <div
        className={`settings-panel${isClosing ? " closing" : ""}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-panel-title"
      >
        <div className="settings-panel-header">
          <div>
            <div id="settings-panel-title" className="settings-panel-title">Settings</div>
            <div className="settings-panel-sub">Relay preferences</div>
          </div>
          <button className="m-x" onClick={handleClose} title="Close (Esc)" aria-label="Close">
            <Close size={15}/>
          </button>
        </div>
        <div className="settings-panel-body">
          <div className="settings-tabs">
            {SETTINGS_TABS.map(({ key, num }) => (
              <button
                key={key}
                className={"settings-tab " + (tab === key ? "on" : "")}
                onClick={() => setTab(key)}
              >
                <span className="settings-tab-num">{num}</span>
                <span>{key}</span>
              </button>
            ))}
          </div>

          {tab==="General"&&(
            <div className="settings-stack">
              <div className="settings-card">
                <div className="settings-card-title">Workspace</div>
                <div className="field"><div className="lbl">Studio Name</div><input className="inp" defaultValue="Ranger & Fox"/></div>
              </div>
              <div className="field settings-mt-12"><div className="lbl">Default Platform</div>
                <div className="plat-tabs settings-mt-0">
                  {Object.entries(PLATFORMS).map(([k,pl])=>(
                    <button key={k} className="plat-tab">{pl.label}</button>
                  ))}
                </div>
              </div>
              <div className="settings-card">
                <div className="settings-field-row settings-mt-0">
                  <div><div className="settings-field-label">Timezone</div><div className="settings-field-sub">All times shown in Pacific</div></div>
                  <div className="settings-tz-badge">PT (UTC−8)</div>
                </div>
                <div className="settings-field-row">
                  <div><div className="settings-field-label">Save confidence</div><div className="settings-field-sub">Show explicit save state throughout the studio</div></div>
                  <div className="settings-field-value">Enabled</div>
                </div>
              </div>
              <div className="settings-card settings-mt-8">
                <div className="settings-card-title">Data & Backup</div>
                <div className="settings-field-row">
                  <div>
                    <div className="settings-field-label">Export studio data</div>
                    <div className="settings-field-sub">Download all posts, audit log, and config as JSON</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={onExport}>Export</button>
                </div>
              </div>
            </div>
          )}

          {tab === "Brand" && (
            <BrandTab
              brandProfile={brandProfile}
              onBrandProfileUpdate={onBrandProfileUpdate}
            />
          )}

          {tab === "Billing" && <BillingTab />}

          {tab === "Appearance" && <AppearanceTab />}

          {tab==="Team"&&(
            <div className="settings-team-list">
              {team.map(t=>(
                <div key={t.id} className="settings-card settings-member">
                  <div className="av settings-member-avatar" style={{background:t.color+"22",color:t.color}}>{t.initials}</div>
                  <div className="settings-member-info">
                    <div className="settings-member-name">{t.name}</div>
                    <div className="settings-member-role">{t.role || "Team member"}</div>
                  </div>
                  <div className="settings-role-badge" style={{background:t.id==="stephen"?T.s3:"transparent"}}>
                    {t.id==="stephen"?"Admin":"Editor"}
                  </div>
                  {onTeamUpdate && (
                    <button className="m-x settings-remove-btn" title="Remove member"
                      onClick={()=>onTeamUpdate(team.filter(m=>m.id!==t.id))}>
                      <Close size={12}/>
                    </button>
                  )}
                </div>
              ))}
              {showInvite ? (
                <div className="settings-card settings-invite-form">
                  <div className="field"><div className="lbl">Name</div><input className="inp" placeholder="Full name" value={inviteName} onChange={e=>setInviteName(e.target.value)} autoFocus/></div>
                  <div className="field"><div className="lbl">Role</div><input className="inp" placeholder="e.g. Designer, Content Lead" value={inviteRole} onChange={e=>setInviteRole(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") handleInviteSubmit(); }}/></div>
                  <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{setShowInvite(false);setInviteName("");setInviteRole("");}}>Cancel</button>
                    <button className="btn btn-primary btn-sm" disabled={!inviteName.trim()} onClick={handleInviteSubmit}>Add Member</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-ghost settings-invite-trigger" onClick={()=>setShowInvite(true)}><Plus size={12} className="cp-icon-mr"/> Invite team member</button>
              )}

              <ReviewLinkCard />
            </div>
          )}
        </div>
        <div className="settings-panel-footer">
          <button className="btn btn-primary btn-sm" onClick={handleClose}>Done</button>
        </div>
      </div>
    </>
  );
}
