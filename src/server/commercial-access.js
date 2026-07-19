// THE authoritative, server-owned commercial-access contract for Relay.
//
// One pure, deterministic resolver turns a normalized subscription row plus an
// explicit `now` into a structured result that drives every commercial
// decision — feature entitlement, connection/seat limits, protected-action
// policy, and client presentation. No caller reinterprets raw Stripe fields;
// they consume this result.
//
// Precedence (highest first):
//   1. Complimentary access (env COMP_TEAM_USER_IDS)  — overrides all Stripe state
//   2. Malformed / unrecognized billing data          — fail safe to Free, flagged
//   3. Active paid / trial / past-due grace           — the plan's entitlements
//   4. Everything else (expired, canceled, none)      — Free tier
//
// Stripe owns lifecycle FACTS (status, trial_end, current_period_end,
// cancel_at_period_end). Relay owns POLICY (grace duration and boundary,
// paid-through boundary, precedence, fallback). We never grant indefinite
// access from a `past_due` status, and never derive a deadline from webhook
// arrival time — only from durable Stripe timestamps.

// ─── Plan tiers (canonical definition; entitlements.js re-exports) ───
//
//   free        — view + manual draft, no AI, 1 connection.
//   essentials  — sold as "Solo", $24/mo: unlimited posts, AI captions +
//                 variants, 3 connections, 1 user.
//   team        — sold as "Studio", $59/mo flat: AI strategy, approvals +
//                 client links, all connections, 3 users.
export const PLANS = {
  free: {
    id: "free",
    label: "Free",
    priceMonthly: 0,
    features: {
      aiCaptions: false,
      aiVariants: false,
      aiStrategy: false,
      learnFromUrl: false,
    },
    limits: {
      scheduledPosts: 5,
      connections: 1,
      seats: 1,
    },
  },
  essentials: {
    id: "essentials",
    label: "Solo",
    priceMonthly: 24,
    features: {
      aiCaptions: true,
      aiVariants: true,
      aiStrategy: false,
      learnFromUrl: true,
    },
    limits: {
      scheduledPosts: Infinity,
      connections: 3,
      seats: 1,
    },
  },
  team: {
    id: "team",
    label: "Studio",
    priceMonthly: 59,
    perSeat: false,
    features: {
      aiCaptions: true,
      aiVariants: true,
      aiStrategy: true,
      learnFromUrl: true,
    },
    limits: {
      scheduledPosts: Infinity,
      connections: Infinity,
      seats: 3,
    },
  },
};

export const PLAN_ORDER = ["free", "essentials", "team"];

// Trial length offered at checkout, and the Relay-owned grace window that a
// `past_due` subscription keeps access for after its paid period lapses.
export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
export const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

