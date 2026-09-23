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

  if (!name) {
    return next(new AppError("Profile details are incomplete", 422));
  }

  // Phase 8c: an invited signup's user_metadata carries an inviteToken
  // instead of companyName/companyType — company and role come from the
  // invite row itself (looked up in createProfile), not from metadata.
  const inviteToken =
    typeof metadata.inviteToken === "string" ? metadata.inviteToken.trim() : "";
  const jobsiteInviteToken =
    typeof metadata.jobsiteInviteToken === "string"
      ? metadata.jobsiteInviteToken.trim()
      : "";

  // The two invite kinds are mutually exclusive: a team invite joins an
  // existing company, a jobsite invite founds a brand-new one.
  if (inviteToken && jobsiteInviteToken) {
    return next(new AppError("Profile details are incomplete", 422));
  }

  if (inviteToken) {
    req.profile = { name, inviteToken };
    return next();
  }

  const companyName =
    typeof metadata.companyName === "string"
      ? metadata.companyName.trim()
      : "";

  // Phase 8d Case B: a GC's jobsite invite to an unregistered sub. The invitee
  // names their own company (the GC never pre-creates one), but companyType is
  // forced to "subcontractor" rather than read from metadata — a GC must not be
  // able to self-declare into a sub invite.
  if (jobsiteInviteToken) {
    if (!companyName) {
      return next(new AppError("Profile details are incomplete", 422));
    }
    req.profile = {
      name,
      companyName,
      companyType: "subcontractor",
      jobsiteInviteToken,
    };
    return next();
  }

  const companyType = metadata.companyType;

  if (!companyName || !COMPANY_TYPES.includes(companyType)) {
    return next(new AppError("Profile details are incomplete", 422));
  }

  req.profile = { name, companyName, companyType };
  return next();
};

module.exports = { requireProfileMetadata };
