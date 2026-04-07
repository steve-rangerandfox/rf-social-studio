// StatusMachine — proper status transition system for RF Social Studio
// Replaces the single-click cycle with validated, forward-only transitions.

export const STATUS_ORDER = ['idea', 'draft', 'needs_review', 'approved', 'scheduled', 'posted'];

/**
 * Returns { allowed: boolean, reason: string } for whether a transition is valid.
 *
 * Rules:
 *   idea -> draft            : always allowed
 *   draft -> needs_review    : requires caption (caption.length > 0)
 *   needs_review -> approved : requires explicit approval action
 *   approved -> scheduled    : requires scheduledAt AND a connected account
 *   scheduled -> posted      : system-only (never user-clickable)
 *   No backward transitions. No cycling past posted.
 */
export function canTransition(fromStatus, toStatus, row, hasConnectedAccount = false) {
  const fromIdx = STATUS_ORDER.indexOf(fromStatus);
  const toIdx = STATUS_ORDER.indexOf(toStatus);

  // Unknown statuses
  if (fromIdx === -1 || toIdx === -1) {
    return { allowed: false, reason: "Unknown status" };
  }

  // No same-status transitions
  if (fromIdx === toIdx) {
    return { allowed: false, reason: "Already at this status" };
  }

  // No backward transitions
  if (toIdx < fromIdx) {
    return { allowed: false, reason: "Backward transitions are not allowed" };
  }

  // Cannot move past posted
  if (fromStatus === "posted") {
    return { allowed: false, reason: "Posted is a terminal status" };
  }

  // Cannot skip statuses (must move one step at a time)
  if (toIdx - fromIdx > 1) {
    return { allowed: false, reason: `Cannot skip from ${fromStatus} to ${toStatus}` };
  }

  // Per-transition validation
  switch (toStatus) {
    case "draft":
      // idea -> draft: always allowed
      return { allowed: true, reason: "Ready to draft" };

    case "needs_review":
      // draft -> needs_review: requires caption
      if (!row.caption || row.caption.length === 0) {
        return { allowed: false, reason: "Caption is required before requesting review" };
      }
      return { allowed: true, reason: "Ready for review" };

    case "approved":
      // needs_review -> approved: requires explicit approval (the action itself is the approval)
      return { allowed: true, reason: "Approve this post" };

    case "scheduled":
      // approved -> scheduled: requires scheduledAt + connected account
      if (!row.scheduledAt) {
        return { allowed: false, reason: "A scheduled date is required" };
      }
      if (!hasConnectedAccount) {
        return { allowed: false, reason: "A connected account is required to schedule" };
      }
      return { allowed: true, reason: "Ready to schedule" };

    case "posted":
      // scheduled -> posted: system-only
      return { allowed: false, reason: "Posts are marked as posted by the system only" };

    default:
      return { allowed: false, reason: "Unknown transition" };
  }
}

/**
 * Returns the next forward status in the pipeline, or null if at the end.
 * Does NOT validate whether the transition is actually allowed for a given row.
 * Use canTransition() for that.
 */
export function getNextStatus(currentStatus) {
  const idx = STATUS_ORDER.indexOf(currentStatus);
  if (idx === -1 || idx >= STATUS_ORDER.length - 1) return null;
  // Never return 'posted' — that's system-only
  const next = STATUS_ORDER[idx + 1];
  return next === "posted" ? null : next;
}

/**
 * Returns all statuses the row can validly transition TO from its current status.
 * Each entry: { status, label, allowed, reason }
 */
export function getAvailableTransitions(row, hasConnectedAccount = false) {
  const currentIdx = STATUS_ORDER.indexOf(row.status);
  if (currentIdx === -1) return [];

  const results = [];
  // Only check one step forward (we don't allow skipping)
  const nextStatus = getNextStatus(row.status);
  if (nextStatus) {
    const check = canTransition(row.status, nextStatus, row, hasConnectedAccount);
    results.push({
      status: nextStatus,
      label: statusLabel(nextStatus),
      allowed: check.allowed,
      reason: check.reason,
    });
  }

  return results;
}

// Helper: human-readable label for a status key
function statusLabel(status) {
  const labels = {
    idea: "Idea",
    draft: "Draft",
    needs_review: "In Review",
    approved: "Approved",
    scheduled: "Scheduled",
    posted: "Posted",
  };
  return labels[status] || status;
}
