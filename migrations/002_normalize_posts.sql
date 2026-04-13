-- Migration 002: Row-normalized posts table.
--
-- The current model stores each user's entire content calendar as a single
-- JSONB blob in studio_documents.document. This works fine at low scale but
-- has two failure modes that trigger this migration:
--
--   TRIGGER: 100 registered users  OR  any document exceeds 2 MB
--
-- When either threshold is crossed, execute this migration:
--   psql $DATABASE_URL < migrations/002_normalize_posts.sql
-- then run the data migration script:
--   node migrations/run-migration.js
--
-- After a successful migration, the app switches to reading/writing the posts
-- table directly. The studio_documents table is kept as an audit snapshot and
-- removed in a future cleanup migration.
--
-- Schema notes:
--   - owner_user_id is the Clerk user ID (text, not UUID)
--   - platform matches the frontend PLATFORMS keys: ig_post, ig_reel, ig_story, etc.
--   - status matches the frontend STATUSES keys: idea, draft, needs_review, approved, scheduled, posted
--   - media_url is a public CDN URL (Supabase Storage, Cloudinary, etc.)
--   - ig_post_id is set by the scheduled worker after a successful publish
--   - publish_error is set on failure; cleared on next successful publish
--   - deleted_at is soft-delete; rows are purged by a periodic vacuum job
--   - version supports optimistic locking for concurrent session edits

CREATE TABLE IF NOT EXISTS posts (
  id                TEXT        NOT NULL,
  owner_user_id     TEXT        NOT NULL,
  platform          TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'idea',
  caption           TEXT        NOT NULL DEFAULT '',
  note              TEXT        NOT NULL DEFAULT '',
  media_url         TEXT,
  scheduled_at      TIMESTAMPTZ,
  assignee          TEXT,
  "order"           INTEGER     NOT NULL DEFAULT 0,
  ig_post_id        TEXT,                         -- set after successful publish
  posted_at         TIMESTAMPTZ,
  publish_error     TEXT,
  publish_error_at  TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version           INTEGER     NOT NULL DEFAULT 1,

  PRIMARY KEY (owner_user_id, id)
);

-- Fast access by owner (primary read pattern)
CREATE INDEX IF NOT EXISTS posts_owner_idx
  ON posts (owner_user_id);

-- Worker query: find due scheduled posts
CREATE INDEX IF NOT EXISTS posts_scheduled_idx
  ON posts (scheduled_at)
  WHERE status = 'scheduled' AND deleted_at IS NULL;

-- Soft-delete vacuum: find stale deleted rows
CREATE INDEX IF NOT EXISTS posts_deleted_at_idx
  ON posts (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- RLS: only the service role (server + background worker) touches this table.
-- User-facing queries go through the API layer with Clerk authentication.
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — service_role bypasses RLS entirely.

COMMENT ON TABLE posts IS
  'Row-normalized post records migrated from studio_documents.document JSONB blob.';
COMMENT ON COLUMN posts.ig_post_id IS
  'Instagram media ID returned by the Graph API after a successful publish.';
COMMENT ON COLUMN posts.version IS
  'Optimistic lock counter. Increment on every write; reject saves where version does not match.';

-- ─── Comments table (normalized from rows[].comments array) ───────

CREATE TABLE IF NOT EXISTS post_comments (
  id            TEXT        NOT NULL,
  post_id       TEXT        NOT NULL,
  owner_user_id TEXT        NOT NULL,
  author        TEXT        NOT NULL,
  text          TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (owner_user_id, post_id, id),
  FOREIGN KEY (owner_user_id, post_id) REFERENCES posts (owner_user_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS post_comments_post_idx
  ON post_comments (owner_user_id, post_id);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE post_comments IS
  'Per-post review comments, migrated from the embedded comments array in studio_documents.';
