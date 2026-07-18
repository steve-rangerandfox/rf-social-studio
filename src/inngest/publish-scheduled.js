// Scheduled publishing background worker.
//
// Runs every 5 minutes via Inngest cron. For each user with a stored IG token,
// loads their studio document, finds posts where:
//   - status === "scheduled"
//   - scheduledAt is in the past (+ 10-minute grace window)
//   - platform is ig_post, ig_reel, or ig_story
//   - not soft-deleted
//
// Publishes each due post to the Instagram Graph API, then writes the result
// back to the studio document (status → "posted", postedAt, igPostId).
//
// Token refresh: if a token is within 7 days of expiry, it is refreshed in
// this same step and re-persisted so the user never loses access silently.

import { NonRetriableError } from "inngest";

import { inngest } from "../server/inngest-client.js";
import { listActiveIGTokenOwners, loadIGToken, saveIGToken } from "../server/ig-token-store.js";
import { listActiveLITokenOwners, loadLIToken } from "../server/li-token-store.js";
import { publishInstagramPost, publishInstagramCarousel, refreshInstagramToken } from "../server/meta.js";
import { publishLinkedInText } from "../server/linkedin.js";
import { resolvePublishPlan } from "../features/studio/publish-policy.js";
import { metaPostArgs, metaCarouselArgs } from "../lib/publish-adapters.js";

// ─── Constants ─────────────────────────────────────────────────────

// How far past scheduledAt we will still attempt to publish (avoid spam after
// a long outage by skipping posts that are very stale).
const MAX_LATE_MS = 2 * 60 * 60 * 1000; // 2 hours

// Refresh a token proactively if it expires within this window.
const REFRESH_AHEAD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Helpers ───────────────────────────────────────────────────────

function buildEnv() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    sessionSecret: process.env.SESSION_SECRET || "",
  };
}

async function getSupabaseClient(env) {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Exported for unit tests only — treat as module-internal in app code.
// Deterministic media/type/frame/carousel decisions now live in the canonical
// publish-policy module (resolvePublishPlan); this worker only orchestrates.
export { MAX_LATE_MS, REFRESH_AHEAD_MS, findDueRows, findDueLinkedInRows, applyRowPatches, saveDocumentWithRetry };

/** Find rows that are due for publishing right now. */
function findDueRows(document) {
  const now = Date.now();
  if (!Array.isArray(document?.rows)) return [];

  return document.rows.filter((row) => {
    if (row.deletedAt) return false;
    if (row.status !== "scheduled") return false;
    if (row.publishMode === "manual") return false;
    if (!["ig_post", "ig_reel", "ig_story"].includes(row.platform)) return false;
    if (!row.scheduledAt) return false;

    const scheduledMs = new Date(row.scheduledAt).getTime();
    return scheduledMs <= now && now - scheduledMs <= MAX_LATE_MS;
  });
}

/** Find LinkedIn rows that are due for publishing. Separate from findDueRows
 *  because LI doesn't require a media URL and goes through a different
 *  publish path. */
function findDueLinkedInRows(document) {
  const now = Date.now();
  if (!Array.isArray(document?.rows)) return [];

  return document.rows.filter((row) => {
    if (row.deletedAt) return false;
    if (row.status !== "scheduled") return false;
    if (row.publishMode === "manual") return false;
    if (row.platform !== "linkedin") return false;
    if (!row.scheduledAt) return false;
    if (!row.caption || !row.caption.trim()) return false;

    const scheduledMs = new Date(row.scheduledAt).getTime();
    return scheduledMs <= now && now - scheduledMs <= MAX_LATE_MS;
  });
}

/** Update a single row in the document in-place; returns new document. */
function applyRowPatch(document, rowId, patch) {
  return {
    ...document,
    rows: document.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
  };
}

/** Re-apply a list of publish-outcome patches ({rowId, patch}) to a document.
 *  Outcomes are authoritative — the posts DID (or did not) go live — so on a
 *  version conflict they re-apply cleanly on top of whatever the user saved
 *  concurrently, preserving their edits to every other field. */
function applyRowPatches(document, rowPatches) {
  let next = document;
  for (const { rowId, patch } of rowPatches) next = applyRowPatch(next, rowId, patch);
  return next;
}

/** Save the patched document with the optimistic lock; on a version conflict,
 *  refetch the fresh document, re-apply the publish outcomes, and try again.
 *  Publish outcomes must never be lost: dropping a "posted" status leaves the
 *  row "scheduled", and the next cron tick re-publishes it — duplicate posts
 *  on the user's real account. Returns true when the save landed. */
async function saveDocumentWithRetry({ supabase, ownerUserId, document, version, rowPatches, logger, attempts = 3 }) {
  let doc = document;
  let ver = version;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { error } = await supabase
      .from("studio_documents")
      .update({ document: doc, version: ver + 1, updated_at: new Date().toISOString() })
      .eq("owner_user_id", ownerUserId)
      .eq("version", ver);
    if (!error) return true;
    logger.warn(`publish-scheduled: document save failed for ${ownerUserId} (attempt ${attempt}/${attempts})`, { error: error.message });
    if (attempt === attempts) break;
    const { data: fresh, error: refetchErr } = await supabase
      .from("studio_documents")
      .select("document, version")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();
    if (refetchErr || !fresh?.document) continue; // transient read failure — retry the write as-is
    doc = applyRowPatches(fresh.document, rowPatches);
    ver = fresh.version ?? ver;
  }
  return false;
}

