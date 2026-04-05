import React, { useState } from "react";
import { X, Check, RotateCcw } from "lucide-react";
import {
  exchangeInstagramCode,
  fetchInstagramFeed,
  getInstagramAuthorizeUrl,
} from "../../../lib/api-client.js";
import { T } from "../shared.js";

const IG_OAUTH_CALLBACK_PATH = "/instagram/oauth/callback";

const IG_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;

function IGOAuthPanel({ igConfig, igMedia, onSave, onMediaSync, onDisconnect }) {
  const [connecting, setConnecting] = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [error,      setError]      = useState("");

  const isConnected = !!igConfig?.username;
  const redirectUri = new URL(IG_OAUTH_CALLBACK_PATH, window.location.origin).toString();

  const startOAuth = async () => {
    setError(""); setConnecting(true);
    let safeRedirectUri;
    try {
      safeRedirectUri = new URL(redirectUri).toString();
    } catch {
      setError("Invalid page origin — cannot start OAuth flow."); setConnecting(false); return;
    }

    let authorizeUrl;
    try {
      const data = await getInstagramAuthorizeUrl(safeRedirectUri);
      authorizeUrl = data.authorizeUrl;
    } catch (e) {
      const baseError = e.message || "Instagram OAuth could not start.";
      setError(
        baseError === "redirectUri is not allowed"
          ? `Redirect URI is not allowed. Add ${safeRedirectUri} to your server ALLOWED_ORIGINS and Meta app redirect URIs.`
          : baseError,
      );
      setConnecting(false);
      return;
    }

    const popup = window.open(authorizeUrl, "ig_oauth", "width=620,height=720,scrollbars=yes,resizable=yes");
    if (!popup) { setError("Popup blocked — allow popups for this page and try again."); setConnecting(false); return; }
    const timer = setInterval(() => {
      try {
        if (!popup || popup.closed) { clearInterval(timer); setConnecting(false); return; }
        const pu = popup.location.href;
        if (pu.startsWith(safeRedirectUri)) {
          const params = new URL(pu).searchParams;
          const code = params.get("code"), err = params.get("error"), state = params.get("state");
          popup.close(); clearInterval(timer);
          if (err) { setError("Denied: " + (params.get("error_description") || err)); setConnecting(false); return; }
          if (code && state) handleCode(code, safeRedirectUri, state);
        }
      } catch {
        return;
      }
    }, 500);
  };

  const handleCode = async (code, safeRedirectUri, state) => {
    try {
      const tokenData = await exchangeInstagramCode({ code, redirectUri: safeRedirectUri, state });
      onSave(tokenData.account);
      const feed = await fetchInstagramFeed();
      onMediaSync(feed);
    } catch(e) {
      setError(e.message || "Connection failed. Check the Instagram callback URL and production env settings.");
    }
    setConnecting(false);
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
          <div className="cp-avatar cp-ig-avatar">
            {igConfig.username?.[0]?.toUpperCase() || "I"}
          </div>
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
        Sign in with your Instagram account to sync your real grid and publish posts directly from Social Studio.
      </div>
      {error && <div className="cp-error" style={{padding:"0 0 10px"}}>{error}</div>}
      <button className="cp-ig-btn" onClick={startOAuth} disabled={connecting}>
        {connecting
          ? "Waiting for Instagram…"
          : <>{IG_ICON} Sign in with Instagram</>
        }
      </button>
    </>
  );
}

export function ConnectionPanel({ platform, connected, onConnect, onDisconnect, onClose, igConfig, igMedia, onIGSave, onIGMediaSync }) {
  const isIG = platform === "instagram";
  const [simulating, setSimulating] = useState(false);

  const simulate = async (action) => {
    setSimulating(true);
    await new Promise(r => setTimeout(r, 1200));
    action();
    setSimulating(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cp-modal" onClick={e => e.stopPropagation()}>
        <div className="m-head">
          <div>
            <div className="m-title">{isIG ? "Instagram" : "LinkedIn"}</div>
            <div className="m-sub">{isIG ? (igConfig?.username ? `@${igConfig.username}` : "Not connected") : (connected ? "@rangerandfox · Company Page" : "Not connected")}</div>
          </div>
          <button className="m-x" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="m-body">
          {isIG ? (
            <IGOAuthPanel
              igConfig={igConfig}
              igMedia={igMedia}
              onSave={onIGSave}
              onMediaSync={onIGMediaSync}
              onDisconnect={onDisconnect}
            />
          ) : (
            <>
              <div className="cp-status-row">
                <div className={`cp-status-dot ${connected ? "cp-dot-connected" : "cp-dot-disconnected"}`}/>
                <span className={`cp-status-text ${connected ? "" : "cp-text-dim"}`}>
                  {simulating ? (connected ? "Disconnecting…" : "Connecting…") : connected ? "Connected" : "Not connected"}
                </span>
                {connected && <span className="cp-status-ts">Workspace record only</span>}
              </div>
              {connected ? (
                <>
                  <div className="cp-account-row">
                    <div className="cp-avatar cp-li-avatar">RF</div>
                    <div><div className="cp-handle">@rangerandfox</div><div className="cp-meta">LinkedIn Company Page</div></div>
                  </div>
                  <div className="cp-detail-grid">
                    {[
                      ["Connection state", "Saved to the studio workspace"],
                      ["Publishing route", "Server endpoint not connected yet"],
                      ["Scope", "Planning and readiness only"],
                    ].map(([label, value])=>(
                      <div key={label} className="cp-detail-card">
                        <div className="cp-detail-label">{label}</div>
                        <div className="cp-detail-value">{value}</div>
                      </div>))}
                  </div>
                </>
              ) : (
                <div className="cp-description alt">
                  Prepare LinkedIn workspace access now so publish routing can be added cleanly when the server-side integration is ready.
                  {[`Attach the company page record to this workspace`,"Complete server-side publish setup when the backend route is live"].map((s,i) => (
                    <div key={i} className="cp-step"><div className="cp-step-num">{i+1}</div><div className="cp-step-text">{s}</div></div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {!isIG && (
          <div className="m-foot">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            {connected
              ? <button className="btn btn-danger btn-sm" disabled={simulating} onClick={()=>simulate(onDisconnect)}>
                  {simulating ? "Disconnecting…" : "Disconnect"}
                </button>
              : <button className="btn btn-primary btn-sm cp-li-btn" disabled={simulating} onClick={()=>simulate(onConnect)}>
                  {simulating ? "Connecting…" : "Connect with LinkedIn →"}
                </button>
            }
          </div>
        )}
        {isIG && (
          <div className="m-foot">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
