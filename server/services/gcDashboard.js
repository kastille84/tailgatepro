// GC-side read service (docs/gc-dashboard-design.md). Every function here
// takes `gcCompanyId` from the caller's verified `req.user.companyId`
// (loadUserContext), never from request input — that's what makes
// `gc_company_id = gcCompanyId` a safe authorization filter. A project not
// linked to the caller is indistinguishable from a missing one: 404, never
// 403, matching every other company-scoped lookup in this codebase.
//
// Minimum exposure (design doc "GC authorization and data exposure"): the row
// mappers here never include crew_photo_url, final_pdf_url or a signature's
// image path — only a derived `pdfReady` boolean and, on the detail view,
// worker name + quiz pass/fail.
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { dayWindow } = require("../utility/dayWindow");
const { computeCompliance } = require("../utility/compliance");
const { buildPdfFilename } = require("../utility/pdfFilename");
const companiesService = require("./companies");
const storageService = require("./storage");
const { PDF_BUCKET, PDF_URL_TTL_SECONDS } = require("./meetingLogs");

// No pagination in v1 (docs/tasks.md) — a GC juggling many subs still gets a
// bounded, readable response instead of an unbounded one.
const MEETINGS_LIST_LIMIT = 200;

const PROJECT_COLUMNS =
  "id, owner_company_id, jobsite_id, name, status, archived_at, created_at";

const toProject = (row) => ({
  id: row.id,
  ownerCompanyId: row.owner_company_id,
  jobsiteId: row.jobsite_id,
  name: row.name,
  status: row.status,
  archivedAt: row.archived_at,
  createdAt: row.created_at,
});

// Every project currently linked to this GC, oldest first (getOverview relies
// on that order to pick a sub's earliest project per jobsite).
const listLinkedProjects = async (gcCompanyId) => {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("gc_company_id", gcCompanyId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("Could not load linked projects", 502, { cause: error });
  }

  return data.map(toProject);
};

// { id -> name } for a set of companies. Used for the *sub's* company name on
// both the overview and the meetings list — a plain second query, not a
// PostgREST embed, because `projects` has two FKs to `companies`
// (owner_company_id and gc_company_id) and an embed would need a hint that
// can't be verified without live Supabase.
const getCompanyNamesByIds = async (ids) => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .in("id", uniqueIds);

  if (error) {
    throw new AppError("Could not load company names", 502, { cause: error });
  }

  return new Map(data.map((row) => [row.id, row.name]));
};

// Confirms `projectId` is currently linked to this GC — anything else
// (unknown id, a different GC's project, an unlinked one) is a 404. Returns
// the mapped project so callers that need its name next (getMeeting,
// getMeetingPdfUrl) don't have to look it up twice.
const assertGcLinkedProject = async (projectId, gcCompanyId) => {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", projectId)
    .eq("gc_company_id", gcCompanyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Project not found", 404, { cause: error });
    }
    throw new AppError("Could not verify the project", 502, { cause: error });
  }

  return toProject(data);
};

// Completed logs held inside [start, end) for a set of project ids. held_at
// is never null for a completed row (6b2 backfilled every pre-existing one
// from completed_at, and complete() always sets it going forward), so no
// held_at ?? completed_at fallback is needed on this path.
const listCompletedLogsInWindow = async (projectIds, window) => {
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("meeting_logs")
    .select("project_id, held_at")
    .in("project_id", projectIds)
    .not("completed_at", "is", null)
    .gte("held_at", window.start)
    .lt("held_at", window.end);

  if (error) {
    throw new AppError("Could not load meeting logs", 502, { cause: error });
  }

  return data;
};

// The GC's live jobsites (active, not archived) with their accepted roster
// embedded. A pending invite has no sub_company_id yet and is not a roster
// member — it can't be "missing" a log until it's accepted.
const listActiveJobsites = async (gcCompanyId) => {
  const { data, error } = await supabase
    .from("jobsites")
    .select("id, name, jobsite_subcontractors(sub_company_id, accepted_at)")
    .eq("gc_company_id", gcCompanyId)
    .eq("status", "active")
    .is("archived_at", null);

  if (error) {
    throw new AppError("Could not load jobsites", 502, { cause: error });
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    subIds: (row.jobsite_subcontractors ?? [])
      .filter((sub) => sub.sub_company_id && sub.accepted_at)
      .map((sub) => sub.sub_company_id),
  }));
};

