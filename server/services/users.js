// #TODO - TODO(join-company-flow): every self-serve signup currently creates a brand
// new `companies` row, even if another user already registered the same
// company name — there's no lookup/merge/invite step. Building a real "join
// an existing company" flow is an open PRD item (see docs/PRD.md §7, open
// question #1, Viral Loop / Onboarding) and will need to replace the
// always-create-a-new-company behavior below.
const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");

// Creates the `companies` row and the `users` row for a newly self-signed-up
// auth user. `role` is fixed to 'foreman' (lowest privilege) — this default
// should be confirmed/overridden once company invite / admin-provisioning
// flows exist. `tier` is fixed to 'basic' — self-serve signups don't choose a
// billing tier yet.
const createProfile = async ({ id, name, companyName, companyType }) => {
  const companyId = uuidv4();

  const { error: companyError } = await supabase.from("companies").insert({
    id: companyId,
    name: companyName,
    company_type: companyType,
    tier: "basic",
  });

  if (companyError) {
    throw new AppError("Could not create your company", 502, {
      cause: companyError,
    });
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      id,
      company_id: companyId,
      role: "foreman",
      name,
    })
    .select("id, name, role, company_id")
    .single();

  if (error) {
    // The company row was just created for this user only — if the user row
    // fails, best-effort clean it up rather than leave an orphan behind.
    await supabase.from("companies").delete().eq("id", companyId);

    // 23505 = unique_violation on users.id (pkey) — profile already exists.
    if (error.code === "23505") {
      throw new AppError("Profile already exists for this account", 409, {
        cause: error,
      });
    }
    throw new AppError("Could not finish setting up your account", 502, {
      cause: error,
    });
  }

  return {
    id: data.id,
    name: data.name,
    role: data.role,
    companyId: data.company_id,
  };
};

module.exports = { createProfile };
