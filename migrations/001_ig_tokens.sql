-- Migration 001: IG token persistence table for scheduled publishing.
--
-- The background worker (Inngest) has no access to the user's session cookie.
-- This table stores the IG user token encrypted at rest (AES-256-GCM, same key
-- as SESSION_SECRET) so the worker can retrieve it at publish time.
--
-- Run once against your Supabase project:
--   psql $DATABASE_URL < migrations/001_ig_tokens.sql
-- Or paste into Supabase SQL editor.

CREATE TABLE IF NOT EXISTS ig_tokens (
  owner_user_id      TEXT        PRIMARY KEY,
  ig_user_id         TEXT        NOT NULL,
  ig_user_token_enc  TEXT        NOT NULL, -- AES-256-GCM encrypted, iv.tag.ciphertext format
  ig_username        TEXT,
  expires_at         TIMESTAMPTZ NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the service role (used by the server and background worker) ever touches
-- this table. Regular Supabase auth sessions have no access.
ALTER TABLE ig_tokens ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — service_role bypasses RLS entirely.

-- Index for the worker's "find tokens expiring soon" query used in refresh.
CREATE INDEX IF NOT EXISTS ig_tokens_expires_at_idx ON ig_tokens (expires_at);

COMMENT ON TABLE ig_tokens IS
  'Encrypted Instagram user tokens persisted for the scheduled publishing background worker.';
COMMENT ON COLUMN ig_tokens.ig_user_token_enc IS
  'AES-256-GCM encrypted token. Key is derived from SESSION_SECRET. Format: base64url(iv).base64url(tag).base64url(ciphertext)';
