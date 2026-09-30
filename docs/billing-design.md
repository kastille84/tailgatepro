# Billing design (Phase 12)

Stripe subscriptions for company plans: Trade Pro, Trade Enterprise, GC Portfolio (10 sites / unlimited), monthly and annual. Per-jobsite GC Site Pro (`jobsites.plan`), SMS nudges and integrations are out of scope for this milestone.

**Principle:** `companies.tier` is written only by the Stripe webhook. Checkout and the client's success redirect never grant a plan.

## Plans and prices

Plan keys (`server/utility/stripePlans.js`) are finer-grained than `client/src/data/plans.ts` because Portfolio is sold as two prices.

| Plan key | Company type | Tier written | Stripe products |
| :--- | :--- | :--- | :--- |
| `trade-pro` | subcontractor | `premium` | monthly + annual price |
| `trade-enterprise` | subcontractor | `enterprise` | monthly + annual price |
| `gc-portfolio-10` | gc | `premium` | monthly + annual price |
| `gc-portfolio-unlimited` | gc | `enterprise` | monthly + annual price |

Price ids come from env vars (`STRIPE_PRICE_*`, `_PROD` suffix in production), mapped in `server/utility/envUtils.js`. Every `companyType` + `tier` pair must exist in `PLAN_LIMITS` (`server/utility/entitlements.js`); `stripePlans.test.js` enforces this.

## Endpoints

| Endpoint | Auth | Purpose |
| :--- | :--- | :--- |
| `POST /api/stripe/checkout-session` | manager (`admin`, `safety_manager`) | Body `{ planId, interval }`. Returns `{ url }` for hosted Checkout. 403 wrong company type, 409 `ALREADY_SUBSCRIBED` when a live subscription exists (use the portal instead), 500 if the price env var is unset |
| `GET /api/stripe/billing` | manager | `{ hasBillingAccount, subscriptionStatus, billingInterval, currentPeriodEnd }` for Settings → Billing (no Stripe ids) |
| `POST /api/stripe/portal-session` | manager | Returns `{ url }` for the Customer Portal. 404 if the company has no Stripe customer yet |
| `POST /webhook/stripe` | Stripe signature | Raw body, mounted before `bodyParser.json()` in `server.js` |

## Webhook

1. Verify the signature over the raw body (400 on failure).
2. Skip the event if its id is already in `stripe_events`.
3. Resolve the event to one subscription and **re-fetch it from Stripe**, then write the current state. This makes duplicate and out-of-order deliveries converge on the latest truth.
4. Record the event id **after** success. A failed handler returns 500 and Stripe retries.

| Event | Subscription used |
| :--- | :--- |
| `checkout.session.completed` | `session.subscription` (subscription mode only) |
| `customer.subscription.created` / `updated` / `deleted` | `event.data.object.id` |
| `invoice.payment_failed` | `invoice.subscription` |

| Stripe status | `companies.tier` | Notes |
| :--- | :--- | :--- |
| `active`, `trialing` | tier from `resolvePrice(priceId)` | also sets `billing_interval`, `current_period_end` |
| `past_due` | unchanged | grace period while Stripe retries the payment |
| `canceled`, `unpaid`, `incomplete_expired` | `basic` | subscription id kept with status `canceled`, so a new checkout is allowed |
| `incomplete` | unchanged | status recorded only |

Safety rules: an unrecognized price, or a plan whose company type doesn't match the company, changes nothing. A late event for an old subscription never downgrades a company that has since bought a new one.

## Client flow

```
/pricing (visitor)  -> /signup?plan=&interval=  -> /checkout?plan=&interval=  -> Stripe Checkout
/pricing (manager)  ----------------------------> /checkout?plan=&interval=  -> Stripe Checkout
Stripe success      -> /settings?checkout=success -> poll GET /api/stripe/billing until active
```

- `/checkout` (behind `RequireAuth`) validates the params, starts the session once, and shows inline errors. A 409 `ALREADY_SUBSCRIBED` redirects to Settings.
- When email confirmation is on, Signup saves the choice in `localStorage` (`tailgatepro.pendingCheckout`, expires after 24h) and Login resumes it after the first sign-in. `/checkout` clears it.
- Pricing CTAs are decided in `client/src/utils/pricingCtas.ts`: GC Portfolio shows two buttons (10 sites / unlimited), GC Site Pro stays on the waitlist, and the UI hides options the server would reject (wrong company type, non-manager).
- `?checkout=success` is not proof of payment; `useCheckoutReturn` waits (up to 30s) for the webhook to mark the subscription active, then refreshes the current user.

## Downgrade policy

When a company drops to `basic`, nothing is deleted. Existing foremen, jobsites and history stay, but limits already apply to new adds (`server/services/seats.js`, `jobsites.js`) and to feature gates (branding, translation, history window), so the company can't grow back past the Free limits.

## Local testing

1. Run the server, then `stripe listen --forward-to localhost:5000/webhook/stripe`.
2. Put the printed `whsec_...` in `STRIPE_WEBHOOK_SECRET` and restart the server.
3. Pay with test card `4242 4242 4242 4242`; failed payment: `4000 0000 0000 0341`.
4. Replay with `stripe events resend <evt_id>` to confirm idempotency.

The `whsec_...` printed by `stripe listen` is a different secret from the one on a Dashboard webhook endpoint. The CLI one only works locally.

## Going live

> **Don't forget the webhook.** `stripe listen` stands in for a registered endpoint in test mode, so nothing in local testing reminds you. Without the live endpoint, payments succeed but `companies.tier` never changes.

- [ ] **Register the webhook endpoint in the live-mode Dashboard** (Developers -> Webhooks -> Add endpoint). URL `https://<api-domain>/webhook/stripe`. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- [ ] Copy that endpoint's signing secret (`whsec_...`, not the CLI's) into `STRIPE_WEBHOOK_SECRET_PROD`.
- [ ] Put the live secret key in `STRIPE_SECRET_KEY_PROD`.
- [ ] Recreate the 4 products and 8 prices in live mode, then set the 8 `STRIPE_PRICE_*_PROD` vars.
- [ ] Configure the live-mode Customer Portal (cancel, update payment method, invoice history).
- [ ] Run the `companies` `ALTER TABLE` lines and `CREATE TABLE stripe_events` on the production database.
- [ ] Set `NODE_ENV=production` on the host and confirm all the env vars there.
- [ ] Send a test event from the Dashboard and check for a 200 response and a row in `stripe_events`.
- [ ] Make one real low-value purchase, confirm `companies.tier` changes, then cancel and refund it.

## Live-DB migration

Run the commented `ALTER TABLE companies ...` lines and the `CREATE TABLE stripe_events` block from `Supabase_SQL.sql` before using billing.
