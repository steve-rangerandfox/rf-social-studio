// Per-user subscription persistence (Supabase). Mirrors the shape of
// li-token-store.js — service-role client, single row per Clerk user,
// upsert on owner_user_id.

const TABLE = "subscriptions";

async function getClient(env) {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isConfigured(env) {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

// Loads the subscription row for a user. Returns null when no row
// exists — callers should treat that as the free tier.
export async function loadSubscription(env, ownerUserId) {
  if (!isConfigured(env) || !ownerUserId) return null;
  const client = await getClient(env);
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// Upserts the row by owner_user_id. Touches updated_at on every write.
export async function upsertSubscription(env, ownerUserId, fields) {
  if (!isConfigured(env)) return;
  const client = await getClient(env);
  const { error } = await client.from(TABLE).upsert(
    {
      owner_user_id: ownerUserId,
      ...fields,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_user_id" },
  );
  if (error) throw new Error(`subscription upsert failed: ${error.message}`);
}

// Webhook reconciliation: the Stripe payload identifies the customer,
// not the Clerk user — look up by customer ID.
export async function loadSubscriptionByStripeCustomer(env, stripeCustomerId) {
  if (!isConfigured(env) || !stripeCustomerId) return null;
  const client = await getClient(env);
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function deleteSubscription(env, ownerUserId) {
  if (!isConfigured(env)) return;
  const client = await getClient(env);
  await client.from(TABLE).delete().eq("owner_user_id", ownerUserId);
}