// GET /api/gc/overview — the GC's real jobsites, each with a per-sub
// compliance status for the given day. The roster is the accepted members, so
// an accepted sub that never logged shows `missing`.
const getOverview = async (gcCompanyId, { date, tzOffset }) => {
  const window = dayWindow({ date, tzOffset });

  const [jobsiteRows, allProjects] = await Promise.all([
    listActiveJobsites(gcCompanyId),
    listLinkedProjects(gcCompanyId),
  ]);
  const projects = allProjects.filter(
    (project) =>
      project.jobsiteId && project.status === "active" && !project.archivedAt,
  );

  const projectIds = projects.map((project) => project.id);
  const subIds = jobsiteRows.flatMap((jobsite) => jobsite.subIds);
  const [logs, companyNamesById] = await Promise.all([
    listCompletedLogsInWindow(projectIds, window),
    getCompanyNamesByIds(subIds),
  ]);

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const logsByJobsite = new Map();
  for (const log of logs) {
    const project = projectById.get(log.project_id);
    const list = logsByJobsite.get(project.jobsiteId) ?? [];
    list.push({ subId: project.ownerCompanyId, heldAt: log.held_at });
    logsByJobsite.set(project.jobsiteId, list);
  }

  const jobsites = jobsiteRows
    .map((jobsite) => {
      // projects is oldest-first, so the first match is the sub's earliest
      // project in this jobsite — what a drill-in opens.
      const projectIdBySub = new Map();
      for (const project of projects) {
        if (
          project.jobsiteId === jobsite.id &&
          !projectIdBySub.has(project.ownerCompanyId)
        ) {
          projectIdBySub.set(project.ownerCompanyId, project.id);
        }
      }

      const compliance = computeCompliance({
        roster: jobsite.subIds.map((subId) => ({ subId })),
        logs: logsByJobsite.get(jobsite.id) ?? [],
        window,
      });

      return {
        id: jobsite.id,
        name: jobsite.name,
        subs: compliance.map((entry) => ({
          companyId: entry.subId,
          companyName: companyNamesById.get(entry.subId) ?? null,
          projectId: projectIdBySub.get(entry.subId) ?? null,
          status: entry.status,
          lastLoggedAt: entry.lastLoggedAt,
          count: entry.count,
        })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const allSubs = jobsites.flatMap((jobsite) => jobsite.subs);
  const totals = {
    subs: allSubs.length,
    logged: allSubs.filter((sub) => sub.status === "logged").length,
    missing: allSubs.filter((sub) => sub.status === "missing").length,
  };

  return { jobsites, totals };
};

// Maps a completed meeting_logs row (optionally carrying an embedded
// toolbox_talks title and/or signatures) to the shape shared by the list and
// detail endpoints. `projectName`/`companyName` are passed in by the caller,
// which already has them (from listLinkedProjects or assertGcLinkedProject),
// rather than re-queried per row.
const toMeetingSummary = (row, { projectName, companyName }) => ({
  id: row.id,
  projectId: row.project_id,
  projectName,
  companyId: row.company_id,
  companyName,
  talkTitle: row.toolbox_talks?.title ?? null,
  heldAt: row.held_at ?? row.completed_at,
  completedAt: row.completed_at,
  signerCount: (row.signatures ?? []).length,
  pdfReady: Boolean(row.final_pdf_url),
});

// GET /api/gc/meetings?projectId&from&to — completed logs for the GC's
// linked projects (optionally narrowed to one), newest-held first.
const listMeetings = async (gcCompanyId, { projectId, from, to } = {}) => {
  let projectIds;
  let projectNameById;

  if (projectId) {
    const project = await assertGcLinkedProject(projectId, gcCompanyId);
    projectIds = [project.id];
    projectNameById = new Map([[project.id, project.name]]);
  } else {
    const projects = await listLinkedProjects(gcCompanyId);
    projectIds = projects.map((project) => project.id);
    projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  }

  if (projectIds.length === 0) return [];

  let query = supabase
    .from("meeting_logs")
    .select(
      "id, project_id, company_id, held_at, completed_at, final_pdf_url, toolbox_talks(title), signatures(id)",
    )
    .in("project_id", projectIds)
    .not("completed_at", "is", null);

  if (from) query = query.gte("held_at", from);
  if (to) query = query.lt("held_at", to);

  const { data, error } = await query
    .order("held_at", { ascending: false })
    .limit(MEETINGS_LIST_LIMIT);

  if (error) {
    throw new AppError("Could not load meetings", 502, { cause: error });
  }

  const companyNamesById = await getCompanyNamesByIds(
    data.map((row) => row.company_id),
  );

  return data.map((row) =>
    toMeetingSummary(row, {
      projectName: projectNameById.get(row.project_id) ?? null,
      companyName: companyNamesById.get(row.company_id) ?? null,
    }),
  );
};

// Shared by getMeeting/getMeetingPdfUrl: loads a meeting_logs row and
// confirms it's both completed and linked to this GC. An in-progress meeting
// 404s the same as a missing one — only completed logs are ever exposed to a
// GC (design doc "Only completed logs exposed").
const getCompletedLinkedMeeting = async (id, gcCompanyId) => {
  const { data, error } = await supabase
    .from("meeting_logs")
    .select(
      "id, project_id, company_id, talk_id, held_at, completed_at, final_pdf_url",
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Meeting not found", 404, { cause: error });
    }
    throw new AppError("Could not load the meeting", 502, { cause: error });
  }

  if (!data.completed_at) {
    throw new AppError("Meeting not found", 404);
  }

  const project = await assertGcLinkedProject(data.project_id, gcCompanyId);

  return { row: data, project };
};

// GET /api/gc/meetings/:id — detail + signers, with both heldAt and
// completedAt so the UI can show a "received later" cue when they differ.
const getMeeting = async (id, gcCompanyId) => {
  const { row, project } = await getCompletedLinkedMeeting(id, gcCompanyId);

  const [company, talkRow, signatures] = await Promise.all([
    companiesService.getById(row.company_id),
    row.talk_id
      ? supabase
          .from("toolbox_talks")
          .select("title")
          .eq("id", row.talk_id)
          .single()
          .then(({ data, error }) => {
            // A detached/missing talk (talk_id is ON DELETE SET NULL, but a
            // stale id could still 404 here in theory) degrades to no title,
            // same as signatures.js's own quiz lookup — never a hard failure.
            if (error && error.code !== "PGRST116") {
              throw new AppError("Could not load the talk", 502, { cause: error });
            }
            return data ?? null;
          })
      : null,
    supabase
      .from("signatures")
      .select("worker_name, quiz_passed")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          throw new AppError("Could not load signers", 502, { cause: error });
        }
        return data;
      }),
  ]);

  return {
    ...toMeetingSummary(
      { ...row, toolbox_talks: talkRow, signatures },
      { projectName: project.name, companyName: company.name },
    ),
    signers: signatures.map((signature) => ({
      workerName: signature.worker_name,
      quizPassed: signature.quiz_passed,
    })),
  };
};

// GET /api/gc/meetings/:id/pdf-url — a short-lived signed URL, named from the
// *meeting's* company (not the caller's GC) via the same buildPdfFilename
// every other PDF-naming path uses.
const getMeetingPdfUrl = async (id, gcCompanyId) => {
  const { row, project } = await getCompletedLinkedMeeting(id, gcCompanyId);

  if (!row.final_pdf_url) {
    throw new AppError("No PDF has been generated for this meeting yet", 404);
  }

  const company = await companiesService.getById(row.company_id);

  const filename = buildPdfFilename({
    companyName: company.name,
    projectName: project.name,
    meetingDate: row.held_at ?? row.completed_at,
    meetingLogId: row.id,
  });

  return storageService.getSignedUrl(
    PDF_BUCKET,
    row.final_pdf_url,
    PDF_URL_TTL_SECONDS,
    filename,
  );
};

module.exports = {
  assertGcLinkedProject,
  getOverview,
  listMeetings,
  getMeeting,
  getMeetingPdfUrl,
};
