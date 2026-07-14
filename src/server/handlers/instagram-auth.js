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
  validateCanonicalRedirectUri,
  IG_OAUTH_SCOPES,
} from "../meta.js";
import { requireRequestAuth } from "../middleware.js";

const logger = createLogger("rf-social-studio-api");

export async function handleInstagramStart(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }

  const envCheck = ensureEnv(env, ["igAppId", "igAppSecret", "igRedirectUri", "sessionSecret"]);
  if (!envCheck.ok) {
    return errorJson(res, 500, "SERVER_ERROR", "Instagram OAuth is not configured", { missing: envCheck.missing });
  }

  if (!validateCanonicalRedirectUri(env.igRedirectUri)) {
    logger("error", reqId, "ig_redirect_uri_invalid", {
      redirectUri: sanitizeLogValue(env.igRedirectUri),
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
      appId: env.igAppId,
      redirectUri: env.igRedirectUri,
      state,
    }),
    scopes: IG_OAUTH_SCOPES,
  });
}

export async function handleInstagramExchange(req, res, env, reqId) {
  const envCheck = ensureEnv(env, ["igAppId", "igAppSecret", "igRedirectUri", "sessionSecret"]);
  if (!envCheck.ok) {
    return errorJson(res, 500, "SERVER_ERROR", "Instagram OAuth is not configured", { missing: envCheck.missing });
  }

  if (!validateCanonicalRedirectUri(env.igRedirectUri)) {
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
    // Instagram business login: code → short-lived → long-lived IG user
    // token. Publishing runs on graph.instagram.com as that account.
    const token = await exchangeCodeForInstagramToken({
      appId: env.igAppId,
      appSecret: env.igAppSecret,
      code: code.trim(),
      redirectUri: env.igRedirectUri,
    });

    // Long-lived upgrade is best-effort; when it fails we connect with the
    // 1-hour short token and log what Meta returned (redacted) to fix it.
    if (!token.longLived) {
      logger("warn", reqId, "ig_long_token_unavailable", token.longTokenDiag || {});
    }

    const profile = await fetchInstagramProfile(token.accessToken);

    const expiresAt = Date.now() + token.expiresIn * 1000;
    const session = {
      ownerUserId: auth.userId,
      igUserId: token.userId,
      igUserToken: token.accessToken,
      igUsername: profile.username,
      igAccountType: profile.accountType || "BUSINESS",
      igProfilePictureUrl: profile.profilePictureUrl || null,
      igMediaCount: profile.mediaCount ?? null,
      expiresAt,
      connectedAt: Date.now(),
    };

    setInstagramSession(res, req, env, session);

    // Persist for the scheduled publishing worker (no session cookie there).
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
        mediaCount: profile.mediaCount ?? null,
        profilePictureUrl: profile.profilePictureUrl || null,
        accountType: profile.accountType || "BUSINESS",
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
