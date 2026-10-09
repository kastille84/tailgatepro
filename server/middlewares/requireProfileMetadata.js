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
  // Phase 9e: a brand-new sub signing up straight from a scanned jobsite QR
  // code (docs/jobsite-qr-join-design.md), as opposed to jobsiteInviteToken's
  // GC-sent email invite. Validated identically to jobsiteInviteToken below —
  // the two differ only in which service call createProfile makes with them.
  const jobsiteJoinToken =
    typeof metadata.jobsiteJoinToken === "string" ? metadata.jobsiteJoinToken.trim() : "";

  // Phase 13f-join: a foreman signing up from an in-house crew's open join link.
  // Like inviteToken it joins an existing company (the crew), so no company
  // fields are read; the role is set server-side, never from metadata.
  const crewJoinToken =
    typeof metadata.crewJoinToken === "string" ? metadata.crewJoinToken.trim() : "";

  // The four token kinds are mutually exclusive: a team invite or a crew join
  // link joins an existing company, a jobsite invite or a jobsite join link each
  // found a brand-new one.
  const tokenCount = [inviteToken, jobsiteInviteToken, jobsiteJoinToken, crewJoinToken].filter(
    Boolean,
  ).length;
  if (tokenCount > 1) {
    return next(new AppError("Profile details are incomplete", 422));
  }

  if (inviteToken) {
    req.profile = { name, inviteToken };
    return next();
  }

  if (crewJoinToken) {
    req.profile = { name, crewJoinToken };
    return next();
  }

  const companyName =
    typeof metadata.companyName === "string"
      ? metadata.companyName.trim()
      : "";

  // Phase 8d Case B / Phase 9e: a GC's jobsite invite, or a scanned jobsite
  // QR/join link, reaching an unregistered sub. The invitee names their own
  // company (the GC never pre-creates one), but companyType is forced to
  // "subcontractor" rather than read from metadata — self-declaring into
  // either kind of jobsite admission must not be possible.
  if (jobsiteInviteToken || jobsiteJoinToken) {
    if (!companyName) {
      return next(new AppError("Profile details are incomplete", 422));
    }
    req.profile = {
      name,
      companyName,
      companyType: "subcontractor",
      ...(jobsiteInviteToken ? { jobsiteInviteToken } : { jobsiteJoinToken }),
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
