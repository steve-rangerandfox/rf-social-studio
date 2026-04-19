-- Migration 003: LinkedIn token persistence for scheduled publishing.
--
-- Mirrors 001_ig_tokens.sql. The scheduled publish worker needs
-- server-side access to the user's LinkedIn access token so it can
-- publish on their behalf without a browser session cookie.
--
-- Run once against your Supabase project:
--   psql $DATABASE_URL < migrations/003_li_tokens.sql

CREATE TABLE IF NOT EXISTS li_tokens (
  owner_user_id    TEXT        PRIMARY KEY,
  person_urn       TEXT        NOT NULL,
  access_token_enc TEXT        NOT NULL, -- AES-256-GCM encrypted
  display_name     TEXT,
  expires_at       TIMESTAMPTZ NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE li_tokens ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS — user-facing queries go through the API.

CREATE INDEX IF NOT EXISTS li_tokens_expires_at_idx ON li_tokens (expires_at);

COMMENT ON TABLE li_tokens IS
  'Encrypted LinkedIn access tokens for the scheduled publishing background worker.';
COMMENT ON COLUMN li_tokens.access_token_enc IS
  'AES-256-GCM encrypted access token. Key derived from SESSION_SECRET. Format: base64url(iv).base64url(tag).base64url(ciphertext)';
COMMENT ON COLUMN li_tokens.person_urn IS
  'LinkedIn member URN (urn:li:person:...) used as the author of published posts.';
