// Top-down corporate policy push (Phase 9e, GC Portfolio only,
// docs/policy-push-design.md): a GC pushes one global toolbox talk as the
// company's current required safety topic, applied live across every active,
// non-archived jobsite. Every function here takes `gcCompanyId` from the
// caller's verified `req.user.companyId` (loadUserContext), same trust
// boundary as gcDashboard.js/scorecards.js.
//
// Namespaced, not destructured requires -- same convention scorecards.js
// uses, so a test's vi.spyOn on another service's methods is picked up
// regardless of require order.
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { dayWindow } = require("../utility/dayWindow");
const { computeCompliance } = require("../utility/compliance");
const siteScopeService = require("./siteScope");
const companiesService = require("./companies");
const talksService = require("./talks");
const gcDashboardService = require("./gcDashboard");
const projectsService = require("./projects");

// Every talk offered by the push picker: the global library plus the GC's own
// company talks (docs/company-talks-design.md). A GC has the full library, so
// listForCompany's default visibility is exactly that set. The GC's talks are
// visible to the subs a push targets because talks.js's visibility filter
// unions in the authoring GC of every jobsite a sub has accepted.
const listPickerTalks = (gcCompanyId) => talksService.listForCompany(gcCompanyId);

// A talk's title, or null if it no longer exists (the FK is ON DELETE SET
// NULL, so in practice this only degrades a stale reference rather than
// failing the whole read -- same "degrade, don't 500" convention
// gcDashboard.getMeeting's own talk-title lookup uses).
const getTalkTitle = async (talkId) => {
  const { data, error } = await supabase
    .from("toolbox_talks")
    .select("title")
    .eq("id", talkId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new AppError("Could not load the talk", 502, { cause: error });
  }
  return data.title;
};

// A user's name, or null if the row no longer exists (required_talk_pushed_by
// is ON DELETE SET NULL too -- same degrade-don't-fail reasoning).
const getUserName = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("users")
    .select("name")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new AppError("Could not load the user", 502, { cause: error });
  }
  return data.name;
};

const NO_PUSH_STATE = {
  talkId: null,
  talkTitle: null,
  pushedAt: null,
  pushedByName: null,
};

// The caller's current push (or the "nothing pushed" shape). GC Portfolio only.
const getCurrentPush = async (gcCompanyId) => {
  await siteScopeService.assertPolicyPushAvailable(gcCompanyId);

  const company = await companiesService.getById(gcCompanyId);
  if (!company.requiredTalkId) return { ...NO_PUSH_STATE };

  const [talkTitle, pushedByName] = await Promise.all([
    getTalkTitle(company.requiredTalkId),
    getUserName(company.requiredTalkPushedBy),
  ]);

  return {
    talkId: company.requiredTalkId,
    talkTitle,
    pushedAt: company.requiredTalkPushedAt,
    pushedByName,
  };
};

// Pushes (or replaces) the caller's company's current required topic.
// `talkId` must resolve to a global talk or one of the caller's own company
// talks -- talksService.getById's visibility, which 404s any other company's
// talk. Replacing an existing push is just a second call, no special-casing
// needed.
const pushRequiredTopic = async (gcCompanyId, { talkId, pushedByUserId }) => {
  await siteScopeService.assertPolicyPushAvailable(gcCompanyId);

  const talk = await talksService.getById(talkId, gcCompanyId);

  const company = await companiesService.setRequiredTopic(gcCompanyId, {
    talkId,
    pushedByUserId,
  });
  const pushedByName = await getUserName(company.requiredTalkPushedBy);

  return {
    talkId: company.requiredTalkId,
    talkTitle: talk.title,
    pushedAt: company.requiredTalkPushedAt,
    pushedByName,
  };
};

// Clears the caller's company's current push. Idempotent when nothing is
// currently pushed -- companiesService.clearRequiredTopic just no-ops the
// write.
const clearRequiredTopic = async (gcCompanyId) => {
  await siteScopeService.assertPolicyPushAvailable(gcCompanyId);
  await companiesService.clearRequiredTopic(gcCompanyId);
};

// Completed logs of the pushed talk, held at or after `since`, for a set of
// project ids. Deliberately a small, dedicated query here rather than a
// change to gcDashboard.js's shared, already-tested listCompletedLogsInWindow
// (which selects no talk_id column and is reused unmodified by scorecards.js)
// -- adding a talk filter there would change a shared caller's contract for
// this one caller.
const listCompletedLogsForTalkSince = async (projectIds, talkId, since) => {
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("meeting_logs")
    .select("project_id, held_at")
    .in("project_id", projectIds)
    .eq("talk_id", talkId)
    .not("completed_at", "is", null)
    .gte("held_at", since);

  if (error) {
    throw new AppError("Could not load meeting logs", 502, { cause: error });
  }

  return data;
};

