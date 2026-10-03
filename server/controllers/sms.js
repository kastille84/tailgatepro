const smsNudgesService = require("../services/smsNudges");
const smsService = require("../services/sms");
const siteScopeService = require("../services/siteScope");
const { toE164 } = require("../utility/phone");
const { AppError } = require("../utility/AppError");

// GET /api/sms/me — the caller's own SMS opt-in, or null.
exports.getMine = async (req, res, next) => {
  try {
    const data = await smsNudgesService.getMine(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// PUT /api/sms/me — a foreman opts in with their phone (route enforces consent).
exports.setMine = async (req, res, next) => {
  try {
    const data = await smsNudgesService.setMine({
      userId: req.user.id,
      subCompanyId: req.user.companyId,
      phone: req.body.phone,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/sms/me — withdraw the opt-in.
exports.clearMine = async (req, res, next) => {
  try {
    await smsNudgesService.clearMine(req.user.id);
    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    return next(error);
  }
};

// GET /api/sms/jobsites/:id/recipients — GC-entered numbers for one site.
exports.listForJobsite = async (req, res, next) => {
  try {
    const data = await smsNudgesService.listForJobsite({
      jobsiteId: req.params.id,
      gcCompanyId: req.user.companyId,
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/sms/jobsites/:id/recipients — add a sub foreman's number.
exports.addForJobsite = async (req, res, next) => {
  try {
    const data = await smsNudgesService.addForJobsite({
      jobsiteId: req.params.id,
      gcCompanyId: req.user.companyId,
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
      rosterId: req.body.rosterId,
      phone: req.body.phone,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/sms/jobsites/:id/recipients/:recipientId
exports.removeForJobsite = async (req, res, next) => {
  try {
    await smsNudgesService.removeForJobsite({
      jobsiteId: req.params.id,
      recipientId: req.params.recipientId,
      gcCompanyId: req.user.companyId,
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
    });
    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    return next(error);
  }
};

const escapeXml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// POST /webhook/twilio/sms — Twilio's inbound-message webhook. No requireAuth:
// the X-Twilio-Signature header is the credential. Answers with TwiML.
exports.handleInbound = async (req, res, next) => {
  try {
    const valid = smsService.isValidTwilioSignature({
      signature: req.get("x-twilio-signature"),
      params: req.body,
    });
    if (!valid) throw new AppError("Invalid signature", 403);

    const from = toE164(req.body.From);
    const reply = from
      ? await smsNudgesService.handleInbound({ from, body: req.body.Body })
      : null;

    res.type("text/xml");
    return res
      .status(200)
      .send(
        reply
          ? `<Response><Message>${escapeXml(reply)}</Message></Response>`
          : "<Response></Response>",
      );
  } catch (error) {
    return next(error);
  }
};
