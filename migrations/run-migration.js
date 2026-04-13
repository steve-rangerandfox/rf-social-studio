#!/usr/bin/env node
// Migration runner: studio_documents → posts + post_comments
//
// Reads every row from studio_documents, extracts the embedded rows[] array,
// and bulk-inserts them into the new posts and post_comments tables.
//
// Run AFTER applying 002_normalize_posts.sql:
//   node migrations/run-migration.js
//
// Environment variables required:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// The script is idempotent — it upserts on (owner_user_id, id) so it is safe
// to re-run if it was interrupted. A dry-run mode is available:
//   DRY_RUN=1 node migrations/run-migration.js

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.env.DRY_RUN === "1";
const BATCH_SIZE = 200;

// ─── Setup ────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────

function toISO(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

function toText(value) {
  if (value == null) return null;
  return String(value).trim() || null;
}

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function mapRow(ownerUserId, row, index) {
  return {
    id: row.id,
    owner_user_id: ownerUserId,
    platform: row.platform || "ig_post",
    status: row.status || "idea",
    caption: row.caption || "",
    note: row.note || "",
    media_url: toText(row.mediaUrl || row.imageUrl || row.media_url),
    scheduled_at: toISO(row.scheduledAt || row.scheduled_at),
    assignee: toText(row.assignee),
    order: toInt(row.order, index),
    ig_post_id: toText(row.igPostId || row.ig_post_id),
    posted_at: toISO(row.postedAt || row.posted_at),
    publish_error: toText(row.publishError || row.publish_error),
    publish_error_at: toISO(row.publishErrorAt || row.publish_error_at),
    deleted_at: toISO(row.deletedAt || row.deleted_at),
    created_at: toISO(row.createdAt) || new Date().toISOString(),
    updated_at: toISO(row.updatedAt) || new Date().toISOString(),
    version: 1,
  };
}

function mapComments(ownerUserId, row) {
  if (!Array.isArray(row.comments) || !row.comments.length) return [];
  return row.comments
    .filter((c) => c && c.id && c.text)
    .map((c) => ({
      id: c.id,
      post_id: row.id,
      owner_user_id: ownerUserId,
      author: toText(c.author) || "unknown",
      text: c.text,
      created_at: toISO(c.ts || c.created_at) || new Date().toISOString(),
    }));
}

async function batchUpsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would upsert ${batch.length} rows into ${table}`);
      continue;
    }
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`Upsert into ${table} failed: ${error.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────

async function run() {
  console.log(`\nrf-social-studio document migration${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log("─".repeat(50));

  // Load all studio documents
  const { data: docs, error: loadErr } = await supabase
    .from("studio_documents")
    .select("owner_user_id, document");

  if (loadErr) {
    console.error("ERROR loading studio_documents:", loadErr.message);
    process.exit(1);
  }

  console.log(`Found ${docs.length} studio documents\n`);

  let totalRows = 0;
  let totalComments = 0;
  let skipped = 0;

  for (const doc of docs) {
    const ownerUserId = doc.owner_user_id;
    const document = doc.document;

    if (!Array.isArray(document?.rows)) {
      console.warn(`  SKIP ${ownerUserId}: document.rows is not an array`);
      skipped++;
      continue;
    }

    const validRows = document.rows.filter((r) => r && typeof r.id === "string");
    const postRows = validRows.map((r, i) => mapRow(ownerUserId, r, i));
    const commentRows = validRows.flatMap((r) => mapComments(ownerUserId, r));

    console.log(`  ${ownerUserId}: ${postRows.length} posts, ${commentRows.length} comments`);

    await batchUpsert("posts", postRows, "owner_user_id,id");
    if (commentRows.length) {
      await batchUpsert("post_comments", commentRows, "owner_user_id,post_id,id");
    }

    totalRows += postRows.length;
    totalComments += commentRows.length;
  }

  console.log("\n─".repeat(50));
  console.log(`Migration complete.`);
  console.log(`  Documents processed: ${docs.length - skipped} (${skipped} skipped)`);
  console.log(`  Posts migrated:      ${totalRows}`);
  console.log(`  Comments migrated:   ${totalComments}`);
  if (DRY_RUN) console.log("\n  Dry run — no data was written.");
}

run().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
