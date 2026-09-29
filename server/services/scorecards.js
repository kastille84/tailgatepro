// GC-side read service for cross-project subcontractor safety scorecards
// (Phase 9e, docs/sub-scorecard-design.md). GC Portfolio only. Every function
// takes `gcCompanyId` from the caller's verified `req.user.companyId`, same
// trust boundary as gcDashboard.js. Reuses gcDashboard.js's project/log
// helpers rather than re-querying them.
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { rollingPeriodWindows } = require("../utility/rollingWindow");
const { computeRollingCompliance, buildScorecard } = require("../utility/subScorecard");
const { effectiveCadence } = require("../utility/cadence");
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
      "jobsite_id, sub_company_id, accepted_at, meeting_cadence, jobsites!inner(name, gc_company_id, status, archived_at, meeting_cadence)",
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
    // Strictest of the GC's jobsite default and the sub's own override.
    cadence: effectiveCadence(row.jobsites.meeting_cadence ?? "daily", row.meeting_cadence),
  }));
};

// Shared by both endpoints below: every sub's full scorecard (overall score +
// per-jobsite breakdown) for the caller's portfolio, keyed by companyId. A
// single query spans the whole rolling window (no per-period round trip) --
// computeRollingCompliance narrows it to each period (a day or a Mon-Sun week,
// per the sub's effective cadence on that jobsite) itself, the same way
// computeCompliance narrows any window.
const buildAllScorecards = async (gcCompanyId, { date, tzOffset, allowedJobsiteIds = null }) => {
  await siteScopeService.assertScorecardsAvailable(gcCompanyId);

  const windowsByCadence = {
    daily: rollingPeriodWindows({ date, tzOffset, days: ROLLING_WINDOW_DAYS, cadence: "daily" }),
    weekly: rollingPeriodWindows({ date, tzOffset, days: ROLLING_WINDOW_DAYS, cadence: "weekly" }),
  };
  const { daily, weekly } = windowsByCadence;
  // One query over the widest range: the oldest week can start before the
  // 30-day range does.
  const rangeWindow = {
    start: weekly[0].start < daily[0].start ? weekly[0].start : daily[0].start,
    end: daily[daily.length - 1].end,
  };
  const asOf = daily[daily.length - 1].end;

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
      const [result] = computeRollingCompliance({
        roster: [{ subId, since: entry.since }],
        logs: logsByJobsite.get(entry.jobsiteId) ?? [],
        windows: windowsByCadence[entry.cadence],
        // Only a weekly period can still be open; daily has always counted today.
        asOf: entry.cadence === "weekly" ? asOf : undefined,
      });
      return {
        jobsiteId: entry.jobsiteId,
        jobsiteName: entry.jobsiteName,
        cadence: entry.cadence,
        expectedPeriods: result.expectedPeriods,
        loggedPeriods: result.loggedPeriods,
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
