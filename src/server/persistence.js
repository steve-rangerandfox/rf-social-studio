let cachedClient = null;
let cachedKey = "";
let cachedAt = 0;
let clientFactoryPromise = null;

const CLIENT_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes (covers warm Vercel functions)
const QUERY_TIMEOUT_MS = 10_000; // 10 seconds
const RETRY_DELAY_MS = 500;
const MAX_RETRIES = 1;

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

  const now = Date.now();
  const nextKey = getConfigKey(env);

  // Refresh client if config changed or if cached client is stale
  if (cachedClient && (cachedKey !== nextKey || now - cachedAt > CLIENT_MAX_AGE_MS)) {
    cachedClient = null;
  }

  if (!cachedClient) {
    if (!clientFactoryPromise) {
      clientFactoryPromise = import("@supabase/supabase-js").then((mod) => mod.createClient);
    }

    const createClient = await clientFactoryPromise;
    cachedKey = nextKey;
    cachedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "public" },
    });
    cachedAt = now;
  }

  return cachedClient;
}

function invalidateClient() {
  cachedClient = null;
}

// --- Error categorization ---

function isTransientError(error) {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("socket hang up")
  );
}

function isAuthError(error) {
  const msg = (error?.message || "").toLowerCase();
  const code = error?.code || "";
  return (
    code === "PGRST301" ||
    msg.includes("jwt") ||
    msg.includes("invalid api key") ||
    msg.includes("not authorized") ||
    msg.includes("apikey")
  );
}

function isRlsViolation(error) {
  const msg = (error?.message || "").toLowerCase();
  const code = error?.code || "";
  return code === "42501" || msg.includes("row-level security") || msg.includes("rls");
}

function isConstraintViolation(error) {
  const code = error?.code || "";
  return code === "23505" || code === "23503" || code === "23502" || code === "23514";
}

/**
 * Classify a Supabase/Postgres error into a category.
 * Returns { category, statusCode, retryable }.
 */
function categorizeError(error) {
  if (isTransientError(error)) {
    return { category: "transient", statusCode: 503, retryable: true };
  }
  if (isAuthError(error)) {
    console.error("[security] Auth error from Supabase:", error.message || error);
    return { category: "auth", statusCode: 401, retryable: false };
  }
  if (isRlsViolation(error)) {
    return { category: "rls", statusCode: 403, retryable: false };
  }
  if (isConstraintViolation(error)) {
    return { category: "constraint", statusCode: 400, retryable: false };
  }
  // Unknown errors are not retryable by default
  return { category: "unknown", statusCode: 500, retryable: false };
}

// --- Query helpers ---

/**
 * Wrap a promise with a timeout. Rejects with a timeout error if the promise
 * does not settle within `timeoutMs` milliseconds.
 */
function withTimeout(queryPromise, timeoutMs = QUERY_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(Object.assign(new Error("Database query timed out"), { __timeout: true }));
    }, timeoutMs);
  });

  return Promise.race([queryPromise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Execute `fn` with a single retry on transient errors.
 * On transient failure the cached client is invalidated so a fresh one is
 * created on the next attempt.
 */
async function withRetry(fn, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const { retryable } = categorizeError(error);
      if (!retryable || attempt === maxRetries) {
        throw error;
      }
      // Invalidate client so next attempt gets a fresh connection
      invalidateClient();
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
}

/**
 * Run a Supabase query with timeout + retry + error categorization.
 * `queryFn` receives a valid Supabase client and should return the query
 * promise (the Supabase builder is thenable so just return the chain).
 */
async function executeQuery(env, queryFn) {
  return withRetry(async () => {
    const client = await getClient(env);
    if (!client) return null;

    const { data, error } = await withTimeout(queryFn(client));

    if (error) {
      // Attach categorization metadata to the error before throwing
      const meta = categorizeError(error);
      error.__category = meta.category;
      error.__statusCode = meta.statusCode;
      throw error;
    }

    return data;
  });
}

// --- Public API ---

export async function loadStudioDocumentRecord(env, ownerUserId) {
  const data = await executeQuery(env, (client) =>
    client
      .from("studio_documents")
      .select("document, updated_at, version")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle(),
  );

  return data || null;
}

export async function saveStudioDocumentRecord(env, ownerUserId, document, expectedVersion = null) {
  const client = await getClient(env);
  if (!client) return null;

  if (expectedVersion !== null) {
    // Optimistic lock: only update if version matches
    return withRetry(async () => {
      const cl = await getClient(env);
      if (!cl) return null;

      const { data, error } = await withTimeout(
        cl
          .from("studio_documents")
          .update({
            document,
            version: expectedVersion + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("owner_user_id", ownerUserId)
          .eq("version", expectedVersion)
          .select("updated_at, version")
          .single(),
      );

      if (error?.code === "PGRST116" || !data) {
        // No rows updated = version mismatch (not an error to retry)
        return { conflict: true };
      }
      if (error) {
        const meta = categorizeError(error);
        error.__category = meta.category;
        error.__statusCode = meta.statusCode;
        throw error;
      }
      return data;
    });
  }

  // First save (upsert)
  return withRetry(async () => {
    const cl = await getClient(env);
    if (!cl) return null;

    const { data, error } = await withTimeout(
      cl
        .from("studio_documents")
        .upsert(
          {
            owner_user_id: ownerUserId,
            document,
            version: 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "owner_user_id" },
        )
        .select("updated_at, version")
        .single(),
    );

    if (error) {
      const meta = categorizeError(error);
      error.__category = meta.category;
      error.__statusCode = meta.statusCode;
      throw error;
    }

    return data;
  });
}

// Exported for testing / inspection
export { categorizeError, CLIENT_MAX_AGE_MS, QUERY_TIMEOUT_MS };
