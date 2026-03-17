import crypto from "node:crypto";

export const MAX_BODY_BYTES = 16 * 1024;
export const FETCH_TIMEOUT_MS = 10_000;

export function makeReqId() {
  return crypto.randomBytes(6).toString("hex");
}

export function getRequestUrl(req) {
  const host = req.headers.host || "localhost";
  return new URL(req.url || "/", `http://${host}`);
}

export function getOrigin(req) {
  return String(req.headers.origin || "").toLowerCase();
}

export function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "0");
}

export function setCorsHeaders(req, res, allowedOrigins) {
  const origin = getOrigin(req);

  if (allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
}

export function appendResponseCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  const next = Array.isArray(existing)
    ? [...existing, cookie]
    : existing
      ? [existing, cookie]
      : [cookie];

  res.setHeader("Set-Cookie", next);
}

export function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

export function noContent(res) {
  res.statusCode = 204;
  res.end();
}

export function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;

    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        req.destroy();
        reject(Object.assign(new Error("Request body too large"), { code: 413 }));
        return;
      }

      data += chunk;
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { code: 400 }));
      }
    });

    req.on("error", reject);
  });
}

export async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
