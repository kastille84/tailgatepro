const express = require("express");

const { handleStripeWebhook } = require("../controllers/stripeWebhook");

const router = express.Router();

// POST /webhook/stripe — Stripe's event delivery. No requireAuth: the
// `stripe-signature` header, verified in the service, is the credential.
// `express.raw` keeps the body a Buffer, and this router must be mounted in
// server.js BEFORE bodyParser.json() or the signature check would always fail.
router.post(
  "/",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

module.exports = router;
