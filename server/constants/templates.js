// Hardcoded Mailgun template names. These identify templates created by hand
// in the Mailgun web portal (see docs/mailgun-templates/*.html for the HTML
// pasted into each one) -- not environment-specific, so they live here as
// constants rather than in server/utility/envUtils.js's per-environment
// config. Add a new key here whenever a new Mailgun template is introduced.
module.exports = {
  MAILGUN_TEMPLATES: {
    MEETING_LOG_REPORT: "meeting-log-report",
  },
};
