import { fetchWithTimeout } from "./http.js";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Permissions required for the Instagram Graph API integration.
// User must approve all of these for publishing to work.
export const FB_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

// Build the Facebook OAuth authorize URL.
// redirectUri should be the canonical URL registered in the Meta dashboard.
export function buildFacebookAuthorizeUrl({ appId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: FB_OAUTH_SCOPES,
    response_type: "code",
    display: "popup",
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

// Exchange an OAuth code for a short-lived FB user token, then upgrade
// it to a long-lived token (60 days).
// Returns: { accessToken, expiresIn (seconds) }
export async function exchangeCodeForUserToken({ appId, appSecret, code, redirectUri }) {
  // Step 1: short-lived token
  const shortUrl = `${GRAPH_BASE}/oauth/access_token?` + new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  }).toString();

  const shortRes = await fetchWithTimeout(shortUrl);
  const shortBody = await shortRes.json();
  if (!shortRes.ok || shortBody.error) {
    throw new Error(shortBody.error?.message || shortBody.error || "Facebook token exchange failed");
  }

  // Step 2: long-lived token (60 days)
  const longUrl = `${GRAPH_BASE}/oauth/access_token?` + new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortBody.access_token,
  }).toString();

  const longRes = await fetchWithTimeout(longUrl);
  const longBody = await longRes.json();
  if (!longRes.ok || longBody.error) {
    throw new Error(longBody.error?.message || "Facebook long-lived token exchange failed");
  }

  return {
    accessToken: longBody.access_token,
    expiresIn: longBody.expires_in || 60 * 24 * 60 * 60, // default 60 days
  };
}

// Fetch the current FB user's profile.
// Returns: { id, name }
export async function fetchFacebookUser(userToken) {
  const url = `${GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(userToken)}`;
  const res = await fetchWithTimeout(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Facebook user fetch failed");
  }
  return { id: body.id, name: body.name };
}

// Fetch all Facebook Pages the user has access to, along with their connected
// Instagram Business accounts (if any). Pages without an IG account are still
// returned but will have igBusinessAccountId = null.
// Returns: Array<{ pageId, pageName, pageToken, igBusinessAccountId, igUsername }>
export async function fetchUserPages(userToken) {
  // The accounts edge returns pages the user has a role on, with their page tokens.
  // We also request the connected instagram_business_account in one query.
  const url = `${GRAPH_BASE}/me/accounts?` + new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
    limit: "100",
    access_token: userToken,
  }).toString();

  const res = await fetchWithTimeout(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Failed to fetch Facebook Pages");
  }

  const pages = (body.data || []).map((page) => ({
    pageId: page.id,
    pageName: page.name,
    pageToken: page.access_token,
    igBusinessAccountId: page.instagram_business_account?.id || null,
    igUsername: page.instagram_business_account?.username || null,
    igAvatarUrl: page.instagram_business_account?.profile_picture_url || null,
  }));

  return pages;
}

// Fetch IG Business Account profile (username, media count, profile picture).
// Returns: { id, username, mediaCount, profilePictureUrl, name, biography }
export async function fetchInstagramBusinessProfile(igBusinessAccountId, pageToken) {
  const fields = "id,username,name,biography,profile_picture_url,media_count,followers_count";
  const url = `${GRAPH_BASE}/${igBusinessAccountId}?fields=${fields}&access_token=${encodeURIComponent(pageToken)}`;

  const res = await fetchWithTimeout(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Instagram profile fetch failed");
  }

  return {
    id: body.id,
    username: body.username,
    name: body.name,
    biography: body.biography,
    profilePictureUrl: body.profile_picture_url,
    mediaCount: body.media_count,
    followersCount: body.followers_count,
  };
}

