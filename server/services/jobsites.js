const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { generateInviteToken, getInviteExpiry } = require("../utility/inviteToken");
const { effectiveJobsiteLimit } = require("../utility/entitlements");
const { countRows } = require("../utility/countRows");
const projectsService = require("./projects");
const { isSubLocked } = require("../utility/subLocking");
const companiesService = require("./companies");
const subAccessService = require("./subAccess");

// The columns every jobsites query selects, and the snake_case -> camelCase
// mapper applied to each row before it leaves the service. Services never
// leak DB column names to the controller layer.
const JOBSITE_COLUMNS =
  "id, gc_company_id, name, status, archived_at, origin, created_at";

// A NULL origin (a jobsite that predates the column) maps to false: unknown is
// never presented as sub-created.
const toJobsite = (row) => ({
  id: row.id,
  gcCompanyId: row.gc_company_id,
  name: row.name,
  status: row.status,
  archivedAt: row.archived_at,
  createdBySub: row.origin === "subcontractor",
  createdAt: row.created_at,
});

// jobsite_subcontractors is both the invite record and the roster: a row with
// accepted_at NULL is a pending invite, a row with accepted_at set is a member
// (docs/jobsite-design.md "Company-to-company invite"). `token` is selected
// only where a caller needs it to build/validate an invite link and is never
// part of any shape returned to the browser.
const ROSTER_COLUMNS =
  "id, jobsite_id, sub_company_id, invited_email, token, expires_at, accepted_at";

const INVALID_INVITE_MESSAGE = "This invite link is invalid or has expired";

// A jobsite with its roster embedded, for the GC's list view. The token is
// deliberately absent from both the select and the mapped shape.
// `unlocked` (Phase 9d, from subAccess.getUnlockedSubIds) hides a locked sub's
// email and company name; the row id stays so the GC can still remove it.
const toJobsiteWithRoster = (row, unlocked) => ({
  ...toJobsite(row),
  subcontractors: (row.jobsite_subcontractors ?? []).map((sub) => {
    // A pending invite has no sub company yet, so there is nothing to lock.
    const locked = Boolean(sub.sub_company_id) && isSubLocked(unlocked, sub.sub_company_id);
    return {
      id: sub.id,
      email: locked ? null : sub.invited_email,
      status: sub.accepted_at ? "accepted" : "pending",
      companyName: locked ? null : (sub.companies?.name ?? null),
      locked,
    };
  }),
});

// Throws a 403 PLAN_LIMIT when the GC already has as many live (active, not
// archived) jobsites as its plan allows (Phase 9d). GC Free gets 1 plus one per
// paid Site Pro site; Portfolio has its own cap (`effectiveJobsiteLimit`).
// `gcCompanyId` is always the caller's verified company (loadUserContext).
const assertJobsiteAvailable = async (gcCompanyId) => {
  const company = await companiesService.getById(gcCompanyId);

  const liveSites = () =>
    supabase
      .from("jobsites")
      .select("id", { count: "exact", head: true })
      .eq("gc_company_id", gcCompanyId)
      .eq("status", "active")
      .is("archived_at", null);

  const failure = "Could not check your plan's job sites";
  const paidSiteCount = await countRows(liveSites().eq("plan", "site_pro"), failure);
  const limit = effectiveJobsiteLimit({ tier: company.tier, paidSiteCount });
  if (limit === null) return;

  const used = await countRows(liveSites(), failure);
  if (used >= limit) {
    throw new AppError("Your plan's job site limit is reached. Upgrade to add more.", 403, {
      data: { code: "PLAN_LIMIT", limit },
    });
  }
};

