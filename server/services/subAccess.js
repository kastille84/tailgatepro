const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { getLimits } = require("../utility/entitlements");
const { computeUnlockedSubIds } = require("../utility/subLocking");
const companiesService = require("./companies");

// Which of a GC's subcontractors are unlocked on its plan (Phase 9d). Returns
// null when nothing is locked (paid GC plans), else the Set of unlocked sub
// company ids -- see computeUnlockedSubIds for the rule. `gcCompanyId` is
// always the caller's verified company (loadUserContext).
const getUnlockedSubIds = async (gcCompanyId) => {
  const company = await companiesService.getById(gcCompanyId);
  const { unlockedSubs } = getLimits("gc", company.tier);
  if (unlockedSubs === null) return null;

  const { data, error } = await supabase
    .from("jobsite_subcontractors")
    .select("sub_company_id, accepted_at, jobsites!inner(gc_company_id, plan)")
    .eq("jobsites.gc_company_id", gcCompanyId)
    .not("accepted_at", "is", null)
    .not("sub_company_id", "is", null);

  if (error) {
    throw new AppError("Could not check your plan's subcontractors", 502, { cause: error });
  }

  return computeUnlockedSubIds({
    unlockedSubs,
    entries: data.map((row) => ({
      subId: row.sub_company_id,
      acceptedAt: row.accepted_at,
      sponsored: row.jobsites.plan === "site_pro",
    })),
  });
};

module.exports = { getUnlockedSubIds };
