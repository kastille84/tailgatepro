const express = require("express");
const { body, param } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { validate } = require("../middlewares/validate");
const {
  listFavorites,
  addFavorite,
  removeFavorite,
} = require("../controllers/favorites");

const router = express.Router();

// GET /api/favorites — the caller's favorited talk ids, newest first.
router.get("/", requireAuth, loadUserContext, listFavorites);

// POST /api/favorites — favorite a talk. Idempotent: favoriting an
// already-favorited talk still returns 201 with the existing row.
router.post(
  "/",
  requireAuth,
  loadUserContext,
  [body("talkId").isUUID().withMessage("A valid talk id is required")],
  validate,
  addFavorite,
);

// DELETE /api/favorites/:talkId — unfavorite a talk. Idempotent: removing a
// talk that isn't favorited still returns 200.
router.delete(
  "/:talkId",
  requireAuth,
  loadUserContext,
  [param("talkId").isUUID().withMessage("A valid talk id is required")],
  validate,
  removeFavorite,
);

module.exports = router;
