# SMS Nudges Design (Phase 9e)

Status: **built, not yet verified against live Twilio**. Covers the "Automated SMS nudges, 7:00 AM every
Monday" promised to GC Site Pro (one site) and GC Portfolio (all sites) in
`docs/pricing-and-positioning-strategy_V2.md`. Tracked in `docs/tasks.md` 9e and
`docs/pricing-promise-gaps.md` (row "Site Pro, SMS nudges", previously `Missing`).

## Scope

Every Monday at 7:00 AM **in the jobsite's own timezone**, text the confirmed phone numbers of each
subcontractor that has **no completed meeting log on that site for the previous Monday to Sunday week**.

- "Last week" is the half-open window from `weekWindow(..., -1)` in `server/utility/dayWindow.js`
  (DST-exact for an IANA zone). Both daily- and weekly-cadence subs are judged on it: a Monday 7:00 AM
  text about "today" would always find everyone missing, so the nudge looks back at the week just ended.
- A sub that was accepted onto the site after last week ended is skipped (it could not have been late).
- One text per phone per site per week, whatever the number of rows pointing at it.

Out of scope for v1: per-site send time or day, quiet hours, nudging a GC, delivery receipts, non-US/Canada
numbers, and a send log (Twilio's console is the audit trail).

## Gating

- **Plan:** `hasSiteProAccess({ sitePlan, companyTier })` (`server/utility/entitlements.js`): the site's own
  `plan = 'site_pro'`, or its GC company on Portfolio, which covers every site. That one check gives
  "single site" for Site Pro and "all sites" for Portfolio with no new tier logic. It is checked when turning the
  site toggle on (403 `PLAN_LIMIT`), when adding a GC-entered number (403 `PLAN_LIMIT`), and again on
  **every tick**, so a lapsed subscription stops texts without anything being un-written.
- **Opt-in per site:** `jobsites.sms_nudges_enabled`, default `false`. Turning it off is always allowed.
- **Roles:** the toggle is the existing manager-only `PATCH /api/jobsites/:id`. Recipient management uses
  `SITE_MANAGER_ROLES` (a superintendent is limited to assigned sites by `getAllowedJobsiteIds`). A foreman
  opts themself in; any subcontractor user may.

## Data model

`jobsites` gains `sms_nudges_enabled` (bool, default false), `timezone` (IANA text, nullable) and
`sms_last_nudged_on` (date, the local Monday last nudged). A site without a timezone is skipped.

New table `sms_recipients` (`Supabase_SQL.sql` section 15, RLS on, no policies):

| Column | Meaning |
| :--- | :--- |
| `sub_company_id` | the subcontractor the number speaks for |
| `user_id` | set for a foreman's own opt-in; unique per user |
| `jobsite_id` | set for a GC-entered number (one site); `NULL` on a foreman opt-in, which covers every site the company is on |
| `phone` | E.164, US/Canada only (`server/utility/phone.js`) |
| `source` | `foreman` or `gc` |
| `consented_at`, `confirmed_at`, `opted_out_at` | the consent trail (below) |

## Consent

Toll-Free Verification and TCPA both turn on provable opt-in, so the two entry paths differ:

1. **Foreman self opt-in** (Settings, subcontractor accounts only): the foreman types their number and ticks an
   unchecked consent box whose text names the sender, frequency, "message and data rates may apply" and STOP.
   The server stores `consented_at` and sets `confirmed_at` to the same instant. This is the strong path.
2. **GC-entered number** (roster modal, Site Pro sites): the GC picks an accepted sub (by roster row id, so no
   company ids are exposed) and types a foreman's number. The row is created **unconfirmed** and the number is
   texted once: "Reply YES to confirm. Reply STOP to opt out." Only a YES reply sets `confirmed_at`. An
   unconfirmed number is never nudged.

**STOP** (and the standard synonyms) sets `opted_out_at` on **every** row with that phone, so a person who opted
out is excluded from all sites and both sources. **START** clears it. A foreman who saves their number again in
Settings clears a prior STOP because they have just consented again. Twilio sends its own STOP/START/HELP
replies on a Toll-Free number, so the app only answers YES.

## Scheduler

`server.js` runs `cron.schedule("0 * * * *", runNudgeTick)`: hourly, because the target is a local time in
many zones. The tick (`server/services/smsNudges.js`):

1. loads active, non-archived jobsites with `sms_nudges_enabled`;
2. skips any without a valid `timezone`, or without Site Pro access;
3. reads the zone's wall clock (`server/utility/localTime.js`); continues only when it is **Monday, hour 7**
   and `sms_last_nudged_on` is not already that local date;
4. **claims** the week with a conditional `UPDATE ... WHERE sms_last_nudged_on IS NULL OR < date`; if no row
   changed, another tick or server instance won and this one stops. Claiming before sending means a crash can
   skip a week but can never double-text;
5. finds missing subs (reusing `gcDashboard.listLinkedProjects`, `listCompletedLogsInWindow` and
   `utility/compliance.computeCompliance`), then their confirmed, not-opted-out phones (a foreman opt-in, or a
   GC-entered number for this site), de-duplicated;
6. sends each via `server/services/sms.js`.

A failure on one site is logged and does not stop the others. A node-cron schedule only fires while the process
is up, so a restart across 7:00 AM misses that hour and the site waits until next Monday (see limitations).

## Twilio

`server/services/sms.js` calls Twilio's REST API with `fetch` and verifies webhook signatures with
`crypto` (HMAC-SHA1 over the URL plus sorted params): the `twilio` SDK would be a large dependency for one
endpoint. Keys are read through `keysBasedOnEnv().twilio` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM_NUMBER`, `TWILIO_WEBHOOK_URL`, each with a `_PROD` twin). Unset keys log the message instead of
sending and never throw (the `email.js` shape). `TWILIO_WEBHOOK_URL` must be the exact public URL of
`POST /webhook/twilio/sms`, or every inbound reply fails signature verification.

## Endpoint contract

All responses are `{ success, data }` / `{ success, error }`.

| Method and path | Who | Notes |
| :--- | :--- | :--- |
| `PATCH /api/jobsites/:id` | manager | now accepts `smsNudgesEnabled` (403 `PLAN_LIMIT` when turning on without Site Pro access) and `timezone` (IANA, validated) |
| `GET /api/sms/me` | subcontractor user | own opt-in or `null` |
| `PUT /api/sms/me` | subcontractor user | body `{ phone, consent: true }`; 400 on an invalid number or missing consent |
| `DELETE /api/sms/me` | subcontractor user | withdraw |
| `GET /api/sms/jobsites/:id/recipients` | GC site manager | GC-entered numbers with `subCompanyName` |
| `POST /api/sms/jobsites/:id/recipients` | GC site manager | body `{ rosterId, phone }`; 403 `PLAN_LIMIT`, 404 when the roster row is not an accepted member, 409 duplicate; texts the YES request |
| `DELETE /api/sms/jobsites/:id/recipients/:recipientId` | GC site manager | 404 when not a GC-entered row of that site |
| `POST /webhook/twilio/sms` | Twilio | signature-verified; answers TwiML |

## Client UX

- **Settings** (subcontractor accounts): a "Text reminders" card, `SmsOptInCard`: phone field, unchecked
  consent checkbox, and the current status (on, or paused by STOP).
- **Edit job site** (Site Pro sites): a checkbox for the Monday reminder and a time-zone select, defaulting to
  the browser's zone. Other sites see a one-line upgrade note.
- **Subcontractors modal** (Site Pro sites, managers): `SmsRecipientsPanel` lists GC-entered numbers with
  Confirmed / Awaiting YES reply / Opted out, with remove, and an add form.
- The Pricing "SMS nudges are coming soon" waitlist and the SMS "Coming soon" tags were removed.

## Known v1 limitations

- **Missed hour:** the tick only acts when it runs during Monday 7:xx local. If the host is down for that
  whole hour the site is skipped until the next Monday; there is no catch-up.
- **One server instance assumed for the schedule**; the claim step makes accidental duplicates harmless, not
  efficient.
- **No send log or delivery tracking**, and a failed Twilio send is not retried.
- **Timezone is per site and manual**; the form defaults it from the browser but never corrects it.
- **GC-entered numbers are not cleaned up** when a sub is removed from a site; they simply never match a
  roster member again. A foreman opt-in follows the company, not a site.
- **US/Canada numbers only**, matching the Toll-Free sender.
- **Not exercised against live Twilio.** Toll-Free Verification must be approved before production sends, and
  its submission should describe the two opt-in paths above.
