const { AppError } = require("../utility/AppError");

// Runs after loadUserContext. Factory: requireRole("admin", "safety_manager")
// returns a middleware that denies (403) unless the caller's req.user.role is
// one of the given roles. A missing or unknown role is treated as "not
// allowed" — deny by default, same as requireGcCompany/requireSubcontractorCompany.
//
// Only fits a route whose entire purpose is role-gated (e.g. DELETE a
// project). A route that mixes role-gated and ungated actions in one handler
// (e.g. PATCH a project, where `archived` needs a role but `name` doesn't)
// can't wire this at the router level — that gate lives in the service layer
// instead, checking the same MANAGER_ROLES list.
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new AppError("You don't have permission to do this", 403));
    }
    return next();
  };

module.exports = { requireRole };
