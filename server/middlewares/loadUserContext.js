const usersService = require("../services/users");

// Runs after requireAuth. requireAuth proves *who* the caller is (req.userId)
// but never touches the `users` table, so anything that authorizes by company
// or role resolves the caller's profile row here into
// req.user = { id, companyId, role }. Reusable by every authed domain.
const loadUserContext = async (req, res, next) => {
  try {
    const { id, companyId, role } = await usersService.getUserContext(
      req.userId,
    );
    req.user = { id, companyId, role };
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { loadUserContext };
