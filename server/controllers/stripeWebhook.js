const stripeWebhookService = require("../services/stripeWebhook");

// req.body is a raw Buffer here (see the route's `express.raw` middleware):
// Stripe's signature is computed over the exact bytes it sent, so the body
// must not be JSON-parsed before it is verified.
exports.handleStripeWebhook = async (req, res, next) => {
  try {
    await stripeWebhookService.handleWebhook({
      rawBody: req.body,
      signature: req.get("stripe-signature"),
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
};
