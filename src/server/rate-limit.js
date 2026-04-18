// Rate limiter with Upstash Redis backend + in-memory fallback.
//
// When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, all limits
// are enforced across every serverless function instance (the only correct
// behavior on Vercel). When those env vars are absent, falls back to the
// in-memory implementation — fine for local dev, NOT for production.
//
// Usage (same API as before, now async):
//   const result = await rateLimit(userId, endpoint, { maxRequests, windowMs });

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { log } from "./log.js";

const IS_PROD = process.env.NODE_ENV === "production";

// ─── In-memory fallback ────────────────────────────────────────────
// Used in dev / CI when no Upstash credentials are configured.
// Resets on every cold start — not safe for production abuse prevention.

const buckets = new Map();
const MAX_BUCKETS = 10_000;

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 120_000) buckets.delete(key);
  }
}, 60 * 1000);
if (cleanup.unref) cleanup.unref();

function inMemoryRateLimit(userId, endpoint, { maxRequests, windowMs }) {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  bucket.count++;

  if (buckets.size > MAX_BUCKETS) {
    let oldest = null;
    let oldestTime = Infinity;
    for (const [k, b] of buckets) {
      if (b.windowStart < oldestTime) { oldest = k; oldestTime = b.windowStart; }
    }
    if (oldest) buckets.delete(oldest);
  }

  if (bucket.count > maxRequests) {
    const retryAfter = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }

  return { allowed: true, retryAfter: 0 };
}

// ─── Upstash Redis backend ─────────────────────────────────────────
// Lazy-initialized. Cached at module level so warm serverless instances
// reuse the same connection and limiter instances.

let _redisClient = null;
let _redisConfigKey = "";
const _limiterCache = new Map();

function getUpstashLimiter(maxRequests, windowMs) {
  const url = process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) return null;

  const configKey = `${url}::${token}`;

  // Re-initialize if credentials changed (shouldn't happen in production,
  // but handles env var rotation without redeployment in some setups).
  if (_redisClient && _redisConfigKey !== configKey) {
    _redisClient = null;
    _limiterCache.clear();
  }

  if (!_redisClient) {
    _redisClient = new Redis({ url, token });
    _redisConfigKey = configKey;
  }

  const limiterKey = `${maxRequests}:${windowMs}`;
  if (!_limiterCache.has(limiterKey)) {
    _limiterCache.set(limiterKey, new Ratelimit({
      redis: _redisClient,
      limiter: Ratelimit.slidingWindow(maxRequests, `${Math.ceil(windowMs / 1000)} s`),
      prefix: "rf_rl",
      analytics: false,
    }));
  }

  return _limiterCache.get(limiterKey);
}

// ─── Public API ────────────────────────────────────────────────────

export async function rateLimit(userId, endpoint, { maxRequests, windowMs }) {
  const limiter = getUpstashLimiter(maxRequests, windowMs);

  if (limiter) {
    try {
      const { success, reset } = await limiter.limit(`${userId}:${endpoint}`);
      const retryAfter = success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return { allowed: success, retryAfter };
    } catch (err) {
      // Upstash transiently unreachable despite configured creds. Log and
      // degrade to in-memory for this request rather than blocking all
      // traffic. Operators should page on repeated occurrences of this log.
      log.error("rate_limit_upstash_error", { endpoint, err: err.message });
    }
    return inMemoryRateLimit(userId, endpoint, { maxRequests, windowMs });
  }

  // No Upstash creds configured. In production this is a misconfiguration;
  // fail closed (refuse the request) rather than silently allowing abuse
  // via per-instance in-memory buckets that reset on every cold start.
  if (IS_PROD) {
    log.error("rate_limit_unconfigured_in_prod", { endpoint });
    return { allowed: false, retryAfter: 60 };
  }

  return inMemoryRateLimit(userId, endpoint, { maxRequests, windowMs });
}
