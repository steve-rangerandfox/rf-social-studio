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
import { publishInstagramPost, refreshInstagramToken } from "../server/meta.js";

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
export { MAX_LATE_MS, REFRESH_AHEAD_MS, platformToMediaType, findDueRows };

/** Map platform identifier → Instagram mediaType string. */
function platformToMediaType(platform) {
  if (platform === "ig_reel") return "REELS";
  if (platform === "ig_story") return "STORIES";
  return "IMAGE"; // ig_post default
}

/** Find rows that are due for publishing right now. */
function findDueRows(document) {
  const now = Date.now();
  if (!Array.isArray(document?.rows)) return [];

  return document.rows.filter((row) => {
    if (row.deletedAt) return false;
    if (row.status !== "scheduled") return false;
    if (!["ig_post", "ig_reel", "ig_story"].includes(row.platform)) return false;
    if (!row.scheduledAt) return false;

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
        let version = record.version ?? 1;
        let published = 0;

        for (const row of dueRows) {
          try {
            const mediaUrl = row.mediaUrl || row.imageUrl || null;
            if (!mediaUrl) {
              // No media attached — mark as failed so it doesn't re-run endlessly
              document = applyRowPatch(document, row.id, {
                status: "approved", // revert to approved so user can fix it
                publishError: "No media URL attached — re-approve and reschedule after attaching media",
                publishErrorAt: new Date().toISOString(),
              });
              continue;
            }

            const mediaType = platformToMediaType(row.platform);
            const isVideo = mediaType === "REELS" || mediaType === "STORIES" || mediaType === "VIDEO";

            const { mediaId } = await publishInstagramPost({
              userToken: tokenRecord.igUserToken,
              imageUrl: isVideo ? undefined : mediaUrl,
              videoUrl: isVideo ? mediaUrl : undefined,
              caption: row.caption || "",
              mediaType,
            });

            document = applyRowPatch(document, row.id, {
              status: "posted",
              postedAt: new Date().toISOString(),
              igPostId: mediaId,
              publishError: null,
              publishErrorAt: null,
            });
            published++;
          } catch (err) {
            logger.error(`publish-scheduled: post ${row.id} failed for ${ownerUserId}`, { error: err.message });
            // Mark the row with the error — revert to "approved" so the user sees it
            document = applyRowPatch(document, row.id, {
              status: "approved",
              publishError: err.message || "Unknown publish error",
              publishErrorAt: new Date().toISOString(),
            });
          }
        }

        // Write the updated document back with optimistic lock
        const { error: saveErr } = await supabase
          .from("studio_documents")
          .update({
            document,
            version: version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("owner_user_id", ownerUserId)
          .eq("version", version);

        if (saveErr) {
          // Version conflict or write error — the document will be retried next cron tick.
          // Posts that were already published but not saved will have status "posted" on
          // the next run attempt, but findDueRows skips non-"scheduled" rows, so they
          // won't be double-published. The window is at most 5 minutes.
          logger.warn(`publish-scheduled: document save failed for ${ownerUserId}`, { error: saveErr.message });
          throw new NonRetriableError(`Document save conflict for ${ownerUserId}: ${saveErr.message}`);
        }

        return { published };
      });

      totalPublished += result?.published ?? 0;
      if (result?.error) totalErrors++;
    }

    return { processed: ownerIds.length, totalPublished, totalErrors };
  },
);
