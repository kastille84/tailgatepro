const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { SITE_SCOPED_ROLE } = require("../constants/roles");
const { getPlanId } = require("../utility/entitlements");
const companiesService = require("./companies");

// Shared by the GC services: is `jobsiteId` inside the caller's scope? A null
// allow-list (company-wide role) admits everything.
const isJobsiteAllowed = (allowedJobsiteIds, jobsiteId) =>
  allowedJobsiteIds === null || allowedJobsiteIds.includes(jobsiteId);

// Which jobsites a GC user may see (Phase 9d-2). Returns null when the role is
// company-wide (admin/safety_manager -- no restriction), else the array of
// jobsite ids assigned to a site-scoped user in `jobsite_members` (empty until a
// manager assigns some). `user` is always req.user (loadUserContext), never
// client input. The join to `jobsites` keeps a stale row from another company
// out of the result. A superintendent whose company is no longer on GC
// Portfolio (lapsed/downgraded) keeps their rows but sees nothing until the
// company upgrades again -- decided in docs/gc-roles-design.md.
const getAllowedJobsiteIds = async (user) => {
  if (user.role !== SITE_SCOPED_ROLE) return null;
  if (getPlanId(user.companyType, user.tier) !== "gc-portfolio") return [];

  const { data, error } = await supabase
    .from("jobsite_members")
    .select("jobsite_id, jobsites!inner(gc_company_id)")
    .eq("user_id", user.id)
    .eq("jobsites.gc_company_id", user.companyId);

  if (error) {
    throw new AppError("Could not check your assigned jobsites", 502, { cause: error });
  }
  return data.map((row) => row.jobsite_id);
};

// Site-scoped roles are a GC Portfolio feature (Phase 9d-2): throws a 403
// PLAN_LIMIT (same shape as assertJobsiteAvailable) for any other plan. Gates
// inviting a superintendent and assigning sites. `companyId` is always the
// caller's verified company (loadUserContext).
const assertSiteRolesAvailable = async (companyId) => {
  const company = await companiesService.getById(companyId);
  if (getPlanId(company.companyType, company.tier) !== "gc-portfolio") {
    throw new AppError("Superintendent roles are part of GC Portfolio. Upgrade to use them.", 403, {
      data: { code: "PLAN_LIMIT" },
    });
  }
};

module.exports = { getAllowedJobsiteIds, isJobsiteAllowed, assertSiteRolesAvailable };
