const express = require("express");

const { handleInbound } = require("../controllers/sms");

const router = express.Router();

// POST /webhook/twilio/sms — Twilio inbound SMS (STOP/START/YES replies).
// No requireAuth: the X-Twilio-Signature header, verified in the controller,
// is the credential. Twilio posts urlencoded, so the body is parsed here.
router.post("/sms", express.urlencoded({ extended: false }), handleInbound);

module.exports = router;
