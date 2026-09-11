const express = require("express");
const { param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { validate } = require("../middlewares/validate");
const { listTalks, getTalk } = require("../controllers/talks");

const router = express.Router();

// GET /api/talks — every global toolbox talk. Trade filter + search run
// client-side over this one list (docs/tasks.md Phase 2b), so no query params.
router.get("/", requireAuth, loadUserContext, listTalks);

// GET /api/talks/:id
router.get(
  "/:id",
  requireAuth,
  loadUserContext,
  [param("id").isUUID().withMessage("A valid talk id is required")],
  validate,
  getTalk,
);

module.exports = router;
