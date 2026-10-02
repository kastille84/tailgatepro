const integrationsService = require("../services/jobsiteIntegrations");
const siteScopeService = require("../services/siteScope");

// req.user is set by loadUserContext (after requireAuth). The caller's GC
// company always comes from there, never from the request body, and a
// site-scoped user is limited to their assigned jobsites (Phase 9d-2).

// GET /api/jobsites/:id/integrations
exports.listIntegrations = async (req, res, next) => {
  try {
    const data = await integrationsService.list({
      jobsiteId: req.params.id,
      gcCompanyId: req.user.companyId,
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// PUT /api/jobsites/:id/integrations/:provider -- verify + store credentials.
exports.connectIntegration = async (req, res, next) => {
  try {
    const { credentials, projectId, folderId } = req.body;
    const data = await integrationsService.connect({
      jobsiteId: req.params.id,
      gcCompanyId: req.user.companyId,
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
      provider: req.params.provider,
      credentials,
      projectId,
      folderId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/jobsites/:id/integrations/:provider
exports.disconnectIntegration = async (req, res, next) => {
  try {
    await integrationsService.disconnect({
      jobsiteId: req.params.id,
      gcCompanyId: req.user.companyId,
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
      provider: req.params.provider,
    });
    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    return next(error);
  }
};

// POST /api/integrations/pushes/:id/retry
exports.retryPush = async (req, res, next) => {
  try {
    const data = await integrationsService.retryPush({
      pushId: req.params.id,
      gcCompanyId: req.user.companyId,
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
