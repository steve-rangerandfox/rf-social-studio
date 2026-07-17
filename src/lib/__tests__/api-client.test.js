import { describe, it, expect, vi, afterEach } from "vitest";
import { setApiUserId, saveStudioDocument } from "../api-client.js";

// Authentication safety: the account context is captured ONCE at requestJson
// invocation, so a mid-flight account switch (including one that happens while
// the token is still being acquired) can never change the identity a request —
// or any of its retries — is sent under.

describe("api-client identity capture", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("uses the identity captured at invocation even if the account switches during token acquisition", async () => {
    let resolveToken;
    const tokenPromise = new Promise((r) => { resolveToken = r; });
    setApiUserId("user_a", () => tokenPromise);

    const seenHeaders = [];
    const fetchMock = vi.fn(async (_url, opts) => {
      seenHeaders.push(opts.headers);
      return { ok: true, json: async () => ({ ok: true, version: 1 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = saveStudioDocument({ schemaVersion: 3, rows: [] }, 1);

    // Switch accounts while the token for the in-flight request is still pending.
    setApiUserId("user_b", () => Promise.resolve("token_b"));
    resolveToken("token_a");
    await pending;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seenHeaders[0]["X-RF-User-Id"]).toBe("user_a"); // captured identity, not user_b
    expect(seenHeaders[0].Authorization).toBe("Bearer token_a");
  });

  it("every retry of a request reuses the captured account context", async () => {
    setApiUserId("user_a", () => Promise.resolve("token_a"));
    const seenHeaders = [];
    let attempt = 0;
    const fetchMock = vi.fn(async (_url, opts) => {
      seenHeaders.push(opts.headers);
      attempt += 1;
      if (attempt === 1) return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({ error: "retry" }) };
      return { ok: true, json: async () => ({ ok: true, version: 2 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = saveStudioDocument({ schemaVersion: 3, rows: [] }, 1);
    // Switch mid-flight; the retry must still use user_a.
    setApiUserId("user_b", () => Promise.resolve("token_b"));
    await pending;

    expect(seenHeaders.length).toBeGreaterThanOrEqual(2);
    expect(seenHeaders.every((hdr) => hdr["X-RF-User-Id"] === "user_a")).toBe(true);
  });

  it("(#6) invokes the token provider ONCE and reuses its result across retries", async () => {
    let calls = 0;
    // A provider whose returned token would change after a switch.
    setApiUserId("user_a", () => { calls += 1; return Promise.resolve(calls === 1 ? "token_a" : "token_LATER"); });
    const seen = [];
    let attempt = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url, opts) => {
      seen.push(opts.headers.Authorization);
      attempt += 1;
      if (attempt === 1) return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({ error: "retry" }) };
      return { ok: true, json: async () => ({ ok: true }) };
    }));

    const pending = saveStudioDocument({ schemaVersion: 3, rows: [] }, 1);
    setApiUserId("user_b", () => Promise.resolve("token_b")); // switch mid-flight
    await pending;

    expect(calls).toBe(1); // provider invoked exactly once
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.every((a) => a === "Bearer token_a")).toBe(true); // same token every attempt
  });
});
