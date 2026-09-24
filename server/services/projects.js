const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { MANAGER_ROLES } = require("../constants/roles");
const companiesService = require("./companies");

// The columns every projects query selects, and the snake_case -> camelCase
// mapper applied to each row before it leaves the service. Services never leak
// DB column names to the controller layer.
const PROJECT_COLUMNS =
  "id, owner_company_id, name, gc_company_id, jobsite_id, gc_name_custom, gc_contact_email, status, archived_at, created_at";

const toProject = (row) => ({
  id: row.id,
  ownerCompanyId: row.owner_company_id,
  name: row.name,
  gcCompanyId: row.gc_company_id,
  jobsiteId: row.jobsite_id,
  gcNameCustom: row.gc_name_custom,
  gcContactEmail: row.gc_contact_email,
  status: row.status,
  archivedAt: row.archived_at,
  createdAt: row.created_at,
});

// Every project a company can see: the ones it owns (the subcontractor view)
// plus the ones where it is named as the GC. `companyId` comes from the caller's
// verified `users` row (via loadUserContext), never from request input, so the
// interpolation into the PostgREST `or` filter is not an injection vector.
// Archived projects are omitted unless `includeArchived` is set.
const listForCompany = async (companyId, { includeArchived = false } = {}) => {
  let query = supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .or(`owner_company_id.eq.${companyId},gc_company_id.eq.${companyId}`);

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Could not load projects", 502, { cause: error });
  }

  return data.map(toProject);
};

// The admission gate (Phase 8d, docs/jobsite-design.md "Authorization"): a
// subcontractor may attach a project to a jobsite only when an accepted
// jobsite_subcontractors row exists for (jobsiteId, its own company). Without
// this, any sub could POST { jobsiteId } and inject itself into any GC's
// dashboard — the same spoofing hole 6c closed for gcCompanyId. `companyId` is
// always the caller's verified company, never request input. A missing row is
// a 404: another GC's jobsite is indistinguishable from one that doesn't
// exist. Returns the jobsite's GC id + name so the caller can copy them onto
// the project row (one denormalized write, so no later read consults the
// roster).
const resolveAdmission = async (jobsiteId, companyId) => {
  const { data, error } = await supabase
    .from("jobsite_subcontractors")
    .select("jobsites(gc_company_id, companies(name))")
    .eq("jobsite_id", jobsiteId)
    .eq("sub_company_id", companyId)
    .not("accepted_at", "is", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Jobsite not found", 404, { cause: error });
    }
    throw new AppError("Could not verify the jobsite", 502, { cause: error });
  }

  return {
    gcCompanyId: data.jobsites.gc_company_id,
    gcName: data.jobsites.companies?.name ?? null,
  };
};

// Inserts a project with the client-supplied `id` (the offline-sync convention:
// PKs are generated client-side so offline records don't collide on sync). The
// DB `check_gc_info` constraint guarantees at least one of gc_company_id /
// gc_name_custom is present. gc_company_id is deliberately not accepted from
// the caller — it is only ever written server-side: by linkGc (below) via a
// join code, or here from an accepted jobsite roster row (`jobsiteId`, checked
// by resolveAdmission), so a project can't claim a GC company on its own say-so.
const create = async ({
  id,
  ownerCompanyId,
  name,
  gcNameCustom,
  gcContactEmail,
  jobsiteId,
}) => {
  let admission = null;
  if (jobsiteId) {
    admission = await resolveAdmission(jobsiteId, ownerCompanyId);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      id,
      owner_company_id: ownerCompanyId,
      name,
      // With a jobsite, the GC's registered name replaces whatever the sub
      // typed — same overwrite linkGc does, so every screen shows the real name.
      gc_name_custom: admission ? admission.gcName : (gcNameCustom ?? null),
      gc_contact_email: gcContactEmail ?? null,
      ...(admission && {
        jobsite_id: jobsiteId,
        gc_company_id: admission.gcCompanyId,
      }),
    })
    .select(PROJECT_COLUMNS)
    .single();

  if (error) {
    // 23505 = unique_violation on projects.id (pkey) — this id was already used.
    if (error.code === "23505") {
      throw new AppError("This project already exists", 409, { cause: error });
    }
    // 23514 = check_violation — check_gc_info: neither a GC company nor a
    // custom GC name was provided.
    if (error.code === "23514") {
      throw new AppError("A general contractor is required", 422, {
        cause: error,
      });
    }
    throw new AppError("Could not create the project", 502, { cause: error });
  }

  return toProject(data);
};

