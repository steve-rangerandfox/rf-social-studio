// Encrypted LinkedIn session cookie, mirroring instagram-session.js.
// Stores the active access token + member URN + expiry alongside the
// already-existing IG session. Two independent cookies — a user can be
// connected to one, both, or neither.

import {
  buildSecureCookieOptions,
  decryptCookiePayload,
  encryptCookiePayload,
  parseCookies,
  serializeCookie,
} from "./cookies.js";
import { appendResponseCookie } from "./http.js";

export const LI_SESSION_COOKIE = "rf_li_session";
export const LI_OAUTH_STATE_COOKIE = "rf_li_oauth_state";

export function getLinkedInSession(req, env) {
  if (!env.sessionSecret) return null;
  const cookies = parseCookies(req);
  return decryptCookiePayload(cookies[LI_SESSION_COOKIE], env.sessionSecret);
}

export function setLinkedInSession(res, req, env, session) {
  const maxAge = Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000));
  appendResponseCookie(
    res,
    serializeCookie(
      LI_SESSION_COOKIE,
      encryptCookiePayload(session, env.sessionSecret),
      { ...buildSecureCookieOptions(env, req), maxAge },
    ),
  );
}
