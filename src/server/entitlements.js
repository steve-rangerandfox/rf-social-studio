// Plan tier definitions + entitlement helpers.
//
// Three tiers, flat pricing — see /pricing for the public copy.
//   free        — view + manual draft, no AI, 1 connection.
//   essentials  — $5/mo, AI captions + variants, 3 connections, 1 user.
//   team        — $10/mo per user, AI strategy + variants, all connections,
//                 3 users.
//
// Status drives access alongside plan: 'trialing' and 'active' grant
// the plan's entitlements; 'past_due' enters a grace window;
// 'canceled' / 'none' fall back to free.

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
    label: "Essentials",
    priceMonthly: 5,
    features: {
      aiCaptions: true,
      aiVariants: true,
      aiStrategy: false,
      learnFromUrl: true,
    },
    limits: {
      scheduledPosts: 100,
      connections: 3,
      seats: 1,
    },
  },
  team: {
    id: "team",
    label: "Team",
    priceMonthly: 10,
    perSeat: true,
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
export const TRIAL_DAYS = 14;

// A subscription with one of these statuses grants its plan's
// entitlements. Anything else falls back to the free tier.
const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

// Resolves the effective plan for a subscription row. Encapsulates the
// 'past_due' grace window and trial expiry — callers should not check
// status directly.
export function resolvePlan(subscription) {
  if (!subscription || !subscription.plan) return PLANS.free;
  if (!ACTIVE_STATUSES.has(subscription.status)) return PLANS.free;
  if (subscription.status === "trialing" && subscription.trial_end) {
    if (new Date(subscription.trial_end).getTime() < Date.now()) return PLANS.free;
  }
  return PLANS[subscription.plan] || PLANS.free;
}

// True if the given subscription can use the named feature.
export function can(subscription, feature) {
  const plan = resolvePlan(subscription);
  return Boolean(plan.features[feature]);
}

// Returns the named limit (number or Infinity) for the subscription.
export function limit(subscription, key) {
  const plan = resolvePlan(subscription);
  return plan.limits[key];
}

// Suggests the lowest plan that grants the named feature — used by
// upgrade prompts to point the user at the right tier.
export function minPlanForFeature(feature) {
  for (const id of PLAN_ORDER) {
    if (PLANS[id].features[feature]) return PLANS[id];
  }
  return null;
}
