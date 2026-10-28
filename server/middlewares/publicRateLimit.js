const { rateLimit } = require("express-rate-limit");

// Throttle for the unauthenticated /api/public/* verify endpoints
// (docs/tamper-evidence-design.md). Each GET re-downloads every sealed image
// to re-hash it, so an anonymous caller must not be able to hammer it.
// Per client IP; behind a proxy this only works if Express `trust proxy` is
// set (see server.js), otherwise every caller shares the proxy's IP.
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

const publicRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_REQUESTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: "Too many verification requests. Please wait a minute and try again.",
    }),
});

module.exports = { publicRateLimit, WINDOW_MS, MAX_REQUESTS };
