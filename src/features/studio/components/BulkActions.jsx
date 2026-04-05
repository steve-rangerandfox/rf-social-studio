import React, { useState } from "react";
import { useStudio } from "../StudioContext.jsx";
import { PLATFORMS, STATUSES } from "../shared.js";

export function BulkActions() {
  const {
    sel, setSel, bulkDel,
    bulkSetStatus, bulkSetPlatform, bulkSetAssignee,
    team,
  } = useStudio();

  const [statusOpen, setStatusOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  if (sel.size === 0) return null;

  const closeAll = () => { setStatusOpen(false); setPlatformOpen(false); setAssigneeOpen(false); };

  return (
    <div className="bulk">
      <span className="bulk-lbl"><b>{sel.size}</b> selected</span>

      {/* Status dropdown */}
      <div className="bulk-dropdown-anchor">
        <button
          className="btn btn-ghost bulk-action-btn"
          onClick={() => { closeAll(); setStatusOpen(v => !v); }}
        >
          Set status
        </button>
        {statusOpen && (
          <div className="popover-menu anchor-top">
            {Object.entries(STATUSES).map(([value, def]) => (
              <button
                key={value}
                className="popover-menu-item"
                onClick={() => { bulkSetStatus(value); setStatusOpen(false); }}
              >
                <span className="bulk-dot" style={{ background: def.dot }} />
                {def.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Platform dropdown */}
      <div className="bulk-dropdown-anchor">
        <button
          className="btn btn-ghost bulk-action-btn"
          onClick={() => { closeAll(); setPlatformOpen(v => !v); }}
        >
          Set channel
        </button>
        {platformOpen && (
          <div className="popover-menu anchor-top">
            {Object.entries(PLATFORMS).map(([value, def]) => (
              <button
                key={value}
                className="popover-menu-item"
                onClick={() => { bulkSetPlatform(value); setPlatformOpen(false); }}
              >
                {def.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assignee dropdown */}
      <div className="bulk-dropdown-anchor">
        <button
          className="btn btn-ghost bulk-action-btn"
          onClick={() => { closeAll(); setAssigneeOpen(v => !v); }}
        >
          Set assignee
        </button>
        {assigneeOpen && (
          <div className="popover-menu anchor-top">
            <button
              className="popover-menu-item"
              onClick={() => { bulkSetAssignee(null); setAssigneeOpen(false); }}
            >
              Unassigned
            </button>
            {team.map(member => (
              <button
                key={member.id}
                className="popover-menu-item"
                onClick={() => { bulkSetAssignee(member.id); setAssigneeOpen(false); }}
              >
                <span className="bulk-dot" style={{ background: member.color }} />
                {member.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-ghost bulk-action-btn" onClick={() => setSel(new Set())}>Deselect</button>
      <button className="btn btn-danger bulk-action-btn" onClick={bulkDel}>Delete</button>
    </div>
  );
}
