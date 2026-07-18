import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { test } from "node:test";

// ---------------------------------------------------------------------------
// Production-entrypoint smoke tier.
//
// This gate proves the EXACT artifact Vercel deploys responds through Relay's
// real cold-start path: api/<route>.js → createApiHandler() → loadServerEnv()
// → handleApiRequest. It is deliberately distinct from its neighbours:
//
//   • tests/deployment-contract.test.js proves the wiring EXISTS (api/ ↔
//     vercel.json ↔ app.js routes) but never invokes a handler.
//   • tests/server.test.js proves route BEHAVIOR by calling handleApiRequest
//     from app.js with an explicit `env` override — not the deployed shape.
//
// Here we import the actual api/*.js default exports and drive them, so a
// broken entrypoint (bad import, non-dispatching factory, env-loading
// regression) fails route-specifically instead of only surfacing in prod.
//
// Safety: no secrets, no network, no third-party calls, no data mutation.
// Auth-gated routes short-circuit at the auth check (401/503) BEFORE any
// rate-limit, Meta, or publish path runs. The only credential involved is an
// ephemeral RSA public key generated in-process — never a production secret.
//
// Determinism of the auth config: handleApiRequest computes
// `{ ...loadServerEnv(), ...closureEnv }`, and closureEnv is captured by
// createApiHandler() at import time. So each entrypoint's effective
// clerkJwtKey is whatever process.env held WHEN THE FILE WAS IMPORTED. We
// exploit that: import the absent-config route before setting the key, and
// the auth-configured routes after.
// ---------------------------------------------------------------------------

class MockRequest extends EventEmitter {
  constructor({ method = "GET", url = "/", headers = {}, body } = {}) {
    super();
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
  }
}

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = new Map();
    this.body = "";
    this.finished = false;
  }
  setHeader(name, value) { this.headers.set(name.toLowerCase(), value); }
  getHeader(name) { return this.headers.get(name.toLowerCase()); }
  end(body = "") { this.body = body; this.finished = true; }
}

async function invoke(handler, requestInit) {
  const res = new MockResponse();
  await handler(new MockRequest(requestInit), res);
  return {
    status: res.statusCode,
    body: res.body ? JSON.parse(res.body) : null,
  };
}

const baseHeaders = { origin: "http://localhost:5173", host: "localhost:3001" };

// --- absent-config group: imported with CLERK_JWT_KEY unset ------------------
// Guarantees the "external auth configuration is absent" branch is exercised
// through the real entrypoint, producing an explicit, asserted 503 rather than
// an unexplained failure.
delete process.env.CLERK_JWT_KEY;
const liOauthUnconfigured = (await import("../api/li-oauth.js")).default;

test("route-smoke: /api/health responds 200 through the deployed entrypoint", async () => {
  const health = (await import("../api/health.js")).default;
  const res = await invoke(health, { method: "GET", url: "/api/health", headers: baseHeaders });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test("route-smoke: /api/li-oauth returns an explicit 503 when server auth is unconfigured", async () => {
  const res = await invoke(liOauthUnconfigured, {
    method: "GET",
    url: "/api/li-oauth",
    headers: baseHeaders,
  });
  assert.equal(res.status, 503);
  assert.ok(typeof res.body.error === "string" && /not configured/i.test(res.body.error));
});

// --- auth-configured group: imported after CLERK_JWT_KEY is set -------------
const { publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.CLERK_JWT_KEY = publicKey.export({ type: "spki", format: "pem" }).toString("utf8");

const igOauthConfigured = (await import("../api/ig-oauth.js")).default;
const igPublishConfigured = (await import("../api/ig-publish.js")).default;

test("route-smoke: /api/ig-oauth enforces auth (401) through the deployed entrypoint", async () => {
  const res = await invoke(igOauthConfigured, {
    method: "GET",
    url: "/api/ig-oauth",
    headers: baseHeaders, // no Authorization bearer
  });
  assert.equal(res.status, 401);
  assert.ok(typeof res.body.error === "string");
});

test("route-smoke: /api/ig-publish gates publishing behind auth (401) before any Meta call", async () => {
  const res = await invoke(igPublishConfigured, {
    method: "POST",
    url: "/api/ig-publish",
    headers: baseHeaders, // no Authorization bearer
    body: { mediaType: "IMAGE", mediaUrl: "https://example.com/x.jpg", caption: "" },
  });
  assert.equal(res.status, 401);
  assert.ok(typeof res.body.error === "string");
});
