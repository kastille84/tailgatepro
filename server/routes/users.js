const express = require("express");
const { body } = require("express-validator");

const { requireAuth } = require("../middlewares/requireAuth");
const { validate } = require("../middlewares/validate");
const { createProfile } = require("../controllers/users");

const router = express.Router();

// POST /api/users/profile — self-serve signup profile creation. Auth'd; the
// row id always comes from the verified token (req.userId), never the body.
router.post(
  "/profile",
  requireAuth,
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ max: 100 })
      .withMessage("Name is too long"),
    body("companyName")
      .trim()
      .notEmpty()
      .withMessage("Company name is required")
      .isLength({ max: 120 })
      .withMessage("Company name is too long"),
    body("companyType")
      .trim()
      .notEmpty()
      .withMessage("Company type is required")
      .isIn(["gc", "subcontractor"])
      .withMessage("Invalid company type"),
  ],
  validate,
  createProfile,
);

module.exports = router;
