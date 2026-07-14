import { describe, it, expect } from "vitest";
import { compSubscription } from "../subscription-store.js";
import { can, limit } from "../entitlements.js";

// Owner/staff comp: COMP_TEAM_USER_IDS grants a synthetic active Studio
// subscription so the owner isn't gated behind Stripe on their own app.

const env = { compTeamUserIds: new Set(["user_OWNER", "user_STAFF"]) };

describe("compSubscription", () => {
  it("returns an active team subscription for a comped user", () => {
    const sub = compSubscription(env, "user_OWNER");
    expect(sub).toMatchObject({ plan: "team", status: "active", comp: true });
  });

  it("is case-sensitive and returns null for non-comped users", () => {
    expect(compSubscription(env, "user_owner")).toBeNull(); // wrong case
    expect(compSubscription(env, "user_RANDOM")).toBeNull();
    expect(compSubscription(env, "")).toBeNull();
    expect(compSubscription({}, "user_OWNER")).toBeNull(); // no list configured
  });

  it("the comped subscription unlocks the Studio-tier features", () => {
    const sub = compSubscription(env, "user_STAFF");
    expect(can(sub, "aiCaptions")).toBe(true);
    expect(can(sub, "aiStrategy")).toBe(true); // team-only feature
    expect(limit(sub, "connections")).toBe(Infinity);
  });
});
