const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const pdfGenerationQueue = require("./pdfGenerationQueue");

// The columns every meeting_logs query selects, and the snake_case ->
// camelCase mapper applied to each row before it leaves the service. Services
// never leak DB column names to the controller layer.
const MEETING_LOG_COLUMNS =
  "id, project_id, talk_id, foreman_id, company_id, crew_photo_url, final_pdf_url, completed_at, synced_at, created_at";

const toMeetingLog = (row) => ({
  id: row.id,
  projectId: row.project_id,
  talkId: row.talk_id,
  foremanId: row.foreman_id,
  companyId: row.company_id,
  crewPhotoUrl: row.crew_photo_url,
  finalPdfUrl: row.final_pdf_url,
  completedAt: row.completed_at,
  syncedAt: row.synced_at,
  createdAt: row.created_at,
});

// Creates a meeting log with the client-generated `id` (offline-sync
// convention, same as projects/talks). `company_id` is denormalized from the
// project at create time (docs/meeting-flow-design.md) rather than joined
// through projects on every later read — set once here, never updated after.
// The project must belong to the caller's company: without this check, a
// caller could attach a meeting log to any project id, regardless of who
// owns it.
const create = async ({ id, companyId, projectId, talkId, foremanId }) => {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_company_id", companyId)
    .single();

  if (projectError) {
    if (projectError.code === "PGRST116") {
      throw new AppError("Project not found", 404, { cause: projectError });
    }
    throw new AppError("Could not verify the project", 502, {
      cause: projectError,
    });
  }

  const { data, error } = await supabase
    .from("meeting_logs")
    .insert({
      id,
      project_id: projectId,
      talk_id: talkId ?? null,
      foreman_id: foremanId,
      company_id: companyId,
    })
    .select(MEETING_LOG_COLUMNS)
    .single();

  if (error) {
    // 23505 = unique_violation on meeting_logs.id (pkey) — this id was
    // already used (an offline-sync retry collision).
    if (error.code === "23505") {
      throw new AppError("This meeting already exists", 409, { cause: error });
    }
    throw new AppError("Could not create the meeting", 502, { cause: error });
  }

  return toMeetingLog(data);
};

// Every meeting log the caller's company owns, optionally scoped to one
// project. `companyId` comes from the caller's verified `users` row (via
// loadUserContext), never from request input.
const listForCompany = async (companyId, { projectId } = {}) => {
  let query = supabase
    .from("meeting_logs")
    .select(MEETING_LOG_COLUMNS)
    .eq("company_id", companyId);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Could not load meetings", 502, { cause: error });
  }

  return data.map(toMeetingLog);
};

// Scoped the same way as listForCompany: a meeting log belonging to another
// company is indistinguishable from a missing one (404), by design.
const getById = async (id, companyId) => {
  const { data, error } = await supabase
    .from("meeting_logs")
    .select(MEETING_LOG_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Meeting not found", 404, { cause: error });
    }
    throw new AppError("Could not load the meeting", 502, { cause: error });
  }

  return toMeetingLog(data);
};

// Shared guard: once a meeting_log is completed it's an immutable OSHA
// record — no further signatures, no further edits. Mirrors talks.js's
// assertNotLoggedAnywhere. Returns the row's id/talkId (already scoped to the
// caller's company) so callers that need it next — signatures.create, to
// score against the talk's quiz — don't have to look the meeting up twice.
const assertNotCompleted = async (id, companyId) => {
  const { data, error } = await supabase
    .from("meeting_logs")
    .select("id, talk_id, completed_at")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Meeting not found", 404, { cause: error });
    }
    throw new AppError("Could not verify the meeting's status", 502, {
      cause: error,
    });
  }

  if (data.completed_at) {
    throw new AppError(
      "This meeting has already been completed and can't be changed.",
      409,
    );
  }

  return { id: data.id, talkId: data.talk_id };
};

// Finalizes a meeting: requires at least one signature (an attendance record
// with zero attendees isn't a valid completed meeting) and, once stamped,
// locks the meeting_log and its signatures via assertNotCompleted. Triggers
// the Phase 5 PDF-generation hook — a no-op today, see pdfGenerationQueue.js.
const complete = async ({ id, companyId }) => {
  await assertNotCompleted(id, companyId);

  const { data: signatures, error: signaturesError } = await supabase
    .from("signatures")
    .select("id")
    .eq("meeting_id", id)
    .limit(1);

  if (signaturesError) {
    throw new AppError("Could not verify the meeting has signatures", 502, {
      cause: signaturesError,
    });
  }

  if (signatures.length === 0) {
    throw new AppError(
      "A meeting needs at least one signature before it can be completed.",
      409,
    );
  }

  const { data, error } = await supabase
    .from("meeting_logs")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
    .select(MEETING_LOG_COLUMNS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Meeting not found", 404, { cause: error });
    }
    throw new AppError("Could not complete the meeting", 502, { cause: error });
  }

  await pdfGenerationQueue.enqueue(id);

  return toMeetingLog(data);
};

module.exports = { create, listForCompany, getById, complete, assertNotCompleted };
