// Automated SMS nudges (Phase 9e, docs/sms-nudges-design.md): a Monday 7:00 AM
// text, in each site's own timezone, to the confirmed recipients of every
// subcontractor that logged no safety talk on that site last week.
//
// Recipients are either a foreman who opted in themself (covers every site
// their company is on) or a number a GC typed for one site, which only counts
// after the recipient replies YES. STOP (any row with that phone) always wins.
//
// Services call siblings through the module object (gcDashboardService.x, not
// destructured) so tests can spy on them.
const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { hasSiteProAccess } = require("../utility/entitlements");
const { weekWindow } = require("../utility/dayWindow");
const { computeCompliance } = require("../utility/compliance");
const { localParts } = require("../utility/localTime");
const { toE164 } = require("../utility/phone");
const gcDashboardService = require("./gcDashboard");
const jobsitesService = require("./jobsites");
const smsService = require("./sms");

const NUDGE_WEEKDAY = "Mon";
const NUDGE_HOUR = 7;

const RECIPIENT_COLUMNS =
  "id, sub_company_id, user_id, jobsite_id, phone, source, consented_at, confirmed_at, opted_out_at";

const toRecipient = (row) => ({
  id: row.id,
  subCompanyId: row.sub_company_id,
  jobsiteId: row.jobsite_id,
  phone: row.phone,
  source: row.source,
  consentedAt: row.consented_at,
  confirmedAt: row.confirmed_at,
  optedOut: Boolean(row.opted_out_at),
  // Only present when the query embedded `companies(name)` (the GC list).
  subCompanyName: row.companies?.name ?? null,
});

const invalidPhone = () => new AppError("Enter a valid US or Canadian mobile number", 400);

// ---- A foreman's own opt-in ------------------------------------------------

// The caller's own opt-in row, or null when they never opted in.
const getMine = async (userId) => {
  const { data, error } = await supabase
    .from("sms_recipients")
    .select(RECIPIENT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError("Could not load your SMS settings", 502, { cause: error });
  }
  return data ? toRecipient(data) : null;
};

// Creates or replaces the caller's opt-in. Re-saving clears a prior STOP: the
// foreman has just consented again, in the app. The route enforces
// `consent: true`; the stored timestamp is the audit trail.
const setMine = async ({ userId, subCompanyId, phone }) => {
  const e164 = toE164(phone);
  if (!e164) throw invalidPhone();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sms_recipients")
    .upsert(
      {
        id: uuidv4(),
        sub_company_id: subCompanyId,
        user_id: userId,
        jobsite_id: null,
        phone: e164,
        source: "foreman",
        consented_at: now,
        confirmed_at: now,
        opted_out_at: null,
      },
      { onConflict: "user_id" },
    )
    .select(RECIPIENT_COLUMNS)
    .single();

  if (error) {
    throw new AppError("Could not save your SMS settings", 502, { cause: error });
  }
  return toRecipient(data);
};

const clearMine = async (userId) => {
  const { error } = await supabase.from("sms_recipients").delete().eq("user_id", userId);
  if (error) {
    throw new AppError("Could not remove your SMS settings", 502, { cause: error });
  }
};

// ---- GC-entered numbers ----------------------------------------------------

// Throws 403 PLAN_LIMIT unless the site has Site Pro access (own plan, or its
// company is on GC Portfolio). Returns the jobsite.
const assertSiteSmsAvailable = async (jobsiteId, gcCompanyId, allowedJobsiteIds) => {
  const jobsite = await jobsitesService.getOwnedJobsite(jobsiteId, gcCompanyId, allowedJobsiteIds);
  if (!jobsite.sitePro) {
    throw new AppError("SMS nudges are part of GC Site Pro. Upgrade this site to use them.", 403, {
      data: { code: "PLAN_LIMIT" },
    });
  }
  return jobsite;
};

const listForJobsite = async ({ jobsiteId, gcCompanyId, allowedJobsiteIds = null }) => {
  await jobsitesService.getOwnedJobsite(jobsiteId, gcCompanyId, allowedJobsiteIds);

  const { data, error } = await supabase
    .from("sms_recipients")
    .select(`${RECIPIENT_COLUMNS}, companies(name)`)
    .eq("jobsite_id", jobsiteId)
    .eq("source", "gc")
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("Could not load SMS recipients", 502, { cause: error });
  }
  return data.map(toRecipient);
};

