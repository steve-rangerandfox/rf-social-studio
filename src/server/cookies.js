import crypto from "node:crypto";

export const IG_SESSION_COOKIE = "rf_ig_session";
export const IG_OAUTH_STATE_COOKIE = "rf_ig_oauth_state";

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function deriveKey(secret) {
  return crypto.createHash("sha256").update(secret).digest();
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, part) => {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName) {
      return acc;
    }

    acc[rawName] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  parts.push(`Path=${options.path || "/"}`);

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function encryptCookiePayload(payload, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map(base64UrlEncode).join(".");
}

export function decryptCookiePayload(value, secret) {
  const [ivPart, tagPart, dataPart] = String(value || "").split(".");
  if (!ivPart || !tagPart || !dataPart) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret),
      base64UrlDecode(ivPart),
    );
    decipher.setAuthTag(base64UrlDecode(tagPart));
    const plaintext = Buffer.concat([
      decipher.update(base64UrlDecode(dataPart)),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }
}

export function createRandomState() {
  return crypto.randomBytes(18).toString("base64url");
}

export function buildSecureCookieOptions(env, req, overrides = {}) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "");
  const secure = overrides.secure ?? (env.nodeEnv === "production" || forwardedProto.includes("https"));

  return {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    ...overrides,
  };
}
