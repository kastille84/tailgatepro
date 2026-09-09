const projectsService = require("../services/projects");

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's company always comes from there, never from req.body / req.params.

exports.listProjects = async (req, res, next) => {
  try {
    const data = await projectsService.listForCompany(req.user.companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    // The request body has already been validated by the validate middleware.
    const { id, name, gcCompanyId, gcNameCustom } = req.body;
    const data = await projectsService.create({
      id,
      ownerCompanyId: req.user.companyId,
      name,
      gcCompanyId,
      gcNameCustom,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { name, status, gcCompanyId, gcNameCustom } = req.body;
    const data = await projectsService.update({
      id: req.params.id,
      companyId: req.user.companyId,
      patch: { name, status, gcCompanyId, gcNameCustom },
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
