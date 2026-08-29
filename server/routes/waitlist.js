const express = require("express");
const { body } = require("express-validator");

const { validate } = require("../middlewares/validate");
const { joinWaitlist } = require("../controllers/waitlist");

const router = express.Router();

// POST /api/waitlist — landing-page early-access signup.
// Validation mirrors the client Zod schema in WaitlistForm.tsx.
router.post(
  "/",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ max: 100 })
      .withMessage("Name is too long"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Enter a valid email address")
      .normalizeEmail({ gmail_remove_dots: false }),
    body("company")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 120 })
      .withMessage("Company name is too long"),
  ],
  validate,
  joinWaitlist,
);

module.exports = router;