// Stripe subscription statuses we recognize. Anything else is treated as
// malformed data rather than silently mapped to an access grant.
const KNOWN_STATUSES = new Set([
  "none",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

// Sentinel a caller passes when the billing row could NOT be loaded (Supabase
// / network error). Distinguishes "temporarily unavailable" from "no row".
export const BILLING_UNAVAILABLE = "__billing_unavailable__";

// Parse a timestamp input to epoch ms. Returns null for absent, NaN for a
// present-but-unparseable value (→ treated as malformed).
function toMs(value) {
  if (value === null || value === undefined || value === "") return null;
  const t = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(t) ? t : NaN;
}

function isoOrNull(value) {
  const ms = toMs(value);
  if (ms === null || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

// Build the structured result. Features/limits always come from the EFFECTIVE
// plan (free when access has lapsed), so downstream callers never need to
// re-derive them.
function result({
  planId,
  accessLevel,
  state,
  reason,
  userAction = "none",
  dataQuality = "ok",
  trialEnd = null,
  graceEnd = null,
  paidThroughEnd = null,
  complimentary = false,
  cancelAtPeriodEnd = false,
}) {
  const plan = PLANS[planId] || PLANS.free;
  return {
    state, // canonical machine state (see matrix in docs/commercial-access.md)
    planId: plan.id,
    planLabel: plan.label,
    accessLevel, // "paid" | "trial" | "grace" | "complimentary" | "free"
    paidAccess: accessLevel !== "free", // any capability beyond the Free tier
    reason, // stable code for actionable denial / OK
    features: { ...plan.features },
    limits: { ...plan.limits },
    trialEnd,
    graceEnd,
    paidThroughEnd,
    complimentary,
    cancelAtPeriodEnd,
    userAction, // "none" | "upgrade" | "update_payment" | "resubscribe" | "retry"
    dataQuality, // "ok" | "malformed" | "incomplete" | "unavailable"
    accountManagement: true, // billing/portal/upgrade always reachable
  };
}

// The one authoritative decision. `subscription` is the raw store row, null
// (no row), or the BILLING_UNAVAILABLE sentinel. `now` is injectable for
// deterministic boundary tests.
export function resolveCommercialAccess(subscription, { now = Date.now() } = {}) {
  // Provider/store unavailable → fail closed to Free for grants, but flag so
  // the UI can say "temporarily unavailable / retry" rather than "you're free".
  if (subscription === BILLING_UNAVAILABLE) {
    return result({
      planId: "free",
      accessLevel: "free",
      state: "unavailable",
      reason: "BILLING_UNAVAILABLE",
      userAction: "retry",
      dataQuality: "unavailable",
    });
  }

  if (!subscription || typeof subscription !== "object") {
    return result({ planId: "free", accessLevel: "free", state: "none", reason: "NO_SUBSCRIPTION" });
  }

  // 1. Complimentary overrides all Stripe state.
  if (subscription.comp === true) {
    const planId = PLANS[subscription.plan] ? subscription.plan : "team";
    return result({
      planId,
      accessLevel: "complimentary",
      state: "complimentary",
      reason: "OK",
      complimentary: true,
    });
  }

  const rawPlan = subscription.plan;
  const status = subscription.status;
  const planKnown = rawPlan === null || rawPlan === undefined
    || Object.prototype.hasOwnProperty.call(PLANS, rawPlan);
  const statusKnown = status === null || status === undefined || KNOWN_STATUSES.has(status);

  const trialMs = toMs(subscription.trial_end);
  const periodMs = toMs(subscription.current_period_end);
  const badDate = Number.isNaN(trialMs) || Number.isNaN(periodMs);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

  // 2. Malformed data we can't trust for a grant → Free, flagged.
  if (!planKnown || !statusKnown || badDate) {
    return result({
      planId: "free",
      accessLevel: "free",
      state: "malformed",
      reason: "BILLING_DATA_MALFORMED",
      userAction: "retry",
      dataQuality: "malformed",
    });
  }

  const planId = rawPlan && PLANS[rawPlan] ? rawPlan : "free";
  const trialEnd = isoOrNull(subscription.trial_end);
  const paidThroughEnd = isoOrNull(subscription.current_period_end);

  // Non-granting statuses are decided by status alone — the deleted webhook
  // resets plan to "free", so we must still recognize "canceled" et al. even
  // when the plan column no longer names a paid tier.
  switch (status) {
    case "canceled":
      return result({
        planId: "free",
        accessLevel: "free",
        state: "canceled",
        reason: "SUBSCRIPTION_CANCELED",
        userAction: "resubscribe",
        paidThroughEnd,
      });
    case "paused":
      return result({
        planId: "free",
        accessLevel: "free",
        state: "paused",
        reason: "SUBSCRIPTION_PAUSED",
        userAction: "update_payment",
      });
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return result({
        planId: "free",
        accessLevel: "free",
        state: "expired",
        reason: "NO_SUBSCRIPTION",
        userAction: "upgrade",
      });
    default:
      break;
  }

  // Granting-candidate statuses require an actual paid plan tier.
  if (!rawPlan || planId === "free") {
    return result({ planId: "free", accessLevel: "free", state: "none", reason: "NO_SUBSCRIPTION" });
  }

  switch (status) {
    case "trialing": {
      // Boundary is exclusive of access: at exactly trial_end the trial is over.
      // A legacy trialing row with no trial_end stays an open trial (grant).
      if (trialMs !== null && now >= trialMs) {
        return result({
          planId: "free",
          accessLevel: "free",
          state: "trial_expired",
          reason: "TRIAL_EXPIRED",
          userAction: "upgrade",
          trialEnd,
        });
      }
      return result({
        planId,
        accessLevel: "trial",
        state: "trialing",
        reason: "OK",
        userAction: "none",
        trialEnd,
      });
    }

    case "active": {
      // cancel-at-period-end: paid-through is authoritative, NOT the eventual
      // subscription.deleted webhook. Past the boundary → Free immediately.
      if (cancelAtPeriodEnd && periodMs !== null && now >= periodMs) {
        return result({
          planId: "free",
          accessLevel: "free",
          state: "canceled_expired",
          reason: "SUBSCRIPTION_CANCELED",
          userAction: "resubscribe",
          paidThroughEnd,
          cancelAtPeriodEnd: true,
        });
      }
      return result({
        planId,
        accessLevel: "paid",
        state: cancelAtPeriodEnd ? "active_canceling" : "active",
        reason: "OK",
        userAction: cancelAtPeriodEnd ? "resubscribe" : "none",
        paidThroughEnd,
        cancelAtPeriodEnd,
      });
    }

    case "past_due": {
      // Relay-owned grace anchored to the durable paid-through timestamp.
      // No period end recorded → no grace (conservative; never indefinite).
      if (periodMs === null) {
        return result({
          planId: "free",
          accessLevel: "free",
          state: "past_due_expired",
          reason: "PAYMENT_PAST_DUE_EXPIRED",
          userAction: "update_payment",
          dataQuality: "incomplete",
        });
      }
      const graceMs = periodMs + GRACE_MS;
      const graceEnd = new Date(graceMs).toISOString();
      if (now < graceMs) {
        return result({
          planId,
          accessLevel: "grace",
          state: "past_due_grace",
          reason: "OK",
          userAction: "update_payment",
          paidThroughEnd,
          graceEnd,
        });
      }
      return result({
        planId: "free",
        accessLevel: "free",
        state: "past_due_expired",
        reason: "PAYMENT_PAST_DUE_EXPIRED",
        userAction: "update_payment",
        paidThroughEnd,
        graceEnd,
      });
    }

    // status "none" / anything else with a paid plan claimed but not active.
    default:
      return result({ planId: "free", accessLevel: "free", state: "none", reason: "NO_SUBSCRIPTION" });
  }
}

// ─── Backward-compatible entitlement helpers ────────────────────────
// Kept identical in signature to the pre-mission entitlements API so existing
// callers (captions gate, billing read) don't change shape. All delegate to
// the one resolver.

export function resolvePlan(subscription, opts) {
  return PLANS[resolveCommercialAccess(subscription, opts).planId];
}

export function can(subscription, feature, opts) {
  return Boolean(resolveCommercialAccess(subscription, opts).features[feature]);
}

export function limit(subscription, key, opts) {
  return resolveCommercialAccess(subscription, opts).limits[key];
}

// Lowest plan that grants the named feature — used by upgrade prompts.
export function minPlanForFeature(feature) {
  for (const id of PLAN_ORDER) {
    if (PLANS[id].features[feature]) return PLANS[id];
  }
  return null;
}

// ─── Client projection ──────────────────────────────────────────────
// Mechanical serialization of the authoritative result for the browser. The
// client presents these fields; it does not recompute policy from raw Stripe
// state. Infinity limits become null (JSON-safe). A fully-composed human
// `statusLine` lives here so wording can't drift between server and client.

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function statusLineFor(access) {
  switch (access.state) {
    case "complimentary":
      return "Complimentary · full Studio access";
    case "trialing":
      return access.trialEnd ? `Trial · ends ${fmtDate(access.trialEnd)}` : "Trial · active";
    case "active":
      return access.paidThroughEnd ? `Active · renews ${fmtDate(access.paidThroughEnd)}` : "Active";
    case "active_canceling":
      return access.paidThroughEnd ? `Active · cancels ${fmtDate(access.paidThroughEnd)}` : "Active · cancels at period end";
    case "past_due_grace":
      return access.graceEnd
        ? `Past due · access ends ${fmtDate(access.graceEnd)} — update payment`
        : "Past due · update payment to keep access";
    case "past_due_expired":
      return "Past due · access ended — update payment";
    case "trial_expired":
      return "Trial ended · upgrade to continue";
    case "canceled":
    case "canceled_expired":
      return "Canceled · now on Free";
    case "paused":
      return "Paused · update billing to resume";
    case "expired":
      return "Inactive · on Free";
    case "malformed":
    case "unavailable":
      return "Billing status unavailable — please retry";
    case "none":
    default:
      return "Free tier";
  }
}

function jsonLimits(limits) {
  const out = {};
  for (const [k, v] of Object.entries(limits)) out[k] = v === Infinity ? null : v;
  return out;
}

export function serializeCommercialAccess(access, extra = {}) {
  const { plans = null, trialDays = TRIAL_DAYS, trialEligible = false, hasCustomer = false, rawStatus = null } = extra;
  return {
    plan: access.planId,
    planLabel: access.planLabel,
    state: access.state,
    accessLevel: access.accessLevel,
    paidAccess: access.paidAccess,
    reason: access.reason,
    dataQuality: access.dataQuality,
    statusLine: statusLineFor(access),
    complimentary: access.complimentary,
    cancelAtPeriodEnd: access.cancelAtPeriodEnd,
    trialEnd: access.trialEnd,
    graceEnd: access.graceEnd,
    paidThroughEnd: access.paidThroughEnd,
    currentPeriodEnd: access.paidThroughEnd, // compat alias for existing client
    limits: jsonLimits(access.limits),
    features: access.features,
    canManageBilling: hasCustomer || access.accessLevel !== "free",
    trialEligible: Boolean(trialEligible),
    userAction: access.userAction,
    status: rawStatus, // raw Stripe status, for support/debugging only
    ...(plans ? { plans } : {}),
    trialDays,
  };
}
