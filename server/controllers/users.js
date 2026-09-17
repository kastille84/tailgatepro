const usersService = require("../services/users");

exports.createProfile = async (req, res, next) => {
  try {
    // req.userId comes from requireAuth (verified against the Supabase access
    // token); req.profile comes from requireProfileMetadata (normalized from
    // that same token's user_metadata) — never trust anything in req.body.
    const { name, companyName, companyType } = req.profile;
    const data = await usersService.createProfile({
      id: req.userId, // the connection between req.userId and this is the user's Supabase id
      name,
      companyName,
      companyType,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GET /api/users/me — the caller's own resolved identity (id, companyId,
// role, tier). `loadUserContext` already did the DB work; this just returns
// what it put on req.user. First endpoint that exposes profile/tier to the
// client at all.
exports.getCurrentUser = (req, res) => {
  return res.status(200).json({ success: true, data: req.user });
};
