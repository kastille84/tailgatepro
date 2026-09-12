const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { validate } = require("../middlewares/validate");
const { listTalks, getTalk, createTalk } = require("../controllers/talks");

const router = express.Router();

// GET /api/talks — every talk visible to the caller's company: the shared
// global library plus that company's own custom talks. Trade filter + search
// run client-side over this one list (docs/tasks.md Phase 2b), so no query
// params.
router.get("/", requireAuth, loadUserContext, listTalks);

// GET /api/talks/:id — scoped the same way as the list: a talk belonging to
// another company can't be fetched by guessing its id.
router.get(
  "/:id",
  requireAuth,
  loadUserContext,
  [param("id").isUUID().withMessage("A valid talk id is required")],
  validate,
  getTalk,
);

// A list field: an optional array (unless `min` says otherwise), max 30
// items, each a non-empty trimmed string up to 500 chars. Used for talking
// points (>=1 required) and the three optional list fields.
const stringListValidator = (field, { min = 0 } = {}) => [
  body(field)
    .optional({ checkFalsy: min === 0 })
    .isArray({ min, max: 30 })
    .withMessage(
      `${field} must be a list${min ? " with at least one item" : ""}`,
    ),
  body(`${field}.*`)
    .trim()
    .notEmpty()
    .withMessage(`${field} entries can't be blank`)
    .isLength({ max: 500 })
    .withMessage(`${field} entries are too long`),
];

// POST /api/talks — create a company-scoped custom talk. `id` is
// client-generated (offline-sync convention, matches projects.js). Mirrors
// the full structured shape a harvested talk carries; `attribution` is never
// accepted from the client — custom talks always get `attribution: null`,
// set server-side in the service.
router.post(
  "/",
  requireAuth,
  loadUserContext,
  [
    body("id").isUUID().withMessage("A valid talk id is required"),
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ max: 200 })
      .withMessage("Title is too long"),
    body("tradeTag")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 60 })
      .withMessage("Trade is too long"),
    body("summary")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Summary is too long"),
    ...stringListValidator("talkingPoints", { min: 1 }),
    ...stringListValidator("siteHazardsToCheck"),
    ...stringListValidator("discussionQuestions"),
    ...stringListValidator("oshaStandards"),
    body("estimatedMinutes")
      .optional({ nullable: true })
      .isInt({ min: 1, max: 480 })
      .withMessage("Estimated minutes must be a positive number")
      .toInt(),
  ],
  validate,
  createTalk,
);

module.exports = router;
