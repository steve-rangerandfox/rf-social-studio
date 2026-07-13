import { fetchWithTimeout } from "./http.js";

// Instagram publishing via the FACEBOOK-Login / Graph API path. The Meta
// app is set up with "Facebook Login for Business" + the "Manage
// messaging & content on Instagram" use case, so: OAuth runs through
// facebook.com, and publishing targets the IG business account linked to
// a Facebook Page, using that Page's access token.
//
// (The older Instagram-Login path lives in meta.js; this module is its
// Facebook-flow replacement for connect + account resolution.)

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Permissions the "Manage messaging & content on Instagram" use case
// grants — enough to list Pages, read the linked IG business account,
// and publish content.
export const FB_OAUTH_SCOPES = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management";

// Build the Facebook OAuth dialog URL. redirectUri must be a Valid OAuth
// Redirect URI in the app's Facebook Login for Business settings.
export function buildFacebookAuthorizeUrl({ appId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: FB_OAUTH_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

// From a /me/accounts response, pick the first Page that has a linked
// Instagram business account and flatten it to the fields we store.
// Returns null when no Page is IG-connected.
export function pickInstagramBusinessAccount(accounts) {
  const pages = Array.isArray(accounts?.data) ? accounts.data : [];
  for (const p of pages) {
    const ig = p.instagram_business_account;
    if (ig?.id) {
      return {
        pageId: p.id,
        pageName: p.name,
        pageAccessToken: p.access_token,
        igUserId: ig.id,
        igUsername: ig.username,
        ...(ig.profile_picture_url ? { igProfilePictureUrl: ig.profile_picture_url } : {}),
      };
    }
  }
  return null;
}

// Exchange an OAuth code for a short-lived user token, then upgrade it to
// a long-lived one (~60 days). Returns { accessToken, expiresIn }.
export async function exchangeCodeForFacebookToken({ appId, appSecret, code, redirectUri }) {
  const shortUrl = `${GRAPH_BASE}/oauth/access_token?` + new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  }).toString();
  const shortRes = await fetchWithTimeout(shortUrl);
  const shortData = await shortRes.json().catch(() => ({}));
  if (!shortRes.ok || shortData.error) {
    throw new Error(shortData.error?.message || "Facebook token exchange failed");
  }

  const longUrl = `${GRAPH_BASE}/oauth/access_token?` + new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortData.access_token,
  }).toString();
  const longRes = await fetchWithTimeout(longUrl);
  const longData = await longRes.json().catch(() => ({}));
  if (!longRes.ok || longData.error) {
    throw new Error(longData.error?.message || "Facebook long-lived token exchange failed");
  }
  return {
    accessToken: longData.access_token,
    expiresIn: longData.expires_in || 60 * 24 * 60 * 60,
  };
}

// Fetch the user's Pages + linked IG business accounts, then resolve the
// one IG business account we'll publish to. Returns the pickInstagram-
// BusinessAccount shape, or throws with a user-facing message.
export async function resolveInstagramBusinessAccount(userToken) {
  const url = `${GRAPH_BASE}/me/accounts?` + new URLSearchParams({
    fields: "name,access_token,instagram_business_account{id,username,profile_picture_url}",
    access_token: userToken,
  }).toString();
  const res = await fetchWithTimeout(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || "Couldn't read your Facebook Pages");
  }
  const account = pickInstagramBusinessAccount(data);
  if (!account) {
    const err = new Error("No Instagram business account is linked to your Facebook Pages. Connect your Instagram (Professional) account to a Facebook Page, then try again.");
    err.code = "IG_NO_BUSINESS_ACCOUNT";
    throw err;
  }
  return account;
}
