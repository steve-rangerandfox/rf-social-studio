import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateCaption, generateStoryTips } from "./ai.js";
import {
  buildSecureCookieOptions,
  createRandomState,
  decryptCookiePayload,
  encryptCookiePayload,
  IG_OAUTH_STATE_COOKIE,
  IG_SESSION_COOKIE,
  parseCookies,
  serializeCookie,
} from "./cookies.js";
import { ensureEnv, loadServerEnv } from "./env.js";
import {
  appendResponseCookie,
  getOrigin,
  getRequestUrl,
  json,
  makeReqId,
  noContent,
  readJsonBody,
  setCorsHeaders,
  setSecurityHeaders,
} from "./http.js";
import {
  buildInstagramAuthorizeUrl,
  exchangeCodeForLongLivedToken,
  fetchInstagramMedia,
  fetchInstagramProfile,
  refreshInstagramToken,
  validateRedirectUri,
} from "./instagram.js";
import { createLogger, sanitizeLogValue } from "./log.js";
import { hasStudioPersistence, loadStudioDocumentRecord, saveStudioDocumentRecord } from "./persistence.js";
import { resolveRequestAuth } from "./auth.js";

const logger = createLogger("rf-social-studio-api");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC_DIR = path.resolve(__dirname, "../../dist");

function getRequestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) {
    return "";
  }

  return `${proto}://${host}`.toLowerCase();
}

function requireRequestAuth(req, res, env) {
  const auth = resolveRequestAuth(req, env);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return null;
  }

  return auth;
}

function clearCookie(res, name, env, req) {
  appendResponseCookie(
    res,
    serializeCookie(name, "", {
      ...buildSecureCookieOptions(env, req),
      maxAge: 0,
    }),
  );
}

function getSession(req, env) {
  if (!env.sessionSecret) {
    return null;
  }

  const cookies = parseCookies(req);
  return decryptCookiePayload(cookies[IG_SESSION_COOKIE], env.sessionSecret);
}

function setInstagramSession(res, req, env, session) {
  const maxAge = Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000));
  appendResponseCookie(
    res,
    serializeCookie(
      IG_SESSION_COOKIE,
      encryptCookiePayload(session, env.sessionSecret),
      {
        ...buildSecureCookieOptions(env, req),
        maxAge,
      },
    ),
  );
}

async function handleCaptionRequest(req, res, env, reqId) {
  const envCheck = ensureEnv(env, ["anthropicApiKey"]);
  if (!envCheck.ok) {
    return json(res, 503, {
      error: "AI caption service is not configured",
      missing: envCheck.missing,
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return json(res, error.code || 400, { error: error.message });
  }

  const intent = body.intent || "caption";

  try {
    if (intent === "story_tips") {
      if (!Array.isArray(body.board)) {
        return json(res, 400, { error: "board must be an array" });
      }

      const tips = await generateStoryTips(env, body.board);
      return json(res, 200, { tips });
    }

    const platform = typeof body.platform === "string" ? body.platform : "ig_post";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return json(res, 400, { error: "prompt is required" });
    }

    const caption = await generateCaption(env, { platform, prompt });
    return json(res, 200, { caption });
  } catch (error) {
    logger("error", reqId, "caption_generation_failed", {
      error: sanitizeLogValue(error.message),
      intent,
    });
    return json(res, 502, { error: "Caption generation failed" });
  }
}

async function handleInstagramStart(req, res, env) {
  const query = getRequestUrl(req).searchParams;
  const redirectUri = query.get("redirectUri") || "";
  const requestOrigin = getRequestOrigin(req);
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }

  if (!validateRedirectUri(redirectUri, env.allowedOrigins, requestOrigin)) {
    return json(res, 400, { error: "redirectUri is not allowed", redirectUri, requestOrigin });
  }

  const envCheck = ensureEnv(env, ["igAppId", "sessionSecret"]);
  if (!envCheck.ok) {
    return json(res, 500, { error: "Instagram OAuth is not configured", missing: envCheck.missing });
  }

  const state = createRandomState();
  appendResponseCookie(
    res,
    serializeCookie(
      IG_OAUTH_STATE_COOKIE,
      encryptCookiePayload(
        {
          state,
          redirectUri,
          ownerUserId: auth.userId,
          expiresAt: Date.now() + 10 * 60 * 1000,
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
      redirectUri,
      state,
    }),
  });
}

