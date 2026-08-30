const waitlistService = require("../services/waitlist");

exports.joinWaitlist = async (req, res, next) => {
  try {
    // At this point, the request body has already been validated by the validate middleware.
    const { name, email, company } = req.body;
    const data = await waitlistService.addToWaitlist({ name, email, company });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
