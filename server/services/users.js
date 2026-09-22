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
// auth user. `role` is 'admin' — the user creating a brand-new company is its
// first administrator (Phase 8a). A future invited user (Phase 8c) will join
// an existing company instead, at whatever role the inviting admin picks.
// `tier` is fixed to 'basic' — self-serve signups don't choose a billing tier
// yet.
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
      role: "admin",
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

// Resolves an authenticated user's row in `users` into the identity fields that
// downstream authorization needs. `requireAuth` only proves *who* the caller is
// (the auth UID); anything that authorizes by company or role calls this — via
// the `loadUserContext` middleware — to get `companyId` / `role`. Throws a 404
// when the auth user has no profile row yet (deferred first-login path).
const getUserContext = async (id) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, role, company_id, companies(tier, company_type)")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new AppError("Profile not found", 404, {
      cause: error ?? undefined,
    });
  }

  return {
    id: data.id,
    name: data.name,
    role: data.role,
    companyId: data.company_id,
    // `companies` is a to-one embed via the company_id FK -- an object, not
    // an array. Defensive fallback for the (schema-allowed but
    // never-in-practice) case of a user with no company row yet.
    tier: data.companies?.tier ?? null,
    companyType: data.companies?.company_type ?? null,
  };
};

// Resolves a company's admin email, for Phase 8b's gc_contact_email
// supersession: PDF delivery prefers this over the manually-typed stopgap
// field once a project is linked to a real GC company. Auth emails live only
// in Supabase Auth (auth.users), never the public `users` table, so this is a
// two-step lookup: find the admin's row here, then ask the Auth Admin API for
// their email (available because this module's `supabase` client already
// uses the service-role key). If a company somehow has more than one admin
// (e.g. a future 8c co-admin invite), the earliest-created one wins —
// deterministic, not meaningful beyond "pick one". Returns null — not an
// error — when the company has no admin yet (pre-8a legacy data); a genuine
// lookup failure still throws, same as this module's other functions.
const getAdminEmail = async (companyId) => {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new AppError("Could not look up the company's admin", 502, {
      cause: error,
    });
  }
  if (data.length === 0) return null;

  const { data: authData, error: authError } =
    await supabase.auth.admin.getUserById(data[0].id);

  if (authError) {
    throw new AppError("Could not look up the admin's email", 502, {
      cause: authError,
    });
  }

  return authData?.user?.email ?? null;
};

module.exports = { createProfile, getUserContext, getAdminEmail };
