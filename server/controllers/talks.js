const talksService = require("../services/talks");

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's company always comes from there, never from req.body/req.params.

exports.listTalks = async (req, res, next) => {
  try {
    const data = await talksService.listForCompany(req.user.companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getTalk = async (req, res, next) => {
  try {
    const data = await talksService.getById(req.params.id, req.user.companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.createTalk = async (req, res, next) => {
  try {
    const {
      id,
      title,
      tradeTag,
      summary,
      talkingPoints,
      siteHazardsToCheck,
      discussionQuestions,
      oshaStandards,
      estimatedMinutes,
    } = req.body;
    const data = await talksService.create({
      id,
      companyId: req.user.companyId,
      title,
      tradeTag,
      summary,
      talkingPoints,
      siteHazardsToCheck,
      discussionQuestions,
      oshaStandards,
      estimatedMinutes,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.updateTalk = async (req, res, next) => {
  try {
    const {
      title,
      tradeTag,
      summary,
      talkingPoints,
      siteHazardsToCheck,
      discussionQuestions,
      oshaStandards,
      estimatedMinutes,
    } = req.body;
    const data = await talksService.update({
      id: req.params.id,
      companyId: req.user.companyId,
      title,
      tradeTag,
      summary,
      talkingPoints,
      siteHazardsToCheck,
      discussionQuestions,
      oshaStandards,
      estimatedMinutes,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// TODO(roles): once `admin` / `safety_manager` are real, restrict delete to
// those roles rather than any member of the owning company.
exports.deleteTalk = async (req, res, next) => {
  try {
    const data = await talksService.remove({
      id: req.params.id,
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
