import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import {
  PLATFORMS,
  T,
  TEAM,
  createTeamMember,
} from "../shared.js";

const SETTINGS_TABS = ["General","Team"];

export function SettingsModal({ onClose, onExport, team = TEAM, onTeamUpdate }) {
  const [tab, setTab] = useState("General");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("");

  const handleInviteSubmit = () => {
    const trimmed = inviteName.trim();
    if (!trimmed || !onTeamUpdate) return;
    onTeamUpdate([...team, createTeamMember({ name: trimmed, role: inviteRole.trim() })]);
    setInviteName("");
    setInviteRole("");
    setShowInvite(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e=>e.stopPropagation()}>
        <div className="m-head">
          <div><div className="m-title">Settings</div><div className="m-sub">Social Studio preferences</div></div>
          <button className="m-x" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="m-body settings-body-flush">
          <div className="settings-tabs">
            {SETTINGS_TABS.map(t=>(
              <button key={t} className={"settings-tab "+(tab===t?"on":"")} onClick={()=>setTab(t)}>{t}</button>
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
                      <X size={12}/>
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
            </div>
          )}

        </div>
        <div className="m-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
