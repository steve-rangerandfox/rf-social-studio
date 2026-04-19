// LinkedIn OAuth 2.0 + UGC Posts API wrapper. Mirror of meta.js for
// Instagram — lives in one module so app.js + the Inngest worker can
// share it.
//
// Scopes:
//   w_member_social — publish posts on behalf of the member
//   openid profile  — identifies the member (returns the URN we need
//                     as the "author" field when posting)
//
// Publishing uses the UGC Posts endpoint (v2/ugcPosts). Text-only posts
// are the initial support; image/video posts require a multi-step
// register-upload → upload → create-post flow and land in a follow-up.

import { fetchWithTimeout } from "./http.js";

export const LI_OAUTH_SCOPES = ["openid", "profile", "w_member_social"];

export function buildLinkedInAuthorizeUrl({ appId, redirectUri, state }) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: LI_OAUTH_SCOPES.join(" "),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export async function exchangeCodeForLinkedInToken({ appId, appSecret, code, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
  });

  const response = await fetchWithTimeout("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || `LinkedIn token exchange failed (HTTP ${response.status})`);
  }

  return {
    accessToken: payload.access_token,
    expiresIn: Number(payload.expires_in) || 60 * 24 * 60 * 60, // LI access tokens are 60 days
  };
}

export async function fetchLinkedInProfile(accessToken) {
  // OpenID Connect userinfo returns sub (URN), name, email, picture.
  const response = await fetchWithTimeout("https://api.linkedin.com/v2/userinfo", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `LinkedIn profile fetch failed (HTTP ${response.status})`);
  }

  const sub = payload.sub || "";
  const personUrn = sub ? (sub.startsWith("urn:") ? sub : `urn:li:person:${sub}`) : "";

  return {
    personUrn,
    name: payload.name || "",
    givenName: payload.given_name || "",
    familyName: payload.family_name || "",
    email: payload.email || "",
    pictureUrl: payload.picture || "",
    locale: payload.locale || "",
  };
}

export async function publishLinkedInText({ accessToken, personUrn, text }) {
  if (!personUrn) throw new Error("personUrn is required");
  const body = {
    author: personUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const response = await fetchWithTimeout("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `LinkedIn publish failed (HTTP ${response.status})`);
  }

  // LinkedIn returns either the URN in the body or in x-restli-id / Location header.
  const postUrn =
    payload?.id ||
    response.headers.get("x-restli-id") ||
    response.headers.get("x-linkedin-id") ||
    "";

  const permalink = postUrn
    ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`
    : "";

  return { postUrn, permalink };
}

export function validateLinkedInRedirectUri(redirectUri) {
  if (!redirectUri || typeof redirectUri !== "string") return false;
  try {
    const parsed = new URL(redirectUri);
    return parsed.protocol === "https:" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}
