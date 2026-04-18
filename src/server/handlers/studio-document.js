// GET/PUT /api/studio-document — persists the user's entire studio
// document to Supabase with optimistic locking (see persistence.js).

import { errorJson, json, readJsonBody } from "../http.js";
import { createLogger, sanitizeLogValue } from "../log.js";
import { requireRequestAuth } from "../middleware.js";
import {
  hasStudioPersistence,
  loadStudioDocumentRecord,
  saveStudioDocumentRecord,
} from "../persistence.js";
import { validateDocument } from "../validate.js";

const logger = createLogger("rf-social-studio-api");

const MAX_DOCUMENT_BODY_BYTES = 1024 * 1024;

export async function handleStudioDocumentGet(req, res, env, reqId) {
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

export async function handleStudioDocumentPut(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) {
    return;
  }
  if (!hasStudioPersistence(env)) {
    return errorJson(res, 503, "STORAGE_ERROR", "Studio persistence is not configured");
  }

  let body;
  try {
    body = await readJsonBody(req, MAX_DOCUMENT_BODY_BYTES);
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

    if (saved?.notFound) {
      return errorJson(res, 404, "NOT_FOUND", "Studio document no longer exists");
    }
    if (saved?.conflict) {
      return errorJson(res, 409, "VERSION_CONFLICT", "Version conflict", {
        serverVersion: saved.serverVersion ?? null,
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
