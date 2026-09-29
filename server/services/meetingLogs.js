const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { buildPdfFilename } = require("../utility/pdfFilename");
const { resolveHeldAt, resolveHeldTzOffset } = require("../utility/heldAt");
const entitlementsService = require("../utility/entitlements");
const contentSeal = require("../utility/contentSeal");
const pdfGenerationQueue = require("./pdfGenerationQueue");
const storageService = require("./storage");
const projectsService = require("./projects");
const companiesService = require("./companies");
const auditLogService = require("./auditLog");

// The columns every meeting_logs query selects, and the snake_case ->
// camelCase mapper applied to each row before it leaves the service. Services
// never leak DB column names to the controller layer.
const MEETING_LOG_COLUMNS =
  "id, project_id, talk_id, foreman_id, company_id, crew_photo_url, final_pdf_url, completed_at, held_at, held_tz_offset, synced_at, created_at, content_seal, sealed_at";

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
  // The foreman's `Date#getTimezoneOffset()` when held, display-only (not
  // sealed); null for meetings completed before it was stored -> UTC display.
  heldTzOffset: row.held_tz_offset ?? null,
  syncedAt: row.synced_at,
  createdAt: row.created_at,
  // Phase 9e tamper-evidence (docs/tamper-evidence-design.md): null until
  // complete() seals the row, and for every meeting completed before this
  // feature shipped (not backfilled). Never verified by comparing this
  // string client-side — always go through verifySeal below.
  contentSeal: row.content_seal,
  sealedAt: row.sealed_at,
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

  await auditLogService.record({
    meetingLogId: data.id,
    eventType: "created",
    actorId: foremanId,
    metadata: { projectId, talkId: talkId ?? null },
  });

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
// assertNotLoggedAnywhere. Returns the row's fields (already scoped to the
// caller's company) so callers that need them next don't have to look the
// meeting up twice: signatures.create needs talkId to score against the
// talk's quiz; complete() below needs the rest to build its tamper-evidence
// seal payload (docs/tamper-evidence-design.md).
const assertNotCompleted = async (id, companyId) => {
  const { data, error } = await supabase
    .from("meeting_logs")
    .select("id, project_id, talk_id, foreman_id, crew_photo_url, completed_at")
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

  return {
    id: data.id,
    projectId: data.project_id,
    talkId: data.talk_id,
    foremanId: data.foreman_id,
    crewPhotoUrl: data.crew_photo_url,
  };
};

// Finalizes a meeting: requires at least one signature (an attendance record
// with zero attendees isn't a valid completed meeting) and, once stamped,
// locks the meeting_log and its signatures via assertNotCompleted. Also
// computes and stores the tamper-evidence content seal in this same update
// (docs/tamper-evidence-design.md "Delivery") — atomically, so a completed
// meeting can never exist unsealed — then triggers the Phase 5 PDF-generation
// pipeline (see pdfGenerationQueue.js), which stays soft-fail: a PDF/upload
// failure never unwinds completed_at/content_seal or fails this call.
//
// `completed_at` is stamped at server receipt (the audit record); `held_at` is
// the optional client-reported time the meeting was actually held, resolved by
// resolveHeldAt (which falls back to receipt time and never throws — see
// utility/heldAt.js for why a bad value must not fail this call). Both use the
// same `now` so an on-time completion has identical timestamps, and the seal
// covers whichever `heldAt` ends up stored. `heldTzOffset` (the foreman's
// timezone offset) is display-only and deliberately NOT sealed — adding it to
// the payload would invalidate every already-sealed meeting.
//
// `actorId` is the completing user (req.user.id) — distinct from the
// meeting's original `foremanId` when someone else finishes a draft another
// foreman started — recorded on the `completed` audit event, not on the row
// itself.
const complete = async ({ id, companyId, heldAt, heldTzOffset, actorId = null }) => {
  const meetingInfo = await assertNotCompleted(id, companyId);

  const { data: signatures, error: signaturesError } = await supabase
    .from("signatures")
    .select("id, worker_name, quiz_score, quiz_passed")
    .eq("meeting_id", id);

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
  const resolvedHeldAt = resolveHeldAt({ heldAt, now });
  const nowIso = now.toISOString();

  const seal = contentSeal.computeSeal(
    contentSeal.buildCanonicalPayload({
      meetingLog: {
        id: meetingInfo.id,
        projectId: meetingInfo.projectId,
        talkId: meetingInfo.talkId,
        companyId,
        foremanId: meetingInfo.foremanId,
        crewPhotoUrl: meetingInfo.crewPhotoUrl,
        heldAt: resolvedHeldAt,
        completedAt: nowIso,
      },
      signatures: signatures.map((s) => ({
        id: s.id,
        workerName: s.worker_name,
        quizScore: s.quiz_score,
        quizPassed: s.quiz_passed,
      })),
    }),
  );

  const { data, error } = await supabase
    .from("meeting_logs")
    .update({
      completed_at: nowIso,
      held_at: resolvedHeldAt,
      held_tz_offset: resolveHeldTzOffset(heldTzOffset),
      content_seal: seal,
      sealed_at: nowIso,
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

  await auditLogService.record({
    meetingLogId: id,
    eventType: "completed",
    actorId,
    metadata: { signatureCount: signatures.length },
  });

  await pdfGenerationQueue.enqueue(id, companyId);

  return toMeetingLog(data);
};

// Recomputes a completed meeting's content seal from current DB state and
// compares it to what was stored at completion (docs/tamper-evidence-design.md
// "Endpoint contract"). Every call — whether it comes back valid or
// tampered — is itself recorded as a seal_verified audit event, so the audit
// trail shows every time someone checked, not just failures.
const verifySeal = async (id, companyId, actorId = null) => {
  const { data, error } = await supabase
    .from("meeting_logs")
    .select(
      "id, project_id, talk_id, foreman_id, crew_photo_url, held_at, completed_at, content_seal, sealed_at",
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Meeting not found", 404, { cause: error });
    }
    throw new AppError("Could not load the meeting", 502, { cause: error });
  }
  if (!data.content_seal) {
    throw new AppError("This meeting hasn't been sealed yet", 404);
  }

  const { data: signatures, error: signaturesError } = await supabase
    .from("signatures")
    .select("id, worker_name, quiz_score, quiz_passed")
    .eq("meeting_id", id);
  if (signaturesError) {
    throw new AppError("Could not verify the meeting's signatures", 502, {
      cause: signaturesError,
    });
  }

  const expectedSeal = contentSeal.computeSeal(
    contentSeal.buildCanonicalPayload({
      meetingLog: {
        id: data.id,
        projectId: data.project_id,
        talkId: data.talk_id,
        companyId,
        foremanId: data.foreman_id,
        crewPhotoUrl: data.crew_photo_url,
        heldAt: data.held_at,
        completedAt: data.completed_at,
      },
      signatures: signatures.map((s) => ({
        id: s.id,
        workerName: s.worker_name,
        quizScore: s.quiz_score,
        quizPassed: s.quiz_passed,
      })),
    }),
  );

  const valid = contentSeal.sealsMatch(expectedSeal, data.content_seal);

  await auditLogService.record({
    meetingLogId: id,
    eventType: "seal_verified",
    actorId,
    metadata: { valid, via: "sub" },
  });

  return { valid, sealedAt: data.sealed_at };
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
    tzOffset: meeting.heldTzOffset,
  });

  return storageService.getSignedUrl(
    PDF_BUCKET,
    meeting.finalPdfUrl,
    PDF_URL_TTL_SECONDS,
    filename,
  );
};

