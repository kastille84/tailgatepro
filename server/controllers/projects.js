const projectsService = require("../services/projects");

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's company always comes from there, never from req.body / req.params.

exports.listProjects = async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const data = await projectsService.listForCompany(req.user.companyId, {
      includeArchived,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    // The request body has already been validated by the validate middleware.
    const { id, name, gcNameCustom, gcContactEmail } = req.body;
    const data = await projectsService.create({
      id,
      ownerCompanyId: req.user.companyId,
      name,
      gcNameCustom,
      gcContactEmail,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { name, status, gcNameCustom, gcContactEmail, archived } = req.body;
    const data = await projectsService.update({
      id: req.params.id,
      companyId: req.user.companyId,
      role: req.user.role,
      patch: { name, status, gcNameCustom, gcContactEmail, archived },
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Subcontractor-only (requireSubcontractorCompany in the route): links the
// project to the GC that owns the join code. Responds with the updated project.
exports.linkGc = async (req, res, next) => {
  try {
    const data = await projectsService.linkGc({
      projectId: req.params.id,
      companyId: req.user.companyId,
      joinCode: req.body.joinCode,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.unlinkGc = async (req, res, next) => {
  try {
    const data = await projectsService.unlinkGc({
      projectId: req.params.id,
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const data = await projectsService.remove({
      id: req.params.id,
      companyId: req.user.companyId,
      role: req.user.role,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
