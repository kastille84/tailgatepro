const talksService = require("../services/talks");
const translationService = require("../services/translation");
const { AppError } = require("../utility/AppError");
const { hasTranslationAccess, hasFullLibrary } = require("../utility/entitlements");

const UPGRADE_MESSAGE = "Upgrade to Trade Pro to unlock multi-language talks";

// Trade Free sees only the core talks (Phase 9c); the server is the authority.
const fullLibraryFor = (user) => hasFullLibrary(user.companyType, user.tier);

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's company always comes from there, never from req.body/req.params.

exports.listTalks = async (req, res, next) => {
  try {
    const data = await talksService.listForCompany(req.user.companyId, {
      fullLibrary: fullLibraryFor(req.user),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getTalk = async (req, res, next) => {
  try {
    const data = await talksService.getById(req.params.id, req.user.companyId, {
      fullLibrary: fullLibraryFor(req.user),
    });
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
      targetLanguages,
    } = req.body;
    if (targetLanguages?.length && !hasTranslationAccess(req.user.tier)) {
      throw new AppError(UPGRADE_MESSAGE, 403);
    }
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
      targetLanguages,
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
      targetLanguages,
    } = req.body;
    if (targetLanguages?.length && !hasTranslationAccess(req.user.tier)) {
      throw new AppError(UPGRADE_MESSAGE, 403);
    }
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
      targetLanguages,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/talks/translation-languages — every language the configured
// Google Translate project supports, for TalkForm's "Translate into"
// checklist. Gated the same as create/update's targetLanguages.
exports.listTranslationLanguages = async (req, res, next) => {
  try {
    if (!hasTranslationAccess(req.user.tier)) {
      throw new AppError(UPGRADE_MESSAGE, 403);
    }
    const data = await translationService.getSupportedLanguages();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Manager-only (admin/safety_manager) — enforced by requireRole in the route,
// not here (Phase 8a).
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
