const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const {
  requireSubcontractorCompany,
} = require("../middlewares/requireSubcontractorCompany");
const { requireRole } = require("../middlewares/requireRole");
const { validate } = require("../middlewares/validate");
const { MANAGER_ROLES } = require("../constants/roles");
const { SUB_PROVIDERS } = require("../services/integrations");
const {
  listIntegrations,
  connectIntegration,
  disconnectIntegration,
  retryPush,
} = require("../controllers/projectIntegrations");

const router = express.Router();

// Procore / JobTread document push for Trade Enterprise subcontractors
// (docs/integrations-design.md). Sub-only and manager-only; the plan gate lives
// in the service so a free sub gets a typed PLAN_REQUIRED 403.
const guard = [
  requireAuth,
  loadUserContext,
  requireSubcontractorCompany,
  requireRole(...MANAGER_ROLES),
];
const projectId = param("id").isUUID().withMessage("A valid project id is required");
const provider = param("provider")
  .isIn(SUB_PROVIDERS)
  .withMessage("Unsupported integration provider");

// GET /api/projects/:id/integrations -- connected integrations + recent pushes
// (never any credentials).
router.get("/projects/:id/integrations", ...guard, [projectId], validate, listIntegrations);

// PUT /api/projects/:id/integrations/:provider -- verify then store (encrypted).
// `projectId` in the body is the provider-side project/job id. Per-provider
// required credential fields are enforced in the service.
router.put(
  "/projects/:id/integrations/:provider",
  ...guard,
  [
    projectId,
    provider,
    body("credentials").isObject().withMessage("credentials are required"),
    body("projectId").isString().trim().notEmpty().isLength({ max: 200 }),
    body("folderId").optional({ checkFalsy: true }).isString().trim().isLength({ max: 500 }),
  ],
  validate,
  connectIntegration,
);

// DELETE /api/projects/:id/integrations/:provider
router.delete(
  "/projects/:id/integrations/:provider",
  ...guard,
  [projectId, provider],
  validate,
  disconnectIntegration,
);

// POST /api/project-integrations/pushes/:id/retry
router.post(
  "/project-integrations/pushes/:id/retry",
  ...guard,
  [param("id").isUUID().withMessage("Invalid push id")],
  validate,
  retryPush,
);

module.exports = router;
