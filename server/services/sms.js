// Sends SMS through Twilio's REST API when TWILIO_* keys are configured, and
// verifies Twilio's inbound-webhook signature. Plain `fetch` + `crypto`
// instead of the `twilio` SDK: one endpoint and one HMAC don't justify a
// large dependency. Unset keys degrade to "log, don't send" (the email.js /
// translation.js shape), never a hard error. See docs/sms-nudges-design.md.
const crypto = require("crypto");
// Not destructured -- keysBasedOnEnv is looked up fresh at call time so it
// stays spy-able per test (same reason email.js does this).
const envUtils = require("../utility/envUtils");

// Returns null unless all three send credentials are set.
const getTwilioConfig = () => {
  const { accountSid, authToken, fromNumber } = envUtils.keysBasedOnEnv().twilio ?? {};
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
};

/**
 * Sends one SMS. Never throws: a failed send is a soft failure of a
 * background job and must not stop the rest of the tick. Resolves to
 * `{ sent: boolean }`.
 *
 * @param {{ to: string, body: string }} params `to` is E.164.
 */
const sendSms = async ({ to, body }) => {
  const config = module.exports.getTwilioConfig();
  if (!config) {
    console.log(`[sms] Twilio not configured; would send to ${to}: ${body}`);
    return { sent: false };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: config.fromNumber, Body: body }),
      },
    );
    if (!response.ok) {
      console.error(`[sms] Twilio rejected a message to ${to}: HTTP ${response.status}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error(`[sms] Could not reach Twilio for ${to}:`, error);
    return { sent: false };
  }
};

/**
 * Verifies the X-Twilio-Signature of an inbound webhook: base64 HMAC-SHA1,
 * keyed by the auth token, over the public webhook URL followed by every POST
 * param (sorted by name) as name+value. False when keys/url are unset, so an
 * unconfigured server rejects rather than trusts.
 */
const isValidTwilioSignature = ({ signature, params }) => {
  const { authToken, webhookUrl } = envUtils.keysBasedOnEnv().twilio ?? {};
  if (!authToken || !webhookUrl || !signature) return false;

  const payload = Object.keys(params ?? {})
    .sort()
    .reduce((acc, key) => acc + key + params[key], webhookUrl);
  const expected = crypto.createHmac("sha1", authToken).update(payload).digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { getTwilioConfig, sendSms, isValidTwilioSignature };
