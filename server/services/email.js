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
 *   pdfUrl: string, meetingDate: string }} params `meetingDate` is when the meeting was held
 *   (the meeting log's `heldAt`), rendered into the template's `completedDate` variable — that
 *   variable name is fixed by the live Mailgun template, so it isn't renamed to match.
 */
const sendMeetingLogEmail = async ({
  to,
  projectName,
  companyName,
  pdfUrl,
  meetingDate,
}) => {
  const subject = `New Toolbox Talk Report: ${companyName} — ${projectName}`;

  // Property access (module.exports.getMailgunClient), not the bare local
  // reference -- required so vi.spyOn on the exports object intercepts it.
  const mg = module.exports.getMailgunClient();
  const variables = {
    companyName,
    projectName,
    pdfUrl,
    completedDate: formatDate(meetingDate),
  };

  if (!mg) {
    console.log(
      "[email] Mailgun not configured -- logging instead of sending.",
      {
        to,
        subject,
        variables,
      },
    );
    return;
  }

  try {
    await mg.client.messages.create(mg.domain, {
      from: `TailgatePro <support@${mg.domain}>`,
      // Set explicitly so replies don't fall back to a Reply-To stored on the
      // Mailgun template version in the portal.
      "h:Reply-To": `support@${mg.domain}`,
      to: [to],
      subject,
      template: MAILGUN_TEMPLATES.MEETING_LOG_REPORT,
      "h:X-Mailgun-Variables": JSON.stringify(variables),
    });
  } catch (err) {
    console.error(`email: failed to send meeting log report to ${to}`, err);
  }
};

/**
 * Emails a Phase 8c company invite via the company-invite Mailgun template.
 * Same soft-fail shape as sendMeetingLogEmail: never throws, since a failed
 * invite email is a side effect of POST /api/companies/invite, not something
 * that should unwind the request that created the invite row.
 *
 * @param {{ to: string, companyName: string, inviterName: string, role: string,
 *   acceptUrl: string }} params
 */
const sendCompanyInviteEmail = async ({ to, companyName, inviterName, role, acceptUrl }) => {
  const subject = `${inviterName} invited you to join ${companyName} on TailgatePro`;

  const mg = module.exports.getMailgunClient();
  const variables = { companyName, inviterName, role, acceptUrl };

  if (!mg) {
    console.log(
      "[email] Mailgun not configured -- logging instead of sending.",
      {
        to,
        subject,
        variables,
      },
    );
    return;
  }

  try {
    await mg.client.messages.create(mg.domain, {
      from: `TailgatePro <support@${mg.domain}>`,
      "h:Reply-To": `support@${mg.domain}`,
      to: [to],
      subject,
      template: MAILGUN_TEMPLATES.COMPANY_INVITE,
      "h:X-Mailgun-Variables": JSON.stringify(variables),
    });
  } catch (err) {
    console.error(`email: failed to send company invite to ${to}`, err);
  }
};

/**
 * Emails a Phase 8d jobsite invite (a GC inviting a subcontractor company to a
 * job site) via the jobsite-invite Mailgun template. Same soft-fail shape as
 * sendCompanyInviteEmail: never throws, since a failed email is a side effect
 * of POST /api/jobsites/:id/invite, not something that should unwind the
 * roster row that was just created.
 *
 * @param {{ to: string, gcCompanyName: string, jobsiteName: string,
 *   inviterName: string, acceptUrl: string }} params
 */
const sendJobsiteInviteEmail = async ({
  to,
  gcCompanyName,
  jobsiteName,
  inviterName,
  acceptUrl,
}) => {
  const subject = `${gcCompanyName} invited you to ${jobsiteName} on TailgatePro`;

  const mg = module.exports.getMailgunClient();
  const variables = { gcCompanyName, jobsiteName, inviterName, acceptUrl };

  if (!mg) {
    console.log(
      "[email] Mailgun not configured -- logging instead of sending.",
      {
        to,
        subject,
        variables,
      },
    );
    return;
  }

  try {
    await mg.client.messages.create(mg.domain, {
      from: `TailgatePro <support@${mg.domain}>`,
      "h:Reply-To": `support@${mg.domain}`,
      to: [to],
      subject,
      template: MAILGUN_TEMPLATES.JOBSITE_INVITE,
      "h:X-Mailgun-Variables": JSON.stringify(variables),
    });
  } catch (err) {
    console.error(`email: failed to send jobsite invite to ${to}`, err);
  }
};

module.exports = {
  sendMeetingLogEmail,
  sendCompanyInviteEmail,
  sendJobsiteInviteEmail,
  getMailgunClient,
};
