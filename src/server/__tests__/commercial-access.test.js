import { describe, it, expect } from "vitest";
import {
  resolveCommercialAccess,
  serializeCommercialAccess,
  can,
  limit,
  resolvePlan,
  BILLING_UNAVAILABLE,
  GRACE_MS,
  PLANS,
} from "../commercial-access.js";

// Deterministic clock anchors. `now` is injected everywhere — no real time.
const at = (iso) => Date.parse(iso);
const NOW = at("2026-01-15T00:00:00Z");
const PERIOD_END = "2026-02-01T00:00:00Z";
const GRACE_END_MS = at(PERIOD_END) + GRACE_MS; // paid-through + 7 days
const TRIAL_END = "2026-01-20T00:00:00Z";

const sub = (over = {}) => ({
  plan: "team",
  status: "active",
  current_period_end: PERIOD_END,
  cancel_at_period_end: false,
  ...over,
});

// ─── State matrix ───────────────────────────────────────────────────
describe("commercial-access · state matrix", () => {
  it("no subscription → Free / none", () => {
    const a = resolveCommercialAccess(null, { now: NOW });
    expect(a.planId).toBe("free");
    expect(a.accessLevel).toBe("free");
    expect(a.state).toBe("none");
    expect(a.reason).toBe("NO_SUBSCRIPTION");
    expect(a.paidAccess).toBe(false);
  });

  it("active trial → full plan entitlements", () => {
    const a = resolveCommercialAccess(sub({ status: "trialing", trial_end: TRIAL_END }), { now: NOW });
    expect(a.state).toBe("trialing");
    expect(a.accessLevel).toBe("trial");
    expect(a.planId).toBe("team");
    expect(a.features.aiStrategy).toBe(true);
  });

  it("expired trial → Free, upgrade action", () => {
    const a = resolveCommercialAccess(sub({ status: "trialing", trial_end: TRIAL_END }), { now: at("2026-02-01T00:00:00Z") });
    expect(a.state).toBe("trial_expired");
    expect(a.planId).toBe("free");
    expect(a.reason).toBe("TRIAL_EXPIRED");
    expect(a.userAction).toBe("upgrade");
  });

  it("active paid → plan entitlements, renews", () => {
    const a = resolveCommercialAccess(sub(), { now: NOW });
    expect(a.state).toBe("active");
    expect(a.accessLevel).toBe("paid");
    expect(a.paidThroughEnd).toBe(new Date(PERIOD_END).toISOString());
  });

  it("past_due within grace → plan entitlements, update_payment", () => {
    const a = resolveCommercialAccess(sub({ status: "past_due" }), { now: at("2026-02-05T00:00:00Z") });
    expect(a.state).toBe("past_due_grace");
    expect(a.accessLevel).toBe("grace");
    expect(a.planId).toBe("team");
    expect(a.userAction).toBe("update_payment");
    expect(a.graceEnd).toBe(new Date(GRACE_END_MS).toISOString());
  });

  it("past_due after grace → Free (no indefinite access)", () => {
    const a = resolveCommercialAccess(sub({ status: "past_due" }), { now: at("2026-02-20T00:00:00Z") });
    expect(a.state).toBe("past_due_expired");
    expect(a.planId).toBe("free");
    expect(a.reason).toBe("PAYMENT_PAST_DUE_EXPIRED");
  });

  it("past_due with no current_period_end → Free (no fabricated grace)", () => {
    const a = resolveCommercialAccess(sub({ status: "past_due", current_period_end: null }), { now: NOW });
    expect(a.state).toBe("past_due_expired");
    expect(a.planId).toBe("free");
    expect(a.dataQuality).toBe("incomplete");
  });

  it("canceled with future paid-through → still paid until the boundary", () => {
    const a = resolveCommercialAccess(sub({ status: "active", cancel_at_period_end: true }), { now: NOW });
    expect(a.state).toBe("active_canceling");
    expect(a.accessLevel).toBe("paid");
    expect(a.cancelAtPeriodEnd).toBe(true);
  });

  it("canceled after paid-through expiry → Free even before the deleted webhook", () => {
    const a = resolveCommercialAccess(sub({ status: "active", cancel_at_period_end: true }), { now: at("2026-02-02T00:00:00Z") });
    expect(a.state).toBe("canceled_expired");
    expect(a.planId).toBe("free");
    expect(a.reason).toBe("SUBSCRIPTION_CANCELED");
  });

  it("status canceled → Free", () => {
    const a = resolveCommercialAccess(sub({ status: "canceled", plan: "free" }), { now: NOW });
    expect(a.state).toBe("canceled");
    expect(a.planId).toBe("free");
  });

  it("complimentary → Studio, overrides Stripe state", () => {
    const a = resolveCommercialAccess({ plan: "team", status: "canceled", comp: true }, { now: NOW });
    expect(a.state).toBe("complimentary");
    expect(a.accessLevel).toBe("complimentary");
    expect(a.planId).toBe("team");
    expect(a.complimentary).toBe(true);
  });

  it("malformed billing state → Free, flagged", () => {
    const a = resolveCommercialAccess({ plan: "enterprise", status: "active" }, { now: NOW });
    expect(a.state).toBe("malformed");
    expect(a.dataQuality).toBe("malformed");
    expect(a.planId).toBe("free");
  });

  it("unparseable date → malformed", () => {
    const a = resolveCommercialAccess(sub({ current_period_end: "not-a-date" }), { now: NOW });
    expect(a.state).toBe("malformed");
    expect(a.dataQuality).toBe("malformed");
  });

  it("unrecognized status → malformed", () => {
    const a = resolveCommercialAccess(sub({ status: "frozen" }), { now: NOW });
    expect(a.state).toBe("malformed");
  });

  it("unavailable billing → Free (fail closed), flagged for retry", () => {
    const a = resolveCommercialAccess(BILLING_UNAVAILABLE, { now: NOW });
    expect(a.state).toBe("unavailable");
    expect(a.planId).toBe("free");
    expect(a.dataQuality).toBe("unavailable");
    expect(a.userAction).toBe("retry");
  });

  it("incomplete/unpaid statuses → Free", () => {
    for (const status of ["unpaid", "incomplete", "incomplete_expired", "none"]) {
      const a = resolveCommercialAccess(sub({ status }), { now: NOW });
      expect(a.planId, status).toBe("free");
      expect(a.paidAccess, status).toBe(false);
    }
  });
});

