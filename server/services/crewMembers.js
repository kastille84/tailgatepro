const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const companiesService = require("./companies");

// A crew's people, for the GC manager who owns the crew (Phase 13f-join). Emails
// live only in Supabase Auth, so each is read with the Auth Admin API, the same
// call users.getAdminEmail makes. Crews are small, so one call per member is fine.
const listMembers = async (crewId, gcCompanyId) => {
  await companiesService.getOwnedCrew(crewId, gcCompanyId);

  const { data, error } = await supabase
    .from("users")
    .select("id, name, role, created_at")
    .eq("company_id", crewId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("Could not load the crew's people", 502, { cause: error });
  }

  return Promise.all(
    data.map(async (row) => {
      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(row.id);
      if (authError) {
        throw new AppError("Could not load the crew's people", 502, { cause: authError });
      }
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        email: authData?.user?.email ?? null,
      };
    }),
  );
};

// Removes one person from a crew. The select filters on company_id = the crew,
// so a user id from any other company is a 404, never a deletion. Deleting the
// `users` row drops their favorites (cascade) and un-links their past talks
// (meeting_logs.foreman_id is ON DELETE SET NULL); the sealed logs and PDFs stay.
// The Auth account goes too, best-effort and logged: without it they could use
// the sign-up data left on it to rejoin through a still-live join link.
const removeMember = async (crewId, userId, gcCompanyId) => {
  await companiesService.getOwnedCrew(crewId, gcCompanyId);

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("company_id", crewId)
    .maybeSingle();

  if (error) {
    throw new AppError("Could not look up that person", 502, { cause: error });
  }
  if (!data) {
    throw new AppError("Person not found", 404);
  }

  const { error: deleteError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .eq("company_id", crewId);

  if (deleteError) {
    throw new AppError("Could not remove that person", 502, { cause: deleteError });
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("crewMembers: failed to delete a removed member's auth account", authError);
  }
};

module.exports = { listMembers, removeMember };
