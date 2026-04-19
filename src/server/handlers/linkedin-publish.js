// POST /api/li-publish — publish a text post to LinkedIn on behalf of
// the signed-in user, using the session cookie for the access token.

import { errorJson, json, readJsonBody } from "../http.js";
import { getLinkedInSession } from "../linkedin-session.js";
import { publishLinkedInText } from "../linkedin.js";
import { createLogger, sanitizeLogValue } from "../log.js";
import { requireRequestAuth } from "../middleware.js";
import { IG_PUBLISH_MAX_CAPTION } from "../config.js";

const logger = createLogger("rf-social-studio-api");
// LinkedIn's hard limit is ~3000; we allow up to our shared caption cap
// which already sits at 2200 and is enforced client-side for IG too.
const MAX_LI_TEXT = Math.max(IG_PUBLISH_MAX_CAPTION, 3000);

export async function handleLinkedInPublish(req, res, env, reqId) {
  const auth = requireRequestAuth(req, res, env);
  if (!auth) return;

  const session = getLinkedInSession(req, env);
  if (!session?.accessToken || !session?.personUrn) {
    return errorJson(res, 403, "LI_NOT_CONNECTED", "LinkedIn is not connected for this account");
  }
  if (session.ownerUserId !== auth.userId) {
    return errorJson(res, 403, "FORBIDDEN", "LinkedIn connection belongs to a different signed-in user");
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorJson(res, error.code || 400, "VALIDATION_ERROR", error.message);
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const rowId = typeof body?.rowId === "string" ? body.rowId : null;
  if (!text) return errorJson(res, 400, "VALIDATION_ERROR", "text is required");
  if (text.length > MAX_LI_TEXT) {
    return errorJson(res, 400, "VALIDATION_ERROR", `text exceeds ${MAX_LI_TEXT} characters`);
  }

  try {
    const result = await publishLinkedInText({
      accessToken: session.accessToken,
      personUrn: session.personUrn,
      text,
    });
    return json(res, 200, {
      postUrn: result.postUrn,
      permalink: result.permalink,
      rowId,
    });
  } catch (error) {
    logger("error", reqId, "linkedin_publish_failed", { error: sanitizeLogValue(error.message) });
    return errorJson(res, 502, "LI_PUBLISH_FAILED", error.message || "LinkedIn publish failed");
  }
}
