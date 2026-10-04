const usersService = require("../services/users");

// Runs after requireAuth. requireAuth proves *who* the caller is (req.userId)
// but never touches the `users` table, so anything that authorizes by company,
// role, or subscription tier resolves the caller's profile row here into
// req.user = { id, name, companyId, role, tier, companyType }. Reusable by
// every authed domain. `name` is carried so a controller (e.g. Phase 8c's
// invite-send) can use the caller's display name without a second query.
const loadUserContext = async (req, res, next) => {
  try {
    const { id, name, companyId, role, tier, companyType } =
      await usersService.getUserContext(req.userId);
    req.user = { id, name, companyId, role, tier, companyType };
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { loadUserContext };
