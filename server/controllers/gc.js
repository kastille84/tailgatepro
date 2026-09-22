const gcDashboardService = require("../services/gcDashboard");

// req.user is set by loadUserContext (which runs after requireAuth and
// requireGcCompany) — the caller's company always comes from there, never
// from req.body/req.params. See docs/gc-dashboard-design.md "Endpoint
// contract".

exports.getOverview = async (req, res, next) => {
  try {
    const { date, tzOffset } = req.query;
    const data = await gcDashboardService.getOverview(req.user.companyId, {
      date,
      tzOffset: Number(tzOffset),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.listMeetings = async (req, res, next) => {
  try {
    const { projectId, from, to } = req.query;
    const data = await gcDashboardService.listMeetings(req.user.companyId, {
      projectId,
      from,
      to,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getMeeting = async (req, res, next) => {
  try {
    const data = await gcDashboardService.getMeeting(
      req.params.id,
      req.user.companyId,
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getMeetingPdfUrl = async (req, res, next) => {
  try {
    const url = await gcDashboardService.getMeetingPdfUrl(
      req.params.id,
      req.user.companyId,
    );
    return res.status(200).json({ success: true, data: { url } });
  } catch (error) {
    return next(error);
  }
};
