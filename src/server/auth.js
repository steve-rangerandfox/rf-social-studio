import crypto from "node:crypto";

function base64UrlDecodeJson(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return JSON.parse(Buffer.from(normalized + padding, "base64").toString("utf8"));
}

function base64UrlToBuffer(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function extractBearerToken(req) {
  const header = String(req.headers.authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function normalizePem(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  return raw.includes("-----BEGIN")
    ? raw.replace(/\\n/g, "\n")
    : `-----BEGIN PUBLIC KEY-----\n${raw}\n-----END PUBLIC KEY-----`;
}

function verifyClerkToken(token, env) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(token || "").split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Authorization token is malformed");
  }

  const header = base64UrlDecodeJson(encodedHeader);
  const payload = base64UrlDecodeJson(encodedPayload);

  if (header.alg !== "RS256") {
    throw new Error("Authorization token algorithm is not supported");
  }

  const publicKey = crypto.createPublicKey(normalizePem(env.clerkJwtKey));
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    base64UrlToBuffer(encodedSignature),
  );

  if (!verified) {
    throw new Error("Authorization token signature is invalid");
  }

  const now = Math.floor(Date.now() / 1000);
  const CLOCK_SKEW_TOLERANCE = 5;
  if (payload.exp && Number(payload.exp) + CLOCK_SKEW_TOLERANCE <= now) {
    throw new Error("Authorization token has expired");
  }
  if (payload.nbf && Number(payload.nbf) - CLOCK_SKEW_TOLERANCE > now) {
    throw new Error("Authorization token is not active yet");
  }
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Authorization token subject is missing");
  }
  if (env.clerkIssuer && payload.iss !== env.clerkIssuer) {
    throw new Error("Authorization token issuer is invalid");
  }

  return {
    userId: payload.sub,
    sessionId: typeof payload.sid === "string" ? payload.sid : "",
    issuer: typeof payload.iss === "string" ? payload.iss : "",
  };
}

export function resolveRequestAuth(req, env) {
  const bearerToken = extractBearerToken(req);

  if (env.clerkJwtKey) {
    if (!bearerToken) {
      return {
        ok: false,
        status: 401,
        error: "Authorization token is required",
      };
    }

    try {
      const verified = verifyClerkToken(bearerToken, env);
      return {
        ok: true,
        userId: verified.userId,
        sessionId: verified.sessionId,
        verified: true,
      };
    } catch (error) {
      return {
        ok: false,
        status: 401,
        error: error.message || "Authorization failed",
      };
    }
  }

  return {
    ok: false,
    status: 503,
    error: "Server auth is not configured",
  };
}
