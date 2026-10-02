const projectIntegrationsService = require("../services/projectIntegrations");

// req.user is set by loadUserContext (after requireAuth). The caller's company
// and plan always come from there, never from the request body.

// GET /api/projects/:id/integrations
exports.listIntegrations = async (req, res, next) => {
  try {
    const data = await projectIntegrationsService.list({
      projectId: req.params.id,
      companyId: req.user.companyId,
      companyType: req.user.companyType,
      tier: req.user.tier,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// PUT /api/projects/:id/integrations/:provider -- verify + store credentials.
exports.connectIntegration = async (req, res, next) => {
  try {
    const { credentials, projectId, folderId } = req.body;
    const data = await projectIntegrationsService.connect({
      projectId: req.params.id,
      companyId: req.user.companyId,
      companyType: req.user.companyType,
      tier: req.user.tier,
      provider: req.params.provider,
      credentials,
      externalProjectId: projectId,
      folderId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/projects/:id/integrations/:provider
exports.disconnectIntegration = async (req, res, next) => {
  try {
    await projectIntegrationsService.disconnect({
      projectId: req.params.id,
      companyId: req.user.companyId,
      provider: req.params.provider,
    });
    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    return next(error);
  }
};

// POST /api/project-integrations/pushes/:id/retry
exports.retryPush = async (req, res, next) => {
  try {
    const data = await projectIntegrationsService.retryPush({
      pushId: req.params.id,
      companyId: req.user.companyId,
      companyType: req.user.companyType,
      tier: req.user.tier,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
