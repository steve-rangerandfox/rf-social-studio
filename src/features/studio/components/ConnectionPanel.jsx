import React, { useState, useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Check, Close as X } from "../../../components/icons/index.jsx";
import {
  exchangeInstagramCode,
  exchangeLinkedInCode,
  fetchInstagramFeed,
  getInstagramAuthorizeUrl,
  getLinkedInAuthorizeUrl,
} from "../../../lib/api-client.js";
import { T } from "../shared.js";

const IG_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;

// Friendly labels for missing env vars in setup errors
const ENV_LABELS = {
  fbAppId: "FB_APP_ID",
  fbAppSecret: "FB_APP_SECRET",
  fbRedirectUri: "FB_REDIRECT_URI",
  sessionSecret: "SESSION_SECRET",
  sessionExpiresAt: "SESSION_SECRET",
  igAppId: "FB_APP_ID",
  igAppSecret: "FB_APP_SECRET",
};

function IGOAuthPanel({ igConfig, igMedia, onSave, onMediaSync, onDisconnect }) {
  const [phase, setPhase] = useState("idle"); // "idle" | "connecting" | "connected"
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [setupDetails, setSetupDetails] = useState(null); // { missing: [...], reason: string }

  const isConnected = !!igConfig?.username;
  const connecting = phase === "connecting";

  const startOAuth = async () => {
    setError("");
    setSetupDetails(null);
    setPhase("connecting");

    let authorizeUrl;
    try {
      const data = await getInstagramAuthorizeUrl();
      authorizeUrl = data.authorizeUrl;
    } catch (e) {
      // Surface server-side configuration issues clearly so the user can self-diagnose
      const code = e.body?.code || "";
      const missing = e.body?.missing || [];
      if (code === "SERVER_ERROR" && missing.length > 0) {
        const labels = [...new Set(missing.map((k) => ENV_LABELS[k] || k))];
        setSetupDetails({ missing: labels, reason: e.message });
        setError("");
      } else if (code === "SERVER_ERROR" && /redirect/i.test(e.message || "")) {
        setSetupDetails({
          missing: ["FB_REDIRECT_URI"],
          reason: e.message,
        });
        setError("");
      } else {
        setError(e.message || "Couldn't start the connection");
      }
      setPhase("idle");
      return;
    }

    const popup = window.open(
      authorizeUrl,
      "rf_ig_oauth",
      "width=620,height=720,scrollbars=yes,resizable=yes",
    );
    if (!popup) {
      setError("Popup blocked — allow popups for this page and try again.");
      setPhase("idle");
      return;
    }

    let popupCheckTimer = null;

    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "rf_ig_oauth") return;

      window.removeEventListener("message", handleMessage);
      if (popupCheckTimer) clearInterval(popupCheckTimer);

      if (!event.data.ok) {
        setError(event.data.error || "Connection cancelled");
        setPhase("idle");
        return;
      }

      try {
        const result = await exchangeInstagramCode({
          code: event.data.code,
          state: event.data.state,
        });
        onSave(result.account);
        const feed = await fetchInstagramFeed();
        onMediaSync(feed);
        setPhase("connected");
      } catch (e) {
        const msg = e.body?.error || e.message || "Connection failed";
        setError(msg);
        setPhase("idle");
      }
    };

    window.addEventListener("message", handleMessage);

    popupCheckTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupCheckTimer);
        window.removeEventListener("message", handleMessage);
        setPhase((current) => (current === "connecting" ? "idle" : current));
      }
    }, 500);
  };

  const syncMedia = async () => {
    setSyncing(true); setError("");
    try { onMediaSync(await fetchInstagramFeed()); }
    catch(e) { setError(e.message || "Sync failed — token may have expired."); }
    setSyncing(false);
  };

  const daysLeft   = igConfig?.expiresAt ? Math.round((igConfig.expiresAt - Date.now()) / 86400000) : 0;
  const mediaCount = igMedia?.data?.length || 0;
  const syncedAt   = igMedia?._syncedAt ? new Date(igMedia._syncedAt).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : null;

  if (isConnected) {
    return (
      <>
        <div className="cp-status-row">
          <div className="cp-status-dot cp-dot-connected"/>
          <span className="cp-status-text">Connected</span>
          <span className="cp-status-ts">{syncedAt ? `Synced ${syncedAt}` : `${mediaCount} posts loaded`}</span>
        </div>
        <div className="cp-account-row">
          {igConfig.avatarUrl ? (
            <img src={igConfig.avatarUrl} alt="" className="cp-avatar" />
          ) : (
            <div className="cp-avatar cp-ig-avatar">
              {igConfig.username?.[0]?.toUpperCase() || "I"}
            </div>
          )}
          <div>
            <div className="cp-handle">@{igConfig.username}</div>
            <div className="cp-meta">Instagram · {igConfig.mediaCount || mediaCount} posts</div>
          </div>
        </div>

        <div className="cp-session-section">
          <div className="cp-session-header">
            <span className="cp-section-title">Server Session</span>
            <span className="cp-session-expiry" style={{color: daysLeft < 10 ? T.amber : T.textSub}}>
              {daysLeft > 0 ? `${daysLeft}d remaining` : "expired — reconnect"}
            </span>
          </div>
          <div className="cp-token-bar">
            <div className="cp-token-fill" style={{width:`${Math.max(2,Math.min(100,(daysLeft/60)*100))}%`,background: daysLeft < 10 ? T.amber : "var(--t-success)"}}/>
          </div>
        </div>

        <div className="cp-permissions">
          <div className="cp-section-title">Permissions</div>
          {["Read profile & media","Access media URLs & thumbnails","Read media metadata"].map(permission => (
            <div key={permission} className="cp-permission-row">
              <span className="cp-check-icon"><Check size={12}/></span>{permission}
            </div>
          ))}
        </div>

        {error && <div className="cp-error">{error}</div>}

        <div className="cp-actions">
          <button className="btn btn-ghost btn-sm cp-action-fill" onClick={syncMedia} disabled={syncing}>
            {syncing ? "Syncing…" : <><RotateCcw size={11} className="cp-icon-mr"/> Sync Posts ({mediaCount})</>}
          </button>
          <button className="btn btn-danger btn-sm" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="cp-status-row">
        <div className="cp-status-dot cp-dot-disconnected"/>
        <span className="cp-status-text cp-text-dim">
          {connecting ? "Waiting for Instagram…" : "Not connected"}
        </span>
      </div>
      <div className="cp-description">
        Connect your Instagram Business or Creator account directly with Instagram Login.
      </div>
      <div className="cp-requirements">
        <div className="cp-section-title">Before you connect</div>
        <ol className="cp-req-list-numbered">
          <li>
            <span className="cp-req-num">1</span>
            <span>Convert your Instagram to a <strong>Business or Creator</strong> account
              <a href="https://help.instagram.com/502981923235522" target="_blank" rel="noopener noreferrer" className="cp-req-link">How? {"\u2197"}</a>
            </span>
          </li>
          <li>
            <span className="cp-req-num">2</span>
            <span>Authorize this studio with your Instagram credentials</span>
          </li>
        </ol>
      </div>
      {setupDetails && (
        <div className="cp-setup-error" role="alert">
          <div className="cp-setup-error-title">Server isn't configured yet</div>
          <div className="cp-setup-error-body">
            Your Vercel deployment is missing {setupDetails.missing.length === 1 ? "this environment variable" : "these environment variables"}:
          </div>
          <ul className="cp-setup-error-list">
            {setupDetails.missing.map((name) => (
              <li key={name}><code>{name}</code></li>
            ))}
          </ul>
          <div className="cp-setup-error-help">
            Set them in <strong>Vercel → Settings → Environment Variables</strong>, then redeploy. See <code>.env.example</code> for the full setup guide.
          </div>
        </div>
      )}
      {error && <div className="cp-error" style={{padding:"0 0 10px"}}>{error}</div>}
      <button className="cp-ig-btn" onClick={startOAuth} disabled={connecting}>
        {connecting
          ? "Waiting for Instagram…"
          : <>{IG_ICON} Connect Instagram</>
        }
      </button>
    </>
  );
}

