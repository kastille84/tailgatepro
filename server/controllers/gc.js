const gcDashboardService = require("../services/gcDashboard");
const scorecardsService = require("../services/scorecards");
const policyPushService = require("../services/policyPush");
const siteScopeService = require("../services/siteScope");
const zipBundleService = require("../services/zipBundle");
const { slugify } = require("../utility/pdfFilename");

// req.user is set by loadUserContext (which runs after requireAuth and
// requireGcCompany) — the caller's company always comes from there, never
// from req.body/req.params. See docs/gc-dashboard-design.md "Endpoint
// contract". `allowedJobsiteIds` (services/siteScope.js, Phase 9d-2) is null for a
// company-wide role, else the site-scoped user's assigned jobsites.

exports.getOverview = async (req, res, next) => {
  try {
    const { date, tzOffset } = req.query;
    const allowedJobsiteIds = await siteScopeService.getAllowedJobsiteIds(req.user);
    const data = await gcDashboardService.getOverview(req.user.companyId, {
      date,
      tzOffset: Number(tzOffset),
      allowedJobsiteIds,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.listMeetings = async (req, res, next) => {
  try {
    const { projectId, from, to } = req.query;
    const allowedJobsiteIds = await siteScopeService.getAllowedJobsiteIds(req.user);
    const data = await gcDashboardService.listMeetings(req.user.companyId, {
      projectId,
      from,
      to,
      allowedJobsiteIds,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getMeeting = async (req, res, next) => {
  try {
    const allowedJobsiteIds = await siteScopeService.getAllowedJobsiteIds(req.user);
    const data = await gcDashboardService.getMeeting(
      req.params.id,
      req.user.companyId,
      allowedJobsiteIds,
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getMeetingPdfUrl = async (req, res, next) => {
  try {
    const allowedJobsiteIds = await siteScopeService.getAllowedJobsiteIds(req.user);
    const url = await gcDashboardService.getMeetingPdfUrl(
      req.params.id,
      req.user.companyId,
      allowedJobsiteIds,
    );
    return res.status(200).json({ success: true, data: { url } });
  } catch (error) {
    return next(error);
  }
};

// GET /api/gc/subcontractors?date&tzOffset — every distinct sub across the
// caller's active portfolio jobsites with a rolling 30-day compliance score
// (Phase 9e, docs/sub-scorecard-design.md). GC Portfolio only; the service
// throws a 403 PLAN_LIMIT otherwise.
exports.listSubcontractorScorecards = async (req, res, next) => {
  try {
    const { date, tzOffset } = req.query;
    const allowedJobsiteIds = await siteScopeService.getAllowedJobsiteIds(req.user);
    const data = await scorecardsService.listSubcontractorScorecards(req.user.companyId, {
      date,
      tzOffset: Number(tzOffset),
      allowedJobsiteIds,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/gc/subcontractors/:companyId/scorecard?date&tzOffset — one sub's
// score plus its per-jobsite breakdown.
exports.getSubcontractorScorecard = async (req, res, next) => {
  try {
    const { date, tzOffset } = req.query;
    const allowedJobsiteIds = await siteScopeService.getAllowedJobsiteIds(req.user);
    const data = await scorecardsService.getSubcontractorScorecard(
      req.params.companyId,
      req.user.companyId,
      { date, tzOffset: Number(tzOffset), allowedJobsiteIds },
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/gc/policy-push?date&tzOffset — the caller's current top-down
// policy push plus, when one is active, a per-active-jobsite compliance
// rollup since it was pushed (Phase 9e, docs/policy-push-design.md). GC
// Portfolio only; the service throws a 403 PLAN_LIMIT otherwise. Any GC
// member (including a site-scoped superintendent, narrowed via
// allowedJobsiteIds) may read this.
exports.getPolicyPush = async (req, res, next) => {
  try {
    const { date, tzOffset } = req.query;
    const allowedJobsiteIds = await siteScopeService.getAllowedJobsiteIds(req.user);
    const data = await policyPushService.getComplianceRollup(req.user.companyId, {
      date,
      tzOffset: Number(tzOffset),
      allowedJobsiteIds,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/gc/policy-push/talks — every global talk, for the push picker.
exports.listPolicyPushTalks = async (req, res, next) => {
  try {
    const data = await policyPushService.listPickerTalks();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/gc/policy-push { talkId } — pushes/replaces the current required
// topic. Manager-only (requireRole in the route); the service also gates on
// GC Portfolio.
exports.pushPolicyTopic = async (req, res, next) => {
  try {
    const data = await policyPushService.pushRequiredTopic(req.user.companyId, {
      talkId: req.body.talkId,
      pushedByUserId: req.user.id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/gc/policy-push — clears the current required topic.
exports.clearPolicyPush = async (req, res, next) => {
  try {
    await policyPushService.clearRequiredTopic(req.user.companyId);
    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    return next(error);
  }
};

// Streams a ZIP body, not the usual { success, data } JSON envelope — see
// docs/osha-defense-bundle-design.md. A failure that happens after headers
// (and possibly some zip bytes) are already flushed can no longer produce a
// normal JSON error response, so it destroys the connection instead of
// calling next(error).
exports.getDefenseBundle = async (req, res, next) => {
  try {
    const allowedJobsiteIds = await siteScopeService.getAllowedJobsiteIds(req.user);
    const { jobsiteName, entries, skippedCount } = await gcDashboardService.getDefenseBundleEntries(
      req.params.id,
      req.user.companyId,
      allowedJobsiteIds,
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slugify(jobsiteName)}-defense-bundle.zip"`,
    );
    await zipBundleService.streamBundle(entries, res, { skippedCount });
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    return next(error);
  }
};