// A GC enters a sub foreman's number for one site, naming the sub by its
// roster row (`rosterId`, the id the jobsite list already exposes) -- it must
// be an accepted member of this site. The number is texted once, asking for
// YES; until the reply lands it is never nudged.
const addForJobsite = async ({
  jobsiteId,
  gcCompanyId,
  allowedJobsiteIds = null,
  rosterId,
  phone,
}) => {
  const jobsite = await assertSiteSmsAvailable(jobsiteId, gcCompanyId, allowedJobsiteIds);
  const e164 = toE164(phone);
  if (!e164) throw invalidPhone();

  const { data: member, error: memberError } = await supabase
    .from("jobsite_subcontractors")
    .select("sub_company_id")
    .eq("id", rosterId)
    .eq("jobsite_id", jobsiteId)
    .not("accepted_at", "is", null)
    .maybeSingle();
  if (memberError) {
    throw new AppError("Could not check the subcontractor", 502, { cause: memberError });
  }
  if (!member) throw new AppError("That subcontractor is not on this job site", 404);

  const { data, error } = await supabase
    .from("sms_recipients")
    .insert({
      id: uuidv4(),
      sub_company_id: member.sub_company_id,
      user_id: null,
      jobsite_id: jobsiteId,
      phone: e164,
      source: "gc",
    })
    .select(RECIPIENT_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError("That number is already added for this subcontractor", 409, {
        cause: error,
      });
    }
    throw new AppError("Could not add the SMS recipient", 502, { cause: error });
  }

  await smsService.sendSms({
    to: e164,
    body: `TailgatePro: ${jobsite.gcCompanyName ?? "A general contractor"} wants to text you a weekly safety talk reminder for ${jobsite.name}. Reply YES to confirm. Msg&data rates may apply. Reply STOP to opt out.`,
  });

  return toRecipient(data);
};

const removeForJobsite = async ({
  jobsiteId,
  recipientId,
  gcCompanyId,
  allowedJobsiteIds = null,
}) => {
  await jobsitesService.getOwnedJobsite(jobsiteId, gcCompanyId, allowedJobsiteIds);

  const { data, error } = await supabase
    .from("sms_recipients")
    .delete()
    .eq("id", recipientId)
    .eq("jobsite_id", jobsiteId)
    .eq("source", "gc")
    .select("id");

  if (error) {
    throw new AppError("Could not remove the SMS recipient", 502, { cause: error });
  }
  if (data.length === 0) throw new AppError("SMS recipient not found", 404);
};

// ---- Inbound replies (Twilio webhook) --------------------------------------

const YES_WORDS = ["YES", "Y"];
const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const START_WORDS = ["START", "UNSTOP"];

const setOptOutByPhone = async (phone, optedOutAt, failure) => {
  const { error } = await supabase
    .from("sms_recipients")
    .update({ opted_out_at: optedOutAt })
    .eq("phone", phone);
  if (error) throw new AppError(failure, 502, { cause: error });
};

// Applies a reply from `from` (E.164). Returns the text to answer with, or
// null for none: Twilio sends its own STOP/START/HELP replies on a Toll-Free
// number, so only YES is answered here.
const handleInbound = async ({ from, body }) => {
  const word = String(body ?? "")
    .trim()
    .toUpperCase();

  if (STOP_WORDS.includes(word)) {
    await setOptOutByPhone(from, new Date().toISOString(), "Could not record the opt-out");
    return null;
  }
  if (START_WORDS.includes(word)) {
    await setOptOutByPhone(from, null, "Could not record the opt-in");
    return null;
  }
  if (YES_WORDS.includes(word)) {
    const { error } = await supabase
      .from("sms_recipients")
      .update({ confirmed_at: new Date().toISOString(), opted_out_at: null })
      .eq("phone", from)
      .is("confirmed_at", null);
    if (error) throw new AppError("Could not confirm the number", 502, { cause: error });
    return "TailgatePro: You are confirmed for weekly safety talk reminders. Reply STOP to opt out.";
  }
  return null;
};

// ---- The Monday tick -------------------------------------------------------

const nudgeBody = (jobsiteName) =>
  `TailgatePro: no safety talk was logged for ${jobsiteName} last week. Please hold and log one today. Reply STOP to opt out.`;

