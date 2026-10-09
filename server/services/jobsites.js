const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { generateInviteToken, getInviteExpiry } = require("../utility/inviteToken");
const { effectiveJobsiteLimit, hasSiteProAccess } = require("../utility/entitlements");
const { countRows } = require("../utility/countRows");
const projectsService = require("./projects");
const { isSubLocked } = require("../utility/subLocking");
const companiesService = require("./companies");
const subAccessService = require("./subAccess");
const { isJobsiteAllowed } = require("./siteScope");
const { effectiveCadence, isStricterOrEqual } = require("../utility/cadence");

// The columns every jobsites query selects, and the snake_case -> camelCase
// mapper applied to each row before it leaves the service. Services never
// leak DB column names to the controller layer.
const JOBSITE_COLUMNS =
  "id, gc_company_id, name, status, archived_at, origin, plan, meeting_cadence, sms_nudges_enabled, timezone, created_at";

// A NULL origin (a jobsite that predates the column) maps to false: unknown is
// never presented as sub-created.
const toJobsite = (row) => ({
  id: row.id,
  gcCompanyId: row.gc_company_id,
  name: row.name,
  status: row.status,
  archivedAt: row.archived_at,
  createdBySub: row.origin === "subcontractor",
  // 'free' | 'site_pro' (Phase 9b). Exposed so the client can gate/advertise
  // per-jobsite paid features (e.g. the 9e Defense Bundle) without a second
  // round trip; the server is still the actual authority on every such route.
  plan: row.plan,
  // Effective Site Pro access: the site's own plan, or its company's GC
  // Portfolio (which covers every site). Needs the embedded `companies(tier)`;
  // without it (create/update responses) it reflects the site's own plan only.
  sitePro: hasSiteProAccess({ sitePlan: row.plan, companyTier: row.companies?.tier }),
  // 'daily' | 'weekly' -- the GC's default meeting cadence for this site; a
  // sub may tighten it for itself (setMyCadence). A row that predates the
  // column reads as daily, the original hardcoded rule.
  meetingCadence: row.meeting_cadence ?? "daily",
  // Phase 9e SMS nudges: per-site opt-in and the IANA zone the Monday 7:00 AM
  // send is evaluated in (docs/sms-nudges-design.md).
  smsNudgesEnabled: row.sms_nudges_enabled ?? false,
  timezone: row.timezone ?? null,
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
const INVALID_JOIN_LINK_MESSAGE = "This job site link is invalid";

// A jobsite with its roster embedded, for the GC's list view. The token is
// deliberately absent from both the select and the mapped shape.
// `unlocked` (Phase 9d, from subAccess.getUnlockedSubIds) hides a locked sub's
// email and company name; the row id stays so the GC can still remove it.
const toJobsiteWithRoster = (row, unlocked) => ({
  ...toJobsite(row),
  subcontractors: (row.jobsite_subcontractors ?? []).map((sub) => {
    // A pending invite has no sub company yet, so there is nothing to lock.
    const locked = Boolean(sub.sub_company_id) && isSubLocked(unlocked, sub.sub_company_id);
    const inHouse =
      Boolean(sub.sub_company_id) && sub.companies?.parent_gc_company_id === row.gc_company_id;
    return {
      id: sub.id,
      email: locked ? null : sub.invited_email,
      status: sub.accepted_at ? "accepted" : "pending",
      companyName: locked ? null : (sub.companies?.name ?? null),
      // Phase 13: an in-house crew is a child company of this GC. The id is only
      // exposed for a crew (the client matches it to offer "Add in-house crew").
      companyId: !locked && inHouse ? sub.sub_company_id : null,
      inHouse,
      locked,
    };
  }),
});

// Whether the caller's GC company owns at least one live (active, not
// archived), paid Site Pro jobsite (Phase 11c) -- GC Site Pro is a per-site
// purchase (jobsites.plan), not a company-level tier, so this is the only
// way to answer "does this GC have Site Pro" at all. Mirrors sponsorship.js's
// isSponsored shape, but queries jobsites directly (the GC's own sites)
// rather than jobsite_subcontractors (a sub's membership on someone else's).
const hasActiveSitePro = async (gcCompanyId) => {
  const count = await countRows(
    supabase
      .from("jobsites")
      .select("id", { count: "exact", head: true })
      .eq("gc_company_id", gcCompanyId)
      .eq("plan", "site_pro")
      .eq("status", "active")
      .is("archived_at", null),
    "Could not check your job site plan",
  );
  return count > 0;
};

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

// Puts an in-house crew (Phase 13, docs/in-house-subs-design.md) on a jobsite
// with no invite or token: an already-accepted roster row, then the crew's own
// `projects` row through the same validated path acceptJoinLink uses. Roster
// first, project second, so the admission check is already true when the
// project insert runs. Idempotent: a roster row that already exists (23505) is
// kept, and the project is only created if the crew has none on this jobsite
// (heals the "roster without project" drift). The caller has already verified
// that the GC owns both the jobsite and the crew -- ids here are trusted.
const attachCrew = async ({ jobsiteId, jobsiteName, crewId }) => {
  const { data: inserted, error: insertError } = await supabase
    .from("jobsite_subcontractors")
    .insert({
      id: uuidv4(),
      jobsite_id: jobsiteId,
      sub_company_id: crewId,
      invited_email: null,
      accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError && insertError.code !== "23505") {
    throw new AppError("Could not add the crew to the job site", 502, { cause: insertError });
  }
  const insertedId = insertError ? null : inserted.id;

  try {
    const existingProjects = await countRows(
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("jobsite_id", jobsiteId)
        .eq("owner_company_id", crewId),
      "Could not check the crew's project",
    );
    if (existingProjects === 0) {
      await projectsService.create({
        id: uuidv4(),
        ownerCompanyId: crewId,
        name: jobsiteName,
        jobsiteId,
      });
    }
  } catch (projectError) {
    // Only undo a roster row this call inserted -- never one that was already there.
    if (insertedId) {
      const { error: rollbackError } = await supabase
        .from("jobsite_subcontractors")
        .delete()
        .eq("id", insertedId);
      if (rollbackError) {
        console.error("jobsites: failed to roll back an in-house crew attach", rollbackError);
      }
    }
    throw projectError;
  }

  return { alreadyAttached: insertedId === null };
};

// Attaches one in-house crew to a jobsite the caller's GC owns -- used to
// re-add a crew the GC removed from a site. Another GC's jobsite or crew is a
// 404, a site outside a site-scoped user's assigned sites too. An archived or
// non-active jobsite, or an archived crew, is a 409: nothing should newly join them.
const attachInHouseCrew = async ({ jobsiteId, crewId, gcCompanyId, allowedJobsiteIds = null }) => {
  const jobsite = await getOwnedJobsite(jobsiteId, gcCompanyId, allowedJobsiteIds);
  const crew = await companiesService.getOwnedCrew(crewId, gcCompanyId);

  if (jobsite.archivedAt || jobsite.status !== "active") {
    throw new AppError("That job site is not active", 409);
  }
  if (crew.archivedAt) {
    throw new AppError("That crew is archived. Restore it first.", 409);
  }

  return attachCrew({ jobsiteId, jobsiteName: jobsite.name, crewId });
};

// Best-effort attach used by `create`: the live (non-archived) in-house crews the
// GC picked join the new jobsite. The ownership filter is in the query itself,
// so an id that is another GC's, archived or unknown is silently skipped. A
// failure is logged, never thrown -- a working jobsite with a crew missing is
// recoverable via attachInHouseCrew, a failed jobsite create is not what the
// GC asked for.
const attachChosenCrews = async ({ gcCompanyId, jobsite, crewIds }) => {
  if (crewIds.length === 0) return;

  const { data: crews, error } = await supabase
    .from("companies")
    .select("id")
    .in("id", crewIds)
    .eq("parent_gc_company_id", gcCompanyId)
    .is("archived_at", null);

  if (error) {
    console.error("jobsites: could not load in-house crews to attach", error);
    return;
  }

  const results = await Promise.allSettled(
    crews.map((crew) =>
      attachCrew({ jobsiteId: jobsite.id, jobsiteName: jobsite.name, crewId: crew.id }),
    ),
  );
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("jobsites: could not attach an in-house crew", result.reason);
    }
  });
};

