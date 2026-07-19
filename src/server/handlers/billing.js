// Billing handlers — Stripe Checkout, Customer Portal, webhook receiver,
// and the read endpoint that drives the Settings → Billing tab and
// upgrade prompts.
//
// Endpoints (mounted in app.js):
//   GET  /api/billing            — current resolved plan + raw subscription row
//   POST /api/billing/checkout   — { plan } → Stripe-hosted checkout URL
//   POST /api/billing/portal     — Stripe-hosted customer portal URL
//   POST /api/billing/webhook    — Stripe webhook (no Clerk auth, signature-verified)

import { ensureEnv, isAllowedOrigin } from "../env.js";
import { errorJson, json, readJsonBody, readRawBody } from "../http.js";
import { createLogger, sanitizeLogValue } from "../log.js";
import {
  PLANS,
  TRIAL_DAYS,
  resolveCommercialAccess,
  serializeCommercialAccess,
  BILLING_UNAVAILABLE,
} from "../entitlements.js";
import {
  loadSubscription,
  loadSubscriptionByStripeCustomer,
  upsertSubscription,
} from "../subscription-store.js";
import {
  createCheckoutSession,
  createOrRetrieveCustomer,
  createPortalSession,
  planToPriceId,
  priceIdToPlan,
  retrieveSubscription,
  verifyWebhookSignature,
} from "../stripe.js";

const logger = createLogger("rf-social-studio-api");

// Public-facing PLANS payload (no Infinity, no functions). Used by the
// /pricing page and the Settings → Billing tab to render the comparison
// table without duplicating copy.
function publicPlans() {
  return Object.values(PLANS).map((p) => ({
    id: p.id,
    label: p.label,
    priceMonthly: p.priceMonthly,
    perSeat: Boolean(p.perSeat),
    features: p.features,
    limits: Object.fromEntries(
      Object.entries(p.limits).map(([k, v]) => [k, v === Infinity ? null : v]),
    ),
  }));
}

export async function handleBillingGet(req, res, env, reqId, auth) {
  let subscription = null;
  let unavailable = false;
  try {
    subscription = await loadSubscription(env, auth.userId);
  } catch (err) {
    // Distinguish an infra failure from "no subscription": the projection
    // reports "temporarily unavailable / retry" instead of claiming Free.
    logger("warn", reqId, "billing_load_failed", { error: sanitizeLogValue(err.message) });
    unavailable = true;
  }

  const access = resolveCommercialAccess(unavailable ? BILLING_UNAVAILABLE : subscription);
  // `trialEligible` mirrors the checkout handler's trial rule exactly so the
  // client CTA ("Start 14-day trial" vs "Switch to …") can't drift from it.
  const trialEligible = !(subscription?.status === "active" || subscription?.status === "trialing");

  return json(res, 200, serializeCommercialAccess(access, {
    plans: publicPlans(),
    trialDays: TRIAL_DAYS,
    trialEligible,
    hasCustomer: Boolean(subscription?.stripe_customer_id),
    rawStatus: unavailable ? null : (subscription?.status || "none"),
  }));
}

function pickReturnOrigin(req, env) {
  // Only reflect the request origin into Stripe return URLs if it's on the
  // allowlist — otherwise an attacker-set Origin/Referer could bounce the
  // user to an arbitrary domain after checkout. Fall back to appBaseUrl.
  const raw = String(req.headers.origin || req.headers.referer || "").trim();
  if (raw) {
    try {
      const origin = new URL(raw).origin;
      if (isAllowedOrigin(env, origin)) return origin;
    } catch { /* fall through to appBaseUrl */ }
  }
  return env.appBaseUrl || "";
}

