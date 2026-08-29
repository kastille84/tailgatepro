const { validationResult } = require("express-validator");
const { AppError } = require("../utility/AppError");

// Runs after an express-validator chain: forwards a 400 AppError carrying the
// field errors when validation failed, otherwise passes control on.
const validate = (req, res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  return next(new AppError("Validation failed", 400, { data: result.array() }));
};

module.exports = { validate };
