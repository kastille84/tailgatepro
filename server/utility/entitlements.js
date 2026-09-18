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

module.exports = { TRANSLATION_TIERS, hasTranslationAccess };