export async function handleBillingCheckout(req, res, env, reqId, auth) {
  const envCheck = ensureEnv(env, ["stripeSecretKey"]);
  if (!envCheck.ok) {
    return errorJson(res, 503, "SERVER_ERROR", "Billing is not configured", { missing: envCheck.missing });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorJson(res, error.code || 400, "VALIDATION_ERROR", error.message);
  }

  const plan = String(body?.plan || "").toLowerCase();
  if (plan !== "essentials" && plan !== "team") {
    return errorJson(res, 400, "VALIDATION_ERROR", "plan must be 'essentials' or 'team'");
  }
  const priceId = planToPriceId(env, plan);
  if (!priceId) {
    return errorJson(res, 503, "SERVER_ERROR", `Stripe price ID is not configured for plan '${plan}'`);
  }

  const origin = pickReturnOrigin(req, env);
  if (!origin) {
    return errorJson(res, 400, "VALIDATION_ERROR", "Cannot determine return URL");
  }

  try {
    const existing = await loadSubscription(env, auth.userId);
    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await createOrRetrieveCustomer(env, {
        ownerUserId: auth.userId,
        email: auth.email || body?.email || undefined,
        name: auth.name || body?.name || undefined,
      });
      customerId = customer.id;
      await upsertSubscription(env, auth.userId, { stripe_customer_id: customerId });
    }

    const trialDays = existing?.status === "active" || existing?.status === "trialing"
      ? 0
      : TRIAL_DAYS;

    const session = await createCheckoutSession(env, {
      customerId,
      priceId,
      ownerUserId: auth.userId,
      successUrl: `${origin}/?billing=success`,
      cancelUrl: `${origin}/?billing=cancel`,
      trialDays,
    });

    return json(res, 200, { url: session.url });
  } catch (error) {
    logger("error", reqId, "billing_checkout_failed", { error: sanitizeLogValue(error.message) });
    return errorJson(res, 502, "BILLING_ERROR", "Could not start checkout");
  }
}

export async function handleBillingPortal(req, res, env, reqId, auth) {
  const envCheck = ensureEnv(env, ["stripeSecretKey"]);
  if (!envCheck.ok) {
    return errorJson(res, 503, "SERVER_ERROR", "Billing is not configured", { missing: envCheck.missing });
  }

  let subscription;
  try {
    subscription = await loadSubscription(env, auth.userId);
  } catch (error) {
    logger("error", reqId, "billing_portal_load_failed", { error: sanitizeLogValue(error.message) });
    return errorJson(res, 503, "SERVER_ERROR", "Billing is temporarily unavailable");
  }
  if (!subscription?.stripe_customer_id) {
    return errorJson(res, 404, "NO_CUSTOMER", "No billing account exists for this user yet");
  }

  const origin = pickReturnOrigin(req, env);
  if (!origin) {
    return errorJson(res, 400, "VALIDATION_ERROR", "Cannot determine return URL");
  }

  try {
    const session = await createPortalSession(env, {
      customerId: subscription.stripe_customer_id,
      returnUrl: `${origin}/?billing=return`,
    });
    return json(res, 200, { url: session.url });
  } catch (error) {
    logger("error", reqId, "billing_portal_failed", { error: sanitizeLogValue(error.message) });
    return errorJson(res, 502, "BILLING_ERROR", "Could not open billing portal");
  }
}

// Webhook idempotency + ordering decision (pure, unit-tested). Stripe delivers
// at-least-once and does NOT guarantee order, so:
//   • a repeat of the last-applied event id is a duplicate → skip;
//   • an event created before the last-applied one is out of order → skip, so
//     a delayed older event cannot overwrite newer authoritative state.
// `existing` is the stored row (or null). Event identity/timestamp come from
// the Stripe event envelope, which is durable and provider-owned.
export function decideStripeEvent({ existing, eventId, eventCreated }) {
  if (existing && eventId && existing.last_stripe_event_id === eventId) {
    return { apply: false, reason: "duplicate" };
  }
  const prev = Number(existing?.last_stripe_event_created);
  if (existing && Number.isFinite(prev) && Number.isFinite(eventCreated) && eventCreated < prev) {
    return { apply: false, reason: "out_of_order" };
  }
  return { apply: true, reason: "ok" };
}

