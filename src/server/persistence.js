let cachedClient = null;
let cachedKey = "";
let clientFactoryPromise = null;

function getConfigKey(env) {
  return `${env.supabaseUrl || ""}::${env.supabaseServiceRoleKey || ""}`;
}

export function hasStudioPersistence(env) {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

async function getClient(env) {
  if (!hasStudioPersistence(env)) {
    return null;
  }

  const nextKey = getConfigKey(env);
  if (cachedClient && cachedKey === nextKey) {
    return cachedClient;
  }

  if (!clientFactoryPromise) {
    clientFactoryPromise = import("@supabase/supabase-js").then((mod) => mod.createClient);
  }

  const createClient = await clientFactoryPromise;
  cachedKey = nextKey;
  cachedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}

export async function loadStudioDocumentRecord(env, ownerUserId) {
  const client = await getClient(env);
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("studio_documents")
    .select("document, updated_at")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function saveStudioDocumentRecord(env, ownerUserId, document) {
  const client = await getClient(env);
  if (!client) {
    return null;
  }

  const payload = {
    owner_user_id: ownerUserId,
    document,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("studio_documents")
    .upsert(payload, { onConflict: "owner_user_id" })
    .select("updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
