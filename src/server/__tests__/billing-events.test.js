import { describe, it, expect } from "vitest";
import { decideStripeEvent, fieldsFromStripeSubscription } from "../handlers/billing.js";

// Webhook idempotency + ordering — the real decision function the handler uses.
describe("decideStripeEvent · idempotency + ordering", () => {
  it("applies when there is no existing row", () => {
    expect(decideStripeEvent({ existing: null, eventId: "evt_1", eventCreated: 100 }))
      .toEqual({ apply: true, reason: "ok" });
  });

  it("applies the first event on a row that has none recorded", () => {
    const existing = { last_stripe_event_id: null, last_stripe_event_created: null };
    expect(decideStripeEvent({ existing, eventId: "evt_1", eventCreated: 100 }).apply).toBe(true);
  });

  it("skips a duplicate of the last applied event id", () => {
    const existing = { last_stripe_event_id: "evt_1", last_stripe_event_created: 100 };
    expect(decideStripeEvent({ existing, eventId: "evt_1", eventCreated: 100 }))
      .toEqual({ apply: false, reason: "duplicate" });
  });

  it("skips an event created before the last applied (out of order)", () => {
    const existing = { last_stripe_event_id: "evt_2", last_stripe_event_created: 200 };
    expect(decideStripeEvent({ existing, eventId: "evt_1", eventCreated: 100 }))
      .toEqual({ apply: false, reason: "out_of_order" });
  });

  it("applies a newer event", () => {
    const existing = { last_stripe_event_id: "evt_1", last_stripe_event_created: 100 };
    expect(decideStripeEvent({ existing, eventId: "evt_2", eventCreated: 200 }).apply).toBe(true);
  });

  it("applies same-second events with different ids (no false ordering skip)", () => {
    const existing = { last_stripe_event_id: "evt_1", last_stripe_event_created: 100 };
    expect(decideStripeEvent({ existing, eventId: "evt_2", eventCreated: 100 }).apply).toBe(true);
  });

  it("tolerates last_stripe_event_created stored as a string (bigint column)", () => {
    const existing = { last_stripe_event_id: "evt_2", last_stripe_event_created: "200" };
    expect(decideStripeEvent({ existing, eventId: "evt_1", eventCreated: 100 }).reason).toBe("out_of_order");
  });
});

// Stripe subscription → persisted columns.
describe("fieldsFromStripeSubscription · mapping", () => {
  const env = { stripePriceEssentials: "price_ess", stripePriceTeam: "price_team" };

  it("maps price id to plan and converts unix timestamps to ISO", () => {
    const sub = {
      id: "sub_1",
      status: "active",
      items: { data: [{ price: { id: "price_team" } }] },
      trial_end: 1738368000, // 2025-02-01T00:00:00Z
      current_period_end: 1740787200, // 2025-03-01T00:00:00Z
      cancel_at_period_end: true,
    };
    const f = fieldsFromStripeSubscription(env, sub);
    expect(f.plan).toBe("team");
    expect(f.status).toBe("active");
    expect(f.stripe_subscription_id).toBe("sub_1");
    expect(f.stripe_price_id).toBe("price_team");
    expect(f.trial_end).toBe("2025-02-01T00:00:00.000Z");
    expect(f.current_period_end).toBe("2025-03-01T00:00:00.000Z");
    expect(f.cancel_at_period_end).toBe(true);
  });

  it("unknown price → free plan; missing timestamps → null", () => {
    const f = fieldsFromStripeSubscription(env, { id: "sub_2", status: "past_due", items: { data: [{ price: { id: "price_x" } }] } });
    expect(f.plan).toBe("free");
    expect(f.trial_end).toBeNull();
    expect(f.current_period_end).toBeNull();
    expect(f.cancel_at_period_end).toBe(false);
  });
});
