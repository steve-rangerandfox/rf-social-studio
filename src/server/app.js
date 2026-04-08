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
  errorJson,
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
  IG_OAUTH_SCOPES,
  buildInstagramAuthorizeUrl,
  exchangeCodeForInstagramToken,
  fetchInstagramProfile,
  fetchInstagramMedia,
  publishInstagramPost,
  refreshInstagramToken,
  validateCanonicalRedirectUri,
} from "./meta.js";
import { createLogger, log, sanitizeLogValue } from "./log.js";
import { hasStudioPersistence, loadStudioDocumentRecord, saveStudioDocumentRecord } from "./persistence.js";
import { resolveRequestAuth } from "./auth.js";
import { rateLimit } from "./rate-limit.js";
import { validateCaptionRequest, validateDocument } from "./validate.js";

const logger = createLogger("rf-social-studio-api");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC_DIR = path.resolve(__dirname, "../../dist");

// Instagram sync deduplication — concurrent requests share one API call
const igSyncInflight = new Map();
const igSyncCache = new Map();
const IG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedIgSync(userId) {
  const cached = igSyncCache.get(userId);
  if (cached && Date.now() - cached.timestamp < IG_CACHE_TTL_MS) {
    return cached.data;
  }
  igSyncCache.delete(userId);
  return null;
}

function setCachedIgSync(userId, data) {
  igSyncCache.set(userId, { data, timestamp: Date.now() });
  // Cap cache size
  if (igSyncCache.size > 5000) {
    const oldest = [...igSyncCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 1000; i++) igSyncCache.delete(oldest[i][0]);
  }
}

function requireRequestAuth(req, res, env) {
  const auth = resolveRequestAuth(req, env);
  if (!auth.ok) {
    const code = /expired/i.test(auth.error) ? "AUTH_EXPIRED" : "AUTH_REQUIRED";
    errorJson(res, auth.status, code, auth.error);
    return null;
  }

  return auth;
}

function checkRateLimit(res, userId, endpoint, limits) {
  const result = rateLimit(userId, endpoint, limits);
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfter));
    errorJson(res, 429, "RATE_LIMITED", "Rate limit exceeded", { retryAfter: result.retryAfter });
    return false;
  }
  return true;
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
    return errorJson(res, 503, "SERVER_ERROR", "AI caption service is not configured", { missing: envCheck.missing });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorJson(res, error.code || 400, "VALIDATION_ERROR", error.message);
  }

  const captionValidation = validateCaptionRequest(body);
  if (!captionValidation.valid) {
    return errorJson(res, 400, "VALIDATION_ERROR", captionValidation.errors.join("; "), { errors: captionValidation.errors });
  }

  const intent = body.intent || "caption";

  try {
    if (intent === "story_tips") {
      const tips = await generateStoryTips(env, body.board);
      return json(res, 200, { tips });
    }

    const platform = typeof body.platform === "string" ? body.platform : "ig_post";
    const prompt = body.prompt.trim();

    const caption = await generateCaption(env, { platform, prompt });
    return json(res, 200, { caption });
  } catch (error) {
    logger("error", reqId, "caption_generation_failed", {
      error: sanitizeLogValue(error.message),
      intent,
    });
    const code = /timeout|abort/i.test(error.message) ? "AI_TIMEOUT" : "AI_ERROR";
    const status = code === "AI_TIMEOUT" ? 504 : 502;
    return errorJson(res, status, code, "Caption generation failed");
  }
}

const IG_PENDING_TTL_MS = 10 * 60 * 1000;