const LI_ENV_LABELS = {
  liAppId: "LINKEDIN_CLIENT_ID",
  liAppSecret: "LINKEDIN_CLIENT_SECRET",
  liRedirectUri: "LINKEDIN_REDIRECT_URI",
  sessionSecret: "SESSION_SECRET",
};

function LIOAuthPanel({ liAccount, onConnect, onDisconnect }) {
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [setupDetails, setSetupDetails] = useState(null);

  const isConnected = !!liAccount?.personUrn;
  const connecting = phase === "connecting";

  const startOAuth = async () => {
    setError("");
    setSetupDetails(null);
    setPhase("connecting");

    let authorizeUrl;
    try {
      const data = await getLinkedInAuthorizeUrl();
      authorizeUrl = data.authorizeUrl;
    } catch (e) {
      const code = e.body?.code || "";
      const missing = e.body?.missing || [];
      if (code === "SERVER_ERROR" && missing.length > 0) {
        const labels = [...new Set(missing.map((k) => LI_ENV_LABELS[k] || k))];
        setSetupDetails({ missing: labels, reason: e.message });
      } else {
        setError(e.message || "Couldn't start the LinkedIn connection");
      }
      setPhase("idle");
      return;
    }

    const popup = window.open(authorizeUrl, "rf_li_oauth", "width=620,height=760,scrollbars=yes,resizable=yes");
    if (!popup) {
      setError("Popup blocked — allow popups for this page and try again.");
      setPhase("idle");
      return;
    }

    let popupCheckTimer = null;

    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "rf_li_oauth") return;
      window.removeEventListener("message", handleMessage);
      if (popupCheckTimer) clearInterval(popupCheckTimer);

      if (!event.data.ok) {
        setError(event.data.error || "LinkedIn cancelled the connection");
        setPhase("idle");
        return;
      }
      try {
        const result = await exchangeLinkedInCode({ code: event.data.code, state: event.data.state });
        if (result?.account) {
          onConnect(result.account);
          setPhase("idle");
        } else {
          setError("LinkedIn returned an empty account");
          setPhase("idle");
        }
      } catch (err) {
        setError(err?.message || "LinkedIn exchange failed");
        setPhase("idle");
      }
    };

    window.addEventListener("message", handleMessage);
    popupCheckTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupCheckTimer);
        window.removeEventListener("message", handleMessage);
        setPhase("idle");
      }
    }, 500);
  };

  if (isConnected) {
    return (
      <>
        <div className="cp-account-row">
          <div className="cp-avatar cp-li-avatar">
            {liAccount.pictureUrl
              ? <img src={liAccount.pictureUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              : (liAccount.name || "LI").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="cp-handle">{liAccount.name || "LinkedIn member"}</div>
            <div className="cp-meta">Connected · ready to publish</div>
          </div>
        </div>
        <button
          className="btn btn-danger btn-sm"
          style={{ marginTop: 12 }}
          onClick={onDisconnect}
        >
          Disconnect LinkedIn
        </button>
      </>
    );
  }

  return (
    <>
      <div className="cp-description">
        Connect LinkedIn to publish posts directly from the studio. Uses the "Share on LinkedIn"
        product with OpenID Connect for member identity.
      </div>
      {setupDetails && (
        <div className="cp-setup-error" role="alert">
          <div className="cp-setup-error-title">Server isn't configured yet</div>
          <div className="cp-setup-error-body">
            Missing {setupDetails.missing.length === 1 ? "environment variable" : "environment variables"}:
          </div>
          <ul className="cp-setup-error-list">
            {setupDetails.missing.map((name) => (
              <li key={name}><code>{name}</code></li>
            ))}
          </ul>
          <div className="cp-setup-error-help">
            Set them in <strong>Vercel → Settings → Environment Variables</strong>, redeploy, then reopen this panel.
          </div>
        </div>
      )}
      {error && <div className="cp-error" style={{ padding: "0 0 10px" }}>{error}</div>}
      <button className="cp-ig-btn" onClick={startOAuth} disabled={connecting}>
        {connecting ? "Waiting for LinkedIn\u2026" : "Connect LinkedIn"}
      </button>
    </>
  );
}

export function ConnectionPanel({ platform, connected, onConnect, onDisconnect, onClose, igConfig, igMedia, onIGSave, onIGMediaSync, liAccount, onLIConnect, onLIDisconnect }) {
  const isIG = platform === "instagram";
  const isLI = platform === "linkedin";
  const [simulating, setSimulating] = useState(false);
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

  const simulate = async (action) => {
    setSimulating(true);
    await new Promise(r => setTimeout(r, 1200));
    action();
    setSimulating(false);
  };

  return (
    <>
      <div className={`connection-panel-backdrop${isClosing ? " closing" : ""}`} onClick={handleClose} />
      <div
        className={`connection-panel${isClosing ? " closing" : ""}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-panel-title"
      >
        <div className="connection-panel-header">
          <div>
            <div id="connection-panel-title" className="connection-panel-title">{isIG ? "Instagram" : isLI ? "LinkedIn" : "Connection"}</div>
            <div className="connection-panel-sub">
              {isIG
                ? (igConfig?.username ? `@${igConfig.username}` : "Not connected")
                : isLI
                  ? (liAccount?.personUrn ? (liAccount.name || "Connected") : "Not connected")
                  : (connected ? "Connected" : "Not connected")}
            </div>
          </div>
          <button className="m-x" onClick={handleClose} title="Close (Esc)" aria-label="Close"><X size={15}/></button>
        </div>
        <div className="connection-panel-body">
          {isIG ? (
            <IGOAuthPanel
              igConfig={igConfig}
              igMedia={igMedia}
              onSave={onIGSave}
              onMediaSync={onIGMediaSync}
              onDisconnect={onDisconnect}
            />
          ) : isLI ? (
            <LIOAuthPanel
              liAccount={liAccount}
              onConnect={onLIConnect}
              onDisconnect={onLIDisconnect}
            />
          ) : (
            <>
              <div className="cp-status-row">
                <div className={`cp-status-dot ${connected ? "cp-dot-connected" : "cp-dot-disconnected"}`}/>
                <span className={`cp-status-text ${connected ? "" : "cp-text-dim"}`}>
                  {simulating ? (connected ? "Disconnecting…" : "Connecting…") : connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <div className="cp-description alt">
                This platform isn&apos;t wired up for publishing yet — plan posts here and they&apos;ll show in
                the calendar and readiness checks regardless.
              </div>
            </>
          )}
        </div>
        {!isIG && !isLI && (
          <div className="connection-panel-footer">
            <button className="btn btn-ghost btn-sm" onClick={handleClose}>Close</button>
            {connected
              ? <button className="btn btn-danger btn-sm" disabled={simulating} onClick={()=>simulate(onDisconnect)}>
                  {simulating ? "Disconnecting…" : "Disconnect"}
                </button>
              : <button className="btn btn-primary btn-sm" disabled={simulating} onClick={()=>simulate(onConnect)}>
                  {simulating ? "Connecting…" : "Mark as connected"}
                </button>
            }
          </div>
        )}
        {(isIG || isLI) && (
          <div className="connection-panel-footer">
            <button className="btn btn-ghost btn-sm" onClick={handleClose}>Close</button>
          </div>
        )}
      </div>
    </>
  );
}
