// First file in this domain (Phase 11c). Not folded into companies.js:
// jobsites.js already requires companiesService, so companies.js requiring
// jobsites.js back would be circular. This file sits above both and requires
// only jobsites.js, so either controller can require it with no cycle.

const { hasBrandingAccess } = require("../utility/entitlements");
const jobsitesService = require("./jobsites");

// A company's real PDF-branding entitlement. A subcontractor's answer comes
// entirely from its plan (Trade Pro/Enterprise, entitlements.js). A GC's does
// too for GC Portfolio (tier premium/enterprise) -- but GC Site Pro is a
// per-jobsite purchase (jobsites.plan = 'site_pro'), not a company-level tier
// (docs/pricing-and-positioning-strategy_V2.md's feature matrix promises
// branding on both GC Site Pro and GC Portfolio), so a GC without a Portfolio
// tier still needs the DB checked before answering false. Subs and Portfolio
// GCs never pay that query -- only a non-Portfolio GC does.
const resolveBrandingAccess = async ({ companyId, companyType, tier }) => {
  if (hasBrandingAccess(companyType, tier)) return true;
  if (companyType !== "gc") return false;
  return jobsitesService.hasActiveSitePro(companyId);
};

module.exports = { resolveBrandingAccess };
