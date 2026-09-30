const Stripe = require("stripe");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { keysBasedOnEnv } = require("../utility/envUtils");
const { hasSiteProAccess } = require("../utility/entitlements");
const {
  STRIPE_PLANS,
  SITE_PLAN_KEY,
  getPriceId,
} = require("../utility/stripePlans");

// Phase 12 billing (docs/billing-design.md). This service only *starts* a
// purchase and opens the portal -- it never writes `companies.tier`. The
// Stripe webhook (12d) is the single writer of the tier, so a redirect back
// from Checkout can never grant a plan.

let stripeClient;
// Built lazily so requiring this module never needs the secret key (tests, and
// environments that haven't configured billing yet).
const getStripe = () => {
  if (!stripeClient) {
    stripeClient = new Stripe(keysBasedOnEnv().stripe.secretKey);
  }
  return stripeClient;
};

// Reads the billing columns directly rather than via companies.getById: that
// returns the *effective* tier (sponsorship-adjusted), and billing needs the
// company's own real subscription state.
const getBillingState = async (companyId) => {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "name, tier, stripe_customer_id, stripe_subscription_id, subscription_status, billing_interval, current_period_end",
    )
    .eq("id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Company not found", 404, { cause: error });
    }
    throw new AppError("Could not load the company", 502, { cause: error });
  }

  return {
    name: data.name,
    tier: data.tier,
    customerId: data.stripe_customer_id,
    subscriptionId: data.stripe_subscription_id,
    subscriptionStatus: data.subscription_status,
    billingInterval: data.billing_interval,
    currentPeriodEnd: data.current_period_end,
  };
};

// What Settings -> Billing shows. Deliberately omits Stripe ids.
const getBillingSummary = async (companyId) => {
  const billing = await getBillingState(companyId);
  return {
    hasBillingAccount: Boolean(billing.customerId),
    subscriptionStatus: billing.subscriptionStatus,
    billingInterval: billing.billingInterval,
    currentPeriodEnd: billing.currentPeriodEnd,
  };
};

const hasLiveSubscription = ({ subscriptionId, subscriptionStatus }) =>
  Boolean(subscriptionId) && subscriptionStatus !== "canceled";

const saveCustomerId = async (companyId, customerId) => {
  const { error } = await supabase
    .from("companies")
    .update({ stripe_customer_id: customerId })
    .eq("id", companyId);

  if (error) {
    throw new AppError("Could not save the billing account", 502, {
      cause: error,
    });
  }
};

// Runs a Stripe call and turns any SDK failure into a 502 (the original error
// is kept in `cause`; errorHandler masks 5xx messages from the client).
const callStripe = async (message, fn) => {
  try {
    return await fn();
  } catch (error) {
    throw new AppError(message, 502, { cause: error });
  }
};

// The company's Stripe customer, created on first purchase. Company and Site
// Pro subscriptions share it so one Customer Portal manages all of them.
const ensureCustomerId = async ({ companyId, email, billing }, stripe) => {
  if (billing.customerId) return billing.customerId;

  const customer = await callStripe("Could not create the billing account", () =>
    stripe.customers.create({
      email,
      name: billing.name,
      metadata: { companyId },
    }),
  );
  await saveCustomerId(companyId, customer.id);
  return customer.id;
};

const createCheckoutSession = async (
  { companyId, companyType, email, planKey, interval },
  stripe = getStripe(),
) => {
  const plan = STRIPE_PLANS[planKey];
  if (!plan) {
    throw new AppError("Unknown plan", 400);
  }
  if (plan.companyType !== companyType) {
    throw new AppError("That plan is not available for your account type", 403);
  }

  const price = getPriceId(planKey, interval);
  if (!price) {
    throw new AppError("Billing is not configured for that plan", 500);
  }

  const billing = await getBillingState(companyId);
  if (hasLiveSubscription(billing)) {
    throw new AppError(
      "Your company already has a subscription. Use Manage billing to change it.",
      409,
      { data: { code: "ALREADY_SUBSCRIBED" } },
    );
  }

  const customerId = await ensureCustomerId(
    { companyId, email, billing },
    stripe,
  );

  const { clientUrl } = keysBasedOnEnv();
  const session = await callStripe("Could not start checkout", () =>
    stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: companyId,
      subscription_data: { metadata: { companyId } },
      allow_promotion_codes: true,
      success_url: `${clientUrl}/settings?checkout=success`,
      cancel_url: `${clientUrl}/settings?checkout=cancel`,
    }),
  );

  return { url: session.url };
};

// GC Site Pro: one subscription per jobsite. Unlike the company checkout there
// is no ALREADY_SUBSCRIBED guard, but a GC already on Portfolio is refused
// (COVERED_BY_PORTFOLIO). The jobsite id rides in the subscription metadata so
// the webhook can flip that one site's plan.
const createSiteCheckoutSession = async (
  { companyId, companyType, email, jobsiteId, interval },
  stripe = getStripe(),
) => {
  if (companyType !== "gc") {
    throw new AppError("Site Pro is only available for general contractors", 403);
  }

  const price = getPriceId(SITE_PLAN_KEY, interval);
  if (!price) {
    throw new AppError("Billing is not configured for Site Pro", 500);
  }

  const { data: jobsite, error } = await supabase
    .from("jobsites")
    .select("id, plan, status, archived_at")
    .eq("id", jobsiteId)
    .eq("gc_company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new AppError("Could not load the jobsite", 502, { cause: error });
  }
  if (!jobsite) {
    throw new AppError("Jobsite not found", 404);
  }
  if (jobsite.archived_at || jobsite.status !== "active") {
    throw new AppError("Only active jobsites can be upgraded", 409);
  }
  if (jobsite.plan === "site_pro") {
    throw new AppError("This jobsite is already on Site Pro", 409, {
      data: { code: "ALREADY_SITE_PRO" },
    });
  }

  const billing = await getBillingState(companyId);
  // Portfolio already includes Site Pro on every site; selling one would bill
  // the GC twice for the same thing.
  if (hasSiteProAccess({ sitePlan: null, companyTier: billing.tier })) {
    throw new AppError("GC Portfolio already covers this jobsite", 409, {
      data: { code: "COVERED_BY_PORTFOLIO" },
    });
  }
  const customerId = await ensureCustomerId({ companyId, email, billing }, stripe);

  const { clientUrl } = keysBasedOnEnv();
  const session = await callStripe("Could not start checkout", () =>
    stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: companyId,
      subscription_data: {
        metadata: { companyId, jobsiteId, kind: "site_pro" },
      },
      allow_promotion_codes: true,
      success_url: `${clientUrl}/projects?siteCheckout=success&jobsiteId=${jobsiteId}`,
      cancel_url: `${clientUrl}/projects?siteCheckout=cancel`,
    }),
  );

  return { url: session.url };
};

const createPortalSession = async ({ companyId }, stripe = getStripe()) => {
  const { customerId } = await getBillingState(companyId);
  if (!customerId) {
    throw new AppError("No billing account yet", 404);
  }

  const { clientUrl } = keysBasedOnEnv();
  const session = await callStripe("Could not open billing", () =>
    stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${clientUrl}/settings`,
    }),
  );

  return { url: session.url };
};

module.exports = {
  getStripe,
  getBillingState,
  getBillingSummary,
  createCheckoutSession,
  createSiteCheckoutSession,
  createPortalSession,
};