// jobsites.id has no DB default (docs/jobsite-design.md's offline-sync-rule
// exception, same as company_invites.id) — creating a jobsite is an
// online-only action, so the server mints the id here rather than the client
// generating one before an offline write, the way projects.create does.
// `crewIds` are the in-house crews the GC ticked in the job site form; none are
// attached automatically.
const create = async ({ gcCompanyId, name, crewIds = [] }) => {
  await assertJobsiteAvailable(gcCompanyId);

  const { data, error } = await supabase
    .from("jobsites")
    .insert({ id: uuidv4(), gc_company_id: gcCompanyId, name, origin: "gc" })
    .select(JOBSITE_COLUMNS)
    .single();

  if (error) {
    throw new AppError("Could not create the jobsite", 502, { cause: error });
  }

  const jobsite = toJobsite(data);
  await attachChosenCrews({ gcCompanyId, jobsite, crewIds });
  return jobsite;
};

// Every jobsite the caller's GC company owns, newest first — same ordering
// projects.listForCompany uses — each with its roster (pending invites and
// accepted subs) embedded. Includes archived jobsites; nothing consumes this
// list yet (8d-e), so there's no includeArchived toggle to wire up.
const listForGc = async (gcCompanyId, allowedJobsiteIds = null) => {
  // A site-scoped user (Phase 9d-2) only lists their assigned jobsites.
  if (allowedJobsiteIds !== null && allowedJobsiteIds.length === 0) return [];

  let query = supabase
    .from("jobsites")
    .select(
      `${JOBSITE_COLUMNS}, companies(tier), jobsite_subcontractors(id, sub_company_id, invited_email, accepted_at, companies(name, parent_gc_company_id))`,
    )
    .eq("gc_company_id", gcCompanyId);
  if (allowedJobsiteIds !== null) query = query.in("id", allowedJobsiteIds);

  const [{ data, error }, unlocked] = await Promise.all([
    query.order("created_at", { ascending: false }),
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

  // Turning SMS nudges on needs Site Pro access on this site (own plan or the
  // company's GC Portfolio); turning them off is always allowed.
  if (patch.smsNudgesEnabled === true) {
    const current = await getOwnedJobsite(id, gcCompanyId);
    if (!current.sitePro) {
      throw new AppError("SMS nudges are part of GC Site Pro. Upgrade this site to use them.", 403, {
        data: { code: "PLAN_LIMIT" },
      });
    }
  }

  const nextPatch = {};
  if (patch.name !== undefined) nextPatch.name = patch.name;
  if (patch.smsNudgesEnabled !== undefined) nextPatch.sms_nudges_enabled = patch.smsNudgesEnabled;
  if (patch.timezone !== undefined) nextPatch.timezone = patch.timezone;
  if (patch.status !== undefined) nextPatch.status = patch.status;
  if (patch.meetingCadence !== undefined) nextPatch.meeting_cadence = patch.meetingCadence;
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
// (404), same as update -- and so is a jobsite outside a site-scoped user's
// assigned sites (Phase 9d-2; null `allowedJobsiteIds` = company-wide).
const getOwnedJobsite = async (id, gcCompanyId, allowedJobsiteIds = null) => {
  if (!isJobsiteAllowed(allowedJobsiteIds, id)) {
    throw new AppError("Jobsite not found", 404);
  }

  const { data, error } = await supabase
    .from("jobsites")
    .select(`${JOBSITE_COLUMNS}, companies(name, tier)`)
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
const createInvite = async ({ jobsiteId, gcCompanyId, email, allowedJobsiteIds = null }) => {
  const jobsite = await getOwnedJobsite(jobsiteId, gcCompanyId, allowedJobsiteIds);

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

// A generated token can collide with another jobsite's (UNIQUE -> 23505).
// With generateInviteToken's 256-bit space that's vanishingly rare, so a
// handful of retries is plenty — same reasoning/count as
// companies.getOrCreateJoinCode's JOIN_CODE_MAX_ATTEMPTS.
const JOIN_TOKEN_MAX_ATTEMPTS = 5;

const readJoinToken = async (jobsiteId) => {
  const { data, error } = await supabase
    .from("jobsites")
    .select("join_token")
    .eq("id", jobsiteId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Jobsite not found", 404, { cause: error });
    }
    throw new AppError("Could not load this job site's link", 502, { cause: error });
  }

  return data.join_token;
};

// GET /api/jobsites/:id/join-link (Phase 9e, docs/jobsite-qr-join-design.md)
// — the jobsite's own standing QR/join link, created lazily on first ask
// (jobsites.join_token is NULL until then). Unlike the per-invite token, this
// one is meant to be publicly displayed (in a QR code or a printed poster),
// the same trust model companies.join_code already has. The
// `.is("join_token", null)` guard makes the write race-safe without a
// transaction, the identical trick getOrCreateJoinCode uses.
const getOrCreateJoinToken = async ({ jobsiteId, gcCompanyId, allowedJobsiteIds = null }) => {
  await getOwnedJobsite(jobsiteId, gcCompanyId, allowedJobsiteIds);

  const existing = await readJoinToken(jobsiteId);
  if (existing) return existing;

  for (let attempt = 0; attempt < JOIN_TOKEN_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from("jobsites")
      .update({ join_token: generateInviteToken() })
      .eq("id", jobsiteId)
      .is("join_token", null)
      .select("join_token");

    if (error) {
      if (error.code === "23505") continue;
      throw new AppError("Could not create this job site's link", 502, { cause: error });
    }
    if (data.length === 0) return readJoinToken(jobsiteId);
    return data[0].join_token;
  }

  throw new AppError("Could not create a job site link, please try again", 502);
};

// Shared lookup for the QR/join-link admission path: resolves a jobsite by
// its standing join_token. Unlike getActiveInvite there is no expiry to check
// and no invited email to return — the token itself is the only fact.
const getJobsiteByJoinToken = async (token) => {
  const { data, error } = await supabase
    .from("jobsites")
    .select("id, name, gc_company_id, companies(name)")
    .eq("join_token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(INVALID_JOIN_LINK_MESSAGE, 404, { cause: error });
    }
    throw new AppError("Could not look up this job site link", 502, { cause: error });
  }

  return {
    jobsiteId: data.id,
    jobsiteName: data.name,
    gcCompanyId: data.gc_company_id,
    gcCompanyName: data.companies?.name ?? null,
  };
};

// GET /api/jobsites/join/:token — public preview, before any account exists.
const previewJoinLink = async (token) => {
  const jobsite = await getJobsiteByJoinToken(token);
  return { gcCompanyName: jobsite.gcCompanyName, jobsiteName: jobsite.jobsiteName };
};

// Self-admits the caller's own subcontractor company onto a jobsite via its
// standing QR/join link (Phase 9e). Decided with the user: no GC approval —
// the GC's existing roster visibility and removeSubcontractor are the
// control, not a gate before joining. Unlike acceptInvite there is no
// pending row to stamp (a fresh accepted row is inserted directly) and no
// email check applies (there is no invited email). Re-scanning a link the
// caller's company already accepted is an idempotent success, not an error —
// unlike a repeat email-invite accept, scanning the same poster twice is
// ordinary behavior, so a jobsite_subs_company_unique conflict (23505) is
// swallowed rather than thrown.
const acceptJoinLink = async ({ token, companyId }) => {
  const jobsite = await getJobsiteByJoinToken(token);

  const { data: inserted, error: insertError } = await supabase
    .from("jobsite_subcontractors")
    .insert({
      id: uuidv4(),
      jobsite_id: jobsite.jobsiteId,
      sub_company_id: companyId,
      invited_email: null,
      accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { alreadyMember: true };
    }
    throw new AppError("Could not join this job site", 502, { cause: insertError });
  }

  try {
    const project = await projectsService.create({
      id: uuidv4(),
      ownerCompanyId: companyId,
      name: jobsite.jobsiteName,
      jobsiteId: jobsite.jobsiteId,
    });
    return { ...project, alreadyMember: false };
  } catch (projectError) {
    const { error: rollbackError } = await supabase
      .from("jobsite_subcontractors")
      .delete()
      .eq("id", inserted.id);
    if (rollbackError) {
      console.error("jobsites: failed to roll back an accepted join link", rollbackError);
    }
    throw projectError;
  }
};

// Removes a sub from a jobsite the caller's GC company owns. The sub's
// project rows are detached (jobsite_id and gc_company_id nulled — the GC
// loses dashboard access to them, same as an unlink) BEFORE the roster row is
// deleted, so a failure between the two leaves a retryable roster row rather
// than a project still granting GC access with no membership behind it.
const removeSubcontractor = async ({
  jobsiteId,
  subId,
  gcCompanyId,
  allowedJobsiteIds = null,
}) => {
  await getOwnedJobsite(jobsiteId, gcCompanyId, allowedJobsiteIds);

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

// The caller's own subcontractor company's live memberships, for the
// cadence setting: one row per jobsite it has accepted, with the GC's default,
// the company's own override (null = inherit) and the resulting effective
// cadence. Archived/non-active jobsites are left out -- nothing to configure.
const listMemberships = async (companyId) => {
  const { data, error } = await supabase
    .from("jobsite_subcontractors")
    .select(
      "jobsite_id, meeting_cadence, jobsites!inner(name, status, archived_at, meeting_cadence)",
    )
    .eq("sub_company_id", companyId)
    .not("accepted_at", "is", null)
    .eq("jobsites.status", "active")
    .is("jobsites.archived_at", null);

  if (error) {
    throw new AppError("Could not load your job sites", 502, { cause: error });
  }

  return data.map((row) => {
    const jobsiteCadence = row.jobsites.meeting_cadence ?? "daily";
    return {
      jobsiteId: row.jobsite_id,
      jobsiteName: row.jobsites.name,
      jobsiteCadence,
      subCadence: row.meeting_cadence ?? null,
      effectiveCadence: effectiveCadence(jobsiteCadence, row.meeting_cadence),
    };
  });
};

// Sets (or, with `cadence: null`, clears) the caller's company's own cadence
// override on a jobsite it belongs to. An override may only tighten the GC's
// default (daily on a weekly site), never relax it: a looser one is a 422. A
// jobsite the company isn't an accepted member of is a 404, same as a missing
// one.
const setMyCadence = async ({ jobsiteId, companyId, cadence }) => {
  const { data: membership, error: readError } = await supabase
    .from("jobsite_subcontractors")
    .select("id, jobsites!inner(meeting_cadence)")
    .eq("jobsite_id", jobsiteId)
    .eq("sub_company_id", companyId)
    .not("accepted_at", "is", null)
    .single();

  if (readError) {
    if (readError.code === "PGRST116") {
      throw new AppError("Jobsite not found", 404, { cause: readError });
    }
    throw new AppError("Could not load your job site", 502, { cause: readError });
  }

  const jobsiteCadence = membership.jobsites.meeting_cadence ?? "daily";
  if (cadence !== null && !isStricterOrEqual(cadence, jobsiteCadence)) {
    throw new AppError(
      `This job site requires ${jobsiteCadence} meetings; you can only make it stricter`,
      422,
    );
  }

  const { error: updateError } = await supabase
    .from("jobsite_subcontractors")
    .update({ meeting_cadence: cadence })
    .eq("id", membership.id);

  if (updateError) {
    throw new AppError("Could not update your meeting cadence", 502, {
      cause: updateError,
    });
  }

  return {
    jobsiteId,
    jobsiteCadence,
    subCadence: cadence,
    effectiveCadence: effectiveCadence(jobsiteCadence, cadence),
  };
};

module.exports = {
  listMemberships,
  setMyCadence,
  create,
  listForGc,
  update,
  createInvite,
  previewInvite,
  acceptInvite,
  getOrCreateJoinToken,
  previewJoinLink,
  acceptJoinLink,
  removeSubcontractor,
  attachCrew,
  attachInHouseCrew,
  getOwnedJobsite,
  hasActiveSitePro,
};