// Claims this local Monday for the jobsite so two ticks (or two server
// instances) can never nudge it twice. True when this caller won the claim.
const claimWeek = async (jobsiteId, date) => {
  const { data, error } = await supabase
    .from("jobsites")
    .update({ sms_last_nudged_on: date })
    .eq("id", jobsiteId)
    .or(`sms_last_nudged_on.is.null,sms_last_nudged_on.lt.${date}`)
    .select("id");

  if (error) throw new AppError("Could not claim the weekly nudge", 502, { cause: error });
  return data.length > 0;
};

// Subs on the site's roster (accepted before last week ended) with no
// completed log last week.
const findMissingSubIds = async (jobsite, date) => {
  const window = weekWindow({ date, tzOffset: 0, timeZone: jobsite.timezone }, -1);
  const windowEndMs = new Date(window.end).getTime();

  const roster = (jobsite.jobsite_subcontractors ?? [])
    .filter(
      (sub) =>
        sub.sub_company_id &&
        sub.accepted_at &&
        new Date(sub.accepted_at).getTime() < windowEndMs,
    )
    .map((sub) => ({ subId: sub.sub_company_id }));
  if (roster.length === 0) return [];

  const projects = (
    await gcDashboardService.listLinkedProjects(jobsite.gc_company_id, [jobsite.id])
  ).filter(
    (project) =>
      project.jobsiteId === jobsite.id && project.status === "active" && !project.archivedAt,
  );
  const logs = await gcDashboardService.listCompletedLogsInWindow(
    projects.map((project) => project.id),
    window,
  );
  const ownerByProject = new Map(projects.map((project) => [project.id, project.ownerCompanyId]));

  return computeCompliance({
    roster,
    logs: logs.map((log) => ({ subId: ownerByProject.get(log.project_id), heldAt: log.held_at })),
    window,
  })
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.subId);
};

// Confirmed, not-opted-out phones for these subs on this site: a foreman's
// own opt-in (jobsite_id NULL) or a GC-entered number for this site. Deduped.
const findPhones = async (jobsiteId, subIds) => {
  const { data, error } = await supabase
    .from("sms_recipients")
    .select("phone")
    .in("sub_company_id", subIds)
    .not("confirmed_at", "is", null)
    .is("opted_out_at", null)
    .or(`jobsite_id.is.null,jobsite_id.eq.${jobsiteId}`);

  if (error) throw new AppError("Could not load SMS recipients", 502, { cause: error });
  return [...new Set(data.map((row) => row.phone))];
};

const nudgeJobsite = async (jobsite, date) => {
  if (!(await claimWeek(jobsite.id, date))) return 0;

  const missingSubIds = await findMissingSubIds(jobsite, date);
  if (missingSubIds.length === 0) return 0;

  const phones = await findPhones(jobsite.id, missingSubIds);
  let sent = 0;
  for (const to of phones) {
    const result = await smsService.sendSms({ to, body: nudgeBody(jobsite.name) });
    if (result.sent) sent += 1;
  }
  return sent;
};

// Run hourly. Finds every opted-in, Site-Pro-entitled active site whose local
// clock reads Monday 7:xx and has not been nudged this week, and nudges it.
// A failure on one site is logged and does not stop the others. Returns the
// number of messages sent.
const runNudgeTick = async (now = new Date()) => {
  const { data, error } = await supabase
    .from("jobsites")
    .select(
      "id, gc_company_id, name, plan, timezone, sms_last_nudged_on, companies(tier), jobsite_subcontractors(sub_company_id, accepted_at)",
    )
    .eq("sms_nudges_enabled", true)
    .eq("status", "active")
    .is("archived_at", null);

  if (error) throw new AppError("Could not load jobsites for SMS nudges", 502, { cause: error });

  let sent = 0;
  for (const jobsite of data) {
    if (!jobsite.timezone) continue;
    if (!hasSiteProAccess({ sitePlan: jobsite.plan, companyTier: jobsite.companies?.tier })) {
      continue;
    }

    const local = localParts(now, jobsite.timezone);
    if (!local || local.weekday !== NUDGE_WEEKDAY || local.hour !== NUDGE_HOUR) continue;
    if (jobsite.sms_last_nudged_on === local.date) continue;

    try {
      sent += await nudgeJobsite(jobsite, local.date);
    } catch (nudgeError) {
      console.error(`[sms] nudge failed for jobsite ${jobsite.id}:`, nudgeError);
    }
  }
  return sent;
};

module.exports = {
  getMine,
  setMine,
  clearMine,
  listForJobsite,
  addForJobsite,
  removeForJobsite,
  handleInbound,
  runNudgeTick,
};