async function handleInstagramStart(req, res, env, reqId) {
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

async function handleInstagramExchange(req, res, env, reqId) {
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

const refreshLocks = new Map();
const REFRESH_LOCK_TTL_MS = 30 * 1000; // 30 seconds max

async function handleInstagramPosts(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }

  const envCheck = ensureEnv(env, ["sessionSecret"]);
  if (!envCheck.ok) {
    return errorJson(res, 500, "SERVER_ERROR", "Instagram session handling is not configured", { missing: envCheck.missing });
  }

  const session = getSession(req, env);
  if (!session?.igUserToken) {
    return errorJson(res, 401, "IG_TOKEN_EXPIRED", "Instagram is not connected");
  }
  if (session.ownerUserId && session.ownerUserId !== auth.userId) {
    clearCookie(res, IG_SESSION_COOKIE, env, req);
    return errorJson(res, 403, "FORBIDDEN", "Instagram connection belongs to a different signed-in user");
  }

  let activeSession = session;

  const url = getRequestUrl(req);
  const cursor = url.searchParams.get("cursor") || null;

  // Check dedup cache for non-paginated requests
  if (!cursor) {
    const cached = getCachedIgSync(auth.userId);
    if (cached) {
      return json(res, 200, cached);
    }

    // Check if another request is already fetching for this user
    const inflightKey = auth.userId;
    if (igSyncInflight.has(inflightKey)) {
      try {
        const result = await igSyncInflight.get(inflightKey);
        return json(res, 200, result);
      } catch {
        // Fall through to make our own request
      }
    }
  }

  try {
    const msLeft = (session.expiresAt || 0) - Date.now();
    const lockKey = `ig_refresh:${auth.userId}`;

    // Refresh the IG user token when it has less than 7 days left.
    if (msLeft < 7 * 24 * 60 * 60 * 1000) {
      // Cap refresh locks to prevent unbounded growth
      if (refreshLocks.size > 1000) {
        refreshLocks.clear();
      }

      if (refreshLocks.has(lockKey)) {
        // Another request is already refreshing — wait for it
        await refreshLocks.get(lockKey);
      } else {
        const refreshPromise = (async () => {
          const refreshed = await refreshInstagramToken(session.igUserToken);
          activeSession = {
            ...session,
            igUserToken: refreshed.accessToken,
            expiresAt: Date.now() + refreshed.expiresIn * 1000,
          };
          setInstagramSession(res, req, env, activeSession);
        })();
        refreshLocks.set(lockKey, refreshPromise);
        const lockTimer = setTimeout(() => refreshLocks.delete(lockKey), REFRESH_LOCK_TTL_MS);
        try {
          await refreshPromise;
        } finally {
          clearTimeout(lockTimer);
          refreshLocks.delete(lockKey);
        }
      }
    }

    // Wrap fetch logic for deduplication on non-paginated requests
    const fetchData = async () => {
      const [profile, media] = await Promise.all([
        fetchInstagramProfile(activeSession.igUserToken),
        fetchInstagramMedia(activeSession.igUserToken, { limit: 30, after: cursor }),
      ]);

      const mergedSession = {
        ...activeSession,
        igUsername: profile.username || activeSession.igUsername,
      };

      setInstagramSession(res, req, env, mergedSession);

      return {
        account: {
          username: profile.username || mergedSession.igUsername,
          mediaCount: profile.mediaCount,
          profilePictureUrl: profile.profilePictureUrl,
          expiresAt: mergedSession.expiresAt,
        },
        media: { data: media.data, paging: media.paging },
        syncedAt: new Date().toISOString(),
      };
    };

    let result;
    if (!cursor) {
      const inflightKey = auth.userId;
      const fetchPromise = fetchData();
      igSyncInflight.set(inflightKey, fetchPromise);
      try {
        result = await fetchPromise;
        setCachedIgSync(auth.userId, result);
      } finally {
        igSyncInflight.delete(inflightKey);
      }
    } else {
      result = await fetchData();
    }

    return json(res, 200, result);
  } catch (error) {
    logger("error", reqId, "instagram_sync_failed", {
      error: sanitizeLogValue(error.message),
    });

    if (/expired|invalid/i.test(error.message)) {
      clearCookie(res, IG_SESSION_COOKIE, env, req);
      return errorJson(res, 401, "IG_TOKEN_EXPIRED", "Instagram session expired. Please reconnect.");
    }

    return errorJson(res, 502, "IG_API_ERROR", "Instagram sync failed");
  }
}

function isHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

const IG_PUBLISH_MEDIA_TYPES = ["IMAGE", "VIDEO", "REELS", "STORIES"];
const IG_PUBLISH_MAX_CAPTION = 2200;

async function handleInstagramPublish(req, res, env, reqId, auth) {
  const envCheck = ensureEnv(env, ["sessionSecret"]);
  if (!envCheck.ok) {
    return errorJson(res, 500, "SERVER_ERROR", "Instagram session handling is not configured", { missing: envCheck.missing });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorJson(res, error.code || 400, "VALIDATION_ERROR", error.message);
  }

  const { caption, mediaUrl, videoUrl, mediaType, rowId } = body || {};
  const errors = [];

  if (!mediaType || !IG_PUBLISH_MEDIA_TYPES.includes(mediaType)) {
    errors.push(`mediaType must be one of: ${IG_PUBLISH_MEDIA_TYPES.join(", ")}`);
  }

  if (mediaType === "IMAGE") {
    if (!mediaUrl) {
      errors.push("mediaUrl is required for IMAGE posts");
    } else if (!isHttpsUrl(mediaUrl)) {
      errors.push("mediaUrl must be a valid public HTTPS URL");
    }
  } else if (mediaType === "VIDEO" || mediaType === "REELS" || mediaType === "STORIES") {
    if (!videoUrl) {
      errors.push(`videoUrl is required for ${mediaType} posts`);
    } else if (!isHttpsUrl(videoUrl)) {
      errors.push("videoUrl must be a valid public HTTPS URL");
    }
  }

  if (caption != null) {
    if (typeof caption !== "string") {
      errors.push("caption must be a string");
    } else if (caption.length > IG_PUBLISH_MAX_CAPTION) {
      errors.push(`caption exceeds ${IG_PUBLISH_MAX_CAPTION} character limit`);
    }
  }

  if (errors.length > 0) {
    return errorJson(res, 400, "VALIDATION_ERROR", errors.join("; "), { errors });
  }

  const session = getSession(req, env);
  if (!session?.igUserToken) {
    return errorJson(res, 401, "IG_TOKEN_EXPIRED", "Instagram is not connected");
  }
  if (session.ownerUserId && session.ownerUserId !== auth.userId) {
    clearCookie(res, IG_SESSION_COOKIE, env, req);
    return errorJson(res, 403, "FORBIDDEN", "Instagram connection belongs to a different signed-in user");
  }

  try {
    const result = await publishInstagramPost({
      userToken: session.igUserToken,
      imageUrl: mediaType === "IMAGE" ? mediaUrl : undefined,
      videoUrl: mediaType !== "IMAGE" ? videoUrl : undefined,
      caption,
      mediaType,
    });

    logger("info", reqId, "instagram_published", {
      mediaId: result.mediaId,
      rowId: sanitizeLogValue(rowId),
      mediaType,
    });

    return json(res, 200, {
      ok: true,
      mediaId: result.mediaId,
      permalink: null,
    });
  } catch (error) {
    logger("error", reqId, "instagram_publish_failed", {
      error: sanitizeLogValue(error.message),
      rowId: sanitizeLogValue(rowId),
      mediaType,
    });

    if (/expired|invalid|OAuth/i.test(error.message)) {
      clearCookie(res, IG_SESSION_COOKIE, env, req);
      return errorJson(res, 401, "IG_TOKEN_EXPIRED", "Instagram session expired. Please reconnect.");
    }

    return errorJson(res, 502, "IG_PUBLISH_FAILED", error.message || "Instagram publish failed");
  }
}

async function handleStudioDocumentGet(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }
  if (!hasStudioPersistence(env)) {
    return errorJson(res, 503, "STORAGE_ERROR", "Studio persistence is not configured");
  }

  try {
    const record = await loadStudioDocumentRecord(env, auth.userId);
    return json(res, 200, {
      document: record?.document || null,
      updatedAt: record?.updated_at || null,
      version: record?.version || null,
    });
  } catch (error) {
    const status = error.__statusCode || 502;
    logger("error", reqId, "studio_document_load_failed", {
      error: sanitizeLogValue(error.message),
      category: error.__category || "unknown",
      requestUserId: auth.userId,
    });
    return errorJson(res, status, "STORAGE_ERROR", "Studio document load failed");
  }
}

