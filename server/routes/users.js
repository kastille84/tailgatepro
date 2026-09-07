const express = require("express");

const { requireAuth } = require("../middlewares/requireAuth");
const {
  requireProfileMetadata,
} = require("../middlewares/requireProfileMetadata");
const { createProfile } = require("../controllers/users");

const router = express.Router();

// POST /api/users/profile — self-serve signup profile creation. Auth'd; the
// row id always comes from the verified token (req.userId), and the profile
// fields from that token's `user_metadata` (req.profile), never the body —
// the client sends an empty body on the deferred first-login path.
router.post("/profile", requireAuth, requireProfileMetadata, createProfile);

module.exports = router;
