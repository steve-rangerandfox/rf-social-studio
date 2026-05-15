// GET/POST/DELETE /api/studio-fonts — cloud storage for user-uploaded
// custom fonts. Replaces the old localStorage data-URL path that was
// blowing past the browser quota at ~5 MB total.
//
// Storage layout: `studio-fonts/{userId}/{fontId}.{ext}`. The bucket is
// public-read so the browser can fetch the binary for @font-face url();
// writes/deletes go through the service-role server only.

import crypto from "node:crypto";

import { errorJson, json, readJsonBody } from "../http.js";
import { createLogger, sanitizeLogValue } from "../log.js";
import { requireRequestAuth } from "../middleware.js";
import { getStudioStorageClient, hasStudioPersistence } from "../persistence.js";

const logger = createLogger("rf-social-studio-api");

const BUCKET = "studio-fonts";
const MAX_FONT_BYTES = 2 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_FONT_BYTES + 32 * 1024;
const MAX_FONTS_PER_USER = 24;

const EXT_BY_MIME = {
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "application/font-woff": "woff",
  "application/font-woff2": "woff2",
  "application/x-font-ttf": "ttf",
  "application/x-font-otf": "otf",
};

function safeName(raw) {
  return String(raw || "")
    .replace(/[^\w .\-()]/g, "")
    .trim()
    .slice(0, 80) || "Custom font";
}

function extFromFilename(filename) {
  const m = /\.(woff2|woff|ttf|otf)$/i.exec(String(filename || ""));
  return m ? m[1].toLowerCase() : null;
}

function buildPublicUrl(env, path) {
  // Supabase public URL form. We construct it directly so we don't pay
  // an extra round-trip per upload to fetch it from the SDK.
  return `${env.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}

function fontIdFromPath(path) {
  const m = /\/([^/]+)\.(?:woff2|woff|ttf|otf)$/i.exec(path);
  return m ? m[1] : null;
}

export async function handleStudioFontsGet(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) return;
  if (!hasStudioPersistence(env)) {
    return errorJson(res, 503, "STORAGE_ERROR", "Studio persistence is not configured");
  }

  try {
    const storage = await getStudioStorageClient(env);
    const { data, error } = await storage.from(BUCKET).list(auth.userId, {
      limit: MAX_FONTS_PER_USER,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) throw error;

    const fonts = (data || []).map((obj) => {
      const path = `${auth.userId}/${obj.name}`;
      const id = fontIdFromPath(path);
      const meta = obj.metadata || {};
      return {
        id,
        path,
        name: meta.displayName || id,
        fileName: meta.fileName || obj.name,
        contentType: meta.mimetype || meta.contentType || "font/woff2",
        url: buildPublicUrl(env, path),
        size: obj.metadata?.size || null,
      };
    });
    return json(res, 200, { fonts });
  } catch (error) {
    logger("error", reqId, "studio_fonts_list_failed", {
      error: sanitizeLogValue(error.message),
      userId: auth.userId,
    });
    return errorJson(res, 502, "STORAGE_ERROR", "Could not list custom fonts");
  }
}

export async function handleStudioFontsPost(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) return;
  if (!hasStudioPersistence(env)) {
    return errorJson(res, 503, "STORAGE_ERROR", "Studio persistence is not configured");
  }

  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (error) {
    if (error.__statusCode === 413) {
      return errorJson(res, 413, "PAYLOAD_TOO_LARGE", "Font file is too large");
    }
    return errorJson(res, 400, "BAD_REQUEST", "Invalid JSON body");
  }

  const displayName = safeName(body?.name);
  const fileName = safeName(body?.fileName || "font");
  const contentType = String(body?.contentType || "").toLowerCase();
  const dataBase64 = typeof body?.dataBase64 === "string" ? body.dataBase64 : "";

  const ext = EXT_BY_MIME[contentType] || extFromFilename(body?.fileName);
  if (!ext) {
    return errorJson(res, 415, "UNSUPPORTED_MEDIA_TYPE", "Only .woff2, .woff, .ttf, .otf are supported");
  }
  if (!dataBase64) {
    return errorJson(res, 400, "BAD_REQUEST", "Missing dataBase64");
  }

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, "base64");
  } catch {
    return errorJson(res, 400, "BAD_REQUEST", "Invalid base64 payload");
  }
  if (buffer.length === 0) {
    return errorJson(res, 400, "BAD_REQUEST", "Empty font payload");
  }
  if (buffer.length > MAX_FONT_BYTES) {
    return errorJson(res, 413, "PAYLOAD_TOO_LARGE", "Font file is too large");
  }

  try {
    const storage = await getStudioStorageClient(env);
    const { data: existing } = await storage.from(BUCKET).list(auth.userId, { limit: MAX_FONTS_PER_USER + 1 });
    if (existing && existing.length >= MAX_FONTS_PER_USER) {
      return errorJson(res, 409, "QUOTA_EXCEEDED", `Up to ${MAX_FONTS_PER_USER} custom fonts per workspace`);
    }

    const id = crypto.randomBytes(8).toString("hex");
    const path = `${auth.userId}/${id}.${ext}`;
    const { error } = await storage.from(BUCKET).upload(path, buffer, {
      contentType: contentType || `font/${ext}`,
      cacheControl: "31536000",
      upsert: false,
      metadata: { displayName, fileName, mimetype: contentType || `font/${ext}` },
    });
    if (error) throw error;

    return json(res, 201, {
      font: {
        id,
        path,
        name: displayName,
        fileName,
        contentType: contentType || `font/${ext}`,
        url: buildPublicUrl(env, path),
        size: buffer.length,
      },
    });
  } catch (error) {
    logger("error", reqId, "studio_fonts_upload_failed", {
      error: sanitizeLogValue(error.message),
      userId: auth.userId,
    });
    return errorJson(res, 502, "STORAGE_ERROR", "Could not upload font");
  }
}

export async function handleStudioFontsDelete(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) return;
  if (!hasStudioPersistence(env)) {
    return errorJson(res, 503, "STORAGE_ERROR", "Studio persistence is not configured");
  }

  const host = req.headers.host || "localhost";
  const u = new URL(req.url || "/", `http://${host}`);
  const id = u.searchParams.get("id");
  if (!id || !/^[a-f0-9]{16}$/i.test(id)) {
    return errorJson(res, 400, "BAD_REQUEST", "Missing or invalid id");
  }

  try {
    const storage = await getStudioStorageClient(env);
    // Find the object so we know its extension. Listing is cheap (one
    // user's namespace), avoids the caller needing to pass the ext.
    const { data, error: listError } = await storage.from(BUCKET).list(auth.userId, { limit: MAX_FONTS_PER_USER });
    if (listError) throw listError;
    const obj = (data || []).find((o) => o.name.startsWith(`${id}.`));
    if (!obj) {
      res.statusCode = 204;
      res.end();
      return;
    }
    const path = `${auth.userId}/${obj.name}`;
    const { error } = await storage.from(BUCKET).remove([path]);
    if (error) throw error;
    res.statusCode = 204;
    res.end();
  } catch (error) {
    logger("error", reqId, "studio_fonts_delete_failed", {
      error: sanitizeLogValue(error.message),
      userId: auth.userId,
    });
    return errorJson(res, 502, "STORAGE_ERROR", "Could not delete font");
  }
}
