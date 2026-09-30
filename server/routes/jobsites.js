const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { requireGcCompany } = require("../middlewares/requireGcCompany");
const { requireRole } = require("../middlewares/requireRole");
const { validate } = require("../middlewares/validate");
const { CADENCES } = require("../utility/cadence");
const { MANAGER_ROLES, SITE_MANAGER_ROLES } = require("../constants/roles");
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
  getJoinLink,
  previewJoinLink,
  acceptJoinLink,
  removeSubcontractor,
  listMembers,
  setMembers,
  listMemberships,
  setMyCadence,
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

// PATCH /api/jobsites/:id — patch name/status/meetingCadence on a jobsite the caller's GC
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
    body("meetingCadence")
      .optional()
      .isIn(CADENCES)
      .withMessage("Invalid meeting cadence"),
  ],
  validate,
  updateJobsite,
);

// GET /api/jobsites/memberships — a subcontractor company's own job sites
// with their meeting cadence. Any member may read it; changing it is
// manager-gated below.
router.get(
  "/memberships",
  requireAuth,
  loadUserContext,
  requireSubcontractorCompany,
  listMemberships,
);

// PATCH /api/jobsites/:id/my-cadence — a subcontractor company tightens (or,
// with null, clears) its own meeting cadence on a jobsite it belongs to.
// Manager-gated like the other actions that bind the whole company. A value
// looser than the GC's default is a 422 from the service.
router.patch(
  "/:id/my-cadence",
  requireAuth,
  loadUserContext,
  requireSubcontractorCompany,
  requireRole(...MANAGER_ROLES),
  [
    param("id").isUUID().withMessage("A valid jobsite id is required"),
    body("cadence")
      .custom((value) => value === null || CADENCES.includes(value))
      .withMessage("Invalid meeting cadence"),
  ],
  validate,
  setMyCadence,
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
  requireRole(...SITE_MANAGER_ROLES),
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

const joinTokenParam = param("token")
  .isHexadecimal()
  .withMessage("Invalid job site link")
  .isLength({ min: 64, max: 64 })
  .withMessage("Invalid job site link");

// GET /api/jobsites/:id/join-link — a GC admin/safety_manager/superintendent
// fetches this jobsite's standing QR/join link (Phase 9e), generating it on
// first use. Same role set as the invite route — a site-scoped
// superintendent may pull the poster for their own jobsite.
router.get(
  "/:id/join-link",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...SITE_MANAGER_ROLES),
  [param("id").isUUID().withMessage("A valid jobsite id is required")],
  validate,
  getJoinLink,
);

// GET /api/jobsites/join/:token — public preview for the join page, before
// the scanner has any account. No requireAuth: the token is the credential,
// same trust model as GET /api/jobsites/invite/:token.
router.get("/join/:token", [joinTokenParam], validate, previewJoinLink);

// POST /api/jobsites/join/:token/accept — a subcontractor company
// self-admits onto the jobsite (Phase 9e). Manager-gated for the same reason
// as acceptInvite: it binds the whole company to a GC's site. No email check
// — a QR/join link isn't addressed to anyone in particular.
router.post(
  "/join/:token/accept",
  requireAuth,
  loadUserContext,
  requireSubcontractorCompany,
  requireRole(...MANAGER_ROLES),
  [joinTokenParam],
  validate,
  acceptJoinLink,
);

// DELETE /api/jobsites/:id/subcontractors/:subId — a GC removes a sub (or
// cancels a pending invite) from a jobsite it owns.
router.delete(
  "/:id/subcontractors/:subId",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...SITE_MANAGER_ROLES),
  [
    param("id").isUUID().withMessage("A valid jobsite id is required"),
    param("subId").isUUID().withMessage("A valid subcontractor id is required"),
  ],
  validate,
  removeSubcontractor,
);

// GET /api/jobsites/:id/members — the company's superintendents, each flagged
// with whether they are assigned to this jobsite (Phase 9d-2). Manager-only.
router.get(
  "/:id/members",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [param("id").isUUID().withMessage("A valid jobsite id is required")],
  validate,
  listMembers,
);

// PUT /api/jobsites/:id/members — replace the set of superintendents assigned
// to this jobsite. GC Portfolio only (403 PLAN_LIMIT otherwise).
router.put(
  "/:id/members",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  requireRole(...MANAGER_ROLES),
  [
    param("id").isUUID().withMessage("A valid jobsite id is required"),
    body("userIds")
      .isArray({ max: 100 })
      .withMessage("userIds must be a list"),
    body("userIds.*").isUUID().withMessage("Each user id must be valid"),
  ],
  validate,
  setMembers,
);

module.exports = router;
