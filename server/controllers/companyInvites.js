const companyInvitesService = require("../services/companyInvites");
const companiesService = require("../services/companies");
const emailService = require("../services/email");
const envUtils = require("../utility/envUtils");
const { ROLE_LABELS } = require("../constants/roles");

// POST /api/companies/invite — manager-only (requireRole gate on the route).
// Never returns the raw token to the caller's browser — only the email/role
// sent, confirming the invite went out. The accept link only ever leaves the
// server via the email itself.
exports.inviteTeammate = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const invite = await companyInvitesService.createInvite(req.user.companyId, email, role);
    const company = await companiesService.getById(req.user.companyId);
    const acceptUrl = `${envUtils.keysBasedOnEnv().clientUrl}/invite/${invite.token}`;

    await emailService.sendCompanyInviteEmail({
      to: invite.email,
      companyName: company.name,
      inviterName: req.user.name,
      role: ROLE_LABELS[invite.role] ?? invite.role,
      acceptUrl,
    });

    return res.status(201).json({ success: true, data: { email: invite.email, role: invite.role } });
  } catch (error) {
    return next(error);
  }
};

// GET /api/companies/invite/:token — public, unauthenticated preview shown
// before the invitee has any account. The token itself is the credential.
exports.previewInvite = async (req, res, next) => {
  try {
    const data = await companyInvitesService.previewInvite(req.params.token);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
