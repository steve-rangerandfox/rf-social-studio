# Stripe billing setup

Three-tier subscription billing (Free / Essentials / Team) wired through
Stripe Checkout + Customer Portal. The free tier needs no setup; the two
paid tiers require Stripe configuration before the upgrade flow works.

## 1. Run the migration

```bash
psql $DATABASE_URL < migrations/004_subscriptions.sql
```

Creates a `subscriptions` table keyed on Clerk `owner_user_id`. RLS is
on; everything goes through the service-role API.

## 2. Create the Stripe products

In the Stripe dashboard (Products → +Add product), create two recurring
products:

| Product       | Price        | Billing            |
| ------------- | ------------ | ------------------ |
| Essentials    | $5 / month   | Recurring monthly  |
| Team          | $10 / month  | Recurring monthly per seat |

Copy each price ID (`price_...`) — you'll need them in step 4.

## 3. Configure the webhook

Stripe dashboard → Developers → Webhooks → +Add endpoint.

- **Endpoint URL**: `https://<your-domain>/api/billing/webhook`
- **Events to send** (at minimum):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

After saving, copy the signing secret (`whsec_...`).

## 4. Set the env vars

Add to your Vercel project (and to local `.env` for dev):

```
STRIPE_SECRET_KEY=sk_live_...           # or sk_test_... in dev
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ESSENTIALS=price_...
STRIPE_PRICE_TEAM=price_...
APP_BASE_URL=https://your-domain.tld    # used for checkout success/cancel URLs when Origin can't be trusted
```

## 5. Enable the customer portal

Stripe dashboard → Settings → Billing → Customer portal:
- Toggle on "Allow customers to update payment methods, cancel
  subscriptions, switch plans".
- Add Essentials and Team as switchable products so users can move
  between tiers from inside the portal.

## 6. Verify end-to-end

1. Sign in to the app, open Settings → Billing.
2. Click "Start 14-day trial" on Essentials. You should land on
   Stripe-hosted checkout.
3. Complete checkout with a [test card](https://docs.stripe.com/testing).
4. After the redirect back, Settings → Billing should show "Trial · ends
   <date>".
5. From the same screen, click "Manage billing" to confirm the portal
   opens.

## How the gate works

- `src/server/entitlements.js` defines what each tier can do.
- `src/server/handlers/captions.js` looks up the subscription before
  calling Anthropic; if the tier doesn't include the requested feature,
  the API returns `402 PLAN_UPGRADE_REQUIRED`.
- The client (`src/lib/api-client.js`) catches that status and
  dispatches a `rf:plan-upgrade-required` event. `StudioApp.jsx`
  listens, shows a warning toast, and offers an Upgrade action that
  drops the user into Settings → Billing.

## Plan tiers

| Feature                       | Free | Essentials | Team |
| ----------------------------- | ---- | ---------- | ---- |
| Scheduled posts               | 5    | 100        | ∞    |
| Connected accounts            | 1    | 3          | ∞    |
| AI captions                   | —    | ✓          | ✓    |
| Cross-post variants           | —    | ✓          | ✓    |
| Brand learning from URL       | —    | ✓          | ✓    |
| Monthly strategy generator    | —    | —          | ✓    |
| Seats included                | 1    | 1          | 3    |