// ─── Inngest function ──────────────────────────────────────────────

export const publishScheduledPosts = inngest.createFunction(
  {
    id: "publish-scheduled-posts",
    name: "Publish Scheduled Posts",
    triggers: { cron: "*/5 * * * *" },
    // Prevent multiple concurrent runs of this cron from overlapping.
    concurrency: { limit: 1, key: "event/data.cron" },
  },
  async ({ step, logger }) => {
    const env = buildEnv();

    if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !env.sessionSecret) {
      logger.warn("publish-scheduled: missing Supabase/session env vars, skipping");
      return { skipped: true };
    }

    // Step 1: enumerate users with active tokens
    const ownerIds = await step.run("list-token-owners", async () => {
      return listActiveIGTokenOwners(env);
    });

    if (!ownerIds.length) {
      return { processed: 0 };
    }

    let totalPublished = 0;
    let totalErrors = 0;

    // Step 2: process each user independently (isolated failures)
    for (const ownerUserId of ownerIds) {
      const result = await step.run(`process-user-${ownerUserId}`, async () => {
        // Load and optionally refresh the IG token
        let tokenRecord = await loadIGToken(env, ownerUserId);
        if (!tokenRecord) return { published: 0, skipped: "no_token" };

        // Proactive refresh if token is near expiry
        if (tokenRecord.expiresAt - Date.now() < REFRESH_AHEAD_MS) {
          try {
            const refreshed = await refreshInstagramToken(tokenRecord.igUserToken);
            tokenRecord = {
              ...tokenRecord,
              igUserToken: refreshed.accessToken,
              expiresAt: Date.now() + refreshed.expiresIn * 1000,
            };
            await saveIGToken(env, {
              ownerUserId,
              igUserId: tokenRecord.igUserId,
              igUserToken: tokenRecord.igUserToken,
              igUsername: tokenRecord.igUsername,
              expiresAt: tokenRecord.expiresAt,
            });
          } catch (err) {
            logger.warn(`publish-scheduled: token refresh failed for ${ownerUserId}`, { error: err.message });
            // Continue with old token — it may still be valid
          }
        }

        // Load the studio document
        const supabase = await getSupabaseClient(env);
        const { data: record, error: loadErr } = await supabase
          .from("studio_documents")
          .select("document, version")
          .eq("owner_user_id", ownerUserId)
          .maybeSingle();

        if (loadErr || !record?.document) return { published: 0, skipped: "no_document" };

        const dueRows = findDueRows(record.document);
        if (!dueRows.length) return { published: 0, skipped: "none_due" };

        let document = record.document;
        const version = record.version ?? 1;
        let published = 0;
        // Every publish outcome is tracked so a save conflict can re-apply
        // them onto a freshly-loaded document instead of losing them.
        const rowPatches = [];
        const patchRow = (rowId, patch) => {
          rowPatches.push({ rowId, patch });
          document = applyRowPatch(document, rowId, patch);
        };

        for (const row of dueRows) {
          // Canonical, path-independent decision. No transient media on the
          // scheduled path — a legacy carouselSlides-only row (never rendered
          // in the browser) resolves to CAROUSEL_NOT_RENDERED and fails cleanly
          // instead of publishing incorrect media.
          const plan = resolvePublishPlan({ row });
          if (plan.invalid) {
            // Revert to "approved" so the user sees and can fix it.
            patchRow(row.id, {
              status: "approved",
              publishError: plan.invalid.message,
              publishErrorAt: new Date().toISOString(),
            });
            continue;
          }

          const isStory = row.platform === "ig_story";

          if (isStory) {
            // Each operation is one STORIES frame, in order. Resume support:
            // `storyFramesPosted` records how many frames already went live, so
            // a reschedule after a partial failure posts only the remaining
            // operations instead of duplicating the whole story.
            const ops = plan.operations;
            const startIdx = Number.isInteger(row.storyFramesPosted) ? row.storyFramesPosted : 0;
            const frameIds = Array.isArray(row.storyFrameIds) ? [...row.storyFrameIds] : [];
            let postedNow = 0;
            try {
              for (let i = startIdx; i < ops.length; i++) {
                const { mediaId } = await publishInstagramPost(
                  metaPostArgs(ops[i], { igUserId: tokenRecord.igUserId, userToken: tokenRecord.igUserToken }),
                );
                frameIds.push(mediaId);
                postedNow++;
              }
              patchRow(row.id, {
                status: "posted",
                postedAt: new Date().toISOString(),
                igPostId: frameIds[0] || null,
                storyFrameIds: frameIds,
                storyFramesPosted: ops.length,
                publishError: null,
                publishErrorAt: null,
              });
              published++;
            } catch (err) {
              logger.error(`publish-scheduled: story ${row.id} failed for ${ownerUserId}`, { error: err.message });
              const done = startIdx + postedNow;
              patchRow(row.id, {
                status: "approved",
                storyFramesPosted: done,
                storyFrameIds: frameIds,
                publishError: `Published ${done} of ${ops.length} story frames — reschedule to post the rest. (${err.message || "error"})`,
                publishErrorAt: new Date().toISOString(),
              });
            }
            continue;
          }

          // Feed / reel: a single authoritative operation (CAROUSEL is atomic —
          // the three-step container flow only goes live at the final publish,
          // so no resume bookkeeping is needed).
          try {
            const op = plan.operations[0];
            const tok = { igUserId: tokenRecord.igUserId, userToken: tokenRecord.igUserToken };
            const { mediaId } = op.mediaType === "CAROUSEL"
              ? await publishInstagramCarousel(metaCarouselArgs(op, tok))
              : await publishInstagramPost(metaPostArgs(op, tok));
            patchRow(row.id, {
              status: "posted",
              postedAt: new Date().toISOString(),
              igPostId: mediaId,
              publishError: null,
              publishErrorAt: null,
            });
            published++;
          } catch (err) {
            logger.error(`publish-scheduled: post ${row.id} failed for ${ownerUserId}`, { error: err.message });
            patchRow(row.id, {
              status: "approved",
              publishError: err.message || "Unknown publish error",
              publishErrorAt: new Date().toISOString(),
            });
          }
        }

        // Persist the outcomes. On a version conflict the helper re-fetches
        // the fresh document, re-applies the outcome patches, and retries —
        // losing a "posted" status would re-publish the post next tick.
        const saved = await saveDocumentWithRetry({ supabase, ownerUserId, document, version, rowPatches, logger });
        if (!saved) {
          // NonRetriable on purpose: letting Inngest retry the whole step
          // would re-run the publish loop against Instagram.
          throw new NonRetriableError(`Document save failed for ${ownerUserId} after retries — publish outcomes may be re-attempted next tick`);
        }

        return { published };
      });

      totalPublished += result?.published ?? 0;
      if (result?.error) totalErrors++;
    }

    // ── LinkedIn publishing pass ────────────────────────────────────
    // Independent from the IG pass so a user can have either, both, or
    // neither connected without affecting the other's schedule.
    const liOwnerIds = await step.run("list-li-token-owners", async () => {
      return listActiveLITokenOwners(env);
    });

    let totalLIPublished = 0;
    let totalLIErrors = 0;

    for (const ownerUserId of liOwnerIds) {
      const result = await step.run(`process-li-user-${ownerUserId}`, async () => {
        const tokenRecord = await loadLIToken(env, ownerUserId);
        if (!tokenRecord) return { published: 0, skipped: "no_token" };

        const supabase = await getSupabaseClient(env);
        const { data: record, error: loadErr } = await supabase
          .from("studio_documents")
          .select("document, version")
          .eq("owner_user_id", ownerUserId)
          .maybeSingle();

        if (loadErr || !record?.document) return { published: 0, skipped: "no_document" };

        const dueRows = findDueLinkedInRows(record.document);
        if (!dueRows.length) return { published: 0, skipped: "none_due" };

        let document = record.document;
        const version = record.version ?? 1;
        let published = 0;
        const rowPatches = [];
        const patchRow = (rowId, patch) => {
          rowPatches.push({ rowId, patch });
          document = applyRowPatch(document, rowId, patch);
        };

        for (const row of dueRows) {
          try {
            const { postUrn, permalink } = await publishLinkedInText({
              accessToken: tokenRecord.accessToken,
              personUrn: tokenRecord.personUrn,
              text: row.caption,
            });

            patchRow(row.id, {
              status: "posted",
              postedAt: new Date().toISOString(),
              liPostUrn: postUrn || null,
              liPermalink: permalink || null,
              publishError: null,
              publishErrorAt: null,
            });
            published++;
          } catch (err) {
            logger.error(`publish-scheduled: LI post ${row.id} failed for ${ownerUserId}`, { error: err.message });
            patchRow(row.id, {
              status: "approved",
              publishError: err.message || "LinkedIn publish error",
              publishErrorAt: new Date().toISOString(),
            });
          }
        }

        const saved = await saveDocumentWithRetry({ supabase, ownerUserId, document, version, rowPatches, logger });
        if (!saved) {
          throw new NonRetriableError(`LI document save failed for ${ownerUserId} after retries — publish outcomes may be re-attempted next tick`);
        }

        return { published };
      });

      totalLIPublished += result?.published ?? 0;
      if (result?.error) totalLIErrors++;
    }

    return {
      processed: ownerIds.length,
      totalPublished,
      totalErrors,
      liProcessed: liOwnerIds.length,
      totalLIPublished,
      totalLIErrors,
    };
  },
);
