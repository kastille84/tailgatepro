const jobsitesService = require("../services/jobsites");
const emailService = require("../services/email");
const envUtils = require("../utility/envUtils");

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's GC company always comes from there, never from req.body/req.params.

exports.listJobsites = async (req, res, next) => {
  try {
    const data = await jobsitesService.listForGc(req.user.companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.createJobsite = async (req, res, next) => {
  try {
    const { name } = req.body;
    const data = await jobsitesService.create({
      gcCompanyId: req.user.companyId,
      name,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.updateJobsite = async (req, res, next) => {
  try {
    const { name, status, archived } = req.body;
    const data = await jobsitesService.update({
      id: req.params.id,
      gcCompanyId: req.user.companyId,
      patch: { name, status, archived },
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/jobsites/:id/invite — GC manager only (route guards). Never
// returns the raw token to the caller's browser — only the email the invite
// went to. The accept link only ever leaves the server via the email itself.
exports.inviteSubcontractor = async (req, res, next) => {
  try {
    const invite = await jobsitesService.createInvite({
      jobsiteId: req.params.id,
      gcCompanyId: req.user.companyId,
      email: req.body.email,
    });
    const acceptUrl = `${envUtils.keysBasedOnEnv().clientUrl}/jobsite-invite/${invite.token}`;

    await emailService.sendJobsiteInviteEmail({
      to: invite.email,
      gcCompanyName: invite.gcCompanyName,
      jobsiteName: invite.jobsiteName,
      inviterName: req.user.name,
      acceptUrl,
    });

    return res.status(201).json({ success: true, data: { email: invite.email } });
  } catch (error) {
    return next(error);
  }
};

// GET /api/jobsites/invite/:token — public, unauthenticated preview shown
// before the invitee has any account. The token itself is the credential.
exports.previewInvite = async (req, res, next) => {
  try {
    const data = await jobsitesService.previewInvite(req.params.token);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/jobsites/invite/:token/accept — an already-registered sub company
// (Case A). req.userEmail is token-verified by requireAuth; the service
// checks it against the invited address.
exports.acceptInvite = async (req, res, next) => {
  try {
    const data = await jobsitesService.acceptInvite({
      token: req.params.token,
      email: req.userEmail,
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.removeSubcontractor = async (req, res, next) => {
  try {
    const data = await jobsitesService.removeSubcontractor({
      jobsiteId: req.params.id,
      subId: req.params.subId,
      gcCompanyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
