const usersService = require("../services/users");

exports.createProfile = async (req, res, next) => {
  try {
    // req.userId/req.userEmail come from requireAuth (verified against the
    // Supabase access token); req.profile comes from requireProfileMetadata
    // (normalized from that same token's user_metadata) — never trust
    // anything in req.body. `inviteToken` is only present on an invited
    // signup (Phase 8c), `jobsiteInviteToken` only on a GC's jobsite-invite
    // signup (Phase 8d); destructuring yields undefined otherwise.
    const { name, companyName, companyType, inviteToken, jobsiteInviteToken } =
      req.profile;
    const data = await usersService.createProfile({
      id: req.userId, // the connection between req.userId and this is the user's Supabase id
      email: req.userEmail,
      name,
      companyName,
      companyType,
      inviteToken,
      jobsiteInviteToken,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/users/me — the caller's own resolved identity (id, companyId,
// role, tier, companyType). `loadUserContext` already did the DB work; this just returns
// what it put on req.user. First endpoint that exposes profile/tier to the
// client at all.
exports.getCurrentUser = (req, res) => {
  return res.status(200).json({ success: true, data: req.user });
};
