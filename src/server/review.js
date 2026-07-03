// Client approval share links.
//
// An owner enables a review link; the link is a capability URL a client can
// open WITHOUT logging in to see posts awaiting approval and either approve
// them or request changes. No new tables: the token is an HMAC-signed
// capability (ownerId + rotating salt, signed with SESSION_SECRET), and the
// document stores `review: { enabled, salt, createdAt }`. Revoking rotates
// the salt, which invalidates every previously-issued link.
//
// Token format: base64url(ownerUserId).salt.hmacSha256Hex(ownerId + "." + salt)

import crypto from "node:crypto";

import { loadStudioDocumentRecord, saveStudioDocumentRecord } from "./persistence.js";
import { json, readJsonBody } from "./http.js";

const SALT_BYTES = 12;

function b64url(input) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromB64url(input) {
  try {
    return Buffer.from(String(input), "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function sign(env, ownerUserId, salt) {
  return crypto
    .createHmac("sha256", env.sessionSecret)
    .update(`${ownerUserId}.${salt}`)
    .digest("hex");
}

export function makeReviewToken(env, ownerUserId, salt) {
  return `${b64url(ownerUserId)}.${salt}.${sign(env, ownerUserId, salt)}`;
}

/** Verify a token's signature. Returns { ownerUserId, salt } or null. The
 *  document's review config (enabled + matching salt) is checked separately
 *  so revocation works. */
export function verifyReviewToken(env, token) {
  if (!env.sessionSecret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedOwner, salt, sig] = parts;
  const ownerUserId = fromB64url(encodedOwner);
  if (!ownerUserId || !/^[0-9a-f]+$/i.test(salt) || !/^[0-9a-f]{64}$/i.test(sig)) return null;
  const expected = sign(env, ownerUserId, salt);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { ownerUserId, salt };
}

/** The public-safe subset of a row a client reviewer may see. Never leak
 *  tokens, publish bookkeeping, or internal fields. */
export function sanitizeReviewRow(row) {
  return {
    id: row.id,
    note: row.note || "",
    caption: row.caption || "",
    platform: row.platform,
    status: row.status,
    scheduledAt: row.scheduledAt || null,
    thumbnailUrl: row.thumbnailUrl || row.mediaUrl || row.imageUrl || null,
    mediaKind: row.mediaKind || null,
    updatedAt: row.updatedAt || null,
  };
}

function reviewRowsFor(document) {
  const rows = Array.isArray(document?.rows) ? document.rows : [];
  const pending = rows.filter((r) => !r.deletedAt && r.status === "needs_review");
  const recentlyDecided = rows
    .filter((r) => !r.deletedAt && ["approved", "scheduled", "posted"].includes(r.status))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 6);
  return {
    pending: pending.map(sanitizeReviewRow),
    recent: recentlyDecided.map(sanitizeReviewRow),
  };
}

async function loadForToken(env, token) {
  const verified = verifyReviewToken(env, token);
  if (!verified) return { status: 404 };
  const record = await loadStudioDocumentRecord(env, verified.ownerUserId);
  const review = record?.document?.review;
  if (!record?.document || !review?.enabled || review.salt !== verified.salt) return { status: 404 };
  return { status: 200, ownerUserId: verified.ownerUserId, record };
}

/** Owner-authed: enable (or rotate/revoke) the review link.
 *  POST { action: "enable" | "revoke" } → { token? } */
export async function handleReviewLinkPost(req, res, env, reqId, auth) {
  const body = await readJsonBody(req);
  const action = body?.action === "revoke" ? "revoke" : "enable";

  const record = await loadStudioDocumentRecord(env, auth.userId);
  if (!record?.document) return json(res, 404, { error: "No studio document yet — make a change first." });

  let review;
  if (action === "enable") {
    const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
    // The token is stored so the owner can re-copy the active link later —
    // it lives in their own document, the same trust domain as everything
    // else there. Rotating (enabling again) or revoking invalidates it.
    review = { enabled: true, salt, token: makeReviewToken(env, auth.userId, salt), createdAt: new Date().toISOString() };
  } else {
    review = { enabled: false, salt: null, token: null, createdAt: null };
  }

  const saved = await saveStudioDocumentRecord(env, auth.userId, { ...record.document, review }, record.version ?? null);
  if (!saved) return json(res, 409, { error: "Document changed underneath us — try again." });

  return json(res, 200, action === "enable" ? { token: review.token } : { revoked: true });
}

/** Public: GET /api/review?t=<token> → posts awaiting approval. */
export async function handleReviewGet(req, res, env, reqId, url) {
  const loaded = await loadForToken(env, url.searchParams.get("t"));
  if (loaded.status !== 200) return json(res, 404, { error: "This review link is invalid or has been turned off." });

  const { document } = loaded.record;
  return json(res, 200, {
    studio: document.instagram?.account?.username ? `@${document.instagram.account.username}` : "Relay studio",
    ...reviewRowsFor(document),
  });
}

/** Public: POST /api/review { t, rowId, action: "approve"|"request_changes",
 *  note?, clientName? }. Approving flips the row to "approved"; requesting
 *  changes leaves it in review — both append a comment so the thread shows
 *  who said what. Optimistic-lock save with a reload-and-reapply retry. */
export async function handleReviewActionPost(req, res, env, _reqId) {
  const body = await readJsonBody(req);
  const action = body?.action;
  const rowId = typeof body?.rowId === "string" ? body.rowId : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const clientName = (typeof body?.clientName === "string" ? body.clientName.trim() : "").slice(0, 60) || "Client";
  if (!rowId || !["approve", "request_changes"].includes(action)) {
    return json(res, 400, { error: "rowId and a valid action are required" });
  }
  if (action === "request_changes" && !note) {
    return json(res, 400, { error: "Tell the studio what to change." });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const loaded = await loadForToken(env, body?.t);
    if (loaded.status !== 200) return json(res, 404, { error: "This review link is invalid or has been turned off." });

    const { document, version } = loaded.record;
    const row = (document.rows || []).find((r) => r.id === rowId && !r.deletedAt);
    if (!row) return json(res, 404, { error: "That post is no longer in the queue." });
    if (action === "approve" && row.status !== "needs_review") {
      // Already decided (possibly by the studio in parallel) — idempotent OK.
      return json(res, 200, { ok: true, status: row.status });
    }

    const comment = {
      id: crypto.randomUUID(),
      author: `${clientName} · client`,
      text: action === "approve" ? (note || "Approved via review link.") : note,
      ts: new Date().toISOString(),
    };
    const patched = {
      ...document,
      rows: document.rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              status: action === "approve" ? "approved" : r.status,
              comments: [...(Array.isArray(r.comments) ? r.comments : []), comment],
              updatedAt: comment.ts,
            }
          : r,
      ),
    };

    try {
      const saved = await saveStudioDocumentRecord(env, loaded.ownerUserId, patched, version ?? null);
      if (saved) return json(res, 200, { ok: true, status: action === "approve" ? "approved" : row.status });
    } catch {
      // Version conflict — reload and reapply.
    }
  }
  return json(res, 409, { error: "The queue is being edited right now — try again in a moment." });
}
