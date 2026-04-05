// Hardened in-memory rate limiter with LRU eviction
// Configurable per-endpoint limits
// Returns { allowed: boolean, retryAfter: number }

const buckets = new Map();
const MAX_BUCKETS = 10000;

// Clean up stale buckets every 60 seconds
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 120000) { // 2 min stale
      buckets.delete(key);
    }
  }
}, 60 * 1000);
if (cleanup.unref) cleanup.unref();

export function rateLimit(userId, endpoint, { maxRequests, windowMs }) {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  bucket.count++;

  // LRU eviction if too many buckets
  if (buckets.size > MAX_BUCKETS) {
    let oldest = null;
    let oldestTime = Infinity;
    for (const [k, b] of buckets) {
      if (b.windowStart < oldestTime) {
        oldest = k;
        oldestTime = b.windowStart;
      }
    }
    if (oldest) buckets.delete(oldest);
  }

  if (bucket.count > maxRequests) {
    const retryAfter = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }

  return { allowed: true, retryAfter: 0 };
}
