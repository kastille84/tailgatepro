# Billing design (Phase 12)

Stripe subscriptions for company plans: Trade Pro, Trade Enterprise, GC Portfolio (10 sites / unlimited), monthly and annual. Per-jobsite GC Site Pro is covered in its own section below (Phase 12h). Integrations are out of scope; SMS nudges (Twilio) are their own design in `docs/sms-nudges-design.md`.

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
- Pricing CTAs are decided in `client/src/utils/pricingCtas.ts`: GC Portfolio shows two buttons (10 sites / unlimited), GC Site Pro sends a signed-in manager to `/projects` to pick a jobsite (see the Site Pro section), and the UI hides options the server would reject (wrong company type, non-manager).
- `?checkout=success` is not proof of payment; `useCheckoutReturn` waits (up to 30s) for the webhook to mark the subscription active, then refreshes the current user.

## GC Site Pro (Phase 12h, per jobsite)

Site Pro ($149/site/mo, $1,490/site/yr) is one subscription per jobsite and writes `jobsites.plan`, never `companies.tier`. Site subscriptions share the company's one Stripe customer, so the Customer Portal manages every subscription. Site Pro is the entry point; GC Portfolio replaces it (see "Portfolio absorbs Site Pro" below), so a Portfolio company never holds paid site subscriptions.

- **Price**: `gc-site-pro` lives in `SITE_PLAN` in `stripePlans.js`, outside `STRIPE_PLANS` (so the company checkout rejects it). Env vars `STRIPE_PRICE_GC_SITE_PRO_MONTHLY` / `_ANNUAL` (`_PROD` in production). `resolvePrice` returns `scope: "company" | "jobsite"`.
- **Endpoint**: `POST /api/stripe/site-checkout-session`, manager only, body `{ jobsiteId, interval }`. 403 not a GC, 404 jobsite not owned by the caller's company, 409 jobsite archived/completed, 409 `ALREADY_SITE_PRO`, 500 price env unset. 409 `COVERED_BY_PORTFOLIO` when the company is already on Portfolio. No `ALREADY_SUBSCRIBED` guard. The session's `subscription_data.metadata` is `{ companyId, jobsiteId, kind: "site_pro" }`; success returns to `/projects?siteCheckout=success&jobsiteId=`.
- **Webhook**: `syncSubscription` branches on `metadata.kind === "site_pro"` into `syncSiteSubscription`, which never touches company columns. It requires the jobsite's `gc_company_id` to equal `metadata.companyId`, and on `active`/`trialing` requires a `scope: "jobsite"` price. Columns written: `jobsites.plan`, `stripe_subscription_id`, `site_pro_status`, `site_pro_interval`, `site_pro_period_end`. A late end event for a superseded subscription id is ignored.
- **Cancel**: `canceled`/`unpaid`/`incomplete_expired` set the jobsite back to `free`. The jobsite is kept; it loses the Defense Bundle, PDF branding and sub sponsorship, and the GC's free-site allowance drops by one (`effectiveJobsiteLimit`), which blocks new sites but deletes nothing. `past_due` keeps the plan while Stripe retries.
- **Client**: "Upgrade to Site Pro" on each active free row in `JobsiteList` (manager only) and the "Unlock on Site Pro" sub-blur upsell both open `SiteProCheckoutModal` (monthly / annual), which calls `useSiteCheckout`. On return, `useSiteCheckoutReturn` polls the jobsite list until that jobsite reads `site_pro` (30s cap). The Pricing Site Pro CTA sends a signed-in GC manager to `/projects`.

### Portfolio absorbs Site Pro (Phase 12i)

A GC who buys Site Pro on a few sites and then finds Portfolio ($499/mo for 10 sites) cheaper should stop paying $149 per site.

