const express = require("express");
const { body } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { loadUserContext } = require("../middlewares/loadUserContext");
const { requireRole } = require("../middlewares/requireRole");
const { validate } = require("../middlewares/validate");
const { MANAGER_ROLES } = require("../constants/roles");
const { STRIPE_PLANS, INTERVALS } = require("../utility/stripePlans");
const {
  getBilling,
  createCheckoutSession,
  createPortalSession,
} = require("../controllers/stripe");

const router = express.Router();

// All routes are manager-only: a subscription binds the whole company.

// GET /api/stripe/billing — subscription status, interval and renewal date.
router.get(
  "/billing",
  requireAuth,
  loadUserContext,
  requireRole(...MANAGER_ROLES),
  getBilling,
);

// POST /api/stripe/checkout-session — start a hosted Stripe Checkout for a plan.
router.post(
  "/checkout-session",
  requireAuth,
  loadUserContext,
  requireRole(...MANAGER_ROLES),
  [
    body("planId")
      .isIn(Object.keys(STRIPE_PLANS))
      .withMessage("Invalid plan"),
    body("interval").isIn(INTERVALS).withMessage("Invalid billing interval"),
  ],
  validate,
  createCheckoutSession,
);

// POST /api/stripe/portal-session — open the Stripe Customer Portal.
router.post(
  "/portal-session",
  requireAuth,
  loadUserContext,
  requireRole(...MANAGER_ROLES),
  createPortalSession,
);

module.exports = router;
