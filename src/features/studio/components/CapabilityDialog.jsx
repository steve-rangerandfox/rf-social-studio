import React from "react";
import { AlertTriangle, Close as X } from "../../../components/icons/index.jsx";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { T, PLATFORMS } from "../shared.js";
import { getCapability } from "../capabilities.js";

// Capability enforcement dialog: when a drop/upload violates a selected
// channel, name the channel and offer the viable ways out. Which actions
// appear is decided by planUpload (capabilities.js) — never guess here.
export function CapabilityDialog({ plan, onRemoveChannels, onReplace, onCancel }) {
  // Group violation messages per channel, deduped, for the per-channel rows.
  const byChannel = [];
  for (const v of plan.violations) {
    let entry = byChannel.find((e) => e.channel === v.channel);
    if (!entry) { entry = { channel: v.channel, messages: [] }; byChannel.push(entry); }
    if (!entry.messages.includes(v.message)) entry.messages.push(v.message);
  }
  const label = (k) => PLATFORMS[k]?.label || getCapability(k).label;
  const removeLabel = plan.violatingChannels.map(label).join(", ");

  return (
    // Stop propagation so a backdrop click doesn't also hit the parent
    // modal's own overlay (which would close the whole window).
    <div className="overlay" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <div>
            <div className="m-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} style={{ color: T.amber, flexShrink: 0 }} />
              Media doesn&rsquo;t fit {byChannel.length === 1 ? label(byChannel[0].channel) : `${byChannel.length} channels`}
            </div>
            <div className="m-sub">This upload breaks the rules of a selected channel.</div>
          </div>
          <button className="m-x" onClick={onCancel} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="m-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {byChannel.map(({ channel, messages }) => (
            <div key={channel} style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 6, background: T.s2 }}>
              <PlatformIcon platform={channel} size={20} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label(channel)}</div>
                {messages.map((m) => (
                  <div key={m} style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>{m}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="m-foot" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel upload</button>
          {plan.canReplace && (
            <button className="btn btn-ghost" onClick={onReplace}
              title="Start the post's media over with just the files you dropped">
              Replace media
            </button>
          )}
          {plan.canRemoveChannels && (
            <button className="btn btn-primary" onClick={onRemoveChannels}
              title={`Remove ${removeLabel} from this post and continue the upload`}>
              Remove {removeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
