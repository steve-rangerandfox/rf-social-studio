// POST /api/ig-oauth (authorize start) + POST /api/ig-oauth (exchange).
// Handles the Instagram Login OAuth handshake: builds the authorize URL,
// signs a state cookie, then validates + exchanges the callback code.

import { IG_PENDING_TTL_MS } from "../config.js";
import {
  buildSecureCookieOptions,
  createRandomState,
  decryptCookiePayload,
  encryptCookiePayload,
  IG_OAUTH_STATE_COOKIE,
  parseCookies,
  serializeCookie,
} from "../cookies.js";
import { ensureEnv } from "../env.js";
import { appendResponseCookie, errorJson, json, readJsonBody } from "../http.js";
import { saveIGToken } from "../ig-token-store.js";
import { clearCookie, setInstagramSession } from "../instagram-session.js";
import { createLogger, sanitizeLogValue } from "../log.js";
import {
  buildInstagramAuthorizeUrl,
  exchangeCodeForInstagramToken,
  fetchInstagramProfile,
  IG_OAUTH_SCOPES,
  validateCanonicalRedirectUri,
} from "../meta.js";
import { requireRequestAuth } from "../middleware.js";

const logger = createLogger("rf-social-studio-api");

export async function handleInstagramStart(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }

  const envCheck = ensureEnv(env, ["fbAppId", "fbAppSecret", "fbRedirectUri", "sessionSecret"]);
  if (!envCheck.ok) {
    return errorJson(res, 500, "SERVER_ERROR", "Instagram OAuth is not configured", { missing: envCheck.missing });
  }

  if (!validateCanonicalRedirectUri(env.fbRedirectUri)) {
    logger("error", reqId, "ig_redirect_uri_invalid", {
      redirectUri: sanitizeLogValue(env.fbRedirectUri),
    });
    return errorJson(res, 500, "SERVER_ERROR", "Instagram redirect URI is invalid");
  }

  const state = createRandomState();
  appendResponseCookie(
    res,
    serializeCookie(
      IG_OAUTH_STATE_COOKIE,
      encryptCookiePayload(
        {
          state,
          ownerUserId: auth.userId,
          expiresAt: Date.now() + IG_PENDING_TTL_MS,
        },
        env.sessionSecret,
      ),
      {
        ...buildSecureCookieOptions(env, req),
        maxAge: 10 * 60,
      },
    ),
  );

  return json(res, 200, {
    authorizeUrl: buildInstagramAuthorizeUrl({
      appId: env.fbAppId,
      redirectUri: env.fbRedirectUri,
      state,
    }),
    scopes: IG_OAUTH_SCOPES,
  });
}

export async function handleInstagramExchange(req, res, env, reqId) {
  const envCheck = ensureEnv(env, ["fbAppId", "fbAppSecret", "fbRedirectUri", "sessionSecret"]);
  if (!envCheck.ok) {
    return errorJson(res, 500, "SERVER_ERROR", "Instagram OAuth is not configured", { missing: envCheck.missing });
  }

  if (!validateCanonicalRedirectUri(env.fbRedirectUri)) {
    return errorJson(res, 500, "SERVER_ERROR", "Instagram redirect URI is invalid");
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorJson(res, error.code || 400, "VALIDATION_ERROR", error.message);
  }

  const { code, state } = body || {};
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }
  if (!code || typeof code !== "string") {
    return errorJson(res, 400, "VALIDATION_ERROR", "code is required");
  }
  if (!state || typeof state !== "string") {
    return errorJson(res, 400, "VALIDATION_ERROR", "state is required");
  }

  const cookies = parseCookies(req);
  const oauthState = decryptCookiePayload(cookies[IG_OAUTH_STATE_COOKIE], env.sessionSecret);
  if (
    !oauthState ||
    oauthState.state !== state ||
    oauthState.ownerUserId !== auth.userId ||
    oauthState.expiresAt < Date.now()
  ) {
    // Clear the stale/invalid state cookie so a later replay can't succeed.
    clearCookie(res, IG_OAUTH_STATE_COOKIE, env, req);
    return errorJson(res, 400, "VALIDATION_ERROR", "OAuth state validation failed");
  }

  // Delete the OAuth state cookie immediately after validation to prevent replay attacks
  clearCookie(res, IG_OAUTH_STATE_COOKIE, env, req);

  try {
    const token = await exchangeCodeForInstagramToken({
      appId: env.fbAppId,
      appSecret: env.fbAppSecret,
      code: code.trim(),
      redirectUri: env.fbRedirectUri,
    });

    const profile = await fetchInstagramProfile(token.accessToken);

    if (profile.accountType !== "BUSINESS" && profile.accountType !== "MEDIA_CREATOR") {
      return errorJson(
        res,
        400,
        "IG_NO_BUSINESS_ACCOUNT",
        "Your Instagram account must be a Business or Creator account. Please convert it in the Instagram app settings and try again.",
      );
    }

    const expiresAt = Date.now() + token.expiresIn * 1000;
    const session = {
      ownerUserId: auth.userId,
      igUserId: token.userId,
      igUserToken: token.accessToken,
      igUsername: profile.username,
      igAccountType: profile.accountType,
      igProfilePictureUrl: profile.profilePictureUrl,
      igMediaCount: profile.mediaCount,
      expiresAt,
      connectedAt: Date.now(),
    };

    setInstagramSession(res, req, env, session);

    // Persist the token for the scheduled publishing worker (fire-and-forget).
    // The worker has no session cookie — it reads the token from this table.
    saveIGToken(env, {
      ownerUserId: auth.userId,
      igUserId: token.userId,
      igUserToken: token.accessToken,
      igUsername: profile.username,
      expiresAt,
    }).catch((err) =>
      logger("warn", reqId, "ig_token_store_failed", { error: sanitizeLogValue(err.message) })
    );

    return json(res, 200, {
      account: {
        username: profile.username,
        mediaCount: profile.mediaCount,
        profilePictureUrl: profile.profilePictureUrl,
        accountType: profile.accountType,
        expiresAt,
      },
    });
  } catch (error) {
    logger("error", reqId, "instagram_exchange_failed", {
      error: sanitizeLogValue(error.message),
    });
    return errorJson(res, 502, "IG_API_ERROR", "Instagram OAuth exchange failed");
  }
}
