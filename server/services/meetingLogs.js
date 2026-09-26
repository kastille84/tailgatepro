const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { buildPdfFilename } = require("../utility/pdfFilename");
const { resolveHeldAt } = require("../utility/heldAt");
const pdfGenerationQueue = require("./pdfGenerationQueue");
const storageService = require("./storage");
const projectsService = require("./projects");
const companiesService = require("./companies");

// The columns every meeting_logs query selects, and the snake_case ->
// camelCase mapper applied to each row before it leaves the service. Services
// never leak DB column names to the controller layer.
const MEETING_LOG_COLUMNS =
  "id, project_id, talk_id, foreman_id, company_id, crew_photo_url, final_pdf_url, completed_at, held_at, synced_at, created_at";

const CREW_PHOTO_BUCKET = "crew-photos";
const CREW_PHOTO_URL_TTL_SECONDS = 300;
const PDF_BUCKET = "meeting-pdfs";
const PDF_URL_TTL_SECONDS = 300;

// `completedAt` is the server-receipt audit stamp; `heldAt` is when the meeting
// was actually held (client-reported, see utility/heldAt.js) and is what the
// PDF, its filename, the email and GC compliance windows all use. It falls
// back to `completed_at` here, once, for any completed row whose `held_at` was
// never populated, so no consumer has to repeat that fallback. Both are null
// for a meeting still in progress.
const toMeetingLog = (row) => ({
  id: row.id,
  projectId: row.project_id,
  talkId: row.talk_id,
  foremanId: row.foreman_id,
  companyId: row.company_id,
  crewPhotoUrl: row.crew_photo_url,
  finalPdfUrl: row.final_pdf_url,
  completedAt: row.completed_at,
  heldAt: row.held_at ?? row.completed_at,
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
// `historyDays` (null = unlimited) is the plan's in-app history window
// (Phase 9c): older rows are hidden, never deleted, so upgrading restores them.
const historyCutoff = (historyDays) =>
  new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000).toISOString();

// `from`/`to` (ISO timestamps, [from, to)) narrow the list to completed
// meetings held in that range — the month view. A row whose `held_at` was never
// populated falls back to `completed_at`, matching `toMeetingLog`.
const listForCompany = async (
  companyId,
  { projectId, historyDays = null, from, to } = {},
) => {
  let query = supabase
    .from("meeting_logs")
    .select(MEETING_LOG_COLUMNS)
    .eq("company_id", companyId);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  if (historyDays !== null) {
    query = query.gte("created_at", historyCutoff(historyDays));
  }
  if (from && to) {
    query = query
      .not("completed_at", "is", null)
      .or(
        `and(held_at.gte.${from},held_at.lt.${to}),and(held_at.is.null,completed_at.gte.${from},completed_at.lt.${to})`,
      );
  }

  const { data, error } = await query.order(from && to ? "held_at" : "created_at", {
    ascending: false,
  });

  if (error) {
    throw new AppError("Could not load meetings", 502, { cause: error });
  }

  return data.map(toMeetingLog);
};

const MONTH_PAGE_SIZE = 1000;

// One `{ month: "YYYY-MM", count }` per month that has a completed meeting,
// newest first, for the archive's month cards. A month is when the meeting was
// held (held_at, falling back to completed_at) in the viewer's timezone;
// `tzOffset` is minutes with the sign of `Date#getTimezoneOffset()` (UTC minus
// local). Pages through the rows in chunks because PostgREST caps a single
// response (1,000 rows by default), which a daily logger passes within
// three years.
const listMonthSummaries = async (companyId, { historyDays = null, tzOffset = 0 } = {}) => {
  const counts = new Map();

  for (let offset = 0; ; offset += MONTH_PAGE_SIZE) {
    let query = supabase
      .from("meeting_logs")
      .select("held_at, completed_at")
      .eq("company_id", companyId)
      .not("completed_at", "is", null);

    if (historyDays !== null) {
      query = query.gte("created_at", historyCutoff(historyDays));
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + MONTH_PAGE_SIZE - 1);

    if (error) {
      throw new AppError("Could not load meetings", 502, { cause: error });
    }

    for (const row of data) {
      const local = new Date(
        new Date(row.held_at ?? row.completed_at).getTime() - tzOffset * 60 * 1000,
      );
      const month = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }

    if (data.length < MONTH_PAGE_SIZE) break;
  }

  return [...counts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
};

// How many of the company's rows the history window hides, so the client can
// show an upgrade prompt. Always 0 for an unlimited plan (`historyDays` null).
const countHiddenForCompany = async (companyId, { projectId, historyDays = null } = {}) => {
  if (historyDays === null) {
    return 0;
  }

  let query = supabase
    .from("meeting_logs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .lt("created_at", historyCutoff(historyDays));

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { count, error } = await query;

  if (error) {
    throw new AppError("Could not load meetings", 502, { cause: error });
  }

  return count ?? 0;
};

// Scoped the same way as listForCompany: a meeting log belonging to another
// company is indistinguishable from a missing one (404), by design. Only the
// user-facing route passes `historyDays`; internal callers (complete, PDF
// generation) need the row regardless of the plan's history window.
const getById = async (id, companyId, { historyDays = null } = {}) => {
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

  if (historyDays !== null && new Date(data.created_at) < new Date(historyCutoff(historyDays))) {
    throw new AppError("This meeting is older than your plan's history. Upgrade to view it.", 403, {
      data: { code: "PLAN_LIMIT", limit: historyDays },
    });
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
// the Phase 5 PDF-generation pipeline (see pdfGenerationQueue.js) — soft-fail,
// so a PDF/upload failure never unwinds completed_at or fails this call.
//
// `completed_at` is stamped at server receipt (the audit record); `held_at` is
// the optional client-reported time the meeting was actually held, resolved by
// resolveHeldAt (which falls back to receipt time and never throws — see
// utility/heldAt.js for why a bad value must not fail this call). Both use the
// same `now` so an on-time completion has identical timestamps.
const complete = async ({ id, companyId, heldAt }) => {
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

  const now = new Date();
  const { data, error } = await supabase
    .from("meeting_logs")
    .update({
      completed_at: now.toISOString(),
      held_at: resolveHeldAt({ heldAt, now }),
    })
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

  await pdfGenerationQueue.enqueue(id, companyId);

  return toMeetingLog(data);
};

// The path a meeting's crew photo lives at, relative to the `crew-photos`
// bucket. A meeting has at most one crew photo (`crew_photo_url` is a single
// column, not a gallery), so there's no separate photo id in the path — a
// retake overwrites the same object (storage.uploadBlob always upserts).
const crewPhotoPath = (id) => `${id}/photo.jpg`;

// Uploads (or replaces) a meeting's crew photo. Blocked once the meeting is
// completed — an upload is new evidence attached to the record, subject to
// the same immutability rule as a new signature row.
const uploadCrewPhoto = async ({ id, companyId, buffer, contentType }) => {
  await assertNotCompleted(id, companyId);

  const path = crewPhotoPath(id);
  await storageService.uploadBlob(CREW_PHOTO_BUCKET, path, buffer, contentType);

  const { data, error } = await supabase
    .from("meeting_logs")
    .update({ crew_photo_url: path })
    .eq("id", id)
    .eq("company_id", companyId)
    .select(MEETING_LOG_COLUMNS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Meeting not found", 404, { cause: error });
    }
    throw new AppError("Could not save the crew photo", 502, { cause: error });
  }

  return toMeetingLog(data);
};

// A 5-minute signed URL for a meeting's crew photo, once one exists.
const getCrewPhotoUrl = async (id, companyId) => {
  const meeting = await getById(id, companyId);

  if (!meeting.crewPhotoUrl) {
    throw new AppError("No crew photo has been uploaded for this meeting", 404);
  }

  return storageService.getSignedUrl(
    CREW_PHOTO_BUCKET,
    meeting.crewPhotoUrl,
    CREW_PHOTO_URL_TTL_SECONDS,
  );
};

// The path a meeting's generated PDF report lives at, relative to the
// `meeting-pdfs` bucket. A meeting has at most one report (regenerating
// overwrites the same object, same as crewPhotoPath), so there's no separate
// report id in the path.
const pdfPath = (id) => `${id}/report.pdf`;

// Persists the Storage path of a meeting's generated PDF. Called by
// pdfGenerationQueue.js once the upload succeeds; failures here are caught
// and logged by the queue itself (soft-fail — see
// docs/meeting-flow-design.md's "Phase 5 hook point"), never surfaced to the
// caller of complete().
const setFinalPdfUrl = async (id, companyId, path) => {
  const { error } = await supabase
    .from("meeting_logs")
    .update({ final_pdf_url: path })
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    throw new AppError("Could not save the generated PDF", 502, { cause: error });
  }
};

// A 5-minute signed URL for a meeting's generated PDF report, once one
// exists — named for the browser's save-as dialog via buildPdfFilename
// (reporting company + project + date + a short id, so a GC juggling
// several subs on a site can tell whose report is whose, and multiple
// downloads don't all land as "report.pdf"). The finalPdfUrl guard runs
// first so a not-yet-generated PDF 404s without the extra lookups. A project
// with any completed meeting log can never be hard-deleted (projects.remove's
// own meeting_logs guard), so projectsService.getById is not expected to
// 404 here in practice; companiesService.getById(companyId) looks up the
// caller's own company (identical to meeting.companyId by construction of
// getById's scoping filter, so no second id to reconcile) and can't 404
// either — a genuine failure from either just propagates like anywhere else.
const getPdfUrl = async (id, companyId, { historyDays = null } = {}) => {
  const meeting = await getById(id, companyId, { historyDays });

  if (!meeting.finalPdfUrl) {
    throw new AppError("No PDF has been generated for this meeting yet", 404);
  }

  const [project, company] = await Promise.all([
    projectsService.getById(meeting.projectId, companyId),
    companiesService.getById(companyId),
  ]);

  const filename = buildPdfFilename({
    companyName: company.name,
    projectName: project.name,
    meetingDate: meeting.heldAt,
    meetingLogId: meeting.id,
  });

  return storageService.getSignedUrl(
    PDF_BUCKET,
    meeting.finalPdfUrl,
    PDF_URL_TTL_SECONDS,
    filename,
  );
};

module.exports = {
  create,
  listForCompany,
  listMonthSummaries,
  countHiddenForCompany,
  getById,
  complete,
  assertNotCompleted,
  uploadCrewPhoto,
  getCrewPhotoUrl,
  pdfPath,
  setFinalPdfUrl,
  getPdfUrl,
  // Exposed so gcDashboard.js's own pdf-url lookup (built from the *meeting's*
  // company, not the caller's — see docs/gc-dashboard-design.md) can reuse
  // the same bucket/TTL instead of redeclaring them.
  PDF_BUCKET,
  PDF_URL_TTL_SECONDS,
};