// The sub-side "Defense Bundle" (docs/sub-defense-bundle-design.md): every
// completed meeting log the caller's own company has ever logged, across
// every project/client, as one ZIP — there's no jobsite-equivalent grouping
// to scope this to the way the GC bundle scopes to one jobsite
// (getDefenseBundleEntries in gcDashboard.js), so this is a flat export of
// everything, matching the Meeting History page it's downloaded from.
//
// Gated on a paid trade plan (Trade Pro/Enterprise, `archiveYears > 0`) —
// Trade Free keeps today's one-at-a-time "Open PDF" flow.  `companyType`/
// `tier` are passed in from `req.user` (already resolved by
// loadUserContext), not re-fetched from the DB the way this file's
// `getHistoryDays` controller helper does — no second row read needed for
// this gate.
const getDefenseBundleEntries = async (companyId, { companyType, tier }) => {
  const { archiveYears } = entitlementsService.getLimits(companyType, tier);
  if (archiveYears === 0) {
    throw new AppError(
      "Upgrade to Trade Pro to download your OSHA Defense Bundle",
      403,
      { data: { code: "PLAN_LIMIT" } },
    );
  }

  const { data, error } = await supabase
    .from("meeting_logs")
    .select(
      "id, held_at, held_tz_offset, completed_at, final_pdf_url, toolbox_talks(title), projects(name, gc_name_custom)",
    )
    .eq("company_id", companyId)
    .not("completed_at", "is", null)
    .order("held_at", { ascending: true });

  if (error) {
    throw new AppError("Could not load meeting logs", 502, { cause: error });
  }

  const ready = data.filter((row) => row.final_pdf_url);
  const skippedCount = data.length - ready.length;
  if (ready.length === 0) {
    throw new AppError(
      "No completed meeting logs with a generated PDF are available yet.",
      404,
    );
  }

  const company = await companiesService.getById(companyId);

  const entries = ready.map((row) => {
    const projectName = row.projects?.name ?? "project";
    const heldAt = row.held_at ?? row.completed_at;
    return {
      path: row.final_pdf_url,
      filename: buildPdfFilename({
        companyName: company.name,
        projectName,
        meetingDate: heldAt,
        meetingLogId: row.id,
        tzOffset: row.held_tz_offset,
      }),
      // The CSV's "Company" column holds the project's GC/client here, not
      // the caller's own company — every row would otherwise repeat the same
      // value, whereas which client each log belongs to is the signal a sub
      // juggling several GCs actually needs. `gc_name_custom` is populated
      // for every project, whether it's linked to a GC on TailgatePro or the
      // sub just typed the GC's name in by hand — so this works even for a GC
      // that doesn't use the app at all.
      companyName: row.projects?.gc_name_custom ?? "Unknown client",
      projectName,
      talkTitle: row.toolbox_talks?.title ?? null,
      heldAt,
    };
  });

  return { companyName: company.name, entries, skippedCount };
};

module.exports = {
  create,
  listForCompany,
  listMonthSummaries,
  countHiddenForCompany,
  getById,
  complete,
  verifySeal,
  assertNotCompleted,
  uploadCrewPhoto,
  getCrewPhotoUrl,
  pdfPath,
  setFinalPdfUrl,
  getPdfUrl,
  getDefenseBundleEntries,
  // Exposed so gcDashboard.js's own pdf-url lookup (built from the *meeting's*
  // company, not the caller's — see docs/gc-dashboard-design.md) can reuse
  // the same bucket/TTL instead of redeclaring them.
  PDF_BUCKET,
  PDF_URL_TTL_SECONDS,
};
