const talksService = require("../services/talks");
const talkVisibilityService = require("../services/talkVisibility");
const translationService = require("../services/translation");
const { AppError } = require("../utility/AppError");
const { hasTranslationAccess, canAuthorCompanyTalks } = require("../utility/entitlements");
const { MANAGER_ROLES } = require("../constants/roles");

const UPGRADE_MESSAGE = "Upgrade to Trade Pro to unlock multi-language talks";
const GC_UPGRADE_MESSAGE = "Upgrade to GC Portfolio to create company talks";
const GC_MANAGER_MESSAGE = "Only a safety director or admin can write company talks";

// A GC needs Portfolio to author company talks (see canAuthorCompanyTalks) and
// a manager role -- a company talk reaches every sub on the GC's jobsites, so a
// superintendent/foreman shouldn't write or rewrite one (delete is manager-only
// too, via the route). Subcontractors are unaffected.
const assertCanAuthor = (user) => {
  if (!canAuthorCompanyTalks(user.companyType, user.tier)) {
    throw new AppError(GC_UPGRADE_MESSAGE, 403);
  }
  if (user.companyType === "gc" && !MANAGER_ROLES.includes(user.role)) {
    throw new AppError(GC_MANAGER_MESSAGE, 403);
  }
};

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's company always comes from there, never from req.body/req.params.
// Which talks the caller may see (Trade Free core-only, Phase 9c; a sub also
// sees its GCs' company talks) comes from resolveTalkVisibility — the server
// is the authority.

exports.listTalks = async (req, res, next) => {
  try {
    const visibility = await talkVisibilityService.resolveTalkVisibility(req.user);
    const data = await talksService.listForCompany(req.user.companyId, visibility);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getTalk = async (req, res, next) => {
  try {
    const visibility = await talkVisibilityService.resolveTalkVisibility(req.user);
    const data = await talksService.getById(req.params.id, req.user.companyId, visibility);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.createTalk = async (req, res, next) => {
  try {
    assertCanAuthor(req.user);
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
    assertCanAuthor(req.user);
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
