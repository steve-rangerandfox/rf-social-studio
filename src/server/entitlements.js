// Plan tier definitions + entitlement helpers.
//
// The single source of truth for commercial access is now
// src/server/commercial-access.js — a pure, clock-injectable resolver that
// turns a subscription row into a structured access result. This module
// re-exports the plan catalogue and the backward-compatible entitlement
// helpers (resolvePlan / can / limit / minPlanForFeature) so existing callers
// keep working, while all policy lives in one place.
//
// Status → access mapping (owned by commercial-access.js):
//   trialing            → plan entitlements until trial_end
//   active              → plan entitlements (respects cancel-at-period-end paid-through)
//   past_due            → plan entitlements during a Relay-owned grace window
//                         (current_period_end + GRACE_DAYS), then Free
//   canceled/unpaid/... → Free tier
//   complimentary       → Studio (team), overrides all Stripe state

export {
  PLANS,
  PLAN_ORDER,
  TRIAL_DAYS,
  GRACE_DAYS,
  GRACE_MS,
  resolvePlan,
  can,
  limit,
  minPlanForFeature,
  resolveCommercialAccess,
  serializeCommercialAccess,
  BILLING_UNAVAILABLE,
} from "./commercial-access.js";
