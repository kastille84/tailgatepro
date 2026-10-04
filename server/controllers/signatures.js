const signaturesService = require("../services/signatures");

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's company always comes from there, never from req.body/req.params.
// req.params.meetingId comes from the parent route
// (/api/meetings/:meetingId/signatures — see server/routes/meetingLogs.js).

exports.listSignatures = async (req, res, next) => {
  try {
    const data = await signaturesService.listForMeeting(
      req.params.meetingId,
      req.user.companyId,
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.createSignature = async (req, res, next) => {
  try {
    const { id, workerName, quizAnswers } = req.body;
    const data = await signaturesService.create({
      id,
      companyId: req.user.companyId,
      meetingId: req.params.meetingId,
      workerName,
      quizAnswers,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// req.body is a raw Buffer here (see the route's `express.raw` middleware),
// not the parsed JSON object every other controller in this file sees.
exports.uploadSignatureBlob = async (req, res, next) => {
  try {
    const data = await signaturesService.uploadBlob(
      req.params.id,
      req.user.companyId,
      req.body,
      req.get("Content-Type"),
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getSignatureUrl = async (req, res, next) => {
  try {
    const url = await signaturesService.getSignedUrl(
      req.params.id,
      req.user.companyId,
    );
    return res.status(200).json({ success: true, data: { url } });
  } catch (error) {
    return next(error);
  }
};
