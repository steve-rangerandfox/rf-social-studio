-- Migration 004: Subscriptions for Buffer-style three-tier billing.
--
-- One row per Clerk user (owner_user_id). Plan + status drive
-- entitlements (see src/server/entitlements.js). The Stripe IDs let us
-- reconcile webhooks and surface the customer portal.
--
-- Run once against your Supabase project:
--   psql $DATABASE_URL < migrations/004_subscriptions.sql

CREATE TABLE IF NOT EXISTS subscriptions (
  owner_user_id          TEXT        PRIMARY KEY,
  plan                   TEXT        NOT NULL DEFAULT 'free',
  status                 TEXT        NOT NULL DEFAULT 'none',
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id        TEXT,
  trial_end              TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service-role API only — RLS is on as a safety net.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Webhook reconciliation lookups go by Stripe customer ID; subscription
-- lifecycle events also reference the subscription ID directly.
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_idx
  ON subscriptions (stripe_subscription_id);
-- Trial-expiry sweep (future cron) reads by trial_end.
CREATE INDEX IF NOT EXISTS subscriptions_trial_end_idx
  ON subscriptions (trial_end)
  WHERE status = 'trialing';

COMMENT ON TABLE subscriptions IS
  'Per-user plan + Stripe subscription state. One row per Clerk user.';
COMMENT ON COLUMN subscriptions.plan IS
  'Plan tier: free | essentials | team. Drives entitlements.';
COMMENT ON COLUMN subscriptions.status IS
  'Stripe subscription status: none | trialing | active | past_due | canceled | incomplete | unpaid.';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS
  'TRUE when the user has scheduled cancellation; access continues until current_period_end.';
