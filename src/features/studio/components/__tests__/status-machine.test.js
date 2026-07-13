import { describe, it, expect } from "vitest";
import { canTransition } from "../StatusMachine.js";

// Approval pipeline rules. Forward stays strict (one step, gated); going
// BACKWARD is allowed from any state except posted — pulling a scheduled
// post back is the only way to stop the auto-publisher without deleting.

const row = (over = {}) => ({ caption: "hello", scheduledAt: "2026-07-14T09:00:00.000Z", ...over });

describe("canTransition — backward", () => {
  it("allows stepping back one state", () => {
    expect(canTransition("scheduled", "approved", row()).allowed).toBe(true);
    expect(canTransition("needs_review", "draft", row()).allowed).toBe(true);
  });

  it("allows jumping back multiple states (unschedule straight to draft)", () => {
    expect(canTransition("scheduled", "draft", row()).allowed).toBe(true);
    expect(canTransition("approved", "idea", row()).allowed).toBe(true);
  });

  it("keeps posted terminal — no un-posting", () => {
    expect(canTransition("posted", "scheduled", row()).allowed).toBe(false);
    expect(canTransition("posted", "idea", row()).allowed).toBe(false);
  });
});

describe("canTransition — forward rules unchanged", () => {
  it("still blocks forward skips", () => {
    expect(canTransition("idea", "needs_review", row()).allowed).toBe(false);
  });

  it("still requires a caption for review", () => {
    expect(canTransition("draft", "needs_review", row({ caption: "" })).allowed).toBe(false);
  });

  it("still gates scheduling on date + connected account", () => {
    expect(canTransition("approved", "scheduled", row(), false).allowed).toBe(false);
    expect(canTransition("approved", "scheduled", row({ scheduledAt: null }), true).allowed).toBe(false);
    expect(canTransition("approved", "scheduled", row(), true).allowed).toBe(true);
  });

  it("posted stays system-only", () => {
    expect(canTransition("scheduled", "posted", row(), true).allowed).toBe(false);
  });
});
