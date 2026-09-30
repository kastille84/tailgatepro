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

// Custom PDF branding (upload logo, remove the free-tier watermark) is gated
// per-plan via PLAN_LIMITS.brandingAccess below (Phase 11c), not a literal
// alias of hasTranslationAccess's tier list anymore -- Trade Pro/Enterprise
// and GC Portfolio get it from their company tier; GC Site Pro grants it too,
// but that's a per-jobsite purchase (jobsites.plan), which this pure helper
// can't see -- server/services/branding.js's resolveBrandingAccess is the
// real entry point for a GC caller and folds that case in.
const hasBrandingAccess = (companyType, tier) => getLimits(companyType, tier).brandingAccess;

// --- Plan model (Phase 9b) -------------------------------------------------
// The DB enum has three values, the pricing page six plans. The plan is
// resolved from `companies.tier` + `companies.company_type`; GC Site Pro is the
// exception -- it is per jobsite (`jobsites.plan`), not a company tier.
// `null` = unlimited. This module only defines limits; enforcement is 9c/9d.
// `libraryAccess`: "core" = only the talks flagged `is_core` (Trade Free), "full" = all.
const FREE_PLAN_KEY = "subcontractor:basic";

const PLAN_LIMITS = {
  "subcontractor:basic": {
    planId: "trade-free",
    foremanSeats: 1,
    activeJobsites: null,
    unlockedSubs: null,
    historyDays: 30,
    archiveYears: 0,
    libraryAccess: "core",
    brandingAccess: false,
  },
  "subcontractor:premium": {
    planId: "trade-pro",
    foremanSeats: 8,
    activeJobsites: null,
    unlockedSubs: null,
    historyDays: null,
    archiveYears: 5,
    libraryAccess: "full",
    brandingAccess: true,
  },
  "subcontractor:enterprise": {
    planId: "trade-enterprise",
    foremanSeats: null,
    activeJobsites: null,
    unlockedSubs: null,
    historyDays: null,
    archiveYears: 5,
    libraryAccess: "full",
    brandingAccess: true,
  },
  "gc:basic": {
    planId: "gc-free",
    foremanSeats: null,
    activeJobsites: 1,
    unlockedSubs: 1,
    historyDays: null,
    archiveYears: 0,
    libraryAccess: "full",
    // Company-tier branding is false here, but a GC Free company can still
    // earn it by owning an active Site Pro jobsite -- see
    // server/services/branding.js's resolveBrandingAccess, the real gate any
    // GC caller goes through.
    brandingAccess: false,
  },
  // premium = Portfolio up to 10 sites, enterprise = Portfolio unlimited.
  "gc:premium": {
    planId: "gc-portfolio",
    foremanSeats: null,
    activeJobsites: 10,
    unlockedSubs: null,
    historyDays: null,
    archiveYears: null,
    libraryAccess: "full",
    brandingAccess: true,
  },
  "gc:enterprise": {
    planId: "gc-portfolio",
    foremanSeats: null,
    activeJobsites: null,
    unlockedSubs: null,
    historyDays: null,
    archiveYears: null,
    libraryAccess: "full",
    brandingAccess: true,
  },
};

// Per-jobsite plan (`jobsites.plan`); 'site_pro' is the paid GC Site Pro site.
const SITE_PLANS = ["free", "site_pro"];

// Unknown company_type/tier (e.g. a user with no company row) falls back to
// the most restrictive plan rather than granting anything.
const getLimits = (companyType, tier) =>
  PLAN_LIMITS[`${companyType}:${tier}`] ?? PLAN_LIMITS[FREE_PLAN_KEY];

// Whether the plan sees the whole global talk library (false = core talks only).
const hasFullLibrary = (companyType, tier) =>
  getLimits(companyType, tier).libraryAccess === "full";

// Authoring company talks is open to every subcontractor plan (unchanged); a GC
// needs GC Portfolio (premium/enterprise) -- "Custom company safety talks
// shared with every sub" (client/src/data/plans.ts). A GC's talks are shown to every
// sub on its active jobsites (docs/company-talks-design.md).
const canAuthorCompanyTalks = (companyType, tier) =>
  companyType !== "gc" || getLimits(companyType, tier).planId === "gc-portfolio";

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

// Whether a GC jobsite has Site Pro features (Defense Bundle, sub sponsorship):
// it either bought Site Pro itself (`jobsites.plan`) or its company is on GC
// Portfolio, which includes them on every site. Derived, never stored, so a
// Portfolio ending needs nothing un-written.
const hasSiteProAccess = ({ sitePlan, companyTier }) =>
  sitePlan === "site_pro" ||
  getPlanId("gc", companyTier) === "gc-portfolio";

module.exports = {
  TRANSLATION_TIERS,
  hasSiteProAccess,
  hasTranslationAccess,
  hasBrandingAccess,
  PLAN_LIMITS,
  SITE_PLANS,
  getLimits,
  getPlanId,
  hasFullLibrary,
  canAuthorCompanyTalks,
  seatRoleFor,
  effectiveJobsiteLimit,
};
