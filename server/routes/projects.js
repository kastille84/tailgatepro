const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { validate } = require("../middlewares/validate");
const {
  requireSubcontractorCompany,
} = require("../middlewares/requireSubcontractorCompany");
const { requireRole } = require("../middlewares/requireRole");
const { MANAGER_ROLES } = require("../constants/roles");
const {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  linkGc,
  unlinkGc,
} = require("../controllers/projects");

const router = express.Router();

// All routes are authed and resolve the caller's company/role via
// loadUserContext, which the controllers read from req.user.

// GET /api/projects — projects the caller's company owns or is the GC on.
router.get("/", requireAuth, loadUserContext, listProjects);

// POST /api/projects — create a project. `id` is client-generated (offline-sync
// convention). gcNameCustom is required; the DB `check_gc_info` constraint is
// the backstop. gcCompanyId is not accepted — POST /:id/link-gc is the only way
// to attach a registered GC. Subcontractor-only: the project model is
// sub-owned, and a GC-created project could never be linked to itself
// (link-gc is also subcontractor-only), leaving an orphan row indistinguishable
// from a sub's own site of the same name — see docs/gc-dashboard-design.md.
router.post(
  "/",
  requireAuth,
  loadUserContext,
  requireSubcontractorCompany,
  [
    body("id").isUUID().withMessage("A valid project id is required"),
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Project name is required")
      .isLength({ max: 120 })
      .withMessage("Project name is too long"),
    // Phase 8d: attaches the new project to a GC-owned jobsite the caller's
    // company has been admitted to (accepted roster row — checked in the
    // service). When present, the GC's name comes from the jobsite, so
    // gcNameCustom is no longer required.
    body("jobsiteId")
      .optional()
      .isUUID()
      .withMessage("A valid jobsite id is required"),
    body("gcNameCustom")
      .if(body("jobsiteId").not().exists())
      .trim()
      .notEmpty()
      .withMessage("Enter the general contractor for this project")
      .isLength({ max: 120 })
      .withMessage("GC name is too long"),
    body("gcContactEmail")
      .optional({ checkFalsy: true })
      .trim()
      .isEmail()
      .withMessage("Invalid GC contact email")
      .normalizeEmail({ gmail_remove_dots: false }),
  ],
  validate,
  createProject,
);

// PATCH /api/projects/:id — patch name / status / GC fields on a project the
// caller's company owns. `archived: true|false` archives / restores it, and is
// the only field on this route gated by role (any company member can edit the
// others); enforced in the service layer since it can't be wired as router
// middleware on a route that mixes gated and ungated fields.
router.patch(
  "/:id",
  requireAuth,
  loadUserContext,
  [
    param("id").isUUID().withMessage("A valid project id is required"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Project name is required")
      .isLength({ max: 120 })
      .withMessage("Project name is too long"),
    body("status")
      .optional()
      .isIn(["active", "completed"])
      .withMessage("Invalid status"),
    body("gcNameCustom")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("GC name cannot be empty")
      .isLength({ max: 120 })
      .withMessage("GC name is too long"),
    body("gcContactEmail")
      .optional({ checkFalsy: true })
      .trim()
      .isEmail()
      .withMessage("Invalid GC contact email")
      .normalizeEmail({ gmail_remove_dots: false }),
    body("archived")
      .optional()
      .isBoolean()
      .withMessage("Invalid archived flag")
      .toBoolean(),
  ],
  validate,
  updateProject,
);

// POST /api/projects/:id/link-gc — a subcontractor links its own project to a GC
// by entering the GC's join code. Subcontractor-only (403 for a GC account).
router.post(
  "/:id/link-gc",
  requireAuth,
  loadUserContext,
  requireSubcontractorCompany,
  [
    param("id").isUUID().withMessage("A valid project id is required"),
    body("joinCode")
      .isString()
      .withMessage("Enter the GC's join code")
      .trim()
      .notEmpty()
      .withMessage("Enter the GC's join code")
      .isLength({ max: 32 })
      .withMessage("That join code is too long"),
  ],
  validate,
  linkGc,
);

// DELETE /api/projects/:id/link-gc — clears the GC link (the project stays and
// keeps its GC name). Same subcontractor-only guard.
router.delete(
  "/:id/link-gc",
  requireAuth,
  loadUserContext,
  requireSubcontractorCompany,
  [param("id").isUUID().withMessage("A valid project id is required")],
  validate,
  unlinkGc,
);

// DELETE /api/projects/:id — hard-delete a project the caller's company owns.
// Rejected with 409 once the project has logged safety talks (archive instead).
// Manager-only (admin/safety_manager) — the service layer re-checks this too,
// since it's also the authority for PATCH's `archived` alias on a route that
// can't be role-gated wholesale (see server/services/projects.js).
router.delete(
  "/:id",
  requireAuth,
  loadUserContext,
  requireRole(...MANAGER_ROLES),
  [param("id").isUUID().withMessage("A valid project id is required")],
  validate,
  deleteProject,
);

module.exports = router;
