// Phase 8c closed the "join an existing company" gap this TODO used to
// describe: an invited signup (inviteToken present) joins the existing
// company at the invited role via createProfileFromInvite below, instead of
// always creating a new one.
const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const companyInvitesService = require("./companyInvites");
const jobsitesService = require("./jobsites");
const seatsService = require("./seats");
const { resolveEffectiveTier } = require("./sponsorship");

// Creates the `companies` row and the `users` row for a newly self-signed-up
// auth user. `role` is 'admin' — the user creating a brand-new company is its
// first administrator (Phase 8a). An invited signup (inviteToken present)
// takes the createProfileFromInvite branch instead, joining an existing
// company at whatever role the inviting admin picked. `tier` is fixed to
// 'basic' — self-serve signups don't choose a billing tier yet.
const createProfile = async ({
  id,
  email,
  name,
  companyName,
  companyType,
  inviteToken,
  jobsiteInviteToken,
}) => {
  if (inviteToken) {
    return createProfileFromInvite({ id, email, name, inviteToken });
  }

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

  // Phase 8d Case B: a jobsite-invited signup founds its own company (above),
  // then accepts the invite as the last step — only once the users row
  // actually landed, mirroring createProfileFromInvite. Best-effort, never
  // throws past profile creation: a failed accept leaves a working account and
  // a still-valid token, recoverable via the authenticated accept endpoint on
  // next login. `email` is the token-verified email, checked against the
  // invited address inside acceptInvite.
  if (jobsiteInviteToken) {
    try {
      await jobsitesService.acceptInvite({
        token: jobsiteInviteToken,
        email,
        companyId,
      });
    } catch (acceptError) {
      console.error("users: failed to accept a jobsite invite", acceptError);
    }
  }

  return {
    id: data.id,
    name: data.name,
    role: data.role,
    companyId: data.company_id,
  };
};

// An invited user joins the existing company at the invited role instead of
// creating a new one — no `companies` insert, so none of createProfile's
// compensating-delete logic applies here. `email` must be the token-verified
// email of the account accepting the invite (never req.body/req.userMetadata)
// — getInviteForEmail is where the email-match security check actually runs.
const createProfileFromInvite = async ({ id, email, name, inviteToken }) => {
  const invite = await companyInvitesService.getInviteForEmail(inviteToken, email);

  // Re-checked here (not only at invite time) so a downgrade or several
  // invites sent earlier can't push the company past its seats. Pending
  // invites aren't counted: this one is the invite being redeemed.
  await seatsService.assertSeatAvailable({
    companyId: invite.companyId,
    role: invite.role,
    email: invite.email,
    includePending: false,
  });

  const { data, error } = await supabase
    .from("users")
    .insert({ id, company_id: invite.companyId, role: invite.role, name })
    .select("id, name, role, company_id")
    .single();

  if (error) {
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

  // Consume the invite only now that the user row landed — best-effort,
  // never throws. A failed delete just leaves the token valid for a retry;
  // a retried accept would 409 on users.id above (never re-insert), so
  // nothing is unsafe about leaving a consumed invite briefly in place.
  try {
    await companyInvitesService.deleteInvite(invite.id);
  } catch (cleanupError) {
    console.error("users: failed to delete a consumed invite", cleanupError);
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
    // Effective tier: a Free sub on a Site Pro jobsite resolves as Pro (9d).
    tier: await resolveEffectiveTier({
      companyId: data.company_id,
      companyType: data.companies?.company_type ?? null,
      tier: data.companies?.tier ?? null,
    }),
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