// ─── Boundary semantics (before / exactly at / after) ───────────────
describe("commercial-access · boundaries", () => {
  it("trial boundary is exclusive of access at exactly trial_end", () => {
    const s = sub({ status: "trialing", trial_end: TRIAL_END });
    expect(resolveCommercialAccess(s, { now: at(TRIAL_END) - 1 }).accessLevel).toBe("trial");
    expect(resolveCommercialAccess(s, { now: at(TRIAL_END) }).accessLevel).toBe("free");
    expect(resolveCommercialAccess(s, { now: at(TRIAL_END) + 1 }).accessLevel).toBe("free");
  });

  it("grace boundary: access up to but not including period_end + GRACE_MS", () => {
    const s = sub({ status: "past_due" });
    expect(resolveCommercialAccess(s, { now: GRACE_END_MS - 1 }).accessLevel).toBe("grace");
    expect(resolveCommercialAccess(s, { now: GRACE_END_MS }).accessLevel).toBe("free");
  });

  it("paid-through boundary for cancel-at-period-end", () => {
    const s = sub({ status: "active", cancel_at_period_end: true });
    expect(resolveCommercialAccess(s, { now: at(PERIOD_END) - 1 }).accessLevel).toBe("paid");
    expect(resolveCommercialAccess(s, { now: at(PERIOD_END) }).accessLevel).toBe("free");
  });
});

