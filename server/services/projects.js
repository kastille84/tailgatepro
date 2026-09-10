const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");

// The columns every projects query selects, and the snake_case -> camelCase
// mapper applied to each row before it leaves the service. Services never leak
// DB column names to the controller layer.
const PROJECT_COLUMNS =
  "id, owner_company_id, name, gc_company_id, gc_name_custom, status, archived_at, created_at";

const toProject = (row) => ({
  id: row.id,
  ownerCompanyId: row.owner_company_id,
  name: row.name,
  gcCompanyId: row.gc_company_id,
  gcNameCustom: row.gc_name_custom,
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

// Inserts a project with the client-supplied `id` (the offline-sync convention:
// PKs are generated client-side so offline records don't collide on sync). The
// DB `check_gc_info` constraint guarantees at least one of gc_company_id /
// gc_name_custom is present.
const create = async ({ id, ownerCompanyId, name, gcCompanyId, gcNameCustom }) => {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      id,
      owner_company_id: ownerCompanyId,
      name,
      gc_company_id: gcCompanyId ?? null,
      gc_name_custom: gcNameCustom ?? null,
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

// Patches an existing project the caller's company owns. Ownership is enforced
// in the query itself (`owner_company_id` eq the caller's company): a project
// owned by another company is indistinguishable from a missing one (404), by
// design. Only the keys actually present on `patch` are written.
//
// `archived` is a convenience alias: `true` stamps `archived_at` (archive),
// `false` clears it (restore). TODO(roles): once the invite/roles epic wires up
// `admin` / `safety_manager`, gate archive/restore (and delete) on role, not
// just company ownership.
const update = async ({ id, companyId, patch }) => {
  const nextPatch = {};
  if (patch.name !== undefined) nextPatch.name = patch.name;
  if (patch.status !== undefined) nextPatch.status = patch.status;
  if (patch.gcCompanyId !== undefined) nextPatch.gc_company_id = patch.gcCompanyId;
  if (patch.gcNameCustom !== undefined) {
    nextPatch.gc_name_custom = patch.gcNameCustom;
  }
  if (patch.archived !== undefined) {
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
// TODO(roles): gate on `admin` / `safety_manager` once roles are wired up.
const remove = async ({ id, companyId }) => {
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

module.exports = { listForCompany, create, update, remove };
