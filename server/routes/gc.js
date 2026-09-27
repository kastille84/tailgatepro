const express = require("express");
const { param, query } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { requireGcCompany } = require("../middlewares/requireGcCompany");
const { validate } = require("../middlewares/validate");
const {
  getOverview,
  listMeetings,
  getMeeting,
  getMeetingPdfUrl,
  getDefenseBundle,
  listSubcontractorScorecards,
  getSubcontractorScorecard,
} = require("../controllers/gc");

const router = express.Router();

// Every /api/gc/* route is GC-only. Applied once here rather than per route.
router.use(requireAuth, loadUserContext, requireGcCompany);

// GET /api/gc/overview?date&tzOffset — per-sub compliance for the caller's
// linked jobsites on the given day. Both params are required: the server
// never guesses a timezone (docs/gc-dashboard-design.md "The 'today'
// boundary").
router.get(
  "/overview",
  [
    query("date")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("date must be in YYYY-MM-DD format"),
    query("tzOffset")
      .isInt({ min: -840, max: 840 })
      .withMessage("tzOffset must be minutes between -840 and 840"),
  ],
  validate,
  getOverview,
);

// GET /api/gc/meetings?projectId&from&to — completed logs for the caller's
// linked projects, optionally scoped to one project and/or a held_at range.
router.get(
  "/meetings",
  [
    query("projectId")
      .optional({ checkFalsy: true })
      .isUUID()
      .withMessage("projectId must be a valid id"),
    query("from")
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage("from must be an ISO 8601 timestamp"),
    query("to")
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage("to must be an ISO 8601 timestamp"),
  ],
  validate,
  listMeetings,
);

// GET /api/gc/meetings/:id — detail + signers. A meeting not linked to the
// caller (or not yet completed) 404s, same as everywhere else in this
// codebase — existence is never leaked to an unauthorized caller.
router.get(
  "/meetings/:id",
  [param("id").isUUID().withMessage("A valid meeting id is required")],
  validate,
  getMeeting,
);

// GET /api/gc/meetings/:id/pdf-url — a short-lived signed URL, named from the
// meeting's own company. 404s until pdfGenerationQueue has produced a PDF.
router.get(
  "/meetings/:id/pdf-url",
  [param("id").isUUID().withMessage("A valid meeting id is required")],
  validate,
  getMeetingPdfUrl,
);

// GET /api/gc/subcontractors?date&tzOffset — every distinct sub across the
// caller's active portfolio jobsites with a rolling 30-day compliance score
// (Phase 9e, docs/sub-scorecard-design.md). GC Portfolio only; 403 PLAN_LIMIT
// otherwise.
router.get(
  "/subcontractors",
  [
    query("date")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("date must be in YYYY-MM-DD format"),
    query("tzOffset")
      .isInt({ min: -840, max: 840 })
      .withMessage("tzOffset must be minutes between -840 and 840"),
  ],
  validate,
  listSubcontractorScorecards,
);

// GET /api/gc/subcontractors/:companyId/scorecard?date&tzOffset — one sub's
// score plus its per-jobsite breakdown. 404 if the company isn't a current
// accepted roster member anywhere in the caller's (allowed) portfolio.
router.get(
  "/subcontractors/:companyId/scorecard",
  [
    param("companyId").isUUID().withMessage("A valid company id is required"),
    query("date")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("date must be in YYYY-MM-DD format"),
    query("tzOffset")
      .isInt({ min: -840, max: 840 })
      .withMessage("tzOffset must be minutes between -840 and 840"),
  ],
  validate,
  getSubcontractorScorecard,
);

// GET /api/gc/jobsites/:id/defense-bundle — streams a ZIP of every completed
// log's PDF for the jobsite (Phase 9e, docs/osha-defense-bundle-design.md).
// 403 PLAN_LIMIT unless the jobsite is on Site Pro; 404 if it's not owned/
// allowed or has no PDF-ready completed log yet.
router.get(
  "/jobsites/:id/defense-bundle",
  [param("id").isUUID().withMessage("A valid job site id is required")],
  validate,
  getDefenseBundle,
);

module.exports = router;
