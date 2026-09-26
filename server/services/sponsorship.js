const { supabase } = require("../utility/supabaseClient");
const { countRows } = require("../utility/countRows");

// Whether a subcontractor company is sponsored: it holds an accepted roster row
// on a live (active, not archived) GC Site Pro jobsite (`jobsites.plan =
// 'site_pro'`). A sponsored sub gets Trade Pro access at no cost (Phase 9d).
// Ends by itself when the site is unpaid, archived, or the sub is removed --
// nothing is stored on the sub's own company row.
const isSponsored = async (companyId) => {
  const count = await countRows(
    supabase
      .from("jobsite_subcontractors")
      .select("id, jobsites!inner(plan, status, archived_at)", {
        count: "exact",
        head: true,
      })
      .eq("sub_company_id", companyId)
      .not("accepted_at", "is", null)
      .eq("jobsites.plan", "site_pro")
      .eq("jobsites.status", "active")
      .is("jobsites.archived_at", null),
    "Could not check your sponsorship",
  );
  return count > 0;
};

// The tier a company's limits should be resolved from: the stored tier, except
// a Free subcontractor on a sponsored site resolves as Pro ("premium"). Only
// that one combination costs an extra query.
const resolveEffectiveTier = async ({ companyId, companyType, tier }) => {
  if (companyType !== "subcontractor" || tier !== "basic") return tier;
  return (await isSponsored(companyId)) ? "premium" : tier;
};

module.exports = { isSponsored, resolveEffectiveTier };
