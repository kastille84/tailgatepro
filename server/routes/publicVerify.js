const express = require("express");
const { body, param } = require("express-validator");

const { validate } = require("../middlewares/validate");
const { publicRateLimit } = require("../middlewares/publicRateLimit");
const { verifyRecord, verifyFile } = require("../controllers/publicVerify");

const router = express.Router();

// Anonymous callers: throttled per IP before any validation or DB work.
router.use(publicRateLimit);

// No requireAuth on purpose: these back the QR code printed on every report,
// so a GC without an account (or an insurer / inspector) can check a PDF.
// Scoped by an unguessable meeting UUID and answering pass/fail only.
const idParam = param("id").isUUID().withMessage("A valid meeting id is required");

// GET /api/public/meetings/:id/verify -- records + embedded images still match
// what was sealed?
router.get("/meetings/:id/verify", [idParam], validate, verifyRecord);

// POST /api/public/meetings/:id/verify-file -- does this PDF's SHA-256 match
// the one generated for the meeting?
router.post(
  "/meetings/:id/verify-file",
  [
    idParam,
    body("sha256")
      .isString()
      .matches(/^[a-fA-F0-9]{64}$/)
      .withMessage("sha256 must be a 64-character hex digest"),
  ],
  validate,
  verifyFile,
);

module.exports = router;
