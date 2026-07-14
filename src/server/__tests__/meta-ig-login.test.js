import { describe, it, expect } from "vitest";
import { buildInstagramAuthorizeUrl, IG_OAUTH_SCOPES } from "../meta.js";

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
