const gcDashboardService = require("../services/gcDashboard");
const siteScopeService = require("../services/siteScope");

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
