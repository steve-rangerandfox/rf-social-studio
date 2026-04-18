// Cookie helpers for the encrypted Instagram session stored in a
// browser cookie. Extracted so both the OAuth flow (handlers/instagram-auth)
// and the in-session API routes (IG posts / publish) can share them
// without pulling in the entire app.js module.

import {
  buildSecureCookieOptions,
  decryptCookiePayload,
  encryptCookiePayload,
  IG_SESSION_COOKIE,
  parseCookies,
  serializeCookie,
} from "./cookies.js";
import { appendResponseCookie } from "./http.js";

export { IG_SESSION_COOKIE };

/** Remove an arbitrary cookie by name. Used for session + OAuth state. */
export function clearCookie(res, name, env, req) {
  appendResponseCookie(
    res,
    serializeCookie(name, "", {
      ...buildSecureCookieOptions(env, req),
      maxAge: 0,
    }),
  );
}

/** Read and decrypt the current IG session cookie. Returns null if
 *  absent, malformed, or the environment has no session secret. */
export function getInstagramSession(req, env) {
  if (!env.sessionSecret) {
    return null;
  }
  const cookies = parseCookies(req);
  return decryptCookiePayload(cookies[IG_SESSION_COOKIE], env.sessionSecret);
}

/** Write the IG session cookie with Max-Age tied to the token expiry
 *  (clamped to at least 60s so a just-now-issued session survives clock
 *  skew). */
export function setInstagramSession(res, req, env, session) {
  const maxAge = Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000));
  appendResponseCookie(
    res,
    serializeCookie(
      IG_SESSION_COOKIE,
      encryptCookiePayload(session, env.sessionSecret),
      {
        ...buildSecureCookieOptions(env, req),
        maxAge,
      },
    ),
  );
}