async function handleInstagramExchange(req, res, env, reqId) {
  const envCheck = ensureEnv(env, ["igAppId", "igAppSecret", "sessionSecret"]);
  if (!envCheck.ok) {
    return json(res, 500, { error: "Instagram OAuth is not configured", missing: envCheck.missing });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return json(res, error.code || 400, { error: error.message });
  }

  const { code, redirectUri, state } = body;
  const requestOrigin = getRequestOrigin(req);
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }
  if (!code || typeof code !== "string") {
    return json(res, 400, { error: "code is required" });
  }
  if (!redirectUri || typeof redirectUri !== "string" || !validateRedirectUri(redirectUri, env.allowedOrigins, requestOrigin)) {
    return json(res, 400, { error: "redirectUri is not allowed", redirectUri, requestOrigin });
  }
  if (!state || typeof state !== "string") {
    return json(res, 400, { error: "state is required" });
  }

  const cookies = parseCookies(req);
  const oauthState = decryptCookiePayload(cookies[IG_OAUTH_STATE_COOKIE], env.sessionSecret);
  if (
    !oauthState ||
    oauthState.state !== state ||
    oauthState.redirectUri !== redirectUri ||
    oauthState.ownerUserId !== auth.userId ||
    oauthState.expiresAt < Date.now()
  ) {
    return json(res, 400, { error: "OAuth state validation failed" });
  }

  try {
    const token = await exchangeCodeForLongLivedToken({
      appId: env.igAppId,
      appSecret: env.igAppSecret,
      code: code.trim(),
      redirectUri,
    });
    const profile = await fetchInstagramProfile(token.accessToken);

    setInstagramSession(res, req, env, {
      accessToken: token.accessToken,
      userId: token.userId,
      ownerUserId: auth.userId,
      username: profile.username,
      mediaCount: profile.mediaCount,
      expiresAt: Date.now() + token.expiresIn * 1000,
    });
    clearCookie(res, IG_OAUTH_STATE_COOKIE, env, req);

    return json(res, 200, {
      account: {
        username: profile.username,
        mediaCount: profile.mediaCount,
        expiresAt: Date.now() + token.expiresIn * 1000,
      },
    });
  } catch (error) {
    logger("error", reqId, "instagram_exchange_failed", {
      error: sanitizeLogValue(error.message),
    });
    return json(res, 502, { error: "Instagram OAuth exchange failed" });
  }
}

async function handleInstagramPosts(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }

  const envCheck = ensureEnv(env, ["sessionSecret"]);
  if (!envCheck.ok) {
    return json(res, 500, { error: "Instagram session handling is not configured" });
  }

  const session = getSession(req, env);
  if (!session?.accessToken) {
    return json(res, 401, { error: "Instagram is not connected" });
  }
  if (session.ownerUserId && session.ownerUserId !== auth.userId) {
    clearCookie(res, IG_SESSION_COOKIE, env, req);
    return json(res, 403, { error: "Instagram connection belongs to a different signed-in user" });
  }

  let activeSession = session;

  try {
    const msLeft = session.expiresAt - Date.now();
    if (msLeft < 7 * 24 * 60 * 60 * 1000) {
      const refreshed = await refreshInstagramToken(session.accessToken);
      activeSession = {
        ...session,
        accessToken: refreshed.accessToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000,
      };
      setInstagramSession(res, req, env, activeSession);
    }

    const [profile, media] = await Promise.all([
      fetchInstagramProfile(activeSession.accessToken),
      fetchInstagramMedia(activeSession.accessToken),
    ]);

    const mergedSession = {
      ...activeSession,
      username: profile.username,
      mediaCount: profile.mediaCount,
    };

    setInstagramSession(res, req, env, mergedSession);

    return json(res, 200, {
      account: {
        username: profile.username,
        mediaCount: profile.mediaCount,
        expiresAt: mergedSession.expiresAt,
      },
      media,
      syncedAt: Date.now(),
    });
  } catch (error) {
    logger("error", reqId, "instagram_sync_failed", {
      error: sanitizeLogValue(error.message),
    });

    if (/expired|invalid/i.test(error.message)) {
      clearCookie(res, IG_SESSION_COOKIE, env, req);
      return json(res, 401, { error: "Instagram session expired. Please reconnect." });
    }

    return json(res, 502, { error: "Instagram sync failed" });
  }
}

async function handleStudioDocumentGet(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }
  if (!hasStudioPersistence(env)) {
    return json(res, 503, { error: "Studio persistence is not configured" });
  }

  try {
    const record = await loadStudioDocumentRecord(env, auth.userId);
    return json(res, 200, {
      document: record?.document || null,
      updatedAt: record?.updated_at || null,
    });
  } catch (error) {
    logger("error", reqId, "studio_document_load_failed", {
      error: sanitizeLogValue(error.message),
      requestUserId: auth.userId,
    });
    return json(res, 502, { error: "Studio document load failed" });
  }
}

