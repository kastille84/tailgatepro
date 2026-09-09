const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { validate } = require("../middlewares/validate");
const {
  listProjects,
  createProject,
  updateProject,
} = require("../controllers/projects");

const router = express.Router();

// All routes are authed and resolve the caller's company/role via
// loadUserContext, which the controllers read from req.user.

// GET /api/projects — projects the caller's company owns or is the GC on.
router.get("/", requireAuth, loadUserContext, listProjects);

// POST /api/projects — create a project. `id` is client-generated (offline-sync
// convention). At least one of gcCompanyId / gcNameCustom is required; the DB
// `check_gc_info` constraint is the backstop.
router.post(
  "/",
  requireAuth,
  loadUserContext,
  [
    body("id").isUUID().withMessage("A valid project id is required"),
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Project name is required")
      .isLength({ max: 120 })
      .withMessage("Project name is too long"),
    body("gcCompanyId")
      .optional({ checkFalsy: true })
      .isUUID()
      .withMessage("Invalid GC company"),
    body("gcNameCustom")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 120 })
      .withMessage("GC name is too long"),
    body("gcNameCustom").custom((value, { req }) => {
      if (!req.body.gcCompanyId && !req.body.gcNameCustom) {
        throw new Error("Enter the general contractor for this project");
      }
      return true;
    }),
  ],
  validate,
  createProject,
);

// PATCH /api/projects/:id — patch name / status / GC fields on a project the
// caller's company owns.
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
    body("gcCompanyId")
      .optional({ checkFalsy: true })
      .isUUID()
      .withMessage("Invalid GC company"),
    body("gcNameCustom")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 120 })
      .withMessage("GC name is too long"),
  ],
  validate,
  updateProject,
);

module.exports = router;