// jobsites.id has no DB default (docs/jobsite-design.md's offline-sync-rule
// exception, same as company_invites.id) — creating a jobsite is an
// online-only action, so the server mints the id here rather than the client
// generating one before an offline write, the way projects.create does.
const create = async ({ gcCompanyId, name }) => {
  await assertJobsiteAvailable(gcCompanyId);

  const { data, error } = await supabase
    .from("jobsites")
    .insert({ id: uuidv4(), gc_company_id: gcCompanyId, name, origin: "gc" })
    .select(JOBSITE_COLUMNS)
    .single();

  if (error) {
    throw new AppError("Could not create the jobsite", 502, { cause: error });
  }

  return toJobsite(data);
};

// Every jobsite the caller's GC company owns, newest first — same ordering
// projects.listForCompany uses — each with its roster (pending invites and
// accepted subs) embedded. Includes archived jobsites; nothing consumes this
// list yet (8d-e), so there's no includeArchived toggle to wire up.
const listForGc = async (gcCompanyId) => {
  const [{ data, error }, unlocked] = await Promise.all([
    supabase
      .from("jobsites")
      .select(
        `${JOBSITE_COLUMNS}, jobsite_subcontractors(id, sub_company_id, invited_email, accepted_at, companies(name))`,
      )
      .eq("gc_company_id", gcCompanyId)
      .order("created_at", { ascending: false }),
    subAccessService.getUnlockedSubIds(gcCompanyId),
  ]);

  if (error) {
    throw new AppError("Could not load jobsites", 502, { cause: error });
  }

  return data.map((row) => toJobsiteWithRoster(row, unlocked));
};

// Patches a jobsite the caller's GC company owns. Ownership is enforced in
// the query itself (gc_company_id eq the caller's company): another GC's
// jobsite is indistinguishable from a missing one (404), by design. Only the
// keys actually present on `patch` are written.
//
// Unlike projects.update, this route's entire PATCH is manager-gated at the
// router level (docs/jobsite-design.md's endpoint table) — there's no "any
// company member may rename, only a manager may archive" split to enforce
// here, so `archived` needs no in-service role check.
const update = async ({ id, gcCompanyId, patch }) => {
  // Bringing a dormant (archived or non-active) jobsite back to live takes a
  // slot, so it is capped like a create -- otherwise archive -> create ->
  // restore would sidestep the plan limit.
  if (patch.status === "active" || patch.archived === false) {
    const current = await getOwnedJobsite(id, gcCompanyId);
    const wasLive = current.status === "active" && !current.archivedAt;
    const nextStatus = patch.status ?? current.status;
    const nextArchived = patch.archived === undefined ? current.archivedAt : patch.archived;
    if (!wasLive && nextStatus === "active" && !nextArchived) {
      await assertJobsiteAvailable(gcCompanyId);
    }
  }

  const nextPatch = {};
  if (patch.name !== undefined) nextPatch.name = patch.name;
  if (patch.status !== undefined) nextPatch.status = patch.status;
  if (patch.archived !== undefined) {
    nextPatch.archived_at = patch.archived ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("jobsites")
    .update(nextPatch)
    .eq("id", id)
    .eq("gc_company_id", gcCompanyId)
    .select(JOBSITE_COLUMNS)
    .single();

  if (error) {
    // PGRST116 = no row returned by `.single()` — the id doesn't exist or
    // isn't owned by this GC company.
    if (error.code === "PGRST116") {
      throw new AppError("Jobsite not found", 404, { cause: error });
    }
    throw new AppError("Could not update the jobsite", 502, { cause: error });
  }

  return toJobsite(data);
};

// A jobsite the caller's GC company owns, with the GC's registered name for
// invite emails. Another GC's jobsite is indistinguishable from a missing one
// (404), same as update.
const getOwnedJobsite = async (id, gcCompanyId) => {
  const { data, error } = await supabase
    .from("jobsites")
    .select(`${JOBSITE_COLUMNS}, companies(name)`)
    .eq("id", id)
    .eq("gc_company_id", gcCompanyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Jobsite not found", 404, { cause: error });
    }
    throw new AppError("Could not load the jobsite", 502, { cause: error });
  }

  return { ...toJobsite(data), gcCompanyName: data.companies?.name ?? null };
};

