// Persists encrypted Instagram user tokens to Supabase for use by the
// scheduled publishing background worker. The worker has no access to
// the user's session cookie, so the token must be stored server-side.
//
// Encryption uses the same AES-256-GCM scheme as session cookies:
// derived key from SESSION_SECRET, random IV per write.

import { encryptCookiePayload, decryptCookiePayload } from "./cookies.js";

const TABLE = "ig_tokens";

// ─── Internal helpers ──────────────────────────────────────────────

async function getClient(env) {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Upsert the IG token for a user. Called immediately after OAuth exchange
 * and after each token refresh. Fire-and-forget safe (caller can .catch(() => {})).
 */
export async function saveIGToken(env, { ownerUserId, igUserId, igUserToken, igUsername, expiresAt }) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !env.sessionSecret) return;

  const encrypted = encryptCookiePayload({ igUserToken }, env.sessionSecret);

  const client = await getClient(env);
  const { error } = await client.from(TABLE).upsert(
    {
      owner_user_id: ownerUserId,
      ig_user_id: igUserId,
      ig_user_token_enc: encrypted,
      ig_username: igUsername || null,
      expires_at: typeof expiresAt === "number"
        ? new Date(expiresAt).toISOString()
        : expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_user_id" },
  );

  if (error) throw new Error(`ig_token upsert failed: ${error.message}`);
}

/**
 * Load and decrypt the IG token for a user.
 * Returns null if not found, expired, or decryption fails.
 */
export async function loadIGToken(env, ownerUserId) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !env.sessionSecret) return null;

  const client = await getClient(env);
  const { data, error } = await client
    .from(TABLE)
    .select("ig_user_id, ig_user_token_enc, ig_username, expires_at")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error || !data) return null;

  // Token expired — no point decrypting
  if (new Date(data.expires_at) <= new Date()) return null;

  const payload = decryptCookiePayload(data.ig_user_token_enc, env.sessionSecret);
  if (!payload?.igUserToken) return null;

  return {
    igUserId: data.ig_user_id,
    igUserToken: payload.igUserToken,
    igUsername: data.ig_username,
    expiresAt: new Date(data.expires_at).getTime(),
  };
}

/**
 * Delete the stored token when the user disconnects Instagram.
 */
export async function deleteIGToken(env, ownerUserId) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return;
  const client = await getClient(env);
  await client.from(TABLE).delete().eq("owner_user_id", ownerUserId);
}

/**
 * Returns all ownerUserIds that have a valid (non-expired) token.
 * Used by the scheduled publisher to enumerate who to process.
 */
export async function listActiveIGTokenOwners(env) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return [];

  const client = await getClient(env);
  const { data, error } = await client
    .from(TABLE)
    .select("owner_user_id")
    .gt("expires_at", new Date().toISOString());

  if (error || !data) return [];
  return data.map((r) => r.owner_user_id);
}
