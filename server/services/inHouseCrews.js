const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { countRows } = require("../utility/countRows");
const companiesService = require("./companies");
const jobsitesService = require("./jobsites");

// In-house crews (Phase 13, docs/in-house-subs-design.md): a GC's own
// self-performing trades, each a real `subcontractor` company linked to the GC
// by `parent_gc_company_id`. `gcCompanyId` is always the caller's verified
// company (loadUserContext), never request input -- the parent is never taken
// from a request body.

const { CREW_COLUMNS, toCrew } = companiesService;

// 23505 on companies_parent_gc_name_unique: this GC already has a crew by that
// name (case-insensitive).
const DUPLICATE_NAME_MESSAGE = "You already have a crew with that name";

const listForGc = async (gcCompanyId) => {
  const { data, error } = await supabase
    .from("companies")
    .select(CREW_COLUMNS)
    .eq("parent_gc_company_id", gcCompanyId)
    .order("name", { ascending: true });

  if (error) {
    throw new AppError("Could not load your crews", 502, { cause: error });
  }

  return data.map(toCrew);
};

// Best-effort attach: a new crew joins the live (active, not archived) jobsites
// the GC picked. The ownership filter is in the query itself, so an id that is
// another GC's, archived or unknown is silently skipped. A failure is logged,
// never thrown -- a crew missing from one site is recoverable with
// attachInHouseCrew, a failed crew create is not what the GC asked for.
const attachToJobsites = async ({ gcCompanyId, crewId, jobsiteIds }) => {
  if (jobsiteIds.length === 0) return;

  const { data: jobsites, error } = await supabase
    .from("jobsites")
    .select("id, name")
    .in("id", jobsiteIds)
    .eq("gc_company_id", gcCompanyId)
    .eq("status", "active")
    .is("archived_at", null);

  if (error) {
    console.error("inHouseCrews: could not load jobsites to attach a new crew", error);
    return;
  }

  const results = await Promise.allSettled(
    jobsites.map((jobsite) =>
      jobsitesService.attachCrew({ jobsiteId: jobsite.id, jobsiteName: jobsite.name, crewId }),
    ),
  );
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("inHouseCrews: could not attach a new crew to a jobsite", result.reason);
    }
  });
};

// companies.id has no DB default and this is an online-only GC action, so the
// server mints the id (the same exception jobsites.id carries). The stored tier
// is always 'basic': a crew's effective plan is derived from its GC's.
// `jobsiteIds` are the sites the GC ticked in the crew form; none are attached
// automatically (a crew on a site that doesn't need it shows as "missing").
const create = async ({ gcCompanyId, name, jobsiteIds = [] }) => {
  const { data, error } = await supabase
    .from("companies")
    .insert({
      id: uuidv4(),
      name,
      company_type: "subcontractor",
      tier: "basic",
      parent_gc_company_id: gcCompanyId,
    })
    .select(CREW_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(DUPLICATE_NAME_MESSAGE, 409, { cause: error });
    }
    throw new AppError("Could not create the crew", 502, { cause: error });
  }

  const crew = toCrew(data);
  await attachToJobsites({ gcCompanyId, crewId: crew.id, jobsiteIds });
  return crew;
};

// Renames and/or archives/restores a crew. Ownership is checked first, so
// another GC's crew is a 404. Archiving only hides the crew from auto-attach and
// the attach endpoint; it does not detach it from sites or stop its foremen
// logging talks, and restoring does not re-attach it anywhere.
const update = async ({ id, gcCompanyId, patch }) => {
  await companiesService.getOwnedCrew(id, gcCompanyId);

  const nextPatch = {};
  if (patch.name !== undefined) nextPatch.name = patch.name;
  if (patch.archived !== undefined) {
    nextPatch.archived_at = patch.archived ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("companies")
    .update(nextPatch)
    .eq("id", id)
    .eq("parent_gc_company_id", gcCompanyId)
    .select(CREW_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(DUPLICATE_NAME_MESSAGE, 409, { cause: error });
    }
    if (error.code === "PGRST116") {
      throw new AppError("Crew not found", 404, { cause: error });
    }
    throw new AppError("Could not update the crew", 502, { cause: error });
  }

  return toCrew(data);
};

// Hard delete, only for a crew with nothing to lose: no meeting logs and no
// users. The compliance history and PDFs must outlive the GC's housekeeping, so
// anything else is a 409 pointing the GC at archive instead. The delete
// cascades the crew's projects and roster rows.
const remove = async ({ id, gcCompanyId }) => {
  await companiesService.getOwnedCrew(id, gcCompanyId);

  const failure = "Could not check whether the crew can be deleted";
  const [logCount, userCount] = await Promise.all([
    countRows(
      supabase.from("meeting_logs").select("id", { count: "exact", head: true }).eq("company_id", id),
      failure,
    ),
    countRows(
      supabase.from("users").select("id", { count: "exact", head: true }).eq("company_id", id),
      failure,
    ),
  ]);

  if (logCount > 0 || userCount > 0) {
    throw new AppError(
      "This crew has people or meeting history and can't be deleted. Archive it instead.",
      409,
    );
  }

  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", id)
    .eq("parent_gc_company_id", gcCompanyId);

  if (error) {
    throw new AppError("Could not delete the crew", 502, { cause: error });
  }

  return { id };
};

module.exports = { listForGc, create, update, remove };