async function handleStudioDocumentPut(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }
  if (!hasStudioPersistence(env)) {
    return errorJson(res, 503, "STORAGE_ERROR", "Studio persistence is not configured");
  }

  let body;
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (error) {
    return errorJson(res, error.code || 400, "VALIDATION_ERROR", error.message);
  }

  if (!body?.document || typeof body.document !== "object") {
    return errorJson(res, 400, "VALIDATION_ERROR", "document is required");
  }

  const validation = validateDocument(body.document);
  if (!validation.valid) {
    return errorJson(res, 400, "VALIDATION_ERROR", validation.error);
  }

  const expectedVersion = typeof body.version === "number" ? body.version : null;

  try {
    const saved = await saveStudioDocumentRecord(env, auth.userId, body.document, expectedVersion);

    if (saved?.conflict) {
      const current = await loadStudioDocumentRecord(env, auth.userId);
      return errorJson(res, 409, "VERSION_CONFLICT", "Version conflict", {
        serverVersion: current?.version || null,
      });
    }

    return json(res, 200, {
      ok: true,
      updatedAt: saved?.updated_at || null,
      version: saved?.version || null,
    });
  } catch (error) {
    const status = error.__statusCode || 502;
    logger("error", reqId, "studio_document_save_failed", {
      error: sanitizeLogValue(error.message),
      category: error.__category || "unknown",
      requestUserId: auth.userId,
    });
    return errorJson(res, status, "STORAGE_ERROR", "Studio document save failed");
  }
}

