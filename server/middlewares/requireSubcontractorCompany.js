const { AppError } = require("../utility/AppError");

// Runs after loadUserContext. Gates the subcontractor-side link-to-a-GC
// endpoints: only a sub links its own project to a GC's join code, so a GC
// can't attach its own project to another GC (which would later surface as a
// phantom "sub" on that GC's dashboard). A missing or unknown companyType is
// treated as "not a subcontractor" — deny by default.
const requireSubcontractorCompany = (req, res, next) => {
  if (req.user?.companyType !== "subcontractor") {
    return next(
      new AppError("This is only available to subcontractor accounts", 403),
    );
  }
  return next();
};

module.exports = { requireSubcontractorCompany };
