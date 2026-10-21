const noWorkDaysService = require("../services/noWorkDays");

// req.user is set by loadUserContext (after requireAuth). The caller's own
// companyId scopes every read/write; the jobsite is derived from their project
// in the service, never taken from the request.

exports.listNoWorkDays = async (req, res, next) => {
  try {
    const data = await noWorkDaysService.listForProject({
      projectId: req.query.projectId,
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// 201 new mark, 200 already marked, 200 { ignored: true } for a weekend or
// out-of-range date (a no-op, so an offline replay never strands).
exports.createNoWorkDay = async (req, res, next) => {
  try {
    const { id, projectId, offDate, reason } = req.body;
    const result = await noWorkDaysService.create({
      id,
      companyId: req.user.companyId,
      userId: req.user.id,
      projectId,
      offDate,
      reason,
    });

    if (result.ignored) {
      return res.status(200).json({ success: true, data: { ignored: true } });
    }
    return res
      .status(result.created ? 201 : 200)
      .json({ success: true, data: result.noWorkDay });
  } catch (error) {
    return next(error);
  }
};

exports.removeNoWorkDay = async (req, res, next) => {
  try {
    const data = await noWorkDaysService.remove({
      id: req.params.id,
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
