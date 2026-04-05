const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_PROMPT_LENGTH = 5000;
const MAX_ROWS = 5000;
const MAX_COMMENTS_PER_ROW = 500;
const MAX_AUDIT_ENTRIES = 1000;
const VALID_PLATFORMS = ["ig_post", "ig_story", "ig_reel", "tiktok", "facebook", "linkedin"];
const VALID_STATUSES = ["idea", "draft", "needs_review", "approved", "scheduled", "posted"];

export function validateDocument(document) {
  if (!document || typeof document !== "object") {
    return { valid: false, error: "Document must be an object" };
  }

  const jsonSize = JSON.stringify(document).length;
  if (jsonSize > MAX_DOCUMENT_BYTES) {
    return { valid: false, error: `Document exceeds ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB limit (${Math.round(jsonSize / 1024)}KB)` };
  }

  if (document.rows && !Array.isArray(document.rows)) {
    return { valid: false, error: "rows must be an array" };
  }

  if (document.rows && document.rows.length > MAX_ROWS) {
    return { valid: false, error: `Too many rows (max ${MAX_ROWS})` };
  }

  // Validate each row has expected shape (loose - don't reject unknown fields)
  if (document.rows) {
    for (const row of document.rows) {
      if (typeof row !== "object" || !row.id) {
        return { valid: false, error: "Each row must be an object with an id" };
      }
      if (row.platform && !VALID_PLATFORMS.includes(row.platform)) {
        return { valid: false, error: `Invalid platform: ${row.platform}` };
      }
      if (row.status && !VALID_STATUSES.includes(row.status)) {
        return { valid: false, error: `Invalid status: ${row.status}` };
      }
      if (row.comments && row.comments.length > MAX_COMMENTS_PER_ROW) {
        return { valid: false, error: `Too many comments on row ${row.id}` };
      }
    }
  }

  if (document.auditLog && document.auditLog.length > MAX_AUDIT_ENTRIES) {
    // Truncate silently rather than rejecting
    document.auditLog = document.auditLog.slice(-MAX_AUDIT_ENTRIES);
  }

  return { valid: true };
}

export function validateCaptionRequest(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body must be an object"] };
  }

  const intent = body.intent || "caption";
  if (!["caption", "story_tips"].includes(intent)) {
    errors.push(`Invalid intent: ${intent}`);
  }

  if (intent === "caption") {
    if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
      errors.push("prompt is required");
    } else if (body.prompt.length > MAX_PROMPT_LENGTH) {
      errors.push(`prompt exceeds ${MAX_PROMPT_LENGTH} characters`);
    }

    if (body.platform && !VALID_PLATFORMS.includes(body.platform)) {
      errors.push(`Invalid platform: ${body.platform}`);
    }
  }

  if (intent === "story_tips") {
    if (!Array.isArray(body.board)) {
      errors.push("board must be an array");
    } else if (body.board.length > 50) {
      errors.push("board has too many elements (max 50)");
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
