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

// Phase 12h: a GC Site Pro subscription belongs to one jobsite and flips only
// that jobsite's `plan`. It must never touch the company's subscription columns
// or tier -- a GC can hold a company plan and several Site Pro sites at once.
const syncSiteSubscription = async (subscription) => {
  const { jobsiteId, companyId } = subscription.metadata;

  const { data: jobsite, error: loadError } = jobsiteId
    ? await supabase
        .from("jobsites")
        .select("id, gc_company_id, stripe_subscription_id")
        .eq("id", jobsiteId)
        .maybeSingle()
    : { data: null, error: null };

  if (loadError) {
    throw new AppError("Could not load the jobsite", 502, { cause: loadError });
  }
  // Ownership is checked against the metadata written at checkout so a
  // tampered or mismatched subscription can never upgrade someone else's site.
  if (!jobsite || !companyId || jobsite.gc_company_id !== companyId) {
    console.error("[stripe] no matching jobsite for subscription", subscription.id);
    return;
  }

  const { status } = subscription;
  const ended = ENDED_STATUSES.includes(status);

  // A late "deleted" for an old subscription must not downgrade a site that
  // has since bought a new one.
  if (
    ended &&
    jobsite.stripe_subscription_id &&
    jobsite.stripe_subscription_id !== subscription.id
  ) {
    return;
  }

  const update = {
    stripe_subscription_id: subscription.id,
    site_pro_status: status,
    site_pro_period_end: periodEnd(subscription),
  };

  if (ACTIVE_STATUSES.includes(status)) {
    const plan = resolvePrice(subscription.items?.data?.[0]?.price?.id);
    if (!plan || plan.scope !== "jobsite") {
      console.error("[stripe] unrecognized Site Pro price", subscription.id);
      return;
    }
    update.plan = "site_pro";
    update.site_pro_interval = plan.interval;
  } else if (ended) {
    // The jobsite is kept; it just loses the paid features.
    update.plan = "free";
  }
  // past_due / incomplete: plan unchanged (grace period), status recorded.

  const { error } = await supabase
    .from("jobsites")
    .update(update)
    .eq("id", jobsite.id);

  if (error) {
    throw new AppError("Could not update the jobsite subscription", 502, {
      cause: error,
    });
  }
};

// A GC Portfolio covers every site, so once it is active the company's
// per-site subscriptions are redundant: cancel each one now, prorated, with the
// unused time credited to the customer balance (invoice_now). Each cancel comes
// back as a `deleted` event that flips that site's `plan` to 'free' through
// syncSiteSubscription; access stays on because it derives from the tier.
// Re-runs on later Portfolio events, so an already-canceled subscription is
// skipped. A failure throws so Stripe retries the event (the tier is already
// written by then).
const cancelSiteSubscriptions = async (companyId, stripe) => {
  const { data: sites, error } = await supabase
    .from("jobsites")
    .select("id, stripe_subscription_id")
    .eq("gc_company_id", companyId)
    .not("stripe_subscription_id", "is", null)
    .eq("plan", "site_pro");

  if (error) {
    throw new AppError("Could not load the company's Site Pro jobsites", 502, {
      cause: error,
    });
  }

  for (const site of sites) {
    try {
      const current = await stripe.subscriptions.retrieve(site.stripe_subscription_id);
      if (current.status === "canceled") continue;
      await stripe.subscriptions.cancel(site.stripe_subscription_id, {
        prorate: true,
        invoice_now: true,
      });
    } catch (cause) {
      throw new AppError("Could not cancel a Site Pro subscription", 502, { cause });
    }
  }
};

const syncSubscription = async (subscription, stripe) => {
  if (subscription.metadata?.kind === "site_pro") {
    return syncSiteSubscription(subscription);
  }

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
    if (
      !plan ||
      plan.scope !== "company" ||
      plan.companyType !== company.company_type
    ) {
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

  if (ACTIVE_STATUSES.includes(status) && company.company_type === "gc") {
    await cancelSiteSubscriptions(company.id, stripe);
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
    await syncSubscription(subscription, stripe);
  }

  await recordEvent(event);
  return { duplicate: false };
};

module.exports = { handleWebhook };
