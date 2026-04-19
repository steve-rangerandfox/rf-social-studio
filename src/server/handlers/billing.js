// Billing handlers — Stripe Checkout, Customer Portal, webhook receiver,
// and the read endpoint that drives the Settings → Billing tab and
// upgrade prompts.
//
// Endpoints (mounted in app.js):
//   GET  /api/billing            — current resolved plan + raw subscription row
//   POST /api/billing/checkout   — { plan } → Stripe-hosted checkout URL
//   POST /api/billing/portal     — Stripe-hosted customer portal URL
//   POST /api/billing/webhook    — Stripe webhook (no Clerk auth, signature-verified)

import { ensureEnv } from "../env.js";
import { errorJson, json, readJsonBody, readRawBody } from "../http.js";
import { createLogger, sanitizeLogValue } from "../log.js";
import { PLANS, TRIAL_DAYS, resolvePlan } from "../entitlements.js";
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
  const subscription = await loadSubscription(env, auth.userId).catch((err) => {
    logger("warn", reqId, "billing_load_failed", { error: sanitizeLogValue(err.message) });
    return null;
  });
  const plan = resolvePlan(subscription);
  return json(res, 200, {
    plan: plan.id,
    status: subscription?.status || "none",
    trialEnd: subscription?.trial_end || null,
    currentPeriodEnd: subscription?.current_period_end || null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    plans: publicPlans(),
    trialDays: TRIAL_DAYS,
  });
}

function pickReturnOrigin(req, env) {
  const origin = String(req.headers.origin || req.headers.referer || "").trim();
  if (origin) {
    try { return new URL(origin).origin; } catch { /* fall through */ }
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

  const subscription = await loadSubscription(env, auth.userId);
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

// Maps a Stripe subscription object to the columns we persist.
function fieldsFromStripeSubscription(env, sub) {
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

    // Resolve owner user ID — checkout carries it via metadata or
    // client_reference_id; subscription updates carry it via metadata.
    const ownerUserIdFromObj = obj?.metadata?.ownerUserId
      || obj?.client_reference_id
      || obj?.subscription_details?.metadata?.ownerUserId
      || null;

    let ownerUserId = ownerUserIdFromObj;
    if (!ownerUserId && obj?.customer) {
      const existing = await loadSubscriptionByStripeCustomer(env, obj.customer);
      ownerUserId = existing?.owner_user_id || null;
    }

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
      });
    }

    return json(res, 200, { received: true });
  } catch (error) {
    logger("error", reqId, "webhook_handle_failed", { error: sanitizeLogValue(error.message) });
    return errorJson(res, 500, "SERVER_ERROR", "Webhook handler failed");
  }
}