// A single project by id, scoped to the owning company — used by
// pdfGenerationQueue.js to fetch the project a completed meeting belongs to.
// Not the "owned-or-GC" visibility listForCompany grants; only the owner can
// fetch a project directly by id, same scoping update/remove already use.
const getById = async (id, companyId) => {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", id)
    .eq("owner_company_id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Project not found", 404, { cause: error });
    }
    throw new AppError("Could not load the project", 502, { cause: error });
  }

  return toProject(data);
};

// Patches an existing project the caller's company owns. Ownership is enforced
// in the query itself (`owner_company_id` eq the caller's company): a project
// owned by another company is indistinguishable from a missing one (404), by
// design. Only the keys actually present on `patch` are written.
//
// `archived` is a convenience alias: `true` stamps `archived_at` (archive),
// `false` clears it (restore) — gated on `role` (Phase 8a) rather than just
// company ownership, since any member of the owning company can rename a
// project but only a manager should be able to archive/restore/delete one.
// Gated here rather than as route middleware: this same PATCH handles plain
// field edits too, which stay open to any company member.
// A project linked to a GC is partly managed by that GC: the name of a
// jobsite-attached project is the GC's job site name (the GC dashboard still
// groups by it until Phase 8d-h, and it feeds the PDF filename), the GC name is
// the GC's registered name, and PDF delivery goes to the GC company's admin
// (pdfGenerationQueue.resolveGcContactEmail) so a manual GC email is moot.
// The sub owns the row, so nothing else stops it editing those — enforced here
// rather than trusting the form. Unchanged values pass through (a client may
// resend the whole form); an unlinked project is unrestricted. Only reads the
// row when the patch touches one of these fields.
const assertGcManagedFieldsUntouched = async ({ id, companyId, patch }) => {
  if (
    patch.name === undefined &&
    patch.gcNameCustom === undefined &&
    patch.gcContactEmail === undefined
  ) {
    return;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("name, gc_company_id, jobsite_id, gc_name_custom")
    .eq("id", id)
    .eq("owner_company_id", companyId)
    .single();

  if (error) {
    // PGRST116 = the id doesn't exist or isn't owned by this company.
    if (error.code === "PGRST116") {
      throw new AppError("Project not found", 404, { cause: error });
    }
    throw new AppError("Could not update the project", 502, { cause: error });
  }

  if (!data.gc_company_id) return;

  if (
    data.jobsite_id &&
    patch.name !== undefined &&
    patch.name !== data.name
  ) {
    throw new AppError(
      "This project's name is set by the general contractor's job site",
      403,
    );
  }
  if (
    patch.gcNameCustom !== undefined &&
    patch.gcNameCustom !== data.gc_name_custom
  ) {
    throw new AppError(
      "The general contractor's name is set by the linked company",
      403,
    );
  }
  if (patch.gcContactEmail) {
    throw new AppError(
      "Reports for a linked project go to the general contractor's account, so a contact email can't be set",
      403,
    );
  }
};

const update = async ({ id, companyId, role, patch }) => {
  await assertGcManagedFieldsUntouched({ id, companyId, patch });

  const nextPatch = {};
  if (patch.name !== undefined) nextPatch.name = patch.name;
  if (patch.status !== undefined) nextPatch.status = patch.status;
  if (patch.gcNameCustom !== undefined) {
    nextPatch.gc_name_custom = patch.gcNameCustom;
  }
  if (patch.gcContactEmail !== undefined) {
    nextPatch.gc_contact_email = patch.gcContactEmail;
  }
  if (patch.archived !== undefined) {
    if (!MANAGER_ROLES.includes(role)) {
      throw new AppError(
        "Only an admin or safety manager can archive or restore a project",
        403,
      );
    }
    nextPatch.archived_at = patch.archived ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("projects")
    .update(nextPatch)
    .eq("id", id)
    .eq("owner_company_id", companyId)
    .select(PROJECT_COLUMNS)
    .single();

  if (error) {
    // PGRST116 = no row returned by `.single()` — the id doesn't exist or isn't
    // owned by this company.
    if (error.code === "PGRST116") {
      throw new AppError("Project not found", 404, { cause: error });
    }
    if (error.code === "23514") {
      throw new AppError("A general contractor is required", 422, {
        cause: error,
      });
    }
    throw new AppError("Could not update the project", 502, { cause: error });
  }

  return toProject(data);
};

// Hard-deletes a project the caller's company owns — only when it has no
// `meeting_logs`. Once safety talks are logged against a site, deleting the
// project row would cascade them (and their `signatures`) away, destroying the
// OSHA records the product exists to keep; the caller must archive instead.
// `project_subcontractors` rows cascade away harmlessly, and Storage blob
// cleanup (crew photos / PDFs) is a Phase 4 concern once buckets exist.
// Gated on `role` (Phase 8a): only an admin/safety_manager, not just any
// member of the owning company.
const remove = async ({ id, companyId, role }) => {
  if (!MANAGER_ROLES.includes(role)) {
    throw new AppError(
      "Only an admin or safety manager can delete a project",
      403,
    );
  }

  const { data: logs, error: logsError } = await supabase
    .from("meeting_logs")
    .select("id")
    .eq("project_id", id)
    .limit(1);

  if (logsError) {
    throw new AppError("Could not delete the project", 502, {
      cause: logsError,
    });
  }

  if (logs.length > 0) {
    throw new AppError(
      "This project has logged safety talks and can't be deleted. Archive it instead.",
      409,
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("owner_company_id", companyId)
    .select("id")
    .single();

  if (error) {
    // PGRST116 = no row returned by `.single()` — the id doesn't exist or isn't
    // owned by this company.
    if (error.code === "PGRST116") {
      throw new AppError("Project not found", 404, { cause: error });
    }
    throw new AppError("Could not delete the project", 502, { cause: error });
  }

  return { id: data.id };
};

// Links a project the caller's (subcontractor) company owns to a GC via the GC's
// join code — the only path that sets projects.gc_company_id. Order matters:
// the project is fetched owner-scoped first (another company's project 404s,
// same as everywhere), then the code is resolved.
//
// gc_name_custom is overwritten with the GC's registered company name so every
// screen that shows it (project list, picker, PDF) shows the real name, not
// whatever the sub typed at create time. It's left in place on unlink, which
// keeps check_gc_info satisfied.
//
// Linking to the GC the project already has is idempotent and still re-upserts
// the roster row, so a retry heals a link whose roster write failed. The roster
// (project_subcontractors) is informational only — authorization keys on
// projects.gc_company_id, so a drift between the two writes is never a
// security issue (supabase-js has no cross-table transaction).
const linkGc = async ({ projectId, companyId, joinCode }) => {
  const project = await getById(projectId, companyId);
  const gc = await companiesService.getByJoinCode(joinCode);

  if (gc.id === companyId) {
    throw new AppError("That is your own company's join code", 422);
  }
  if (project.gcCompanyId && project.gcCompanyId !== gc.id) {
    throw new AppError(
      "This project is already linked to a different general contractor. Unlink it first.",
      409,
    );
  }

  let linked = project;
  if (project.gcCompanyId !== gc.id) {
    // `.is("gc_company_id", null)` makes the read-then-write above race-safe: if
    // a concurrent request linked it in between, nothing matches.
    const { data, error } = await supabase
      .from("projects")
      .update({ gc_company_id: gc.id, gc_name_custom: gc.name })
      .eq("id", projectId)
      .eq("owner_company_id", companyId)
      .is("gc_company_id", null)
      .select(PROJECT_COLUMNS)
      .single();

    if (error) {
      // PGRST116 = no row matched: the project was linked by another request
      // after we read it.
      if (error.code === "PGRST116") {
        throw new AppError(
          "This project was just changed. Reload and try again.",
          409,
          { cause: error },
        );
      }
      throw new AppError("Could not link the project", 502, { cause: error });
    }
    linked = toProject(data);
  }

  const { error: rosterError } = await supabase
    .from("project_subcontractors")
    .upsert(
      { project_id: projectId, sub_id: companyId },
      { onConflict: "project_id,sub_id", ignoreDuplicates: true },
    );

  if (rosterError) {
    throw new AppError("Could not link the project", 502, {
      cause: rosterError,
    });
  }

  return linked;
};

// Clears the GC link on a project the caller's company owns and drops its
// roster row. gc_name_custom is kept (it now holds the GC's name), so
// check_gc_info still holds. Unlinking a project that isn't linked is a no-op.
const unlinkGc = async ({ projectId, companyId }) => {
  const { data, error } = await supabase
    .from("projects")
    .update({ gc_company_id: null })
    .eq("id", projectId)
    .eq("owner_company_id", companyId)
    .select(PROJECT_COLUMNS)
    .single();

  if (error) {
    // PGRST116 = the id doesn't exist or isn't owned by this company.
    if (error.code === "PGRST116") {
      throw new AppError("Project not found", 404, { cause: error });
    }
    // 23514 = check_gc_info: no GC name left to fall back on.
    if (error.code === "23514") {
      throw new AppError(
        "Add a general contractor name before unlinking",
        422,
        { cause: error },
      );
    }
    throw new AppError("Could not unlink the project", 502, { cause: error });
  }

  const { error: rosterError } = await supabase
    .from("project_subcontractors")
    .delete()
    .eq("project_id", projectId)
    .eq("sub_id", companyId);

  if (rosterError) {
    throw new AppError("Could not unlink the project", 502, {
      cause: rosterError,
    });
  }

  return toProject(data);
};

module.exports = {
  listForCompany,
  getById,
  create,
  update,
  remove,
  linkGc,
  unlinkGc,
};
