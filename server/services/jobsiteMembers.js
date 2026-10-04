const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { SITE_SCOPED_ROLE } = require("../constants/roles");
const jobsitesService = require("./jobsites");
const siteScopeService = require("./siteScope");

// Which of a GC's superintendents are assigned to a jobsite (Phase 9d-2,
// docs/gc-roles-design.md). Both functions take `gcCompanyId` from the caller's
// verified req.user, and confirm the jobsite belongs to it first (404 otherwise),
// so one company can never read or assign another's jobsite.

const listCompanySuperintendents = async (gcCompanyId) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, name")
    .eq("company_id", gcCompanyId)
    .eq("role", SITE_SCOPED_ROLE)
    .order("name", { ascending: true });

  if (error) {
    throw new AppError("Could not load superintendents", 502, { cause: error });
  }
  return data;
};

const listAssignedUserIds = async (jobsiteId) => {
  const { data, error } = await supabase
    .from("jobsite_members")
    .select("user_id")
    .eq("jobsite_id", jobsiteId);

  if (error) {
    throw new AppError("Could not load the jobsite's members", 502, { cause: error });
  }
  return data.map((row) => row.user_id);
};

// Every superintendent in the company, flagged with whether they're assigned to
// this jobsite -- the shape a checklist UI needs.
const listForJobsite = async ({ jobsiteId, gcCompanyId }) => {
  await jobsitesService.getOwnedJobsite(jobsiteId, gcCompanyId);

  const [superintendents, assigned] = await Promise.all([
    listCompanySuperintendents(gcCompanyId),
    listAssignedUserIds(jobsiteId),
  ]);
  const assignedSet = new Set(assigned);

  return {
    members: superintendents.map((user) => ({
      userId: user.id,
      name: user.name,
      assigned: assignedSet.has(user.id),
    })),
  };
};

// Replaces the jobsite's assigned set with `userIds`. GC Portfolio only. Every
// id must be a superintendent of the caller's own company (400 otherwise), so a
// crafted request can't attach another company's user or a non-scoped role.
// Applied as a diff (delete the removed, insert the added) because supabase-js
// has no cross-statement transaction.
const setMembers = async ({ jobsiteId, gcCompanyId, userIds }) => {
  await siteScopeService.assertSiteRolesAvailable(gcCompanyId);
  await jobsitesService.getOwnedJobsite(jobsiteId, gcCompanyId);

  const wanted = [...new Set(userIds)];
  const [superintendents, current] = await Promise.all([
    listCompanySuperintendents(gcCompanyId),
    listAssignedUserIds(jobsiteId),
  ]);

  const validIds = new Set(superintendents.map((user) => user.id));
  if (wanted.some((id) => !validIds.has(id))) {
    throw new AppError("Only your company's superintendents can be assigned to a jobsite", 400);
  }

  const currentSet = new Set(current);
  const toAdd = wanted.filter((id) => !currentSet.has(id));
  const toRemove = current.filter((id) => !wanted.includes(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("jobsite_members")
      .delete()
      .eq("jobsite_id", jobsiteId)
      .in("user_id", toRemove);
    if (error) {
      throw new AppError("Could not update the jobsite's members", 502, { cause: error });
    }
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("jobsite_members")
      .insert(toAdd.map((userId) => ({ jobsite_id: jobsiteId, user_id: userId })));
    if (error) {
      throw new AppError("Could not update the jobsite's members", 502, { cause: error });
    }
  }

  return listForJobsite({ jobsiteId, gcCompanyId });
};

module.exports = { listForJobsite, setMembers };
