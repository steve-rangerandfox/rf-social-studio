// Central server-side constants. Prefer adding values here rather than
// hardcoding them in handlers so tuning knobs are discoverable and
// changes don't require code archaeology.

// Instagram media-sync cache: how long a user's /media response stays
// warm before we refetch from the Graph API. Balances freshness vs the
// Graph API rate limit (200 calls/user/hour).
export const IG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// OAuth handshake window: max time between authorize redirect and
// the callback hitting /instagram/oauth/callback. Covers human-in-the-loop
// sign-in on the Meta side; longer than needed is fine, shorter risks
// legitimate flows timing out.
export const IG_PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Per-instance lock on token refresh: prevents two concurrent refreshes
// from the same serverless instance. NOTE: this lock is NOT distributed —
// see audit finding on token-refresh-race. A distributed lock (Upstash
// SET NX EX or Supabase advisory) is the longer-term fix.
export const REFRESH_LOCK_TTL_MS = 30 * 1000; // 30 seconds

// Instagram Graph API publish limits (Meta-enforced).
export const IG_PUBLISH_MEDIA_TYPES = ["IMAGE", "VIDEO", "REELS", "STORIES"];
export const IG_PUBLISH_MAX_CAPTION = 2200; // IG Graph API hard limit

// In-memory Instagram sync cache size cap. Above this, we evict the oldest
// 20% of entries. Primarily a safety valve against unbounded memory growth
// on a long-running dev server; prod serverless instances rarely reach this.
export const IG_SYNC_CACHE_MAX = 5000;
export const IG_SYNC_CACHE_EVICT_BATCH = 1000;
