// Tiny middleware helpers shared between the app.js dispatcher and
// per-endpoint handlers in src/server/handlers/. Kept in its own module
// so handlers don't have to import app.js (avoiding a cycle).

import { resolveRequestAuth } from "./auth.js";
import { errorJson } from "./http.js";
import { rateLimit } from "./rate-limit.js";

/**
 * Resolve the request's authenticated user. If authentication fails,
 * writes an error response and returns null — callers should early-exit
 * on null.
 */
export function requireRequestAuth(req, res, env) {
  const auth = resolveRequestAuth(req, env);
  if (!auth.ok) {
    const code = /expired/i.test(auth.error) ? "AUTH_EXPIRED" : "AUTH_REQUIRED";
    errorJson(res, auth.status, code, auth.error);
    return null;
  }
  return auth;
}

/**
 * Check per-user rate limit. Writes a 429 and returns false if the user
 * is over quota; returns true otherwise.
 */
export async function checkRateLimit(res, userId, endpoint, limits) {
  const result = await rateLimit(userId, endpoint, limits);
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfter));
    errorJson(res, 429, "RATE_LIMITED", "Rate limit exceeded", { retryAfter: result.retryAfter });
    return false;
  }
  return true;
}
