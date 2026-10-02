const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { requireGcCompany } = require("../middlewares/requireGcCompany");
const { requireRole } = require("../middlewares/requireRole");
const { validate } = require("../middlewares/validate");
const { MANAGER_ROLES } = require("../constants/roles");
const { GC_PROVIDERS } = require("../services/integrations");
const {
  listIntegrations,
  connectIntegration,
  disconnectIntegration,
  retryPush,
} = require("../controllers/integrations");

const router = express.Router();

// Procore / ACC document push (Phase 9f, docs/integrations-design.md). GC-only
// and manager-only, like the rest of a jobsite's settings.
const guard = [requireAuth, loadUserContext, requireGcCompany, requireRole(...MANAGER_ROLES)];
const jobsiteId = param("id").isUUID().withMessage("Invalid jobsite id");
const provider = param("provider")
  .isIn(GC_PROVIDERS)
  .withMessage("Unsupported integration provider");

// GET /api/jobsites/:id/integrations -- connected integrations + recent pushes
// (never any credentials).
router.get("/jobsites/:id/integrations", ...guard, [jobsiteId], validate, listIntegrations);

// PUT /api/jobsites/:id/integrations/:provider -- verify then store (encrypted).
// Per-provider required credential fields are enforced in the service.
router.put(
  "/jobsites/:id/integrations/:provider",
  ...guard,
  [
    jobsiteId,
    provider,
    body("credentials").isObject().withMessage("credentials are required"),
    body("projectId").isString().trim().notEmpty().isLength({ max: 200 }),
    body("folderId").optional({ checkFalsy: true }).isString().trim().isLength({ max: 500 }),
  ],
  validate,
  connectIntegration,
);

// DELETE /api/jobsites/:id/integrations/:provider
router.delete(
  "/jobsites/:id/integrations/:provider",
  ...guard,
  [jobsiteId, provider],
  validate,
  disconnectIntegration,
);

// POST /api/integrations/pushes/:id/retry
router.post(
  "/integrations/pushes/:id/retry",
  ...guard,
  [param("id").isUUID().withMessage("Invalid push id")],
  validate,
  retryPush,
);

module.exports = router;
