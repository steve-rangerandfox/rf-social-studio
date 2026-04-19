// Thin Stripe REST wrapper. We avoid pulling the official SDK in to
// keep the bundle small and to stay isomorphic with our edge-friendly
// fetch-based pattern (mirrors meta.js / linkedin.js).
//
// Required env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// STRIPE_PRICE_ESSENTIALS, STRIPE_PRICE_TEAM.

const STRIPE_API = "https://api.stripe.com/v1";

function authHeader(env) {
  if (!env.stripeSecretKey) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");
  }
  return { Authorization: `Bearer ${env.stripeSecretKey}` };
}

// application/x-www-form-urlencoded with bracket notation for nested
// fields — the Stripe convention.
function formEncode(obj, prefix = "") {
  const params = new URLSearchParams();
  const append = (key, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => append(`${key}[${i}]`, item));
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) append(`${key}[${k}]`, v);
      return;
    }
    params.append(key, String(value));
  };
  for (const [k, v] of Object.entries(obj)) append(prefix ? `${prefix}[${k}]` : k, v);
  return params;
}

async function stripeFetch(env, path, { method = "GET", body, idempotencyKey } = {}) {
  const headers = { ...authHeader(env) };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";

  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers,
    body: body ? formEncode(body).toString() : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const message = json?.error?.message || `Stripe ${method} ${path} failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function createOrRetrieveCustomer(env, { email, ownerUserId, name }) {
  // Search by metadata so we don't double-create on portal/checkout retries.
  const search = await stripeFetch(env,
    `/customers/search?query=${encodeURIComponent(`metadata['ownerUserId']:'${ownerUserId}'`)}`,
  );
  if (search?.data?.length) return search.data[0];

  return stripeFetch(env, "/customers", {
    method: "POST",
    body: {
      email,
      name,
      metadata: { ownerUserId },
    },
    idempotencyKey: `customer_create_${ownerUserId}`,
  });
}

export async function createCheckoutSession(env, { customerId, priceId, ownerUserId, successUrl, cancelUrl, trialDays }) {
  const body = {
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    client_reference_id: ownerUserId,
    metadata: { ownerUserId },
    subscription_data: { metadata: { ownerUserId } },
  };
  if (trialDays && trialDays > 0) {
    body.subscription_data.trial_period_days = trialDays;
  }
  return stripeFetch(env, "/checkout/sessions", {
    method: "POST",
    body,
    idempotencyKey: `checkout_${ownerUserId}_${priceId}_${Date.now()}`,
  });
}

export async function createPortalSession(env, { customerId, returnUrl }) {
  return stripeFetch(env, "/billing_portal/sessions", {
    method: "POST",
    body: { customer: customerId, return_url: returnUrl },
  });
}

export async function retrieveSubscription(env, subscriptionId) {
  return stripeFetch(env, `/subscriptions/${subscriptionId}`);
}

// Verifies a webhook signature using the t=...,v1=... header format.
// Implements the same scheme as the official SDK (HMAC SHA-256 over
// `${timestamp}.${rawBody}`), with a default 5-minute tolerance.
export async function verifyWebhookSignature({ rawBody, signatureHeader, secret, toleranceSec = 300 }) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, ...rest] = kv.split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  );
  const timestamp = parts.t;
  const signatures = signatureHeader
    .split(",")
    .filter((kv) => kv.trim().startsWith("v1="))
    .map((kv) => kv.split("=")[1].trim());
  if (!timestamp || !signatures.length) return false;

  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isNaN(ageSec) || ageSec > toleranceSec) return false;

  const { createHmac } = await import("node:crypto");
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  // Timing-safe-ish compare across all signatures.
  return signatures.some((sig) => sig.length === expected.length && sig === expected);
}

// Maps a Stripe price ID to a plan tier using env-configured IDs.
export function priceIdToPlan(env, priceId) {
  if (!priceId) return null;
  if (priceId === env.stripePriceEssentials) return "essentials";
  if (priceId === env.stripePriceTeam) return "team";
  return null;
}

export function planToPriceId(env, plan) {
  if (plan === "essentials") return env.stripePriceEssentials;
  if (plan === "team") return env.stripePriceTeam;
  return null;
}
