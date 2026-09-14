const express = require("express");
const { body, param, query } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { validate } = require("../middlewares/validate");
const {
  listMeetings,
  getMeeting,
  createMeeting,
  completeMeeting,
} = require("../controllers/meetingLogs");
const signaturesRoutes = require("./signatures");

const router = express.Router();

// GET /api/meetings — every meeting log the caller's company owns, optionally
// scoped to one project.
router.get(
  "/",
  requireAuth,
  loadUserContext,
  [
    query("projectId")
      .optional({ checkFalsy: true })
      .isUUID()
      .withMessage("projectId must be a valid id"),
  ],
  validate,
  listMeetings,
);

// GET /api/meetings/:id — scoped the same way as the list: a meeting log
// belonging to another company can't be fetched by guessing its id.
router.get(
  "/:id",
  requireAuth,
  loadUserContext,
  [param("id").isUUID().withMessage("A valid meeting id is required")],
  validate,
  getMeeting,
);

// POST /api/meetings — start a meeting log. `id` is client-generated
// (offline-sync convention, matches projects/talks). `talkId` is optional at
// creation (a wizard step order that picks the talk after starting the
// meeting is still valid) but required in practice before a signature can be
// meaningfully quizzed.
router.post(
  "/",
  requireAuth,
  loadUserContext,
  [
    body("id").isUUID().withMessage("A valid meeting id is required"),
    body("projectId").isUUID().withMessage("A valid project id is required"),
    body("talkId")
      .optional({ nullable: true })
      .isUUID()
      .withMessage("talkId must be a valid id"),
  ],
  validate,
  createMeeting,
);

// PATCH /api/meetings/:id/complete — finalize a meeting once it has >=1
// signature. There is no general-purpose edit route — a meeting log is either
// an in-progress client-side draft or a completed record; see
// docs/meeting-flow-design.md.
router.patch(
  "/:id/complete",
  requireAuth,
  loadUserContext,
  [param("id").isUUID().withMessage("A valid meeting id is required")],
  validate,
  completeMeeting,
);

// Nested under /api/meetings/:meetingId/signatures — see
// server/routes/signatures.js (mergeParams: true so it can read
// req.params.meetingId).
router.use("/:meetingId/signatures", signaturesRoutes);

module.exports = router;