// Fetch IG media for a Business Account with cursor pagination.
// Returns: { data: [...], paging: { hasNext, after } }
export async function fetchInstagramMedia(igBusinessAccountId, pageToken, { limit = 30, after = null } = {}) {
  const fields = "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count";
  const params = new URLSearchParams({
    fields,
    limit: String(Math.min(Math.max(limit, 1), 100)),
    access_token: pageToken,
  });
  if (after) params.set("after", after);

  const url = `${GRAPH_BASE}/${igBusinessAccountId}/media?${params.toString()}`;
  const res = await fetchWithTimeout(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Instagram media fetch failed (${res.status})`);
  }

  return {
    data: body.data || [],
    paging: {
      hasNext: Boolean(body.paging?.cursors?.after),
      after: body.paging?.cursors?.after || null,
    },
  };
}

// Refresh a Facebook user token. FB long-lived tokens last 60 days but can be
// extended via this endpoint as long as the user has been active.
// Returns: { accessToken, expiresIn }
export async function refreshFacebookUserToken({ appId, appSecret, userToken }) {
  const url = `${GRAPH_BASE}/oauth/access_token?` + new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: userToken,
  }).toString();

  const res = await fetchWithTimeout(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Facebook token refresh failed");
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in || 60 * 24 * 60 * 60,
  };
}

// PUBLISHING — two-step process for Instagram Graph API:
// Step 1: Create a media container with the image/video URL and caption
// Step 2: Publish the container
// Returns: { mediaId } from the publish step
export async function publishInstagramPost({
  igBusinessAccountId,
  pageToken,
  imageUrl,    // public HTTPS URL of image (must be on a public CDN)
  videoUrl,    // optional, for VIDEO/REELS
  caption,
  mediaType = "IMAGE", // "IMAGE" | "VIDEO" | "REELS" | "STORIES"
}) {
  // Step 1: Create container
  const containerParams = new URLSearchParams({
    access_token: pageToken,
  });

  if (mediaType === "VIDEO" || mediaType === "REELS" || mediaType === "STORIES") {
    if (!videoUrl) throw new Error("videoUrl required for video/reel/story posts");
    containerParams.set("media_type", mediaType);
    containerParams.set("video_url", videoUrl);
  } else {
    if (!imageUrl) throw new Error("imageUrl required for image posts");
    containerParams.set("image_url", imageUrl);
  }

  if (caption) containerParams.set("caption", caption);

  const createRes = await fetchWithTimeout(
    `${GRAPH_BASE}/${igBusinessAccountId}/media`,
    { method: "POST", body: containerParams }
  );
  const createBody = await createRes.json();
  if (!createRes.ok || createBody.error) {
    throw new Error(createBody.error?.message || "Failed to create media container");
  }

  const containerId = createBody.id;

  // For videos, we may need to wait for processing. Poll status briefly.
  if (mediaType === "VIDEO" || mediaType === "REELS" || mediaType === "STORIES") {
    let attempts = 0;
    while (attempts < 10) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetchWithTimeout(
        `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(pageToken)}`
      );
      const statusBody = await statusRes.json();
      if (statusBody.status_code === "FINISHED") break;
      if (statusBody.status_code === "ERROR") throw new Error("Media processing failed");
      attempts++;
    }
  }

  // Step 2: Publish
  const publishRes = await fetchWithTimeout(
    `${GRAPH_BASE}/${igBusinessAccountId}/media_publish`,
    {
      method: "POST",
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: pageToken,
      }),
    }
  );
  const publishBody = await publishRes.json();
  if (!publishRes.ok || publishBody.error) {
    throw new Error(publishBody.error?.message || "Failed to publish media");
  }

  return { mediaId: publishBody.id };
}

// Validates that the FB_REDIRECT_URI env var is properly formatted.
// Unlike the old per-origin validation, this checks ONE canonical URL.
export function validateCanonicalRedirectUri(redirectUri) {
  if (!redirectUri || typeof redirectUri !== "string") return false;
  try {
    const parsed = new URL(redirectUri);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return false;
    }
    return parsed.pathname === "/instagram/oauth/callback";
  } catch {
    return false;
  }
}
