const express = require("express");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { requireGcCompany } = require("../middlewares/requireGcCompany");
const {
  uploadLogo,
  getLogoUrl,
  getJoinCode,
  getMe,
} = require("../controllers/companies");

const router = express.Router();

// GET /api/companies/me — the caller's own company profile (name, type,
// tier, logo path). Scoped to req.user.companyId, same trust boundary as
// every other route in this file.
router.get("/me", requireAuth, loadUserContext, getMe);

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

// GET /api/companies/join-code — the GC's own join code (created on first
// call). GC-only: a subcontractor enters this code on a project to link it.
router.get(
  "/join-code",
  requireAuth,
  loadUserContext,
  requireGcCompany,
  getJoinCode,
);

module.exports = router;