// Maps a Stripe subscription object to the columns we persist.
export function fieldsFromStripeSubscription(env, sub) {
  const priceId = sub?.items?.data?.[0]?.price?.id;
  const plan = priceIdToPlan(env, priceId) || "free";
  return {
    plan,
    status: sub.status || "none",
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId || null,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  };
}

export async function handleBillingWebhook(req, res, env, reqId) {
  const envCheck = ensureEnv(env, ["stripeSecretKey", "stripeWebhookSecret"]);
  if (!envCheck.ok) {
    return errorJson(res, 503, "SERVER_ERROR", "Webhook is not configured", { missing: envCheck.missing });
  }

  const rawBody = await readRawBody(req).catch(() => null);
  if (!rawBody) return errorJson(res, 400, "VALIDATION_ERROR", "Empty body");

  const verified = await verifyWebhookSignature({
    rawBody,
    signatureHeader: String(req.headers["stripe-signature"] || ""),
    secret: env.stripeWebhookSecret,
  });
  if (!verified) return errorJson(res, 400, "BAD_SIGNATURE", "Webhook signature did not verify");

  let event;
  try { event = JSON.parse(rawBody); } catch { return errorJson(res, 400, "VALIDATION_ERROR", "Invalid JSON"); }

  try {
    const type = event.type;
    const obj = event.data?.object;
    const eventId = event.id || null;
    const eventCreated = Number.isFinite(event.created) ? event.created : null;

    // Resolve owner user ID — checkout carries it via metadata or
    // client_reference_id; subscription updates carry it via metadata.
    const ownerUserIdFromObj = obj?.metadata?.ownerUserId
      || obj?.client_reference_id
      || obj?.subscription_details?.metadata?.ownerUserId
      || null;

    // Load the existing row once (by customer) — used both to resolve the
    // owner when the event lacks metadata AND for idempotency/ordering.
    let existing = null;
    if (obj?.customer) {
      existing = await loadSubscriptionByStripeCustomer(env, obj.customer);
    }
    let ownerUserId = ownerUserIdFromObj || existing?.owner_user_id || null;

    // Duplicate or out-of-order → acknowledge (200 so Stripe stops retrying)
    // without touching authoritative state.
    const decision = decideStripeEvent({ existing, eventId, eventCreated });
    if (!decision.apply) {
      logger("info", reqId, "webhook_skipped", { type, reason: decision.reason, eventId });
      return json(res, 200, { received: true, skipped: decision.reason });
    }

    const eventFields = {
      last_stripe_event_id: eventId,
      last_stripe_event_created: eventCreated,
    };

    if (type === "checkout.session.completed") {
      if (!ownerUserId) {
        logger("warn", reqId, "webhook_no_owner", { type, sessionId: obj?.id });
        return json(res, 200, { received: true });
      }
      const subscriptionId = obj?.subscription;
      if (subscriptionId) {
        const sub = await retrieveSubscription(env, subscriptionId);
        await upsertSubscription(env, ownerUserId, {
          stripe_customer_id: obj?.customer || sub?.customer,
          ...fieldsFromStripeSubscription(env, sub),
          ...eventFields,
        });
      }
    } else if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      if (!ownerUserId) {
        logger("warn", reqId, "webhook_no_owner", { type, subId: obj?.id });
        return json(res, 200, { received: true });
      }
      const fields = fieldsFromStripeSubscription(env, obj);
      if (type === "customer.subscription.deleted") {
        fields.plan = "free";
        fields.status = "canceled";
      }
      await upsertSubscription(env, ownerUserId, {
        stripe_customer_id: obj?.customer,
        ...fields,
        ...eventFields,
      });
    }

    return json(res, 200, { received: true });
  } catch (error) {
    logger("error", reqId, "webhook_handle_failed", { error: sanitizeLogValue(error.message) });
    return errorJson(res, 500, "SERVER_ERROR", "Webhook handler failed");
  }
}