// ─── Transitions (same row, advancing clock; or lifecycle changes) ──
describe("commercial-access · transitions", () => {
  it("trial active → expired as the clock advances", () => {
    const s = sub({ status: "trialing", trial_end: TRIAL_END });
    expect(resolveCommercialAccess(s, { now: NOW }).accessLevel).toBe("trial");
    expect(resolveCommercialAccess(s, { now: at("2026-02-01T00:00:00Z") }).accessLevel).toBe("free");
  });

  it("past_due within grace → after grace as the clock advances", () => {
    const s = sub({ status: "past_due" });
    expect(resolveCommercialAccess(s, { now: at("2026-02-03T00:00:00Z") }).state).toBe("past_due_grace");
    expect(resolveCommercialAccess(s, { now: at("2026-02-10T00:00:00Z") }).state).toBe("past_due_expired");
  });

  it("past_due → active after restored payment (status flips)", () => {
    expect(resolveCommercialAccess(sub({ status: "past_due" }), { now: at("2026-02-20T00:00:00Z") }).planId).toBe("free");
    // Stripe advances current_period_end and flips status back to active.
    const restored = sub({ status: "active", current_period_end: "2026-03-01T00:00:00Z" });
    expect(resolveCommercialAccess(restored, { now: at("2026-02-20T00:00:00Z") }).accessLevel).toBe("paid");
  });

  it("cancel-at-period-end → reactivated before expiry", () => {
    const canceling = sub({ status: "active", cancel_at_period_end: true });
    expect(resolveCommercialAccess(canceling, { now: NOW }).state).toBe("active_canceling");
    const reactivated = sub({ status: "active", cancel_at_period_end: false });
    expect(resolveCommercialAccess(reactivated, { now: NOW }).state).toBe("active");
  });

  it("complimentary precedence holds through a Stripe cancellation", () => {
    const s = { plan: "team", status: "canceled", cancel_at_period_end: true, comp: true };
    expect(resolveCommercialAccess(s, { now: at("2030-01-01T00:00:00Z") }).accessLevel).toBe("complimentary");
  });
});

// ─── Enforcement through the REAL production helpers ────────────────
describe("commercial-access · enforcement adapters (can/limit/resolvePlan)", () => {
  it("past_due grace grants the plan's gated feature; after grace denies it", () => {
    const s = sub({ status: "past_due", plan: "team" });
    expect(can(s, "aiStrategy", { now: at("2026-02-03T00:00:00Z") })).toBe(true);
    expect(can(s, "aiStrategy", { now: at("2026-02-20T00:00:00Z") })).toBe(false);
  });

  it("expired trial denies AI features (Free tier)", () => {
    const s = sub({ status: "trialing", plan: "essentials", trial_end: TRIAL_END });
    expect(can(s, "aiCaptions", { now: NOW })).toBe(true);
    expect(can(s, "aiCaptions", { now: at("2026-02-01T00:00:00Z") })).toBe(false);
  });

  it("connection/seat limits follow the effective plan", () => {
    expect(limit(null, "connections")).toBe(PLANS.free.limits.connections);
    expect(limit(sub({ plan: "team" }), "connections", { now: NOW })).toBe(Infinity);
    expect(limit(sub({ status: "past_due" }), "seats", { now: at("2026-02-20T00:00:00Z") })).toBe(PLANS.free.limits.seats);
  });

  it("resolvePlan returns the effective plan object", () => {
    expect(resolvePlan(sub({ plan: "essentials" }), { now: NOW }).id).toBe("essentials");
    expect(resolvePlan(sub({ status: "canceled", plan: "free" }), { now: NOW }).id).toBe("free");
  });
});

// ─── Client projection ──────────────────────────────────────────────
describe("commercial-access · client projection", () => {
  it("serializes limits JSON-safe (Infinity → null) and builds a status line", () => {
    const a = resolveCommercialAccess(sub({ plan: "team" }), { now: NOW });
    const out = serializeCommercialAccess(a, { trialEligible: false, hasCustomer: true });
    expect(out.limits.connections).toBeNull(); // Infinity → null
    expect(out.limits.seats).toBe(3);
    expect(out.statusLine).toMatch(/^Active · renews/);
    expect(out.canManageBilling).toBe(true);
    expect(out.trialEligible).toBe(false);
  });

  it("past-due grace projection points the user at payment", () => {
    const a = resolveCommercialAccess(sub({ status: "past_due" }), { now: at("2026-02-03T00:00:00Z") });
    const out = serializeCommercialAccess(a, {});
    expect(out.statusLine).toMatch(/update payment/);
    expect(out.userAction).toBe("update_payment");
  });

  it("unavailable projection tells the client to retry", () => {
    const out = serializeCommercialAccess(resolveCommercialAccess(BILLING_UNAVAILABLE, { now: NOW }), {});
    expect(out.statusLine).toMatch(/unavailable/i);
    expect(out.dataQuality).toBe("unavailable");
  });
});
