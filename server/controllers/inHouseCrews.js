const inHouseCrewsService = require("../services/inHouseCrews");
const jobsitesService = require("../services/jobsites");
const siteScopeService = require("../services/siteScope");
const companiesService = require("../services/companies");
const companyInvitesService = require("../services/companyInvites");
const crewJoinLinksService = require("../services/crewJoinLinks");
const crewMembersService = require("../services/crewMembers");
const emailService = require("../services/email");
const envUtils = require("../utility/envUtils");
const { AppError } = require("../utility/AppError");
const { ROLE_LABELS } = require("../constants/roles");

// req.user is set by loadUserContext (which runs after requireAuth) -- the
// caller's GC company always comes from there, never from req.body/req.params.

exports.listCrews = async (req, res, next) => {
  try {
    const data = await inHouseCrewsService.listForGc(req.user.companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.createCrew = async (req, res, next) => {
  try {
    const data = await inHouseCrewsService.create({
      gcCompanyId: req.user.companyId,
      name: req.body.name,
      jobsiteIds: req.body.jobsiteIds,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.updateCrew = async (req, res, next) => {
  try {
    const { name, archived } = req.body;
    const data = await inHouseCrewsService.update({
      id: req.params.id,
      gcCompanyId: req.user.companyId,
      patch: { name, archived },
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.deleteCrew = async (req, res, next) => {
  try {
    const data = await inHouseCrewsService.remove({
      id: req.params.id,
      gcCompanyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/companies/in-house/:id/invite -- a manager of the parent GC invites
// someone into one of its crews. Ownership is checked by getOwnedCrew (404 for
// another GC's crew); the invite itself is the unchanged 8c flow against the
// crew's company id. Like inviteTeammate, the token never reaches the caller.
exports.inviteCrewMember = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const crew = await companiesService.getOwnedCrew(req.params.id, req.user.companyId);
    if (crew.archivedAt) {
      throw new AppError("This crew is archived. Restore it before inviting people.", 409);
    }

    const invite = await companyInvitesService.createInvite(crew.id, email, role);
    const acceptUrl = `${envUtils.keysBasedOnEnv().clientUrl}/invite/${invite.token}`;

    await emailService.sendCompanyInviteEmail({
      to: invite.email,
      companyName: crew.name,
      inviterName: req.user.name,
      role: ROLE_LABELS[invite.role] ?? invite.role,
      acceptUrl,
    });

    return res.status(201).json({ success: true, data: { email: invite.email, role: invite.role } });
  } catch (error) {
    return next(error);
  }
};

// The crew's join link as the GC manager sees it: the token only ever leaves the
// server inside this URL, and only for a manager of the crew's GC.
const toJoinLinkResponse = (link) => ({
  joinUrl: `${envUtils.keysBasedOnEnv().clientUrl}/crew-join/${link.token}`,
  expiresAt: link.expiresAt,
  usesLeft: link.usesLeft,
});

// GET /api/companies/in-house/:id/join-link -- null when the crew has no link.
exports.getJoinLink = async (req, res, next) => {
  try {
    const link = await crewJoinLinksService.getForCrew(req.params.id, req.user.companyId);
    return res.status(200).json({ success: true, data: link ? toJoinLinkResponse(link) : null });
  } catch (error) {
    return next(error);
  }
};

// POST /api/companies/in-house/:id/join-link -- creates the link, or replaces it
// (the old URL stops working).
exports.createJoinLink = async (req, res, next) => {
  try {
    const link = await crewJoinLinksService.createForCrew(req.params.id, req.user.companyId);
    return res.status(201).json({ success: true, data: toJoinLinkResponse(link) });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/companies/in-house/:id/join-link -- the off switch.
exports.deleteJoinLink = async (req, res, next) => {
  try {
    await crewJoinLinksService.removeForCrew(req.params.id, req.user.companyId);
    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    return next(error);
  }
};

// GET /api/companies/crew-join/:token -- public preview for the join page.
exports.previewJoinLink = async (req, res, next) => {
  try {
    const data = await crewJoinLinksService.previewByToken(req.params.token);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/companies/in-house/:id/members
exports.listCrewMembers = async (req, res, next) => {
  try {
    const data = await crewMembersService.listMembers(req.params.id, req.user.companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/companies/in-house/:id/members/:userId
exports.removeCrewMember = async (req, res, next) => {
  try {
    await crewMembersService.removeMember(req.params.id, req.params.userId, req.user.companyId);
    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    return next(error);
  }
};

// POST /api/jobsites/:id/in-house/:crewId -- re-adds a crew to a jobsite (site
// managers, scoped to their assigned sites like the invite route).
exports.attachCrew = async (req, res, next) => {
  try {
    const data = await jobsitesService.attachInHouseCrew({
      jobsiteId: req.params.id,
      crewId: req.params.crewId,
      gcCompanyId: req.user.companyId,
      allowedJobsiteIds: await siteScopeService.getAllowedJobsiteIds(req.user),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
