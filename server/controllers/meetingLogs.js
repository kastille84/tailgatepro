const meetingLogsService = require("../services/meetingLogs");
const companiesService = require("../services/companies");
const talksService = require("../services/talks");
const talkVisibilityService = require("../services/talkVisibility");
const zipBundleService = require("../services/zipBundle");
const { getLimits } = require("../utility/entitlements");
const { slugify } = require("../utility/pdfFilename");

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's company and id always come from there, never from req.body/req.params.

// The plan's in-app history window in days (null = unlimited), Phase 9c.
const getHistoryDays = async (companyId) => {
  const company = await companiesService.getById(companyId);
  return getLimits(company.companyType, company.tier).historyDays;
};

exports.listMeetings = async (req, res, next) => {
  try {
    const { projectId, from, to } = req.query;
    const historyDays = await getHistoryDays(req.user.companyId);
    const options = { projectId, historyDays, from, to };
    const [data, hiddenCount] = await Promise.all([
      meetingLogsService.listForCompany(req.user.companyId, options),
      meetingLogsService.countHiddenForCompany(req.user.companyId, options),
    ]);
    return res
      .status(200)
      .json({ success: true, data, meta: { hiddenCount, historyDays } });
  } catch (error) {
    return next(error);
  }
};

// The archive's month cards: one entry per month with a completed meeting,
// plus the plan's history window and how many older rows it hides (for the
// upgrade banner, which shows regardless of which month is open).
exports.listMeetingMonths = async (req, res, next) => {
  try {
    const historyDays = await getHistoryDays(req.user.companyId);
    const [data, hiddenCount] = await Promise.all([
      meetingLogsService.listMonthSummaries(req.user.companyId, {
        historyDays,
        tzOffset: Number(req.query.tzOffset),
      }),
      meetingLogsService.countHiddenForCompany(req.user.companyId, {
        historyDays,
      }),
    ]);
    return res
      .status(200)
      .json({ success: true, data, meta: { hiddenCount, historyDays } });
  } catch (error) {
    return next(error);
  }
};

exports.getMeeting = async (req, res, next) => {
  try {
    const data = await meetingLogsService.getById(
      req.params.id,
      req.user.companyId,
      { historyDays: await getHistoryDays(req.user.companyId) },
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// `foremanId` is always the authenticated caller, never accepted from the
// request body — the person running the meeting is whoever is signed in.
exports.createMeeting = async (req, res, next) => {
  try {
    const { id, projectId, talkId } = req.body;
    // A caller can only log a talk it can see, on every plan: global talks
    // (core-only on Trade Free, Phase 9c), its own company's talks, and -- for
    // a sub -- its GCs' company talks. A hidden talk is a 404.
    if (talkId) {
      await talksService.getById(
        talkId,
        req.user.companyId,
        await talkVisibilityService.resolveTalkVisibility(req.user),
      );
    }
    const data = await meetingLogsService.create({
      id,
      companyId: req.user.companyId,
      projectId,
      talkId,
      foremanId: req.user.id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.completeMeeting = async (req, res, next) => {
  try {
    const data = await meetingLogsService.complete({
      id: req.params.id,
      companyId: req.user.companyId,
      heldAt: req.body?.heldAt,
      heldTzOffset: req.body?.heldTzOffset,
      actorId: req.user.id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/meetings/:id/verify-seal — recomputes the meeting's tamper-evidence
// HMAC-SHA256 content seal from current server state and compares it to what
// was stored at completion (Phase 9e, docs/tamper-evidence-design.md).
exports.verifySeal = async (req, res, next) => {
  try {
    const data = await meetingLogsService.verifySeal(
      req.params.id,
      req.user.companyId,
      req.user.id,
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// req.body is a raw Buffer here (see the route's `express.raw` middleware),
// not the parsed JSON object every other controller in this file sees.
exports.uploadCrewPhoto = async (req, res, next) => {
  try {
    const data = await meetingLogsService.uploadCrewPhoto({
      id: req.params.id,
      companyId: req.user.companyId,
      buffer: req.body,
      contentType: req.get("Content-Type"),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getCrewPhotoUrl = async (req, res, next) => {
  try {
    const url = await meetingLogsService.getCrewPhotoUrl(
      req.params.id,
      req.user.companyId,
    );
    return res.status(200).json({ success: true, data: { url } });
  } catch (error) {
    return next(error);
  }
};

exports.getPdfUrl = async (req, res, next) => {
  try {
    const url = await meetingLogsService.getPdfUrl(
      req.params.id,
      req.user.companyId,
      { historyDays: await getHistoryDays(req.user.companyId) },
    );
    return res.status(200).json({ success: true, data: { url } });
  } catch (error) {
    return next(error);
  }
};

// Streams a ZIP body, not the usual { success, data } JSON envelope — see
// docs/sub-defense-bundle-design.md. companyType/tier come straight off
// req.user (already resolved by loadUserContext), unlike getHistoryDays above
// which re-fetches the company row — this gate needs no second DB read. A
// failure once headers (and possibly some zip bytes) are already flushed can
// no longer produce a normal JSON error response, so it destroys the
// connection instead of calling next(error) — same shape as
// controllers/gc.js's getDefenseBundle.
exports.getDefenseBundle = async (req, res, next) => {
  try {
    const { companyName, entries, skippedCount } =
      await meetingLogsService.getDefenseBundleEntries(req.user.companyId, {
        companyType: req.user.companyType,
        tier: req.user.tier,
      });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slugify(companyName)}-defense-bundle.zip"`,
    );
    await zipBundleService.streamBundle(entries, res, {
      skippedCount,
      header: ["GC / Client", "Project", "Talk", "Held At", "Filename"],
    });
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    return next(error);
  }
};
