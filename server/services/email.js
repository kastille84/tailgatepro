// Sends a completed meeting log's PDF-report notification to a project's GC
// contact via a Mailgun template when MAILGUN_API_KEY/MAILGUN_DOMAIN are
// configured; otherwise logs the composed email (recipient, subject,
// template variables) instead of sending -- the dev fallback from 5a,
// mirroring translation.js's "unset degrades to unavailable, never a hard
// error" shape. Never throws: email delivery is a soft-fail side effect of
// completing a meeting log (see docs/meeting-flow-design.md's "Phase 5 hook
// point"), not something that should unwind pdfGenerationQueue.enqueue()'s
// caller.
//
// The email body itself lives in Mailgun's template editor, not here --
// see docs/mailgun-templates/meeting-log-report.html for the template this
// service assumes exists (named by constants/templates.js's
// MEETING_LOG_REPORT). Its subject is left blank in the portal on purpose:
// `subject` is passed per-call below so it can reference the subcontractor
// company + project dynamically, which a static template subject couldn't.
const Mailgun = require("mailgun.js");
const FormData = require("form-data");
// Not destructured -- keysBasedOnEnv is looked up fresh at call time (same
// reason translation.js does this), so it stays spy-able per test and
// reflects env changes without a restart.
const envUtils = require("../utility/envUtils");
const { formatDate } = require("../utility/formatDate");
const { MAILGUN_TEMPLATES } = require("../constants/templates");

const mailgun = new Mailgun(FormData);

// Exposed on this module's exports (not a bare local) so tests can
// vi.spyOn(emailService, "getMailgunClient") without touching mailgun.js
// itself. Returns null when apiKey/domain aren't both set.
const getMailgunClient = () => {
  const { apiKey, domain } = envUtils.keysBasedOnEnv().mailgun ?? {};
  if (!apiKey || !domain) return null;
  return { client: mailgun.client({ username: "api", key: apiKey }), domain };
};

/**
 * Emails a completed meeting log's PDF report to a project's GC contact via
 * the meeting-log-report Mailgun template. Never throws. `to` is assumed
 * non-empty -- callers that should skip sending entirely (no
 * gc_contact_email on file) must not call this at all.
 *
 * @param {{ to: string, projectName: string, companyName: string,
 *   pdfUrl: string, completedAt: string }} params
 */
const sendMeetingLogEmail = async ({ to, projectName, companyName, pdfUrl, completedAt }) => {
  const subject = `New Toolbox Talk Report: ${companyName} — ${projectName}`;

  // Property access (module.exports.getMailgunClient), not the bare local
  // reference -- required so vi.spyOn on the exports object intercepts it.
  const mg = module.exports.getMailgunClient();
  const variables = { companyName, projectName, pdfUrl, completedDate: formatDate(completedAt) };

  if (!mg) {
    console.log("[email] Mailgun not configured -- logging instead of sending.", {
      to,
      subject,
      variables,
    });
    return;
  }

  try {
    await mg.client.messages.create(mg.domain, {
      from: `TailgatePro <mailgun@${mg.domain}>`,
      to: [to],
      subject,
      template: MAILGUN_TEMPLATES.MEETING_LOG_REPORT,
      "h:X-Mailgun-Variables": JSON.stringify(variables),
    });
  } catch (err) {
    console.error(`email: failed to send meeting log report to ${to}`, err);
  }
};

module.exports = { sendMeetingLogEmail, getMailgunClient };
