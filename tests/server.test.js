import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import { handleApiRequest } from "../src/server/app.js";

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

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name) {
    return this.headers.get(name.toLowerCase());
  }

  end(body = "") {
    this.body = body;
    this.finished = true;
  }
}

async function runRequest(request, overrides) {
  const response = new MockResponse();
  await handleApiRequest(request, response, overrides);
  return {
    status: response.statusCode,
    headers: Object.fromEntries(response.headers.entries()),
    body: response.body ? JSON.parse(response.body) : null,
  };
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const { publicKey: clerkJwtPublicKey, privateKey: clerkJwtPrivateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

function makeClerkToken(claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: "user_test_123",
      sid: "sess_test_123",
      iss: "https://comic-liger-60.clerk.accounts.dev",
      iat: now,
      nbf: now - 5,
      exp: now + 60 * 30,
      ...claims,
    }),
  );
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), clerkJwtPrivateKey);
  return `${header}.${payload}.${signature.toString("base64url")}`;
}

const sharedEnv = {
  nodeEnv: "test",
  port: 0,
  igAppId: "test_app_id",
  igAppSecret: "test_app_secret",
  sessionSecret: "test_session_secret_123",
  allowedOrigins: new Set(["http://localhost:5173"]),
};

const verifiedEnv = {
  ...sharedEnv,
  clerkJwtKey: clerkJwtPublicKey.export({ type: "spki", format: "pem" }).toString("utf8"),
  clerkIssuer: "https://comic-liger-60.clerk.accounts.dev",
};

const userHeaders = {
  origin: "http://localhost:5173",
  host: "localhost:3001",
  "x-rf-user-id": "user_test_123",
};

const verifiedUserHeaders = {
  origin: "http://localhost:5173",
  host: "localhost:3001",
  authorization: `Bearer ${makeClerkToken()}`,
};

test("OPTIONS /api/ig-oauth returns 204", async () => {
  const res = await runRequest(
    new MockRequest({
      method: "OPTIONS",
      url: "/api/ig-oauth",
      headers: userHeaders,
    }),
    sharedEnv,
  );

  assert.equal(res.status, 204);
});

test("GET /api/ig-oauth returns authorize URL and state cookie", async () => {
  const res = await runRequest(
    new MockRequest({
      method: "GET",
      url: "/api/ig-oauth?redirectUri=http%3A%2F%2Flocalhost%3A5173",
      headers: verifiedUserHeaders,
    }),
    verifiedEnv,
  );

  assert.equal(res.status, 200);
  assert.ok(res.body.authorizeUrl.includes("api.instagram.com/oauth/authorize"));
  assert.ok(Array.isArray(res.headers["set-cookie"]));
  assert.ok(res.headers["set-cookie"][0].includes("rf_ig_oauth_state="));
});

test("POST /api/ig-oauth rejects invalid redirect URIs", async () => {
  const res = await runRequest(
    new MockRequest({
      method: "POST",
      url: "/api/ig-oauth",
      headers: verifiedUserHeaders,
      body: {
        code: "abc123",
        redirectUri: "https://evil.example.com/callback",
        state: "bad-state",
      },
    }),
    verifiedEnv,
  );

  assert.equal(res.status, 400);
  assert.ok(res.body.error.toLowerCase().includes("redirect"));
});

test("GET /api/ig-posts returns 401 when disconnected", async () => {
  const res = await runRequest(
    new MockRequest({
      method: "GET",
      url: "/api/ig-posts",
      headers: verifiedUserHeaders,
    }),
    verifiedEnv,
  );

  assert.equal(res.status, 401);
  assert.ok(typeof res.body.error === "string");
});

test("POST /api/captions returns 503 when AI configuration is missing", async () => {
  const res = await runRequest(
    new MockRequest({
      method: "POST",
      url: "/api/captions",
      headers: verifiedUserHeaders,
      body: {
        platform: "ig_post",
        prompt: "A motion design case study launch",
      },
    }),
    {
      ...verifiedEnv,
      anthropicApiKey: "",
    },
  );

  assert.equal(res.status, 503);
  assert.ok(Array.isArray(res.body.missing));
});

test("GET /api/ig-oauth requires a bearer token", async () => {
  const res = await runRequest(
    new MockRequest({
      method: "GET",
      url: "/api/ig-oauth?redirectUri=http%3A%2F%2Flocalhost%3A5173",
      headers: { origin: "http://localhost:5173", host: "localhost:3001" },
    }),
    verifiedEnv,
  );

  assert.equal(res.status, 401);
  assert.ok(res.body.error.includes("Authorization token"));
});

test("GET /api/studio-document returns 503 when persistence is not configured", async () => {
  const res = await runRequest(
    new MockRequest({
      method: "GET",
      url: "/api/studio-document",
      headers: verifiedUserHeaders,
    }),
    verifiedEnv,
  );

  assert.equal(res.status, 503);
  assert.ok(res.body.error.includes("persistence"));
});

test("GET /api/studio-document requires a bearer token when Clerk auth is configured", async () => {
  const res = await runRequest(
    new MockRequest({
      method: "GET",
      url: "/api/studio-document",
      headers: { origin: "http://localhost:5173", host: "localhost:3001" },
    }),
    verifiedEnv,
  );

  assert.equal(res.status, 401);
  assert.ok(res.body.error.includes("Authorization token"));
});

test("GET /api/ig-oauth accepts a verified Clerk bearer token", async () => {
  const res = await runRequest(
    new MockRequest({
      method: "GET",
      url: "/api/ig-oauth?redirectUri=http%3A%2F%2Flocalhost%3A5173",
      headers: verifiedUserHeaders,
    }),
    verifiedEnv,
  );

  assert.equal(res.status, 200);
  assert.ok(res.body.authorizeUrl.includes("api.instagram.com/oauth/authorize"));
});