async function handleStudioDocumentPut(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }
  if (!hasStudioPersistence(env)) {
    return json(res, 503, { error: "Studio persistence is not configured" });
  }

  let body;
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    return json(res, error.code || 400, { error: error.message });
  }

  if (!body?.document || typeof body.document !== "object") {
    return json(res, 400, { error: "document is required" });
  }

  try {
    const saved = await saveStudioDocumentRecord(env, auth.userId, body.document);
    return json(res, 200, { ok: true, updatedAt: saved?.updated_at || null });
  } catch (error) {
    logger("error", reqId, "studio_document_save_failed", {
      error: sanitizeLogValue(error.message),
      requestUserId: auth.userId,
    });
    return json(res, 502, { error: "Studio document save failed" });
  }
}

function serveStaticFile(req, res, staticDir) {
  if (req.method !== "GET") {
    return false;
  }

  const requestPath = req.url.split("?")[0];
  const filePath = path.normalize(path.join(staticDir, requestPath === "/" ? "index.html" : requestPath));
  const safeIndex = path.join(staticDir, "index.html");
  const withinStaticDir = filePath.startsWith(staticDir + path.sep) || filePath === safeIndex;

  if (!withinStaticDir) {
    res.statusCode = 400;
    res.end();
    return true;
  }

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime =
      {
        js: "text/javascript",
        css: "text/css",
        html: "text/html",
        svg: "image/svg+xml",
        png: "image/png",
        ico: "image/x-icon",
        webp: "image/webp",
        json: "application/json",
      }[ext] || "application/octet-stream";

    res.statusCode = 200;
    res.setHeader("Content-Type", mime);
    res.end(content);
    return true;
  } catch {
    try {
      const html = fs.readFileSync(safeIndex);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      res.end(html);
      return true;
    } catch {
      return false;
    }
  }
}

export async function handleApiRequest(req, res, overrides = {}) {
  const env = { ...loadServerEnv(), ...overrides };
  const reqId = makeReqId();

  setSecurityHeaders(res);
  setCorsHeaders(req, res, env.allowedOrigins);

  logger("info", reqId, "request", {
    method: req.method,
    url: sanitizeLogValue(req.url),
    origin: sanitizeLogValue(getOrigin(req)),
  });

  if (req.method === "OPTIONS" && req.url.startsWith("/api/")) {
    return noContent(res);
  }

  const url = getRequestUrl(req);

  if (url.pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      allowedOrigins: Array.from(env.allowedOrigins),
      hasClerkAuthConfig: Boolean(env.clerkJwtKey),
      hasInstagramConfig: Boolean(env.igAppId && env.igAppSecret && env.sessionSecret),
      hasAiConfig: Boolean(env.anthropicApiKey),
    });
  }

  if (url.pathname === "/api/captions") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST, OPTIONS");
      res.end();
      return;
    }

    return handleCaptionRequest(req, res, env, reqId);
  }

  if (url.pathname === "/api/ig-oauth") {
    if (req.method === "GET") {
      return handleInstagramStart(req, res, env);
    }

    if (req.method === "POST") {
      return handleInstagramExchange(req, res, env, reqId);
    }

    if (req.method === "DELETE") {
      const auth = requireRequestAuth(req, res, env);
      if (!auth) {
        return;
      }
      const session = getSession(req, env);
      if (session?.ownerUserId && session.ownerUserId !== auth.userId) {
        return json(res, 403, { error: "Instagram connection belongs to a different signed-in user" });
      }
      clearCookie(res, IG_SESSION_COOKIE, env, req);
      clearCookie(res, IG_OAUTH_STATE_COOKIE, env, req);
      return noContent(res);
    }

    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
    res.end();
    return;
  }

  if (url.pathname === "/api/ig-posts") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, OPTIONS");
      res.end();
      return;
    }

    return handleInstagramPosts(req, res, env, reqId);
  }

  if (url.pathname === "/api/studio-document") {
    if (req.method === "GET") {
      return handleStudioDocumentGet(req, res, env, reqId);
    }

    if (req.method === "PUT") {
      return handleStudioDocumentPut(req, res, env, reqId);
    }

    res.statusCode = 405;
    res.setHeader("Allow", "GET, PUT, OPTIONS");
    res.end();
    return;
  }

  return false;
}

export function createNodeServer(overrides = {}) {
  const staticDir = overrides.staticDir || DEFAULT_STATIC_DIR;

  return http.createServer(async (req, res) => {
    const handled = await handleApiRequest(req, res, overrides);
    if (handled !== false) {
      return;
    }

    if (serveStaticFile(req, res, staticDir)) {
      return;
    }

    res.statusCode = 404;
    res.end();
  });
}
