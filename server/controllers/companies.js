const companiesService = require("../services/companies");
const storageService = require("../services/storage");
const { AppError } = require("../utility/AppError");
const { hasBrandingAccess } = require("../utility/entitlements");

const LOGO_BUCKET = "company-logos";
const LOGO_URL_TTL_SECONDS = 300;
const UPGRADE_MESSAGE = "Upgrade to Trade Pro to upload a company logo";

// Deterministic, extension-free path so a re-upload always upserts the same
// object (mirrors crewPhotoPath/signaturePath's fixed-name convention) —
// Storage serves the correct content-type on download regardless of the
// object's key, so this doesn't force a company into PNG or JPEG.
const logoPath = (companyId) => `${companyId}/logo`;

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's company and tier always come from there, never from req.params.

// req.body is a raw Buffer here (see the route's `express.raw` middleware),
// not the parsed JSON object every other controller in this file's siblings see.
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!hasBrandingAccess(req.user.tier)) {
      throw new AppError(UPGRADE_MESSAGE, 403);
    }
    const path = logoPath(req.user.companyId);
    await storageService.uploadBlob(LOGO_BUCKET, path, req.body, req.get("Content-Type"));
    const data = await companiesService.updateLogo(req.user.companyId, path);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// GC-only (requireGcCompany runs before this). The code is created on the
// first call and returned unchanged on every call after.
exports.getJoinCode = async (req, res, next) => {
  try {
    const joinCode = await companiesService.getOrCreateJoinCode(
      req.user.companyId,
    );
    return res.status(200).json({ success: true, data: { joinCode } });
  } catch (error) {
    return next(error);
  }
};

exports.getLogoUrl = async (req, res, next) => {
  try {
    const company = await companiesService.getById(req.user.companyId);
    if (!company.logoPath) {
      throw new AppError("No logo has been uploaded for this company", 404);
    }
    const url = await storageService.getSignedUrl(
      LOGO_BUCKET,
      company.logoPath,
      LOGO_URL_TTL_SECONDS,
    );
    return res.status(200).json({ success: true, data: { url } });
  } catch (error) {
    return next(error);
  }
};
