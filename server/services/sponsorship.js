const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { hasSiteProAccess } = require("../utility/entitlements");

// Whether a subcontractor company is sponsored: it holds an accepted roster row
// on a live (active, not archived) jobsite with Site Pro access -- either the
// site's own `jobsites.plan = 'site_pro'` or its GC being on Portfolio, which
// covers every site. A sponsored sub gets Trade Pro access at no cost (Phase
// 9d). Ends by itself when the site is unpaid, archived, or the sub is removed
// -- nothing is stored on the sub's own company row.
const isSponsored = async (companyId) => {
  const { data, error } = await supabase
    .from("jobsite_subcontractors")
    .select("jobsites!inner(plan, status, archived_at, companies(tier))")
    .eq("sub_company_id", companyId)
    .not("accepted_at", "is", null)
    .eq("jobsites.status", "active")
    .is("jobsites.archived_at", null);

  if (error) {
    throw new AppError("Could not check your sponsorship", 502, { cause: error });
  }

  return data.some((row) =>
    hasSiteProAccess({
      sitePlan: row.jobsites.plan,
      companyTier: row.jobsites.companies?.tier,
    }),
  );
};

// The tier a company's limits should be resolved from: the stored tier, except
// a Free subcontractor on a sponsored site resolves as Pro ("premium"). Only
// that one combination costs an extra query.
const resolveEffectiveTier = async ({ companyId, companyType, tier }) => {
  if (companyType !== "subcontractor" || tier !== "basic") return tier;
  return (await isSponsored(companyId)) ? "premium" : tier;
};

module.exports = { isSponsored, resolveEffectiveTier };
