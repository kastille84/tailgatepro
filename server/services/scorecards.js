// GC-side read service for cross-project subcontractor safety scorecards
// (Phase 9e, docs/sub-scorecard-design.md). GC Portfolio only. Every function
// takes `gcCompanyId` from the caller's verified `req.user.companyId`, same
// trust boundary as gcDashboard.js. Reuses gcDashboard.js's project/log
// helpers rather than re-querying them.
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { rollingDayWindows } = require("../utility/rollingWindow");
const { computeRollingDailyCompliance, buildScorecard } = require("../utility/subScorecard");
// Namespaced, not destructured -- same convention every other cross-service
// call in this codebase uses (companiesService.getById-style), so a test's
// vi.spyOn on either service's methods is picked up regardless of require
// order.
const siteScopeService = require("./siteScope");
const gcDashboardService = require("./gcDashboard");

const ROLLING_WINDOW_DAYS = 30;

// Every accepted (sub, jobsite) pair across the GC's active, non-archived
// jobsites -- the roster this feature scores. Queried directly against
// `jobsite_subcontractors` (same embed style as subAccess.js's
// getUnlockedSubIds) rather than reusing gcDashboard.js's jobsite-shaped
// listActiveJobsites, since this needs `accepted_at` alongside each
// (sub, jobsite) pair, not bucketed under a jobsite object.
// `allowedJobsiteIds` (Phase 9d-2) is null for a company-wide role, else the
// site-scoped user's assigned jobsites.
const listPortfolioRoster = async (gcCompanyId, allowedJobsiteIds = null) => {
  if (allowedJobsiteIds !== null && allowedJobsiteIds.length === 0) return [];

  let query = supabase
    .from("jobsite_subcontractors")
    .select(
      "jobsite_id, sub_company_id, accepted_at, jobsites!inner(name, gc_company_id, status, archived_at)",
    )
    .eq("jobsites.gc_company_id", gcCompanyId)
    .eq("jobsites.status", "active")
    .is("jobsites.archived_at", null)
    .not("accepted_at", "is", null)
    .not("sub_company_id", "is", null);
  if (allowedJobsiteIds !== null) query = query.in("jobsite_id", allowedJobsiteIds);

  const { data, error } = await query;

  if (error) {
    throw new AppError("Could not load your portfolio roster", 502, { cause: error });
  }

  return data.map((row) => ({
    subId: row.sub_company_id,
    since: row.accepted_at,
    jobsiteId: row.jobsite_id,
    jobsiteName: row.jobsites.name,
  }));
};

// Shared by both endpoints below: every sub's full scorecard (overall score +
// per-jobsite breakdown) for the caller's portfolio, keyed by companyId. A
// single query spans the whole rolling window (no per-day round trip) --
// computeRollingDailyCompliance narrows it to each day itself, the same way
// computeCompliance narrows any window.
const buildAllScorecards = async (gcCompanyId, { date, tzOffset, allowedJobsiteIds = null }) => {
  await siteScopeService.assertScorecardsAvailable(gcCompanyId);

  const dayWindows = rollingDayWindows({ date, tzOffset, days: ROLLING_WINDOW_DAYS });
  const rangeWindow = { start: dayWindows[0].start, end: dayWindows[dayWindows.length - 1].end };

  const [roster, allProjects] = await Promise.all([
    listPortfolioRoster(gcCompanyId, allowedJobsiteIds),
    gcDashboardService.listLinkedProjects(gcCompanyId, allowedJobsiteIds),
  ]);

  if (roster.length === 0) return new Map();

  const projects = allProjects.filter(
    (project) => project.jobsiteId && project.status === "active" && !project.archivedAt,
  );
  const projectIds = projects.map((project) => project.id);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const [logs, companyNamesById] = await Promise.all([
    gcDashboardService.listCompletedLogsInWindow(projectIds, rangeWindow),
    gcDashboardService.getCompanyNamesByIds(roster.map((entry) => entry.subId)),
  ]);

  const logsByJobsite = new Map();
  for (const log of logs) {
    const project = projectById.get(log.project_id);
    if (!project) continue;
    const list = logsByJobsite.get(project.jobsiteId) ?? [];
    list.push({ subId: project.ownerCompanyId, heldAt: log.held_at });
    logsByJobsite.set(project.jobsiteId, list);
  }

  const rosterBySub = new Map();
  for (const entry of roster) {
    const list = rosterBySub.get(entry.subId) ?? [];
    list.push(entry);
    rosterBySub.set(entry.subId, list);
  }

  const scorecards = new Map();
  for (const [subId, entries] of rosterBySub) {
    const perJobsite = entries.map((entry) => {
      const [daily] = computeRollingDailyCompliance({
        roster: [{ subId, since: entry.since }],
        logs: logsByJobsite.get(entry.jobsiteId) ?? [],
        dayWindows,
      });
      return {
        jobsiteId: entry.jobsiteId,
        jobsiteName: entry.jobsiteName,
        expectedDays: daily.expectedDays,
        loggedDays: daily.loggedDays,
      };
    });

    const { overallScore, jobsites } = buildScorecard({ perJobsite });
    scorecards.set(subId, {
      companyId: subId,
      companyName: companyNamesById.get(subId) ?? null,
      overallScore,
      jobsites,
    });
  }

  return scorecards;
};

// GET /api/gc/subcontractors -- every distinct sub across the GC's active
// portfolio jobsites with a rolling 30-day compliance score, worst-first (the
// GCs most worth a closer look come first).
const listSubcontractorScorecards = async (gcCompanyId, options) => {
  const scorecards = await buildAllScorecards(gcCompanyId, options);

  return [...scorecards.values()]
    .map(({ jobsites, ...summary }) => summary)
    .sort(
      (a, b) =>
        a.overallScore - b.overallScore ||
        (a.companyName ?? "").localeCompare(b.companyName ?? ""),
    );
};

// GET /api/gc/subcontractors/:companyId/scorecard -- one sub's score plus its
// per-jobsite breakdown. Not a current accepted roster member anywhere in the
// caller's (allowed) portfolio is a 404 -- existence is never leaked, same as
// every other company-scoped lookup in this codebase.
const getSubcontractorScorecard = async (companyId, gcCompanyId, options) => {
  const scorecards = await buildAllScorecards(gcCompanyId, options);

  const scorecard = scorecards.get(companyId);
  if (!scorecard) {
    throw new AppError("Subcontractor not found", 404);
  }
  return scorecard;
};

module.exports = {
  ROLLING_WINDOW_DAYS,
  listSubcontractorScorecards,
  getSubcontractorScorecard,
};
