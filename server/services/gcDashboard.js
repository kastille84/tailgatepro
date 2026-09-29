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
const { isSubLocked } = require("../utility/subLocking");
const contentSeal = require("../utility/contentSeal");
const companiesService = require("./companies");
const subAccessService = require("./subAccess");
const { isJobsiteAllowed } = require("./siteScope");
const jobsitesService = require("./jobsites");
const storageService = require("./storage");
const auditLogService = require("./auditLog");
const { PDF_BUCKET, PDF_URL_TTL_SECONDS } = require("./meetingLogs");

// Default/ceiling page size for GET /meetings (docs/tasks.md's "pagination for
// GET /meetings past 200 rows" follow-up). The caller may request a smaller
// page via `limit` (validated 1-100 in the route); we never trust it past the
// ceiling.
const MEETINGS_PAGE_SIZE = 20;
const MEETINGS_MAX_PAGE_SIZE = 100;

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
// on that order to pick a sub's earliest project per jobsite). `allowedJobsiteIds`
// (Phase 9d-2, services/siteScope.js) is null for a company-wide role, else the
// site-scoped user's assigned jobsites: only projects inside them come back.
const listLinkedProjects = async (gcCompanyId, allowedJobsiteIds = null) => {
  if (allowedJobsiteIds !== null && allowedJobsiteIds.length === 0) return [];

  let query = supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("gc_company_id", gcCompanyId);
  if (allowedJobsiteIds !== null) query = query.in("jobsite_id", allowedJobsiteIds);

  const { data, error } = await query.order("created_at", { ascending: true });

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

const SUB_LOCKED_ERROR = () =>
  new AppError("Upgrade to unlock this subcontractor", 403, {
    data: { code: "PLAN_LIMIT" },
  });

// Confirms `projectId` is currently linked to this GC — anything else
// (unknown id, a different GC's project, an unlinked one) is a 404. A project
// whose sub is locked on the GC's plan (Phase 9d) is a 403 PLAN_LIMIT, so the
// blur can't be bypassed by calling the API directly. A project outside a
// site-scoped user's assigned jobsites (Phase 9d-2) is a 404 too. Returns the mapped
// project so callers that need its name next (getMeeting, getMeetingPdfUrl)
// don't have to look it up twice.
const assertGcLinkedProject = async (projectId, gcCompanyId, allowedJobsiteIds = null) => {
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

  if (!isJobsiteAllowed(allowedJobsiteIds, data.jobsite_id)) {
    throw new AppError("Project not found", 404);
  }

  const unlocked = await subAccessService.getUnlockedSubIds(gcCompanyId);
  if (isSubLocked(unlocked, data.owner_company_id)) throw SUB_LOCKED_ERROR();

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
const listActiveJobsites = async (gcCompanyId, allowedJobsiteIds = null) => {
  if (allowedJobsiteIds !== null && allowedJobsiteIds.length === 0) return [];

  let query = supabase
    .from("jobsites")
    .select(
      "id, name, origin, jobsite_subcontractors(sub_company_id, accepted_at)",
    )
    .eq("gc_company_id", gcCompanyId)
    .eq("status", "active")
    .is("archived_at", null);
  if (allowedJobsiteIds !== null) query = query.in("id", allowedJobsiteIds);

  const { data, error } = await query;

  if (error) {
    throw new AppError("Could not load jobsites", 502, { cause: error });
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    createdBySub: row.origin === "subcontractor",
    subIds: (row.jobsite_subcontractors ?? [])
      .filter((sub) => sub.sub_company_id && sub.accepted_at)
      .map((sub) => sub.sub_company_id),
  }));
};

