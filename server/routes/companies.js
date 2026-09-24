const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { requireGcCompany } = require("../middlewares/requireGcCompany");
const { requireRole } = require("../middlewares/requireRole");
const { validate } = require("../middlewares/validate");
const { MANAGER_ROLES } = require("../constants/roles");
const {
  uploadLogo,
  getLogoUrl,
  getJoinCode,
  getMe,
} = require("../controllers/companies");
const { inviteTeammate, previewInvite } = require("../controllers/companyInvites");

const router = express.Router();

// GET /api/companies/me — the caller's own company profile (name, type,
// tier, logo path). Scoped to req.user.companyId, same trust boundary as
// every other route in this file.
router.get("/me", requireAuth, loadUserContext, getMe);

// PUT /api/companies/logo — upload/replace the caller's own company's logo.
// Scoped to req.user.companyId only (no :id param — there is nothing else to
// target), tier-gated (403 for basic) inside the controller. `express.raw`
// reads the request body as a Buffer, same pattern as the crew-photo/
// signature-blob PUT routes.
router.put(
  "/logo",
  requireAuth,
  loadUserContext,
  express.raw({ type: "image/*", limit: "5mb" }),
  uploadLogo,
);

// GET /api/companies/logo-url — a short-lived signed URL for the caller's own
// company logo, same shape as GET /api/meetings/:id/crew-photo-url. 404s
// until a logo has been uploaded.
router.get("/logo-url", requireAuth, loadUserContext, getLogoUrl);

// GET /api/companies/join-code — the GC's own join code (created on first
// call). GC-only: a subcontractor enters this code on a project to link it.
router.get(
  "/join-code",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  getJoinCode,
);

// POST /api/companies/invite — an admin/safety_manager invites a teammate by
// email at a chosen role (Phase 8c). Manager-only, same single-purpose gate
// shape as DELETE /api/projects/:id.
router.post(
  "/invite",
  requireAuth,
  loadUserContext,
  requireRole(...MANAGER_ROLES),
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Enter a valid email address")
      .normalizeEmail({ gmail_remove_dots: false }),
    body("role")
      .isIn(["admin", "safety_manager", "foreman"])
      .withMessage("Invalid role"),
  ],
  validate,
  inviteTeammate,
);

// GET /api/companies/invite/:token — public preview for the accept-invite
// page, before the invitee has any account. No requireAuth: the token itself
// is the only credential, same trust model as a Supabase password-reset link.
router.get(
  "/invite/:token",
  [
    param("token")
      .isHexadecimal()
      .withMessage("Invalid invite link")
      .isLength({ min: 64, max: 64 })
      .withMessage("Invalid invite link"),
  ],
  validate,
  previewInvite,
);

module.exports = router;
