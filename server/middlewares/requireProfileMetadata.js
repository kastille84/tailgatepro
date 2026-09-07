const { AppError } = require("../utility/AppError");

const COMPANY_TYPES = ["gc", "subcontractor"];

// Reads the profile fields the client stored as Supabase `user_metadata` at
// sign-up (surfaced as req.userMetadata by requireAuth) and normalizes them
// into req.profile for the createProfile controller. Runs in place of an
// express-validator body chain because on the deferred (confirm-email) path
// the request body is empty — the trustworthy copy of these fields is the one
// carried on the token-verified user.
const requireProfileMetadata = (req, res, next) => {
  const metadata = req.userMetadata || {};

  const name = typeof metadata.name === "string" ? metadata.name.trim() : "";
  const companyName =
    typeof metadata.companyName === "string"
      ? metadata.companyName.trim()
      : "";
  const companyType = metadata.companyType;

  if (!name || !companyName || !COMPANY_TYPES.includes(companyType)) {
    return next(new AppError("Profile details are incomplete", 422));
  }

  req.profile = { name, companyName, companyType };
  return next();
};

module.exports = { requireProfileMetadata };
