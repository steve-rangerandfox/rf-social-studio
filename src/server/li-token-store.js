// LinkedIn access tokens persisted (encrypted) so the scheduled-publish
// worker can read them without a browser session. Same AES-256-GCM
// scheme as ig-token-store.js.

import { encryptCookiePayload, decryptCookiePayload } from "./cookies.js";

const TABLE = "li_tokens";

async function getClient(env) {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function saveLIToken(env, { ownerUserId, personUrn, accessToken, expiresAt, name }) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !env.sessionSecret) return;
  const encrypted = encryptCookiePayload({ accessToken }, env.sessionSecret);
  const client = await getClient(env);
  const { error } = await client.from(TABLE).upsert(
    {
      owner_user_id: ownerUserId,
      person_urn: personUrn,
      access_token_enc: encrypted,
      display_name: name || null,
      expires_at: typeof expiresAt === "number" ? new Date(expiresAt).toISOString() : expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_user_id" },
  );
  if (error) throw new Error(`li_token upsert failed: ${error.message}`);
}

export async function loadLIToken(env, ownerUserId) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !env.sessionSecret) return null;
  const client = await getClient(env);
  const { data, error } = await client
    .from(TABLE)
    .select("person_urn, access_token_enc, display_name, expires_at")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error || !data) return null;

  const EXPIRY_GRACE_MS = 60 * 1000;
  if (new Date(data.expires_at).getTime() - EXPIRY_GRACE_MS <= Date.now()) return null;

  const payload = decryptCookiePayload(data.access_token_enc, env.sessionSecret);
  if (!payload?.accessToken) return null;

  return {
    personUrn: data.person_urn,
    accessToken: payload.accessToken,
    name: data.display_name,
    expiresAt: new Date(data.expires_at).getTime(),
  };
}

export async function deleteLIToken(env, ownerUserId) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return;
  const client = await getClient(env);
  await client.from(TABLE).delete().eq("owner_user_id", ownerUserId);
}

/** Returns all ownerUserIds with a non-expired LinkedIn token — consumed
 *  by the scheduled publisher to enumerate who to process. */
export async function listActiveLITokenOwners(env) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return [];
  const client = await getClient(env);
  const { data, error } = await client
    .from(TABLE)
    .select("owner_user_id")
    .gt("expires_at", new Date().toISOString());
  if (error || !data) return [];
  return data.map((r) => r.owner_user_id);
}
