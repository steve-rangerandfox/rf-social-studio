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
import { validateCanonicalRedirectUri } from "../meta.js";
import {
  buildFacebookAuthorizeUrl,
  exchangeCodeForFacebookToken,
  resolveInstagramBusinessAccount,
  FB_OAUTH_SCOPES,
} from "../meta-fb.js";
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
    authorizeUrl: buildFacebookAuthorizeUrl({
      appId: env.fbAppId,
      redirectUri: env.fbRedirectUri,
      state,
    }),
    scopes: FB_OAUTH_SCOPES,
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
    // Facebook-Login path: code → long-lived USER token, then resolve the
    // IG business account linked to one of the user's Pages. We publish
    // through that account with the PAGE access token.
    const token = await exchangeCodeForFacebookToken({
      appId: env.fbAppId,
      appSecret: env.fbAppSecret,
      code: code.trim(),
      redirectUri: env.fbRedirectUri,
    });

    const ig = await resolveInstagramBusinessAccount(token.accessToken);

    const expiresAt = Date.now() + token.expiresIn * 1000;
    const session = {
      ownerUserId: auth.userId,
      igUserId: ig.igUserId,
      // Publishing uses the PAGE token (never expires while the user token
      // is valid); the long-lived user token is kept for re-resolution.
      igUserToken: ig.pageAccessToken,
      fbUserToken: token.accessToken,
      pageId: ig.pageId,
      pageName: ig.pageName,
      igUsername: ig.igUsername,
      igAccountType: "BUSINESS",
      igProfilePictureUrl: ig.igProfilePictureUrl || null,
      igMediaCount: null,
      expiresAt,
      connectedAt: Date.now(),
    };

    setInstagramSession(res, req, env, session);

    // Persist for the scheduled publishing worker (no session cookie there).
    saveIGToken(env, {
      ownerUserId: auth.userId,
      igUserId: ig.igUserId,
      igUserToken: ig.pageAccessToken,
      igUsername: ig.igUsername,
      expiresAt,
    }).catch((err) =>
      logger("warn", reqId, "ig_token_store_failed", { error: sanitizeLogValue(err.message) })
    );

    return json(res, 200, {
      account: {
        username: ig.igUsername,
        mediaCount: null,
        profilePictureUrl: ig.igProfilePictureUrl || null,
        accountType: "BUSINESS",
        expiresAt,
      },
    });
  } catch (error) {
    // Surface the "no linked IG business account" case distinctly.
    if (error.code === "IG_NO_BUSINESS_ACCOUNT") {
      return errorJson(res, 400, "IG_NO_BUSINESS_ACCOUNT", error.message);
    }
    logger("error", reqId, "instagram_exchange_failed", {
      error: sanitizeLogValue(error.message),
    });
    return errorJson(res, 502, "IG_API_ERROR", "Instagram OAuth exchange failed");
  }
}
