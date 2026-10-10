const jobsitesService = require("../services/jobsites");
const siteScopeService = require("../services/siteScope");
const jobsiteMembersService = require("../services/jobsiteMembers");
const emailService = require("../services/email");
const envUtils = require("../utility/envUtils");

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's GC company always comes from there, never from req.body/req.params.

exports.listJobsites = async (req, res, next) => {
  try {
    const allowedJobsiteIds = await siteScopeService.getAllowedJobsiteIds(req.user);
    const data = await jobsitesService.listForGc(req.user.companyId, allowedJobsiteIds);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.createJobsite = async (req, res, next) => {
  try {
    const { name, crewIds } = req.body;
    const data = await jobsitesService.create({
      gcCompanyId: req.user.companyId,
      name,
      crewIds,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.updateJobsite = async (req, res, next) => {
  try {
    const { name, status, archived, meetingCadence, smsNudgesEnabled, timezone } = req.body;
    const data = await jobsitesService.update({
      id: req.params.id,
      gcCompanyId: req.user.companyId,
      patch: { name, status, archived, meetingCadence, smsNudgesEnabled, timezone },
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
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
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

// GET /api/jobsites/:id/join-link — GC manager/site-scoped superintendent
// only (route guards). Returns the jobsite's standing QR/join URL,
// generating the token on first use. Unlike the invite token, this one is
// meant to be shown/printed — see docs/jobsite-qr-join-design.md.
exports.getJoinLink = async (req, res, next) => {
  try {
    const token = await jobsitesService.getOrCreateJoinToken({
      jobsiteId: req.params.id,
      gcCompanyId: req.user.companyId,
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
    });
    const joinUrl = `${envUtils.keysBasedOnEnv().clientUrl}/jobsite-join/${token}`;
    return res.status(200).json({ success: true, data: { joinUrl } });
  } catch (error) {
    return next(error);
  }
};

// GET /api/jobsites/join/:token — public, unauthenticated preview shown
// before the scanner has any account. The token itself is the credential.
exports.previewJoinLink = async (req, res, next) => {
  try {
    const data = await jobsitesService.previewJoinLink(req.params.token);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/jobsites/join/:token/accept — a subcontractor company
// self-admits onto the jobsite (Phase 9e). No email check — see
// jobsitesService.acceptJoinLink for why.
exports.acceptJoinLink = async (req, res, next) => {
  try {
    const data = await jobsitesService.acceptJoinLink({
      token: req.params.token,
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
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/jobsites/:id/members — manager only (route guards).
exports.listMembers = async (req, res, next) => {
  try {
    const data = await jobsiteMembersService.listForJobsite({
      jobsiteId: req.params.id,
      gcCompanyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// PUT /api/jobsites/:id/members — manager only, GC Portfolio only.
exports.setMembers = async (req, res, next) => {
  try {
    const data = await jobsiteMembersService.setMembers({
      jobsiteId: req.params.id,
      gcCompanyId: req.user.companyId,
      userIds: req.body.userIds,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/jobsites/memberships — a subcontractor company's own job sites
// with their meeting cadence (GC default, own override, effective).
exports.listMemberships = async (req, res, next) => {
  try {
    const data = await jobsitesService.listMemberships(req.user.companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/jobsites/:id/my-cadence — the caller's company tightens (or, with
// null, clears) its own cadence on a jobsite it belongs to.
exports.setMyCadence = async (req, res, next) => {
  try {
    const data = await jobsitesService.setMyCadence({
      jobsiteId: req.params.id,
      companyId: req.user.companyId,
      cadence: req.body.cadence,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
