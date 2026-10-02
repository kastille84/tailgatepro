const stripeService = require("../services/stripe");

// req.user is set by loadUserContext (after requireAuth); req.userEmail is the
// token-verified email. The caller's company always comes from there, never
// from the request body.

// GET /api/stripe/billing -- the caller's company subscription summary.
exports.getBilling = async (req, res, next) => {
  try {
    const data = await stripeService.getBillingSummary(req.user.companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/stripe/checkout-session -- returns the hosted Checkout URL.
exports.createCheckoutSession = async (req, res, next) => {
  try {
    const data = await stripeService.createCheckoutSession({
      companyId: req.user.companyId,
      companyType: req.user.companyType,
      email: req.userEmail,
      planKey: req.body.planId,
      interval: req.body.interval,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/stripe/site-checkout-session -- Checkout URL for one jobsite's Site Pro.
exports.createSiteCheckoutSession = async (req, res, next) => {
  try {
    const data = await stripeService.createSiteCheckoutSession({
      companyId: req.user.companyId,
      companyType: req.user.companyType,
      email: req.userEmail,
      jobsiteId: req.body.jobsiteId,
      interval: req.body.interval,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/stripe/portal-session -- returns the Customer Portal URL.
exports.createPortalSession = async (req, res, next) => {
  try {
    const data = await stripeService.createPortalSession({
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
