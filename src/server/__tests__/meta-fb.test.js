import { describe, it, expect } from "vitest";
import { buildFacebookAuthorizeUrl, FB_OAUTH_SCOPES, pickInstagramBusinessAccount } from "../meta-fb.js";

// Facebook-Login path to Instagram publishing (Graph API). The app is
// configured with "Facebook Login for Business" + the "Manage messaging
// & content on Instagram" use case, so OAuth runs through facebook.com
// and publishing goes through the Page-linked IG business account.

describe("buildFacebookAuthorizeUrl", () => {
  it("targets the facebook.com OAuth dialog with our params", () => {
    const url = new URL(buildFacebookAuthorizeUrl({ appId: "123", redirectUri: "https://x/cb", state: "s1" }));
    expect(url.host).toBe("www.facebook.com");
    expect(url.pathname).toMatch(/\/dialog\/oauth$/);
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x/cb");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(FB_OAUTH_SCOPES);
  });

  it("requests the scopes IG content publishing needs", () => {
    for (const s of ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"]) {
      expect(FB_OAUTH_SCOPES).toContain(s);
    }
  });
});

describe("pickInstagramBusinessAccount", () => {
  const page = (over) => ({ id: "p1", name: "My Page", access_token: "pgtok", instagram_business_account: { id: "ig1", username: "acme", profile_picture_url: "u" }, ...over });

  it("returns the first page that has a linked IG business account", () => {
    const r = pickInstagramBusinessAccount({ data: [
      { id: "p0", name: "No IG", access_token: "t0" },
      page(),
    ] });
    expect(r).toEqual({ pageId: "p1", pageName: "My Page", pageAccessToken: "pgtok", igUserId: "ig1", igUsername: "acme", igProfilePictureUrl: "u" });
  });

  it("returns null when no page has an IG business account", () => {
    expect(pickInstagramBusinessAccount({ data: [{ id: "p0", access_token: "t0" }] })).toBeNull();
  });

  it("returns null for an empty or malformed response", () => {
    expect(pickInstagramBusinessAccount({})).toBeNull();
    expect(pickInstagramBusinessAccount(null)).toBeNull();
    expect(pickInstagramBusinessAccount({ data: [] })).toBeNull();
  });

  it("tolerates a missing profile picture", () => {
    const r = pickInstagramBusinessAccount({ data: [page({ instagram_business_account: { id: "ig2", username: "b" } })] });
    expect(r.igUserId).toBe("ig2");
    expect(r.igProfilePictureUrl).toBeUndefined();
  });
});
