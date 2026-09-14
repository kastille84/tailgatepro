const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { validate } = require("../middlewares/validate");
const { listSignatures, createSignature } = require("../controllers/signatures");

// mergeParams: true — this router is nested under
// /api/meetings/:meetingId/signatures (see server/routes/meetingLogs.js) and
// needs req.params.meetingId, which Express doesn't pass to a sub-router by
// default.
const router = express.Router({ mergeParams: true });

// GET /api/meetings/:meetingId/signatures
router.get(
  "/",
  requireAuth,
  loadUserContext,
  [param("meetingId").isUUID().withMessage("A valid meeting id is required")],
  validate,
  listSignatures,
);

// POST /api/meetings/:meetingId/signatures — `id` is client-generated
// (offline-sync convention, matches projects/talks/meetings). `quizAnswers`
// is optional (a talk with no quiz yet, or a skipped quiz) and is always
// re-scored server-side against the talk's authoritative quiz — a client
// never gets to assert its own pass/fail.
router.post(
  "/",
  requireAuth,
  loadUserContext,
  [
    param("meetingId").isUUID().withMessage("A valid meeting id is required"),
    body("id").isUUID().withMessage("A valid signature id is required"),
    body("workerName")
      .trim()
      .notEmpty()
      .withMessage("Worker name is required")
      .isLength({ max: 200 })
      .withMessage("Worker name is too long"),
    body("quizAnswers")
      .optional({ nullable: true })
      .isArray({ max: 3 })
      .withMessage("quizAnswers must be a list of at most 3 answers"),
    body("quizAnswers.*.questionIndex")
      .isInt({ min: 0, max: 2 })
      .withMessage("questionIndex must be 0, 1, or 2"),
    body("quizAnswers.*.selectedIndex")
      .isInt({ min: 0 })
      .withMessage("selectedIndex must be a non-negative integer"),
  ],
  validate,
  createSignature,
);

module.exports = router;