// GET /api/gc/overview — the GC's real jobsites, each with a per-sub
// compliance status for the given day. The roster is the accepted members, so
// an accepted sub that never logged shows `missing`.
const getOverview = async (gcCompanyId, { date, tzOffset, allowedJobsiteIds = null }) => {
  const window = dayWindow({ date, tzOffset });

  const [jobsiteRows, allProjects, unlocked] = await Promise.all([
    listActiveJobsites(gcCompanyId, allowedJobsiteIds),
    listLinkedProjects(gcCompanyId, allowedJobsiteIds),
    subAccessService.getUnlockedSubIds(gcCompanyId),
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
        createdBySub: jobsite.createdBySub,
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

  // Totals are counted before masking so a locked sub still shows up in the
  // headline numbers (that's what makes the upgrade prompt tempting).
  const allSubs = jobsites.flatMap((jobsite) => jobsite.subs);
  const totals = {
    subs: allSubs.length,
    logged: allSubs.filter((sub) => sub.status === "logged").length,
    missing: allSubs.filter((sub) => sub.status === "missing").length,
  };

  // Phase 9d: a locked sub keeps only a placeholder row -- no identity, status
  // or drill-in target ever leaves the server.
  const maskedJobsites = jobsites.map((jobsite) => ({
    ...jobsite,
    subs: jobsite.subs.map((sub) =>
      isSubLocked(unlocked, sub.companyId)
        ? {
            companyId: null,
            companyName: null,
            projectId: null,
            status: null,
            lastLoggedAt: null,
            count: null,
            locked: true,
          }
        : { ...sub, locked: false },
    ),
  }));

  return { jobsites: maskedJobsites, totals };
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
  // Phase 9e tamper-evidence (docs/tamper-evidence-design.md): a derived
  // boolean only, matching how pdfReady already exposes final_pdf_url
  // without leaking the path itself — the raw content_seal never reaches a
  // GC's response.
  sealed: Boolean(row.content_seal),
});

// GET /api/gc/meetings?projectId&from&to&limit&offset — completed logs for
// the GC's linked projects (optionally narrowed to one), newest-held first,
// paginated in pages of up to `limit` (default/max clamped by
// MEETINGS_PAGE_SIZE/MEETINGS_MAX_PAGE_SIZE). We ask Supabase for one extra
// row past the page so `hasMore` can be derived without a separate count
// query, matching the "peek" trick already used by meetingLogs.js's month
// paging.
const listMeetings = async (
  gcCompanyId,
  { projectId, from, to, allowedJobsiteIds = null, limit, offset } = {},
) => {
  const pageSize = Math.min(limit || MEETINGS_PAGE_SIZE, MEETINGS_MAX_PAGE_SIZE);
  const pageOffset = offset || 0;

  let projectIds;
  let projectNameById;

  if (projectId) {
    const project = await assertGcLinkedProject(projectId, gcCompanyId, allowedJobsiteIds);
    projectIds = [project.id];
    projectNameById = new Map([[project.id, project.name]]);
  } else {
    const [allProjects, unlocked] = await Promise.all([
      listLinkedProjects(gcCompanyId, allowedJobsiteIds),
      subAccessService.getUnlockedSubIds(gcCompanyId),
    ]);
    const projects = allProjects.filter(
      (project) => !isSubLocked(unlocked, project.ownerCompanyId),
    );
    projectIds = projects.map((project) => project.id);
    projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  }

  if (projectIds.length === 0) return { meetings: [], hasMore: false };

  let query = supabase
    .from("meeting_logs")
    .select(
      "id, project_id, company_id, held_at, completed_at, final_pdf_url, content_seal, toolbox_talks(title), signatures(id)",
    )
    .in("project_id", projectIds)
    .not("completed_at", "is", null);

  if (from) query = query.gte("held_at", from);
  if (to) query = query.lt("held_at", to);

  const { data, error } = await query
    .order("held_at", { ascending: false })
    // Tiebreaker for a stable sort across pages when held_at ties.
    .order("id", { ascending: false })
    .range(pageOffset, pageOffset + pageSize);

  if (error) {
    throw new AppError("Could not load meetings", 502, { cause: error });
  }

  const hasMore = data.length > pageSize;
  const pageRows = hasMore ? data.slice(0, pageSize) : data;

  const companyNamesById = await getCompanyNamesByIds(
    pageRows.map((row) => row.company_id),
  );

  const meetings = pageRows.map((row) =>
    toMeetingSummary(row, {
      projectName: projectNameById.get(row.project_id) ?? null,
      companyName: companyNamesById.get(row.company_id) ?? null,
    }),
  );

  return { meetings, hasMore };
};

// Shared by getMeeting/getMeetingPdfUrl: loads a meeting_logs row and
// confirms it's both completed and linked to this GC. An in-progress meeting
// 404s the same as a missing one — only completed logs are ever exposed to a
// GC (design doc "Only completed logs exposed").
const getCompletedLinkedMeeting = async (id, gcCompanyId, allowedJobsiteIds) => {
  const { data, error } = await supabase
    .from("meeting_logs")
    .select(
      "id, project_id, company_id, talk_id, foreman_id, crew_photo_url, held_at, completed_at, final_pdf_url, content_seal, sealed_at",
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

  const project = await assertGcLinkedProject(data.project_id, gcCompanyId, allowedJobsiteIds);

  return { row: data, project };
};

// GET /api/gc/meetings/:id — detail + signers, with both heldAt and
// completedAt so the UI can show a "received later" cue when they differ.
const getMeeting = async (id, gcCompanyId, allowedJobsiteIds = null) => {
  const { row, project } = await getCompletedLinkedMeeting(id, gcCompanyId, allowedJobsiteIds);

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
const getMeetingPdfUrl = async (id, gcCompanyId, allowedJobsiteIds = null) => {
  const { row, project } = await getCompletedLinkedMeeting(id, gcCompanyId, allowedJobsiteIds);

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

// GET /api/gc/meetings/:id/verify-seal — same recompute-and-compare as
// meetingLogs.js's own verifySeal (Phase 9e, docs/tamper-evidence-design.md),
// scoped through the GC's linked-project authorization instead of company
// ownership. No plan gate — see the design doc's "Gating" section.
const verifySeal = async (id, gcCompanyId, allowedJobsiteIds = null, actorId = null) => {
  const { row } = await getCompletedLinkedMeeting(id, gcCompanyId, allowedJobsiteIds);

  if (!row.content_seal) {
    throw new AppError("This meeting hasn't been sealed yet", 404);
  }

  const { data: signatures, error } = await supabase
    .from("signatures")
    .select("id, worker_name, quiz_score, quiz_passed")
    .eq("meeting_id", id);
  if (error) {
    throw new AppError("Could not verify the meeting's signatures", 502, { cause: error });
  }

  const expectedSeal = contentSeal.computeSeal(
    contentSeal.buildCanonicalPayload({
      meetingLog: {
        id: row.id,
        projectId: row.project_id,
        talkId: row.talk_id,
        companyId: row.company_id,
        foremanId: row.foreman_id,
        crewPhotoUrl: row.crew_photo_url,
        heldAt: row.held_at,
        completedAt: row.completed_at,
      },
      signatures: signatures.map((s) => ({
        id: s.id,
        workerName: s.worker_name,
        quizScore: s.quiz_score,
        quizPassed: s.quiz_passed,
      })),
    }),
  );

  const valid = contentSeal.sealsMatch(expectedSeal, row.content_seal);

  await auditLogService.record({
    meetingLogId: id,
    eventType: "seal_verified",
    actorId,
    metadata: { valid, via: "gc" },
  });

  return { valid, sealedAt: row.sealed_at };
};

// GET /api/gc/jobsites/:id/defense-bundle (Phase 9e,
// docs/osha-defense-bundle-design.md) — every completed log's PDF for one
// jobsite, indexed. Gated per-jobsite on `jobsites.plan === "site_pro"`, not
// blended with the caller's own company tier (see the design doc's "Gating"
// section for why). Unlike listMeetings, this has no MEETINGS_LIST_LIMIT and
// no from/to range — it's a full legal export, not a dashboard page.
const getDefenseBundleEntries = async (jobsiteId, gcCompanyId, allowedJobsiteIds = null) => {
  const jobsite = await jobsitesService.getOwnedJobsite(jobsiteId, gcCompanyId, allowedJobsiteIds);

  if (jobsite.plan !== "site_pro") {
    throw new AppError(
      "Upgrade this job site to Site Pro to download its OSHA Defense Bundle",
      403,
      { data: { code: "PLAN_LIMIT" } },
    );
  }

  const [allProjects, unlocked] = await Promise.all([
    listLinkedProjects(gcCompanyId, allowedJobsiteIds),
    subAccessService.getUnlockedSubIds(gcCompanyId),
  ]);
  const projects = allProjects.filter(
    (project) => project.jobsiteId === jobsiteId && !isSubLocked(unlocked, project.ownerCompanyId),
  );
  const projectIds = projects.map((project) => project.id);

  const NOTHING_TO_BUNDLE = "No completed meeting logs with a generated PDF are available yet for this job site.";
  if (projectIds.length === 0) {
    throw new AppError(NOTHING_TO_BUNDLE, 404);
  }
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));

  const { data, error } = await supabase
    .from("meeting_logs")
    .select("id, project_id, company_id, held_at, completed_at, final_pdf_url, toolbox_talks(title)")
    .in("project_id", projectIds)
    .not("completed_at", "is", null)
    .order("held_at", { ascending: true });

  if (error) {
    throw new AppError("Could not load meeting logs", 502, { cause: error });
  }

  const ready = data.filter((row) => row.final_pdf_url);
  const skippedCount = data.length - ready.length;
  if (ready.length === 0) {
    throw new AppError(NOTHING_TO_BUNDLE, 404);
  }

  const companyNamesById = await getCompanyNamesByIds(ready.map((row) => row.company_id));

  const entries = ready.map((row) => {
    const companyName = companyNamesById.get(row.company_id) ?? "company";
    const projectName = projectNameById.get(row.project_id) ?? "project";
    const heldAt = row.held_at ?? row.completed_at;
    return {
      path: row.final_pdf_url,
      filename: buildPdfFilename({
        companyName,
        projectName,
        meetingDate: heldAt,
        meetingLogId: row.id,
      }),
      companyName,
      projectName,
      talkTitle: row.toolbox_talks?.title ?? null,
      heldAt,
    };
  });

  return { jobsiteName: jobsite.name, entries, skippedCount };
};

module.exports = {
  assertGcLinkedProject,
  getOverview,
  listMeetings,
  getMeeting,
  getMeetingPdfUrl,
  verifySeal,
  getDefenseBundleEntries,
  // Exported for services/scorecards.js and services/policyPush.js (Phase 9e)
  // to reuse rather than re-querying -- no logic change, just widening this
  // module's surface.
  listActiveJobsites,
  listLinkedProjects,
  listCompletedLogsInWindow,
  getCompanyNamesByIds,
};
