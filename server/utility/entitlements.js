// Minimal, real feature gating against `companies.tier`
// ('basic' | 'premium' | 'enterprise', see Supabase_SQL.sql). No
// billing/checkout flow exists yet -- tier is just read and enforced here.
// Mirrored (deliberately, by hand) on the client by useCurrentUser.ts for
// UI purposes only; the server is the actual authority.

// Multi-language talk translation is a Trade Pro/Enterprise feature
// (client/src/data/plans.ts, docs/pricing-and-positioning-strategy_V2.md) --
// also gated because Google Translate is a metered, billable API.
const TRANSLATION_TIERS = ["premium", "enterprise"];

const hasTranslationAccess = (tier) => TRANSLATION_TIERS.includes(tier);

// Custom PDF branding (upload logo, remove the free-tier watermark) is the
// same Trade Pro/Enterprise paywall (client/src/data/plans.ts,
// docs/pricing-and-positioning-strategy_V2.md) — reuses the identical tier
// list rather than a separate constant, since both gates draw the exact same
// line today.
const hasBrandingAccess = (tier) => TRANSLATION_TIERS.includes(tier);

// --- Plan model (Phase 9b) -------------------------------------------------
// The DB enum has three values, the pricing page six plans. The plan is
// resolved from `companies.tier` + `companies.company_type`; GC Site Pro is the
// exception -- it is per jobsite (`jobsites.plan`), not a company tier.
// `null` = unlimited. This module only defines limits; enforcement is 9c/9d.
const FREE_PLAN_KEY = "subcontractor:basic";

const PLAN_LIMITS = {
  "subcontractor:basic": {
    planId: "trade-free",
    foremanSeats: 1,
    activeJobsites: null,
    unlockedSubs: null,
    historyDays: 30,
    archiveYears: 0,
  },
  "subcontractor:premium": {
    planId: "trade-pro",
    foremanSeats: 8,
    activeJobsites: null,
    unlockedSubs: null,
    historyDays: null,
    archiveYears: 5,
  },
  "subcontractor:enterprise": {
    planId: "trade-enterprise",
    foremanSeats: null,
    activeJobsites: null,
    unlockedSubs: null,
    historyDays: null,
    archiveYears: 5,
  },
  "gc:basic": {
    planId: "gc-free",
    foremanSeats: null,
    activeJobsites: 1,
    unlockedSubs: 1,
    historyDays: null,
    archiveYears: 0,
  },
  // premium = Portfolio up to 10 sites, enterprise = Portfolio unlimited.
  "gc:premium": {
    planId: "gc-portfolio",
    foremanSeats: null,
    activeJobsites: 10,
    unlockedSubs: null,
    historyDays: null,
    archiveYears: null,
  },
  "gc:enterprise": {
    planId: "gc-portfolio",
    foremanSeats: null,
    activeJobsites: null,
    unlockedSubs: null,
    historyDays: null,
    archiveYears: null,
  },
};

// Per-jobsite plan (`jobsites.plan`); 'site_pro' is the paid GC Site Pro site.
const SITE_PLANS = ["free", "site_pro"];

// Unknown company_type/tier (e.g. a user with no company row) falls back to
// the most restrictive plan rather than granting anything.
const getLimits = (companyType, tier) =>
  PLAN_LIMITS[`${companyType}:${tier}`] ?? PLAN_LIMITS[FREE_PLAN_KEY];

const getPlanId = (companyType, tier) => getLimits(companyType, tier).planId;

// Which role a plan's seat cap counts. Free is "one person total" so it counts
// every member (null = any role); paid trade plans cap foremen only.
const seatRoleFor = (companyType, tier) =>
  getPlanId(companyType, tier) === "trade-free" ? null : "foreman";

// A GC's active-jobsite cap: its plan's cap, plus one per paid Site Pro site
// when on the free plan. Portfolio covers all sites up to its own cap.
const effectiveJobsiteLimit = ({ tier, paidSiteCount = 0 }) => {
  const { activeJobsites } = getLimits("gc", tier);
  if (activeJobsites === null) return null;
  return tier === "basic" ? activeJobsites + paidSiteCount : activeJobsites;
};

module.exports = {
  TRANSLATION_TIERS,
  hasTranslationAccess,
  hasBrandingAccess,
  PLAN_LIMITS,
  SITE_PLANS,
  getLimits,
  getPlanId,
  seatRoleFor,
  effectiveJobsiteLimit,
};
