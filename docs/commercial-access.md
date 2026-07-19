# Commercial Access

The single, server-owned contract that decides what a Relay account may do
commercially — feature entitlement, connection/seat limits, protected-action
policy, and every billing/upgrade surface.

## Canonical owner

`src/server/commercial-access.js` — a **pure, deterministic resolver**:

```js
resolveCommercialAccess(subscription, { now = Date.now() }) -> AccessResult
```

- **Inputs**: the normalized `subscriptions` row (or `null` for no row, or the
  `BILLING_UNAVAILABLE` sentinel when the store could not be read) and an
  explicit `now` (epoch ms). `now` is injectable so boundary behavior is
  unit-testable without real time.
- **Output** (`AccessResult`): `state`, `planId`, `planLabel`, `accessLevel`
  (`paid|trial|grace|complimentary|free`), `paidAccess`, `reason`, `features`,
  `limits {connections, seats, scheduledPosts}`, `trialEnd`, `graceEnd`,
  `paidThroughEnd`, `complimentary`, `cancelAtPeriodEnd`, `userAction`,
  `dataQuality`, `accountManagement`.

Features/limits always come from the **effective** plan (Free once access has
lapsed), so no caller re-derives them.

`entitlements.js` re-exports the plan catalogue (`PLANS`, `PLAN_ORDER`,
`TRIAL_DAYS`, `GRACE_DAYS`) and the backward-compatible helpers
`resolvePlan` / `can` / `limit` / `minPlanForFeature` — all delegate to the
resolver. There is no second resolver.

## Stripe-owned facts vs Relay-owned policy

| Stripe owns (facts) | Relay owns (policy) |
| --- | --- |
| `status`, `trial_end`, `current_period_end`, `cancel_at_period_end`, price→plan | grace **duration** and boundary, paid-through boundary, **precedence**, malformed/unavailable fallback, trial equivalence |

We never read policy out of a raw status alone: `past_due` is not "access", it
is "access *if* still inside the Relay grace window."

## Account-state matrix

`now`-relative. Boundaries are **exclusive of access** (access ends *at* the
timestamp). All lapsed states fall back to the **Free tier** — there is no hard
lockout; read, export, and account management always remain.

| State | Inputs | accessLevel | Effective plan | reason | userAction |
| --- | --- | --- | --- | --- | --- |
| `none` | no row / status none / plan free | free | free | NO_SUBSCRIPTION | none |
| `trialing` | status trialing, `now < trial_end` | trial | claimed | OK | none |
| `trial_expired` | status trialing, `now >= trial_end` | free | free | TRIAL_EXPIRED | upgrade |
| `active` | status active, not canceling | paid | claimed | OK | none |
| `active_canceling` | status active, `cancel_at_period_end`, `now < period_end` | paid | claimed | OK | resubscribe |
| `canceled_expired` | status active, `cancel_at_period_end`, `now >= period_end` | free | free | SUBSCRIPTION_CANCELED | resubscribe |
| `past_due_grace` | status past_due, `now < period_end + 7d` | grace | claimed | OK | update_payment |
| `past_due_expired` | status past_due, `now >= period_end + 7d` (or no period_end) | free | free | PAYMENT_PAST_DUE_EXPIRED | update_payment |
| `canceled` | status canceled | free | free | SUBSCRIPTION_CANCELED | resubscribe |
| `paused` | status paused | free | free | SUBSCRIPTION_PAUSED | update_payment |
| `expired` | status unpaid/incomplete/incomplete_expired | free | free | NO_SUBSCRIPTION | upgrade |
| `complimentary` | `comp: true` | complimentary | team | OK | none |
| `malformed` | unknown plan/status or unparseable date | free | free | BILLING_DATA_MALFORMED | retry |
| `unavailable` | store read failed | free | free | BILLING_UNAVAILABLE | retry |

### Precedence (highest first)

1. **Complimentary** (`comp: true`) overrides all Stripe state, no expiry.
2. **Malformed / unrecognized** data fails safe to Free (flagged), never a grant.
3. **Active paid / trial / past-due grace** grant the claimed plan.
4. Everything else → Free.

