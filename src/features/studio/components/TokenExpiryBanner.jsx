import React from "react";
import { X } from "lucide-react";
import { T } from "../shared.js";

export function TokenExpiryBanner({ igConfig, onRefresh, onDismiss }) {
  if (!igConfig?.expiresAt) return null;
  const daysLeft = Math.round((igConfig.expiresAt - Date.now()) / 86400000);
  if (daysLeft > 10) return null; // not yet critical

  const expired = daysLeft <= 0;
  const bg      = expired ? T.red : T.amber;
  const msg     = expired
    ? 'Your Instagram access token has expired. Reconnect to continue syncing.'
    : `Instagram token expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Refresh now to avoid disruption.`;

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, zIndex:400,
      background: bg, color:'#fff',
      padding:'8px 20px', fontSize:12.5, fontWeight:500,
      display:'flex', alignItems:'center', gap:12,
      fontFamily:'"Oakes Grotesk", system-ui, sans-serif',
    }}>
      <span style={{flex:1}}>{msg}</span>
      {!expired && (
        <button onClick={onRefresh} style={{
          background:'rgba(255,255,255,0.22)', border:'1px solid rgba(255,255,255,0.4)',
          borderRadius:5, padding:'4px 12px', color:'#fff', fontSize:12, fontWeight:700,
          cursor:'pointer',
        }}>Refresh Token</button>
      )}
      <button onClick={onDismiss} style={{
        background:'transparent', border:'none', color:'rgba(255,255,255,0.7)',
        fontSize:16, cursor:'pointer', lineHeight:1, padding:'2px 4px',
      }}><X size={14} /></button>
    </div>
  );
}