// Creates (or, for a repeat invite to the same email, replaces) the one
// pending roster row for a jobsite+email pair. Re-inviting an already-accepted
// sub is a 409 — the row's whole point is to persist as the membership. Returns
// the token so the controller can build the emailed link; it must never be
// echoed to the browser.
const createInvite = async ({ jobsiteId, gcCompanyId, email }) => {
  const jobsite = await getOwnedJobsite(jobsiteId, gcCompanyId);

  const { data: existing, error: readError } = await supabase
    .from("jobsite_subcontractors")
    .select("id, accepted_at")
    .eq("jobsite_id", jobsiteId)
    .eq("invited_email", email)
    .limit(1);

  if (readError) {
    throw new AppError("Could not create the invite", 502, { cause: readError });
  }
  if (existing.length > 0 && existing[0].accepted_at) {
    throw new AppError("That subcontractor is already on this job site", 409);
  }

  const fresh = {
    token: generateInviteToken(),
    expires_at: getInviteExpiry().toISOString(),
  };

  let query;
  if (existing.length > 0) {
    // `.is("accepted_at", null)` makes the read-then-write above race-safe: if
    // the invite was accepted in between, nothing matches.
    query = supabase
      .from("jobsite_subcontractors")
      .update(fresh)
      .eq("id", existing[0].id)
      .is("accepted_at", null);
  } else {
    query = supabase
      .from("jobsite_subcontractors")
      .insert({ id: uuidv4(), jobsite_id: jobsiteId, invited_email: email, ...fresh });
  }

  const { data, error } = await query.select(ROSTER_COLUMNS).single();

  if (error) {
    // PGRST116 = the pending row was accepted by another request after we
    // read it; 23505 = a concurrent request inserted the same jobsite+email.
    if (error.code === "PGRST116" || error.code === "23505") {
      throw new AppError("This invite was just changed. Reload and try again.", 409, {
        cause: error,
      });
    }
    throw new AppError("Could not create the invite", 502, { cause: error });
  }

  return {
    id: data.id,
    jobsiteId: data.jobsite_id,
    email: data.invited_email,
    token: data.token,
    expiresAt: data.expires_at,
    jobsiteName: jobsite.name,
    gcCompanyName: jobsite.gcCompanyName,
  };
};

// Shared lookup: an invite is only "active" if the token exists (accepting
// nulls it) AND hasn't expired. Both the public preview and the accept path
// funnel through this single check, so "not found", "already accepted" and
// "expired" collapse into the same 404 — minimal disclosure, same reasoning as
// companyInvites.getActiveInvite.
const getActiveInvite = async (token) => {
  const { data, error } = await supabase
    .from("jobsite_subcontractors")
    .select(`${ROSTER_COLUMNS}, jobsites(name, gc_company_id, companies(name))`)
    .eq("token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(INVALID_INVITE_MESSAGE, 404, { cause: error });
    }
    throw new AppError("Could not look up the invite", 502, { cause: error });
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new AppError(INVALID_INVITE_MESSAGE, 404);
  }

  return {
    id: data.id,
    jobsiteId: data.jobsite_id,
    email: data.invited_email,
    jobsiteName: data.jobsites?.name ?? null,
    gcCompanyId: data.jobsites?.gc_company_id ?? null,
    gcCompanyName: data.jobsites?.companies?.name ?? null,
  };
};

// GET /api/jobsites/invite/:token — public preview, before any account exists.
const previewInvite = async (token) => {
  const invite = await getActiveInvite(token);
  return {
    gcCompanyName: invite.gcCompanyName,
    jobsiteName: invite.jobsiteName,
    email: invite.email,
  };
};

