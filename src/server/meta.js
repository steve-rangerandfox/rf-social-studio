import { fetchWithTimeout } from "./http.js";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

// Permissions required for the Instagram API with Instagram Login.
// User must approve all of these for publishing to work.
export const IG_OAUTH_SCOPES = "instagram_business_basic,instagram_business_content_publish";

// Build the Instagram OAuth authorize URL.
// redirectUri should be the canonical URL registered in the Meta dashboard.
export function buildInstagramAuthorizeUrl({ appId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: IG_OAUTH_SCOPES,
    response_type: "code",
  });
  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

// Exchange an OAuth code for a short-lived IG user token, then upgrade
// it to a long-lived token (60 days).
// Returns: { accessToken, userId, expiresIn (seconds) }
export async function exchangeCodeForInstagramToken({ appId, appSecret, code, redirectUri }) {
  // Step 1: short-lived token (POST form to api.instagram.com)
  const shortBody = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const shortRes = await fetchWithTimeout("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: shortBody,
  });
  const shortData = await shortRes.json();
  if (!shortRes.ok || shortData.error) {
    throw new Error(shortData.error?.message || shortData.error_message || "Instagram token exchange failed");
  }

  // Step 2: long-lived token (60 days)
  const longUrl = `${GRAPH_BASE}/access_token?` + new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortData.access_token,
  }).toString();

  const longRes = await fetchWithTimeout(longUrl);
  const longData = await longRes.json();
  if (!longRes.ok || longData.error) {
    throw new Error(longData.error?.message || "Instagram long-lived token exchange failed");
  }

  return {
    accessToken: longData.access_token,
    userId: String(shortData.user_id),
    expiresIn: longData.expires_in || 60 * 24 * 60 * 60, // default 60 days
  };
}

// Refresh a long-lived Instagram user token. Tokens last 60 days and can be
// refreshed as long as they have not expired.
// Returns: { accessToken, expiresIn }
export async function refreshInstagramToken(userToken) {
  const url = `${GRAPH_BASE}/refresh_access_token?` + new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: userToken,
  }).toString();

  const res = await fetchWithTimeout(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Instagram token refresh failed");
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in || 60 * 24 * 60 * 60,
  };
}

// Fetch the authenticated IG user's profile.
// Returns: { id, username, name, accountType, profilePictureUrl, mediaCount, followersCount, biography }
export async function fetchInstagramProfile(userToken) {
  const fields = "user_id,username,name,account_type,profile_picture_url,media_count,followers_count,biography";
  const url = `${GRAPH_BASE}/me?fields=${fields}&access_token=${encodeURIComponent(userToken)}`;

  const res = await fetchWithTimeout(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || "Instagram profile fetch failed");
  }

  return {
    id: body.user_id || body.id,
    username: body.username,
    name: body.name,
    accountType: body.account_type,
    profilePictureUrl: body.profile_picture_url,
    mediaCount: body.media_count,
    followersCount: body.followers_count,
    biography: body.biography,
  };
}

// Fetch IG media for the authenticated user with cursor pagination.
// Returns: { data: [...], paging: { hasNext, after } }
export async function fetchInstagramMedia(userToken, { limit = 30, after = null } = {}) {
  const fields = "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count";
  const params = new URLSearchParams({
    fields,
    limit: String(Math.min(Math.max(limit, 1), 100)),
    access_token: userToken,
  });
  if (after) params.set("after", after);

  const url = `${GRAPH_BASE}/me/media?${params.toString()}`;
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

// PUBLISHING — two-step process for Instagram Graph API (Instagram Login):
// Step 1: Create a media container with the image/video URL and caption
// Step 2: Publish the container
// Returns: { mediaId } from the publish step
export async function publishInstagramPost({
  userToken,
  imageUrl,    // public HTTPS URL of image (must be on a public CDN)
  videoUrl,    // optional, for VIDEO/REELS/STORIES
  caption,
  mediaType = "IMAGE", // "IMAGE" | "VIDEO" | "REELS" | "STORIES"
}) {
  // Step 1: Create container
  const containerParams = new URLSearchParams({
    access_token: userToken,
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
    `${GRAPH_BASE}/me/media`,
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
        `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(userToken)}`
      );
      const statusBody = await statusRes.json();
      if (statusBody.status_code === "FINISHED") break;
      if (statusBody.status_code === "ERROR") throw new Error("Media processing failed");
      attempts++;
    }
  }

  // Step 2: Publish
  const publishRes = await fetchWithTimeout(
    `${GRAPH_BASE}/me/media_publish`,
    {
      method: "POST",
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: userToken,
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
