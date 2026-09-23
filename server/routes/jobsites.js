const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { requireGcCompany } = require("../middlewares/requireGcCompany");
const { requireRole } = require("../middlewares/requireRole");
const { validate } = require("../middlewares/validate");
const { MANAGER_ROLES } = require("../constants/roles");
const {
  requireSubcontractorCompany,
} = require("../middlewares/requireSubcontractorCompany");
const {
  listJobsites,
  createJobsite,
  updateJobsite,
  inviteSubcontractor,
  previewInvite,
  acceptInvite,
  removeSubcontractor,
} = require("../controllers/jobsites");

const router = express.Router();

// All routes are GC-only (requireGcCompany) — a jobsite is created and owned
// by a general contractor, never a subcontractor. Writes are additionally
// manager-only (docs/jobsite-design.md's endpoint table): unlike a project's
// PATCH, there is no "any company member may edit" carve-out for a jobsite.

// GET /api/jobsites — every jobsite the caller's GC company owns, each with
// its roster (pending invites + accepted subs; never the invite token).
router.get("/", requireAuth, loadUserContext, requireGcCompany, listJobsites);

// POST /api/jobsites — create a jobsite. `id` is server-generated (jobsites.id
// has no DB default and this is an online-only action, unlike a project's
// client-generated id — see server/services/jobsites.js).
router.post(
  "/",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Jobsite name is required")
      .isLength({ max: 120 })
      .withMessage("Jobsite name is too long"),
  ],
  validate,
  createJobsite,
);

// PATCH /api/jobsites/:id — patch name/status on a jobsite the caller's GC
// company owns. `archived: true|false` archives/restores it.
router.patch(
  "/:id",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [
    param("id").isUUID().withMessage("A valid jobsite id is required"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Jobsite name cannot be empty")
      .isLength({ max: 120 })
      .withMessage("Jobsite name is too long"),
    body("status")
      .optional()
      .isIn(["active", "completed"])
      .withMessage("Invalid status"),
    body("archived")
      .optional()
      .isBoolean()
      .withMessage("Invalid archived flag")
      .toBoolean(),
  ],
  validate,
  updateJobsite,
);

const inviteTokenParam = param("token")
  .isHexadecimal()
  .withMessage("Invalid invite link")
  .isLength({ min: 64, max: 64 })
  .withMessage("Invalid invite link");

// POST /api/jobsites/:id/invite — a GC admin/safety_manager invites a
// subcontractor company to the jobsite by email (Phase 8d). The GC never
// pre-creates a company row for the invitee.
router.post(
  "/:id/invite",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [
    param("id").isUUID().withMessage("A valid jobsite id is required"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Enter a valid email address")
      .normalizeEmail({ gmail_remove_dots: false }),
  ],
  validate,
  inviteSubcontractor,
);

// GET /api/jobsites/invite/:token — public preview for the accept-invite page,
// before the invitee has any account. No requireAuth: the token itself is the
// only credential, same trust model as GET /api/companies/invite/:token.
router.get("/invite/:token", [inviteTokenParam], validate, previewInvite);

// POST /api/jobsites/invite/:token/accept — an already-registered
// subcontractor company accepts. Manager-gated: it binds the whole company to
// a GC's site. The invited-email match runs in the service off req.userEmail.
router.post(
  "/invite/:token/accept",
  requireAuth,
  loadUserContext,
  requireSubcontractorCompany,
  requireRole(...MANAGER_ROLES),
  [inviteTokenParam],
  validate,
  acceptInvite,
);

// DELETE /api/jobsites/:id/subcontractors/:subId — a GC removes a sub (or
// cancels a pending invite) from a jobsite it owns.
router.delete(
  "/:id/subcontractors/:subId",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [
    param("id").isUUID().withMessage("A valid jobsite id is required"),
    param("subId").isUUID().withMessage("A valid subcontractor id is required"),
  ],
  validate,
  removeSubcontractor,
);

module.exports = router;
