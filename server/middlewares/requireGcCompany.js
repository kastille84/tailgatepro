const { AppError } = require("../utility/AppError");

// Runs after loadUserContext. Gates the GC-only surface (join code, and 6e's
// /api/gc/*) on the caller's company being a general contractor. A missing or
// unknown companyType is treated as "not a GC" — deny by default.
const requireGcCompany = (req, res, next) => {
  if (req.user?.companyType !== "gc") {
    return next(
      new AppError("This is only available to general contractor accounts", 403),
    );
  }
  return next();
};

module.exports = { requireGcCompany };
