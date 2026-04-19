// GET /api/li-oauth — builds authorize URL + signs a state cookie.
// POST /api/li-oauth — validates state, exchanges code for token,
//                      fetches profile, persists session + token row.
// DELETE /api/li-oauth — clears session cookie + removes persisted token.

import { IG_PENDING_TTL_MS } from "../config.js";
import {
  buildSecureCookieOptions,
  createRandomState,
  decryptCookiePayload,
  encryptCookiePayload,
  parseCookies,
  serializeCookie,
} from "../cookies.js";
import { ensureEnv } from "../env.js";
import { appendResponseCookie, errorJson, json, readJsonBody } from "../http.js";
import { deleteLIToken, saveLIToken } from "../li-token-store.js";
import {
  LI_OAUTH_STATE_COOKIE,
  LI_SESSION_COOKIE,
  getLinkedInSession,
  setLinkedInSession,
} from "../linkedin-session.js";
import {
  buildLinkedInAuthorizeUrl,
  exchangeCodeForLinkedInToken,
  fetchLinkedInProfile,
  LI_OAUTH_SCOPES,
  validateLinkedInRedirectUri,
} from "../linkedin.js";
import { createLogger, sanitizeLogValue } from "../log.js";
import { requireRequestAuth } from "../middleware.js";

const logger = createLogger("rf-social-studio-api");

function clearCookie(res, name, env, req) {
  appendResponseCookie(
    res,
    serializeCookie(name, "", { ...buildSecureCookieOptions(env, req), maxAge: 0 }),
  );
}

export async function handleLinkedInStart(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) return;

  const envCheck = ensureEnv(env, ["liAppId", "liAppSecret", "liRedirectUri", "sessionSecret"]);
  if (!envCheck.ok) {
    return errorJson(res, 503, "SERVER_ERROR", "LinkedIn OAuth is not configured", { missing: envCheck.missing });
  }

  if (!validateLinkedInRedirectUri(env.liRedirectUri)) {
    logger("error", reqId, "li_redirect_uri_invalid", { redirectUri: sanitizeLogValue(env.liRedirectUri) });
    return errorJson(res, 500, "SERVER_ERROR", "LinkedIn redirect URI is invalid");
  }

  const state = createRandomState();
  appendResponseCookie(
    res,
    serializeCookie(
      LI_OAUTH_STATE_COOKIE,
      encryptCookiePayload(
        {
          state,
          ownerUserId: auth.userId,
          expiresAt: Date.now() + IG_PENDING_TTL_MS,
        },
        env.sessionSecret,
      ),
      { ...buildSecureCookieOptions(env, req), maxAge: 10 * 60 },
    ),
  );

  return json(res, 200, {
    authorizeUrl: buildLinkedInAuthorizeUrl({
      appId: env.liAppId,
      redirectUri: env.liRedirectUri,
      state,
    }),
    scopes: LI_OAUTH_SCOPES,
  });
}

export async function handleLinkedInExchange(req, res, env, reqId) {
  const envCheck = ensureEnv(env, ["liAppId", "liAppSecret", "liRedirectUri", "sessionSecret"]);
  if (!envCheck.ok) {
    return errorJson(res, 503, "SERVER_ERROR", "LinkedIn OAuth is not configured", { missing: envCheck.missing });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorJson(res, error.code || 400, "VALIDATION_ERROR", error.message);
  }

  const auth = requireRequestAuth(req, res, env);
  if (!auth) return;

  const { code, state } = body || {};
  if (!code || typeof code !== "string") return errorJson(res, 400, "VALIDATION_ERROR", "code is required");
  if (!state || typeof state !== "string") return errorJson(res, 400, "VALIDATION_ERROR", "state is required");

  const cookies = parseCookies(req);
  const oauthState = decryptCookiePayload(cookies[LI_OAUTH_STATE_COOKIE], env.sessionSecret);
  if (
    !oauthState ||
    oauthState.state !== state ||
    oauthState.ownerUserId !== auth.userId ||
    oauthState.expiresAt < Date.now()
  ) {
    clearCookie(res, LI_OAUTH_STATE_COOKIE, env, req);
    return errorJson(res, 400, "VALIDATION_ERROR", "OAuth state validation failed");
  }

  clearCookie(res, LI_OAUTH_STATE_COOKIE, env, req);

  try {
    const token = await exchangeCodeForLinkedInToken({
      appId: env.liAppId,
      appSecret: env.liAppSecret,
      code: code.trim(),
      redirectUri: env.liRedirectUri,
    });

    const profile = await fetchLinkedInProfile(token.accessToken);
    if (!profile.personUrn) {
      return errorJson(res, 502, "LI_API_ERROR", "LinkedIn did not return a profile URN");
    }

    const expiresAt = Date.now() + token.expiresIn * 1000;
    const session = {
      ownerUserId: auth.userId,
      personUrn: profile.personUrn,
      accessToken: token.accessToken,
      name: profile.name,
      pictureUrl: profile.pictureUrl,
      expiresAt,
      connectedAt: Date.now(),
    };

    setLinkedInSession(res, req, env, session);

    saveLIToken(env, {
      ownerUserId: auth.userId,
      personUrn: profile.personUrn,
      accessToken: token.accessToken,
      name: profile.name,
      expiresAt,
    }).catch((err) =>
      logger("warn", reqId, "li_token_store_failed", { error: sanitizeLogValue(err.message) }),
    );

    return json(res, 200, {
      account: {
        name: profile.name,
        pictureUrl: profile.pictureUrl,
        personUrn: profile.personUrn,
        expiresAt,
      },
    });
  } catch (error) {
    logger("error", reqId, "linkedin_exchange_failed", { error: sanitizeLogValue(error.message) });
    return errorJson(res, 502, "LI_API_ERROR", "LinkedIn OAuth exchange failed");
  }
}

export async function handleLinkedInDisconnect(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) return;

  const session = getLinkedInSession(req, env);
  if (session?.ownerUserId && session.ownerUserId !== auth.userId) {
    return errorJson(res, 403, "FORBIDDEN", "LinkedIn connection belongs to a different signed-in user");
  }

  clearCookie(res, LI_SESSION_COOKIE, env, req);
  clearCookie(res, LI_OAUTH_STATE_COOKIE, env, req);
  deleteLIToken(env, auth.userId).catch((err) =>
    logger("warn", reqId, "li_token_delete_failed", { error: sanitizeLogValue(err.message) }),
  );

  res.statusCode = 204;
  res.end();
}
