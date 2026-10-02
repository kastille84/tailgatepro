// Maps Stripe prices to TailgatePro plans. Billing writes `companies.tier`; the
// limits that tier implies live in entitlements.js (PLAN_LIMITS), so every
// `companyType` + `tier` pair below must be a key there.
//
// Plan keys are checkout-level ids, finer-grained than client/src/data/plans.ts
// because GC Portfolio is sold as two prices (10 sites / unlimited sites).
const { keysBasedOnEnv } = require("./envUtils");

const INTERVALS = ["monthly", "annual"];

const STRIPE_PLANS = {
  "trade-pro": {
    companyType: "subcontractor",
    tier: "premium",
    priceKeys: {
      monthly: "price_trade_pro_monthly",
      annual: "price_trade_pro_annual",
    },
  },
  "trade-enterprise": {
    companyType: "subcontractor",
    tier: "enterprise",
    priceKeys: {
      monthly: "price_trade_enterprise_monthly",
      annual: "price_trade_enterprise_annual",
    },
  },
  "gc-portfolio-10": {
    companyType: "gc",
    tier: "premium",
    priceKeys: {
      monthly: "price_gc_portfolio_10_sites_monthly",
      annual: "price_gc_portfolio_10_sites_annual",
    },
  },
  "gc-portfolio-unlimited": {
    companyType: "gc",
    tier: "enterprise",
    priceKeys: {
      monthly: "price_gc_portfolio_unlimited_sites_monthly",
      annual: "price_gc_portfolio_unlimited_sites_annual",
    },
  },
};

// GC Site Pro is billed per jobsite and writes `jobsites.plan`, never
// `companies.tier`, so it lives outside STRIPE_PLANS (which is the set of
// company-level plans the company checkout accepts).
const SITE_PLAN_KEY = "gc-site-pro";
const SITE_PLAN = {
  companyType: "gc",
  priceKeys: {
    monthly: "price_gc_site_pro_monthly",
    annual: "price_gc_site_pro_annual",
  },
};

// Stripe price id for a plan + billing interval, or undefined when the plan or
// interval is unknown or its env var is unset.
const getPriceId = (planKey, interval, stripeConfig = keysBasedOnEnv().stripe) => {
  const plan = planKey === SITE_PLAN_KEY ? SITE_PLAN : STRIPE_PLANS[planKey];
  const priceKey = plan?.priceKeys[interval];
  return priceKey ? stripeConfig[priceKey] : undefined;
};

// Reverse lookup used by the webhook: which plan/tier/interval a Stripe price
// id stands for, or null for a price we don't sell (never grants a tier).
const resolvePrice = (priceId, stripeConfig = keysBasedOnEnv().stripe) => {
  if (!priceId) return null;
  for (const [planKey, plan] of Object.entries(STRIPE_PLANS)) {
    for (const interval of INTERVALS) {
      if (stripeConfig[plan.priceKeys[interval]] === priceId) {
        return {
          scope: "company",
          planKey,
          companyType: plan.companyType,
          tier: plan.tier,
          interval,
        };
      }
    }
  }
  for (const interval of INTERVALS) {
    if (stripeConfig[SITE_PLAN.priceKeys[interval]] === priceId) {
      return {
        scope: "jobsite",
        planKey: SITE_PLAN_KEY,
        companyType: SITE_PLAN.companyType,
        interval,
      };
    }
  }
  return null;
};

module.exports = {
  STRIPE_PLANS,
  SITE_PLAN_KEY,
  INTERVALS,
  getPriceId,
  resolvePrice,
};