- **Access is derived, not stored**: `hasSiteProAccess({ sitePlan, companyTier })` (`entitlements.js`) is true when `jobsites.plan === "site_pro"` or the company tier is `premium`/`enterprise`. `toJobsite` exposes it as `sitePro` (the list and `getOwnedJobsite` embed `companies(tier)`; create/update responses reflect the site's own plan only). The Defense Bundle gate, sub sponsorship (`sponsorship.js`) and the client's Defense Bundle / upgrade button all use it. `jobsites.plan` keeps meaning "this site pays for itself", so ending Portfolio un-writes nothing: sites without their own plan simply lose access.
- **Webhook**: when a GC company subscription is `active`/`trialing`, `cancelSiteSubscriptions` lists the company's jobsites with `plan = 'site_pro'` and a `stripe_subscription_id`, and cancels each in Stripe with `{ prorate: true, invoice_now: true }` (unused time credited to the customer balance). Each cancel returns as a `deleted` event that sets the site's `plan` to `free` via `syncSiteSubscription`. Runs after the tier write and again on every later Portfolio event; an already-canceled subscription is skipped. A Stripe or DB failure throws 502 so Stripe retries the event (the tier is already saved).
- **Checkout guard**: `createSiteCheckoutSession` returns 409 `COVERED_BY_PORTFOLIO` for a Portfolio company, so a covered site is never sold.
- **Client**: a covered site shows a "Covered by GC Portfolio" badge and the Defense Bundle button; the Site Pro upgrade button is hidden.
- Not handled: a Site Pro purchase already in flight when Portfolio activates (edge race; the next Portfolio event cancels it once its `plan` is `site_pro`).

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
- [ ] Recreate the 5 products and 10 prices in live mode (the 4 company plans plus GC Site Pro), then set the 10 `STRIPE_PRICE_*_PROD` vars.
- [ ] Configure the live-mode Customer Portal (cancel, update payment method, invoice history).
- [ ] Run the `companies` `ALTER TABLE` lines, the `jobsites` Phase 12h `ALTER TABLE` lines and `CREATE TABLE stripe_events` on the production database.
- [ ] Set `NODE_ENV=production` on the host and confirm all the env vars there.
- [ ] Send a test event from the Dashboard and check for a 200 response and a row in `stripe_events`.
- [ ] Make one real low-value purchase, confirm `companies.tier` changes, then cancel and refund it. Repeat once for a Site Pro jobsite and confirm `jobsites.plan` flips and reverts.

## Live-mode product and price table

Create these in the live Dashboard (Product catalog). Annual is 10x monthly. The unlimited-sites monthly amount ($799) is inferred from its $7,990 annual price, so confirm it before creating it.

| Product | Monthly | Annual | Env vars (`_PROD` suffix on each) |
| --- | --- | --- | --- |
| Trade Pro | $29 | $290 | `STRIPE_PRICE_TRADE_PRO_MONTHLY` / `_ANNUAL` |
| Trade Enterprise | $79 | $790 | `STRIPE_PRICE_TRADE_ENTERPRISE_MONTHLY` / `_ANNUAL` |
| GC Portfolio (10 sites) | $499 | $4,990 | `STRIPE_PRICE_GC_PORTFOLIO_10_SITES_MONTHLY` / `_ANNUAL` |
| GC Portfolio (unlimited) | $799 | $7,990 | `STRIPE_PRICE_GC_PORTFOLIO_UNLIMITED_SITES_MONTHLY` / `_ANNUAL` |
| GC Site Pro (per jobsite) | $149 | $1,490 | `STRIPE_PRICE_GC_SITE_PRO_MONTHLY` / `_ANNUAL` |

## Production env checklist (names only)

`NODE_ENV=production`, `STRIPE_SECRET_KEY_PROD`, `STRIPE_WEBHOOK_SECRET_PROD` (from the registered live endpoint, not the CLI) and the 10 `STRIPE_PRICE_*_PROD` vars above. The client origin used for Checkout return URLs is hardcoded in `server/utility/envUtils.js` (`clientUrl`), so it needs no env var. The webhook is server-to-server, so CORS does not apply to it.

## Live-DB migration

Safe to run on production before launch (every statement is additive). Paste into the Supabase SQL editor:

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_interval TEXT CHECK (billing_interval IN ('monthly', 'annual'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'site_pro'));
ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;
ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS site_pro_status TEXT;
ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS site_pro_interval TEXT CHECK (site_pro_interval IN ('monthly', 'annual'));
ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS site_pro_period_end TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
```

Source of truth stays `Supabase_SQL.sql`; if the production DB already has the `jobsites.plan` column from Phase 9b, the `IF NOT EXISTS` makes that line a no-op.
