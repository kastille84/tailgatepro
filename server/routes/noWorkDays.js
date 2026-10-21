const express = require("express");
const { body, param, query } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { validate } = require("../middlewares/validate");
const {
  listNoWorkDays,
  createNoWorkDay,
  removeNoWorkDay,
} = require("../controllers/noWorkDays");

const router = express.Router();

// "Mark day off" (Phase 14, docs/no-work-days-design.md). Same access as
// starting a meeting: any signed-in user acting for the company that owns the
// project (the service enforces ownership).

// GET /api/no-work-days?projectId — the caller's marks for that project's job
// site, from a week back onward.
router.get(
  "/",
  requireAuth,
  loadUserContext,
  [query("projectId").isUUID().withMessage("A valid project id is required")],
  validate,
  listNoWorkDays,
);

// POST /api/no-work-days — `id` is client-generated (offline-sync convention).
// Only the format is checked here: whether the date is a weekend or inside the
// allowed range is the service's call, and it must never reject on that (a
// no-op `{ ignored: true }`), so the offline outbox can't strand a row.
router.post(
  "/",
  requireAuth,
  loadUserContext,
  [
    body("id").isUUID().withMessage("A valid id is required"),
    body("projectId").isUUID().withMessage("A valid project id is required"),
    body("offDate")
      .isDate({ format: "YYYY-MM-DD", strictMode: true })
      .withMessage("offDate must be a date in YYYY-MM-DD format"),
    body("reason")
      .isIn(["holiday", "weather", "no_crew", "other"])
      .withMessage("reason must be holiday, weather, no_crew or other"),
  ],
  validate,
  createNoWorkDay,
);

// DELETE /api/no-work-days/:id — idempotent: an already-removed mark is a 200.
router.delete(
  "/:id",
  requireAuth,
  loadUserContext,
  [param("id").isUUID().withMessage("A valid id is required")],
  validate,
  removeNoWorkDay,
);

module.exports = router;