// GET /api/gc/policy-push -- the current push plus, when one is active, a
// per-active-jobsite compliance rollup since it was pushed: has any of the
// jobsite's accepted subs logged the required talk since pushedAt, up to
// today? This is a single boolean per sub, not a rate, so it reuses
// computeCompliance as-is with one open-ended-since-push window per jobsite
// -- it deliberately does not reach for subScorecard.js's per-day rolling
// machinery, which solves a different problem (a 30-day *rate* needing daily
// granularity/proration).
const getComplianceRollup = async (gcCompanyId, { date, tzOffset, allowedJobsiteIds = null }) => {
  const pushState = await getCurrentPush(gcCompanyId);
  if (!pushState.talkId) {
    return { ...pushState, jobsites: [], totals: { subs: 0, logged: 0, missing: 0 } };
  }

  const { end } = dayWindow({ date, tzOffset });

  const [jobsiteRows, allProjects] = await Promise.all([
    gcDashboardService.listActiveJobsites(gcCompanyId, allowedJobsiteIds),
    gcDashboardService.listLinkedProjects(gcCompanyId, allowedJobsiteIds),
  ]);
  const projects = allProjects.filter(
    (project) => project.jobsiteId && project.status === "active" && !project.archivedAt,
  );
  const projectIds = projects.map((project) => project.id);
  const subIds = jobsiteRows.flatMap((jobsite) => jobsite.subIds);

  const [logs, companyNamesById] = await Promise.all([
    listCompletedLogsForTalkSince(projectIds, pushState.talkId, pushState.pushedAt),
    gcDashboardService.getCompanyNamesByIds(subIds),
  ]);

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const logsByJobsite = new Map();
  for (const log of logs) {
    const project = projectById.get(log.project_id);
    if (!project) continue;
    const list = logsByJobsite.get(project.jobsiteId) ?? [];
    list.push({ subId: project.ownerCompanyId, heldAt: log.held_at });
    logsByJobsite.set(project.jobsiteId, list);
  }

  const jobsites = jobsiteRows
    .map((jobsite) => {
      const compliance = computeCompliance({
        roster: jobsite.subIds.map((subId) => ({ subId })),
        logs: logsByJobsite.get(jobsite.id) ?? [],
        window: { start: pushState.pushedAt, end },
      });

      return {
        id: jobsite.id,
        name: jobsite.name,
        subs: compliance.map((entry) => ({
          companyId: entry.subId,
          companyName: companyNamesById.get(entry.subId) ?? null,
          status: entry.status,
          lastLoggedAt: entry.lastLoggedAt,
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

  return { ...pushState, jobsites, totals };
};

// GET /api/projects/:id/required-topic -- the sub-facing read. No plan check
// here: it reflects whatever is currently stored regardless of the GC's
// *current* plan (see docs/policy-push-design.md "Known v1 limitations" for
// why a downgraded GC's already-pushed topic keeps showing until it
// re-upgrades to clear/replace it -- consistent with how every other
// Portfolio-only feature behaves on downgrade).
const getRequiredTopicForProject = async (projectId, companyId) => {
  const project = await projectsService.getById(projectId, companyId);

  // An unlinked project (no jobsite) is never in scope.
  if (!project.jobsiteId) return { talkId: null, talkTitle: null, pushedAt: null };

  const { data: jobsite, error } = await supabase
    .from("jobsites")
    .select("gc_company_id, status, archived_at")
    .eq("id", project.jobsiteId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new AppError("Could not load the job site", 502, { cause: error });
  }

  // A missing, inactive, or archived jobsite is never in scope either.
  if (!jobsite || jobsite.status !== "active" || jobsite.archived_at) {
    return { talkId: null, talkTitle: null, pushedAt: null };
  }

  const gc = await companiesService.getById(jobsite.gc_company_id);
  if (!gc.requiredTalkId) return { talkId: null, talkTitle: null, pushedAt: null };

  const talkTitle = await getTalkTitle(gc.requiredTalkId);
  return { talkId: gc.requiredTalkId, talkTitle, pushedAt: gc.requiredTalkPushedAt };
};

module.exports = {
  listPickerTalks,
  getCurrentPush,
  pushRequiredTopic,
  clearRequiredTopic,
  getComplianceRollup,
  getRequiredTopicForProject,
};
