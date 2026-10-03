const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { requireGcCompany } = require("../middlewares/requireGcCompany");
const { requireRole } = require("../middlewares/requireRole");
const {
  requireSubcontractorCompany,
} = require("../middlewares/requireSubcontractorCompany");
const { validate } = require("../middlewares/validate");
const { SITE_MANAGER_ROLES } = require("../constants/roles");
const {
  getMine,
  setMine,
  clearMine,
  listForJobsite,
  addForJobsite,
  removeForJobsite,
} = require("../controllers/sms");

const router = express.Router();

const jobsiteIdParam = param("id").isUUID().withMessage("A valid jobsite id is required");
const phoneBody = body("phone")
  .trim()
  .notEmpty()
  .withMessage("A phone number is required")
  .isLength({ max: 32 })
  .withMessage("Enter a valid phone number");

// GET/PUT/DELETE /api/sms/me — a subcontractor foreman's own Monday-nudge
// opt-in (docs/sms-nudges-design.md). The row id and company always come from
// the verified token context, never the body.
router.get("/me", requireAuth, loadUserContext, requireSubcontractorCompany, getMine);

router.put(
  "/me",
  requireAuth,
  loadUserContext,
  requireSubcontractorCompany,
  [phoneBody, body("consent").equals("true").withMessage("You must agree to receive text messages")],
  validate,
  setMine,
);

router.delete("/me", requireAuth, loadUserContext, requireSubcontractorCompany, clearMine);

// GC-entered numbers for one jobsite. Same role set as the invite route; a
// superintendent is limited to assigned sites in the service. Adding needs
// Site Pro access on the site (403 PLAN_LIMIT).
const gcOnly = [requireAuth, loadUserContext, requireGcCompany, requireRole(...SITE_MANAGER_ROLES)];

router.get("/jobsites/:id/recipients", ...gcOnly, [jobsiteIdParam], validate, listForJobsite);

router.post(
  "/jobsites/:id/recipients",
  ...gcOnly,
  [
    jobsiteIdParam,
    body("rosterId").isUUID().withMessage("A valid subcontractor is required"),
    phoneBody,
  ],
  validate,
  addForJobsite,
);

router.delete(
  "/jobsites/:id/recipients/:recipientId",
  ...gcOnly,
  [jobsiteIdParam, param("recipientId").isUUID().withMessage("A valid recipient id is required")],
  validate,
  removeForJobsite,
);

module.exports = router;
