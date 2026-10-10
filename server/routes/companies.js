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
const {
  listCrews,
  createCrew,
  updateCrew,
  deleteCrew,
  inviteCrewMember,
  getJoinLink,
  createJoinLink,
  deleteJoinLink,
  previewJoinLink,
  listCrewMembers,
  removeCrewMember,
} = require("../controllers/inHouseCrews");

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

// In-house crews (Phase 13, docs/in-house-subs-design.md): a GC's own
// self-performing trades, each a subcontractor company owned by the caller's GC.
// GC-only; writes are manager-only, like jobsite writes.
// A factory, not a shared chain: express-validator chains are mutable, so
// `.optional()` on a shared one would also loosen the POST route.
const crewNameValidator = () =>
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Crew name is required")
    .isLength({ max: 120 })
    .withMessage("Crew name is too long");

router.get("/in-house", requireAuth, loadUserContext, requireGcCompany, listCrews);

router.post(
  "/in-house",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [
    crewNameValidator(),
    // Job sites to put the new crew on; none are automatic.
    body("jobsiteIds").optional().isArray({ max: 100 }).withMessage("Invalid job sites"),
    body("jobsiteIds.*").isUUID().withMessage("Invalid job site id"),
  ],
  validate,
  createCrew,
);

router.patch(
  "/in-house/:id",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [
    param("id").isUUID().withMessage("A valid crew id is required"),
    crewNameValidator().optional(),
    body("archived").optional().isBoolean().withMessage("Invalid archived flag").toBoolean(),
  ],
  validate,
  updateCrew,
);

router.delete(
  "/in-house/:id",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [param("id").isUUID().withMessage("A valid crew id is required")],
  validate,
  deleteCrew,
);

// POST /api/companies/in-house/:id/invite — a manager of the parent GC invites
// someone into one of its crews (Phase 13d). Superintendent is excluded: it is a
// GC Portfolio-only role and a crew is a subcontractor company.
router.post(
  "/in-house/:id/invite",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [
    param("id").isUUID().withMessage("A valid crew id is required"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Enter a valid email address")
      .normalizeEmail({ gmail_remove_dots: false }),
    body("role").isIn(["admin", "safety_manager", "foreman"]).withMessage("Invalid role"),
  ],
  validate,
  inviteCrewMember,
);

// Crew join link (Phase 13f-join): one open link per crew that lets a foreman
// sign up into it without the GC knowing their email. Same gates as the invite.
const crewIdParam = () => param("id").isUUID().withMessage("A valid crew id is required");
const crewManagerGates = [
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
];

router.get("/in-house/:id/join-link", ...crewManagerGates, [crewIdParam()], validate, getJoinLink);
router.post("/in-house/:id/join-link", ...crewManagerGates, [crewIdParam()], validate, createJoinLink);
router.delete("/in-house/:id/join-link", ...crewManagerGates, [crewIdParam()], validate, deleteJoinLink);

// A crew's people, and removing one (the GC's control over an open join link).
router.get("/in-house/:id/members", ...crewManagerGates, [crewIdParam()], validate, listCrewMembers);
router.delete(
  "/in-house/:id/members/:userId",
  ...crewManagerGates,
  [crewIdParam(), param("userId").isUUID().withMessage("A valid user id is required")],
  validate,
  removeCrewMember,
);

// GET /api/companies/crew-join/:token — public preview for the join-crew page.
// No requireAuth: the token itself is the credential, as for /invite/:token.
router.get(
  "/crew-join/:token",
  [
    param("token")
      .isHexadecimal()
      .withMessage("Invalid join link")
      .isLength({ min: 64, max: 64 })
      .withMessage("Invalid join link"),
  ],
  validate,
  previewJoinLink,
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
      .isIn(["admin", "safety_manager", "foreman", "superintendent"])
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
