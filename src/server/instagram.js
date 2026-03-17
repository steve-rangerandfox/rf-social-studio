import { fetchWithTimeout } from "./http.js";

const PROFILE_FIELDS = "id,username,media_count";
const MEDIA_FIELDS = "id,media_type,media_url,thumbnail_url,timestamp,caption,permalink";

export function validateRedirectUri(redirectUri, allowedOrigins, currentOrigin = "") {
  let parsed;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return false;
  }

  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const protocolOk = parsed.protocol === "https:" || (parsed.protocol === "http:" && isLocalhost);

  if (!protocolOk) {
    return false;
  }

  const redirectOrigin = parsed.origin.toLowerCase();
  const normalizedCurrentOrigin = String(currentOrigin || "").toLowerCase();

  return allowedOrigins.has(redirectOrigin) || (normalizedCurrentOrigin && redirectOrigin === normalizedCurrentOrigin);
}

export function buildInstagramAuthorizeUrl({ appId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: "user_profile,user_media",
    response_type: "code",
    state,
  });

  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForLongLivedToken({
  appId,
  appSecret,
  code,
  redirectUri,
}) {
  const shortRes = await fetchWithTimeout("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });

  const shortBody = await shortRes.json();
  if (!shortRes.ok || shortBody.error || shortBody.error_type) {
    throw new Error(shortBody.error_message || shortBody.error || "Instagram auth failed");
  }

  const longRes = await fetchWithTimeout(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(appSecret)}&access_token=${encodeURIComponent(shortBody.access_token)}`,
  );
  const longBody = await longRes.json();

  if (!longRes.ok || longBody.error) {
    throw new Error(longBody.error?.message || "Token upgrade failed");
  }

  return {
    accessToken: longBody.access_token,
    expiresIn: longBody.expires_in,
    userId: shortBody.user_id,
  };
}

export async function refreshInstagramToken(accessToken) {
  const response = await fetchWithTimeout(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`,
  );
  const body = await response.json();

  if (!response.ok || body.error) {
    throw new Error(body.error?.message || "Instagram token refresh failed");
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in,
  };
}

export async function fetchInstagramProfile(accessToken) {
  const response = await fetchWithTimeout(
    `https://graph.instagram.com/me?fields=${PROFILE_FIELDS}&access_token=${encodeURIComponent(accessToken)}`,
  );
  const body = await response.json();

  if (!response.ok || body.error) {
    throw new Error(body.error?.message || "Instagram profile fetch failed");
  }

  return {
    id: body.id,
    username: body.username,
    mediaCount: body.media_count,
  };
}

export async function fetchInstagramMedia(accessToken, limit = 30) {
  const response = await fetchWithTimeout(
    `https://graph.instagram.com/me/media?fields=${MEDIA_FIELDS}&access_token=${encodeURIComponent(accessToken)}&limit=${limit}`,
  );
  const body = await response.json();

  if (!response.ok || body.error) {
    throw new Error(body.error?.message || "Instagram media fetch failed");
  }

  return {
    data: Array.isArray(body.data) ? body.data : [],
    paging: body.paging || null,
  };
}
