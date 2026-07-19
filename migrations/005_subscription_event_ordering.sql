-- Migration 005: Webhook idempotency + ordering for subscriptions.
--
-- Stripe delivers webhook events at-least-once and without ordering
-- guarantees. To make reconciliation safe we persist the last applied event's
-- identity and creation time, so the handler can:
--   • skip a duplicate delivery of the same event id, and
--   • skip an event created before the one we already applied, preventing a
--     delayed older event from overwriting newer authoritative state.
--
-- Both columns are nullable and additive — existing rows keep working and are
-- treated as "no event applied yet" (the first real event applies normally).
-- See src/server/handlers/billing.js (decideStripeEvent).
--
-- Run once against your Supabase project:
--   psql $DATABASE_URL < migrations/005_subscription_event_ordering.sql

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_stripe_event_id      TEXT,
  ADD COLUMN IF NOT EXISTS last_stripe_event_created BIGINT;

COMMENT ON COLUMN subscriptions.last_stripe_event_id IS
  'Stripe event id of the last webhook applied to this row (idempotency).';
COMMENT ON COLUMN subscriptions.last_stripe_event_created IS
  'Unix seconds (event.created) of the last webhook applied — older events are ignored (ordering).';