const MIME_TYPES = {
  js: "text/javascript",
  css: "text/css",
  html: "text/html",
  svg: "image/svg+xml",
  png: "image/png",
  ico: "image/x-icon",
  webp: "image/webp",
  json: "application/json",
};

function streamFile(res, filePath, contentType) {
  return new Promise((resolve) => {
    res.writeHead(200, { "Content-Type": contentType });
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(404);
      }
      res.end();
      resolve(false);
    });
    stream.on("end", () => resolve(true));
    stream.pipe(res);
  });
}

async function serveStaticFile(req, res, staticDir) {
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

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";

  if (fs.existsSync(filePath)) {
    return streamFile(res, filePath, mime);
  }

  if (fs.existsSync(safeIndex)) {
    return streamFile(res, safeIndex, "text/html");
  }

  return false;
}

export async function handleApiRequest(req, res, overrides = {}) {
  const env = { ...loadServerEnv(), ...overrides };
  const reqId = makeReqId();
  const endTimer = log.startTimer("request");

  setSecurityHeaders(res);
  setCorsHeaders(req, res, env.allowedOrigins);

  log.info("request_start", {
    reqId,
    method: req.method,
    url: sanitizeLogValue(req.url),
    origin: sanitizeLogValue(getOrigin(req)),
  });

  if (req.method === "OPTIONS" && req.url.startsWith("/api/")) {
    endTimer({ reqId, status: 204 });
    return noContent(res);
  }

  const url = getRequestUrl(req);

  if (url.pathname === "/api/health") {
    endTimer({ reqId, status: 200, route: "/api/health" });
    return json(res, 200, { ok: true });
  }

  if (url.pathname === "/api/captions") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST, OPTIONS");
      res.end();
      endTimer({ reqId, status: 405, route: "/api/captions" });
      return;
    }

    const auth = requireRequestAuth(req, res, env);
    if (!auth) { endTimer({ reqId, status: 401, route: "/api/captions" }); return; }
    if (!checkRateLimit(res, auth.userId, "captions", { maxRequests: 10, windowMs: 60_000 })) { endTimer({ reqId, status: 429, route: "/api/captions" }); return; }

    try {
      return await handleCaptionRequest(req, res, env, reqId);
    } finally {
      endTimer({ reqId, route: "/api/captions", status: res.statusCode });
    }
  }

  if (url.pathname === "/api/ig-oauth") {
    if (req.method === "GET") {
      const auth = requireRequestAuth(req, res, env);
      if (!auth) { endTimer({ reqId, status: 401, route: "/api/ig-oauth" }); return; }
      if (!checkRateLimit(res, auth.userId, "ig-oauth:GET", { maxRequests: 5, windowMs: 60_000 })) { endTimer({ reqId, status: 429, route: "/api/ig-oauth" }); return; }

      try {
        return await handleInstagramStart(req, res, env, reqId);
      } finally {
        endTimer({ reqId, route: "/api/ig-oauth", method: "GET", status: res.statusCode });
      }
    }

    if (req.method === "POST") {
      const auth = requireRequestAuth(req, res, env);
      if (!auth) { endTimer({ reqId, status: 401, route: "/api/ig-oauth" }); return; }
      if (!checkRateLimit(res, auth.userId, "ig-oauth:POST", { maxRequests: 5, windowMs: 60_000 })) { endTimer({ reqId, status: 429, route: "/api/ig-oauth" }); return; }

      try {
        return await handleInstagramExchange(req, res, env, reqId);
      } finally {
        endTimer({ reqId, route: "/api/ig-oauth", method: "POST", status: res.statusCode });
      }
    }

    if (req.method === "DELETE") {
      const auth = requireRequestAuth(req, res, env);
      if (!auth) {
        endTimer({ reqId, status: 401, route: "/api/ig-oauth" });
        return;
      }
      const session = getSession(req, env);
      if (session?.ownerUserId && session.ownerUserId !== auth.userId) {
        endTimer({ reqId, status: 403, route: "/api/ig-oauth" });
        return errorJson(res, 403, "FORBIDDEN", "Instagram connection belongs to a different signed-in user");
      }
      clearCookie(res, IG_SESSION_COOKIE, env, req);
      clearCookie(res, IG_OAUTH_STATE_COOKIE, env, req);
      endTimer({ reqId, status: 204, route: "/api/ig-oauth", method: "DELETE" });
      return noContent(res);
    }

    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
    res.end();
    endTimer({ reqId, status: 405, route: "/api/ig-oauth" });
    return;
  }

  if (url.pathname === "/api/ig-posts") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, OPTIONS");
      res.end();
      endTimer({ reqId, status: 405, route: "/api/ig-posts" });
      return;
    }

    const auth = requireRequestAuth(req, res, env);
    if (!auth) { endTimer({ reqId, status: 401, route: "/api/ig-posts" }); return; }
    if (!checkRateLimit(res, auth.userId, "ig-posts", { maxRequests: 20, windowMs: 60_000 })) { endTimer({ reqId, status: 429, route: "/api/ig-posts" }); return; }

    try {
      return await handleInstagramPosts(req, res, env, reqId);
    } finally {
      endTimer({ reqId, route: "/api/ig-posts", status: res.statusCode });
    }
  }

  if (url.pathname === "/api/ig-publish") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST, OPTIONS");
      res.end();
      endTimer({ reqId, status: 405, route: "/api/ig-publish" });
      return;
    }

    const auth = requireRequestAuth(req, res, env);
    if (!auth) { endTimer({ reqId, status: 401, route: "/api/ig-publish" }); return; }
    if (!checkRateLimit(res, auth.userId, "ig-publish:POST", { maxRequests: 5, windowMs: 60_000 })) { endTimer({ reqId, status: 429, route: "/api/ig-publish" }); return; }

    try {
      return await handleInstagramPublish(req, res, env, reqId, auth);
    } finally {
      endTimer({ reqId, route: "/api/ig-publish", method: "POST", status: res.statusCode });
    }
  }

  if (url.pathname === "/api/studio-document") {
    if (req.method === "GET") {
      const auth = requireRequestAuth(req, res, env);
      if (!auth) { endTimer({ reqId, status: 401, route: "/api/studio-document" }); return; }
      if (!checkRateLimit(res, auth.userId, "studio-document:GET", { maxRequests: 60, windowMs: 60_000 })) { endTimer({ reqId, status: 429, route: "/api/studio-document" }); return; }

      try {
        return await handleStudioDocumentGet(req, res, env, reqId);
      } finally {
        endTimer({ reqId, route: "/api/studio-document", method: "GET", status: res.statusCode });
      }
    }

    if (req.method === "PUT") {
      const auth = requireRequestAuth(req, res, env);
      if (!auth) { endTimer({ reqId, status: 401, route: "/api/studio-document" }); return; }
      if (!checkRateLimit(res, auth.userId, "studio-document:PUT", { maxRequests: 30, windowMs: 60_000 })) { endTimer({ reqId, status: 429, route: "/api/studio-document" }); return; }

      try {
        return await handleStudioDocumentPut(req, res, env, reqId);
      } finally {
        endTimer({ reqId, route: "/api/studio-document", method: "PUT", status: res.statusCode });
      }
    }

    res.statusCode = 405;
    res.setHeader("Allow", "GET, PUT, OPTIONS");
    res.end();
    endTimer({ reqId, status: 405, route: "/api/studio-document" });
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

    if (await serveStaticFile(req, res, staticDir)) {
      return;
    }

    res.statusCode = 404;
    res.end();
  });
}
