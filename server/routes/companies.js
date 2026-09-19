const express = require("express");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { uploadLogo, getLogoUrl } = require("../controllers/companies");

const router = express.Router();

// PUT /api/companies/logo — upload/replace the caller's own company's logo.
// Scoped to req.user.companyId only (no :id param — there is nothing else to
// target), tier-gated (403 for basic) inside the controller. `express.raw`
// reads the request body as a Buffer, same pattern as the crew-photo/
// signature-blob PUT routes.
router.put(
  "/logo",
  requireAuth,
  loadUserContext,
  express.raw({ type: "image/*", limit: "5mb" }),
  uploadLogo,
);

// GET /api/companies/logo-url — a short-lived signed URL for the caller's own
// company logo, same shape as GET /api/meetings/:id/crew-photo-url. 404s
// until a logo has been uploaded.
router.get("/logo-url", requireAuth, loadUserContext, getLogoUrl);

module.exports = router;