Specific tie-breaks: active paid beats a stale trial; the `cancel_at_period_end`
+ `current_period_end` **paid-through boundary** is authoritative over the
eventual `subscription.deleted` webhook; a Relay grace deadline is authoritative
over a lingering `past_due` status.

## Lifecycle semantics

- **Trial**: 14 days (`TRIAL_DAYS`), granted at checkout only when the account
  is not already active/trialing. `trial_end` comes from Stripe. A trial grants
  the **full** capabilities of the chosen plan. Expiry is device/refresh
  independent (server-evaluated against `now`).
- **Past-due grace**: `GRACE_DAYS = 7`, anchored to `current_period_end + 7d`
  (the durable Stripe paid-through timestamp) — **not** webhook arrival time.
  During grace the plan's entitlements hold and the user is prompted to update
  payment; after it, Free. If `current_period_end` is absent, **no grace** is
  fabricated. Restoring payment (Stripe flips status back to `active` and
  advances `current_period_end`) restores access automatically.
- **Cancellation**: `cancel_at_period_end` keeps full access until
  `current_period_end`, then Free — even before `subscription.deleted` arrives.
  Removing the cancellation before expiry returns to `active`. Immediate
  cancellation (`subscription.deleted`) drops to Free at once.
- **Complimentary**: granted via `COMP_TEAM_USER_IDS` (env, comma-separated,
  case-sensitive Clerk ids) → synthetic `{ plan: team, comp: true }`, highest
  precedence, no expiry, no Stripe row required.

## Webhook integrity (`handleBillingWebhook`)

Signature-verified (5-min tolerance). Idempotency + ordering via
`decideStripeEvent`, persisted per row in `last_stripe_event_id` /
`last_stripe_event_created` (migration 005):

- duplicate of the last-applied event id → skip (ack 200);
- event `created` earlier than the last applied → skip, so a delayed older
  event cannot overwrite newer authoritative state;
- same-second events with distinct ids still apply.

Malformed JSON / bad signature → 4xx. Provider unavailability never silently
grants access (reads fail closed to Free, flagged `unavailable`).

## Enforcement owners

- **Feature access (server-enforced)**: `POST /api/captions` gates each AI
  intent via `can(subscription, feature)` → `402 PLAN_UPGRADE_REQUIRED`. This is
  the protected mutation guarded by commercial access; it never trusts
  client-supplied entitlement.
- **Client presentation**: `GET /api/billing` returns
  `serializeCommercialAccess(...)`; Settings → Billing renders the server's
  `statusLine`, `canManageBilling`, `trialEligible`, and `limits`. The client
  does **not** recompute policy from raw Stripe fields.
- **Publishing / background jobs**: publishing is a Free-tier capability, and
  every lapsed state falls back to Free (which still publishes), so no
  commercial denial is applied on the publish or scheduled-worker paths. The
  only commercial gate on content is AI generation, enforced synchronously at
  request time.

## Known limitations (follow-ups, not in this contract)

- **Connection limits** (`limits.connections`) and **seat limits**
  (`limits.seats`) are represented in the contract and surfaced in the Billing
  tab, but are **not hard-enforced server-side**. Connections live split across
  an encrypted session cookie and a best-effort durable token store, so a
  reliable server-side count needs a unified connection registry first. Team
  seats are client-only (`localStorage`), with no server team model. Both are
  scoped follow-ups.

## Tests

- `src/server/__tests__/commercial-access.test.js` — full state matrix,
  boundary semantics, transitions, and enforcement through the real
  `can`/`limit`/`resolvePlan` helpers and the client projection.
- `src/server/__tests__/billing-events.test.js` — webhook idempotency/ordering
  (`decideStripeEvent`) and Stripe→column mapping.
- `src/server/__tests__/subscription-comp.test.js` — complimentary access.

## Operational note

Live Stripe webhook delivery, real dunning timing, and portal/checkout flows
are exercised against Stripe and are **not** covered by these deterministic
tests.
