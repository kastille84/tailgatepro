const Stripe = require("stripe");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { keysBasedOnEnv } = require("../utility/envUtils");
const { STRIPE_PLANS, getPriceId } = require("../utility/stripePlans");

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
      "name, stripe_customer_id, stripe_subscription_id, subscription_status, billing_interval, current_period_end",
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

  let customerId = billing.customerId;
  if (!customerId) {
    const customer = await callStripe("Could not create the billing account", () =>
      stripe.customers.create({
        email,
        name: billing.name,
        metadata: { companyId },
      }),
    );
    customerId = customer.id;
    await saveCustomerId(companyId, customerId);
  }

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
  createPortalSession,
};
