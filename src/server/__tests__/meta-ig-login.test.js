import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../http.js", () => ({ fetchWithTimeout: vi.fn() }));
import { fetchWithTimeout } from "../http.js";
import { buildInstagramAuthorizeUrl, IG_OAUTH_SCOPES, exchangeCodeForInstagramToken } from "../meta.js";

// Business Login for Instagram — the Instagram-branded consent screen
// (Buffer-style). client_id must be the INSTAGRAM App ID from the Instagram
// product config; the Meta/Facebook app id fails with "Invalid platform app".

describe("buildInstagramAuthorizeUrl", () => {
  it("targets the instagram.com OAuth dialog with our params", () => {
    const url = new URL(buildInstagramAuthorizeUrl({ appId: "ig123", redirectUri: "https://x/cb", state: "s1" }));
    expect(url.host).toBe("www.instagram.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("ig123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x/cb");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(IG_OAUTH_SCOPES);
  });

  it("requests the business-login scopes publishing needs, and nothing Facebook-flavored", () => {
    for (const s of ["instagram_business_basic", "instagram_business_content_publish"]) {
      expect(IG_OAUTH_SCOPES).toContain(s);
    }
    expect(IG_OAUTH_SCOPES).not.toContain("pages_");
    expect(IG_OAUTH_SCOPES).not.toContain("business_management");
  });
});

describe("exchangeCodeForInstagramToken", () => {
  beforeEach(() => fetchWithTimeout.mockReset());

  it("calls the long-lived token endpoint version-LESS (a /v21.0/ prefix breaks it)", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "short", user_id: 42 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "long", expires_in: 5184000 }) });

    await exchangeCodeForInstagramToken({ appId: "1", appSecret: "s", code: "c", redirectUri: "https://x/cb" });

    // Step 1: short-lived POST to api.instagram.com.
    expect(fetchWithTimeout.mock.calls[0][0]).toBe("https://api.instagram.com/oauth/access_token");
    // Step 2: long-lived GET to graph.instagram.com WITHOUT a version segment.
    const longUrl = fetchWithTimeout.mock.calls[1][0];
    expect(longUrl).toContain("https://graph.instagram.com/access_token");
    expect(longUrl).not.toContain("/v21.0/access_token");
  });

  it("falls back to POST when the live API refuses GET on the long-token endpoint", async () => {
    fetchWithTimeout
      // Step 1 short-lived
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "short", user_id: 42 }) })
      // Step 2 GET — refused with the observed "method type: get" error
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Unsupported request - method type: get" } }) })
      // Step 2 retry as POST — succeeds
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "long", expires_in: 5184000 }) });

    const out = await exchangeCodeForInstagramToken({ appId: "1", appSecret: "s", code: "c", redirectUri: "https://x/cb" });
    expect(out.accessToken).toBe("long");

    // The GET was tried, then the same endpoint retried as POST with a body.
    expect(fetchWithTimeout.mock.calls[1][1]).toBeUndefined();
    expect(fetchWithTimeout.mock.calls[2][0]).toBe("https://graph.instagram.com/access_token");
    expect(fetchWithTimeout.mock.calls[2][1].method).toBe("POST");
  });
});
