import React, { useState, useRef, useEffect } from "react";
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cancelTimerRef = useRef(null);

  // Auto-cancel confirm after 5 seconds
  useEffect(() => {
    if (!confirmingDelete) return;
    cancelTimerRef.current = setTimeout(() => setConfirmingDelete(false), 5000);
    return () => clearTimeout(cancelTimerRef.current);
  }, [confirmingDelete]);

  // Reset confirm state if selection changes
  useEffect(() => { setConfirmingDelete(false); }, [sel.size]);

  if (sel.size === 0) return null;

  const closeAll = () => { setStatusOpen(false); setPlatformOpen(false); setAssigneeOpen(false); };

  const handleDeleteClick = () => {
    if (sel.size > 5) {
      setConfirmingDelete(true);
    } else {
      bulkDel();
    }
  };

  const handleConfirm = () => {
    setConfirmingDelete(false);
    bulkDel();
  };

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
      {confirmingDelete ? (
        <div className="bulk-confirm-inline" role="alert">
          <span className="bulk-confirm-text">Delete {sel.size} posts?</span>
          <button className="btn btn-danger bulk-action-btn" onClick={handleConfirm}>
            Confirm
          </button>
          <button className="btn btn-ghost bulk-action-btn" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-danger bulk-action-btn" onClick={handleDeleteClick}>
          Delete
        </button>
      )}
    </div>
  );
}