// Accepts an invite on behalf of an existing subcontractor company. `email`
// must be the token-verified email of the accepting account (req.userEmail,
// never req.body/req.userMetadata) — the check that stops a leaked token from
// being claimed by a different email.
//
// Order matters: the roster row is stamped accepted FIRST, so the admission
// check inside projectsService.create is already true when the project insert
// runs — the same validated path a later manual create takes. If that insert
// fails, the roster stamp is rolled back best-effort so the (still-held) token
// stays usable for a retry; supabase-js has no cross-table transaction.
const acceptInvite = async ({ token, email, companyId }) => {
  const invite = await getActiveInvite(token);

  if (invite.email.toLowerCase() !== String(email ?? "").toLowerCase()) {
    throw new AppError("This invite was sent to a different email address", 403);
  }

  const { error: stampError } = await supabase
    .from("jobsite_subcontractors")
    .update({
      sub_company_id: companyId,
      accepted_at: new Date().toISOString(),
      token: null,
      expires_at: null,
    })
    .eq("id", invite.id)
    .is("accepted_at", null)
    .select("id")
    .single();

  if (stampError) {
    // PGRST116 = accepted by another request after we read it; 23505 = this
    // company already holds a membership on the jobsite (jobsite_subs_company_unique).
    if (stampError.code === "PGRST116") {
      throw new AppError("This invite was just accepted. Reload and try again.", 409, {
        cause: stampError,
      });
    }
    if (stampError.code === "23505") {
      throw new AppError("Your company is already on this job site", 409, {
        cause: stampError,
      });
    }
    throw new AppError("Could not accept the invite", 502, { cause: stampError });
  }

  try {
    return await projectsService.create({
      id: uuidv4(),
      ownerCompanyId: companyId,
      name: invite.jobsiteName,
      jobsiteId: invite.jobsiteId,
    });
  } catch (projectError) {
    const { error: rollbackError } = await supabase
      .from("jobsite_subcontractors")
      .update({
        sub_company_id: null,
        accepted_at: null,
        token,
        expires_at: getInviteExpiry().toISOString(),
      })
      .eq("id", invite.id);
    if (rollbackError) {
      console.error("jobsites: failed to roll back an accepted invite", rollbackError);
    }
    throw projectError;
  }
};

// Removes a sub from a jobsite the caller's GC company owns. The sub's
// project rows are detached (jobsite_id and gc_company_id nulled — the GC
// loses dashboard access to them, same as an unlink) BEFORE the roster row is
// deleted, so a failure between the two leaves a retryable roster row rather
// than a project still granting GC access with no membership behind it.
const removeSubcontractor = async ({ jobsiteId, subId, gcCompanyId }) => {
  await getOwnedJobsite(jobsiteId, gcCompanyId);

  const { data: sub, error: readError } = await supabase
    .from("jobsite_subcontractors")
    .select("id, sub_company_id")
    .eq("id", subId)
    .eq("jobsite_id", jobsiteId)
    .single();

  if (readError) {
    if (readError.code === "PGRST116") {
      throw new AppError("Subcontractor not found", 404, { cause: readError });
    }
    throw new AppError("Could not remove the subcontractor", 502, { cause: readError });
  }

  if (sub.sub_company_id) {
    const { error: detachError } = await supabase
      .from("projects")
      .update({ jobsite_id: null, gc_company_id: null })
      .eq("jobsite_id", jobsiteId)
      .eq("owner_company_id", sub.sub_company_id);

    if (detachError) {
      throw new AppError("Could not remove the subcontractor", 502, { cause: detachError });
    }
  }

  const { error: deleteError } = await supabase
    .from("jobsite_subcontractors")
    .delete()
    .eq("id", subId);

  if (deleteError) {
    throw new AppError("Could not remove the subcontractor", 502, { cause: deleteError });
  }

  return { id: sub.id };
};

module.exports = {
  create,
  listForGc,
  update,
  createInvite,
  previewInvite,
  acceptInvite,
  removeSubcontractor,
};
