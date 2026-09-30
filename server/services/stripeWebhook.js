const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { keysBasedOnEnv } = require("../utility/envUtils");
const { resolvePrice } = require("../utility/stripePlans");
const { getStripe } = require("./stripe");

// Phase 12d (docs/billing-design.md). The Stripe webhook is the ONLY writer of
// `companies.tier`. Every relevant event resolves to one subscription, which is
// re-fetched from Stripe and written as current state, so late, duplicate or
// out-of-order deliveries all converge on the latest truth.

const ACTIVE_STATUSES = ["active", "trialing"];
// Statuses where the subscription is over: the company falls back to Free.
const ENDED_STATUSES = ["canceled", "unpaid", "incomplete_expired"];

const UNIQUE_VIOLATION = "23505";

const toIso = (seconds) => (seconds ? new Date(seconds * 1000).toISOString() : null);

// Stripe moved current_period_end from the subscription onto its items in
// newer API versions; accept either.
const periodEnd = (subscription) =>
  toIso(
    subscription.current_period_end ??
      subscription.items?.data?.[0]?.current_period_end,
  );

const isProcessed = async (eventId) => {
  const { data, error } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new AppError("Could not check the Stripe event", 502, { cause: error });
  }
  return Boolean(data);
};

const recordEvent = async (event) => {
  const { error } = await supabase
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  // A concurrent delivery of the same event already recorded it: fine.
  if (error && error.code !== UNIQUE_VIOLATION) {
    throw new AppError("Could not record the Stripe event", 502, { cause: error });
  }
};

// The subscription id an event is about, or null when the event has none to
// act on (e.g. a one-time-payment checkout).
const subscriptionIdFor = (event) => {
  const object = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
      return object.mode === "subscription" ? object.subscription : null;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return object.id;
    case "invoice.payment_failed":
      return object.subscription ?? null;
    default:
      return null;
  }
};

// metadata.companyId is set by createCheckoutSession; the customer id is the
// fallback for subscriptions created any other way.
const findCompany = async (subscription) => {
  const companyId = subscription.metadata?.companyId;
  const column = companyId ? "id" : "stripe_customer_id";
  const value = companyId ?? subscription.customer;

  const { data, error } = await supabase
    .from("companies")
    .select("id, company_type, stripe_subscription_id")
    .eq(column, value)
    .maybeSingle();

  if (error) {
    throw new AppError("Could not load the company", 502, { cause: error });
  }
  return data;
};

const syncSubscription = async (subscription) => {
  const company = await findCompany(subscription);
  if (!company) {
    console.error("[stripe] no company for subscription", subscription.id);
    return;
  }

  const { status } = subscription;
  const ended = ENDED_STATUSES.includes(status);

  // A late "deleted" for an old subscription must not downgrade a company
  // that has since bought a new one.
  if (
    ended &&
    company.stripe_subscription_id &&
    company.stripe_subscription_id !== subscription.id
  ) {
    return;
  }

  const update = {
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    current_period_end: periodEnd(subscription),
  };

  if (ACTIVE_STATUSES.includes(status)) {
    const plan = resolvePrice(subscription.items?.data?.[0]?.price?.id);
    if (!plan || plan.companyType !== company.company_type) {
      // Never grant a tier from a price we don't sell or one that doesn't
      // fit the company's type.
      console.error("[stripe] unrecognized or mismatched price", subscription.id);
      return;
    }
    update.tier = plan.tier;
    update.billing_interval = plan.interval;
  } else if (ended) {
    update.tier = "basic";
  }
  // past_due / incomplete: tier unchanged (grace period), status recorded.

  const { error } = await supabase
    .from("companies")
    .update(update)
    .eq("id", company.id);

  if (error) {
    throw new AppError("Could not update the company subscription", 502, {
      cause: error,
    });
  }
};

// Verifies the signature on the raw body, skips events already handled, syncs
// the subscription, then records the event. Recording happens last so a
// failed handler is retried by Stripe instead of being marked done.
const handleWebhook = async ({ rawBody, signature }, stripe = getStripe()) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      keysBasedOnEnv().stripe.webhookSecret,
    );
  } catch (error) {
    throw new AppError("Invalid Stripe signature", 400, { cause: error });
  }

  if (await isProcessed(event.id)) return { duplicate: true };

  const subscriptionId = subscriptionIdFor(event);
  if (subscriptionId) {
    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      throw new AppError("Could not load the Stripe subscription", 502, {
        cause: error,
      });
    }
    await syncSubscription(subscription);
  }

  await recordEvent(event);
  return { duplicate: false };
};

module.exports = { handleWebhook };
