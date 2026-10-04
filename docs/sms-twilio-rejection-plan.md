# Runbook: Twilio does not approve the Toll-Free number

Use this if Twilio rejects (or the user abandons) the Toll-Free Verification for the Phase 9e SMS nudge
(`docs/sms-nudges-design.md`). When the user says "follow the Twilio rejection plan", work through the steps
below in order, confirming before anything destructive (DB drops, number release).

The SMS code ships in commit `a0ed27d` on `feature/SMS-Nudge`. With no `TWILIO_*` env vars set, `sendSms` only
logs and never throws, so an unapproved number never breaks the app; it only leaves UI that promises texts that
do not go out.

## While the review is pending (merged to main)

- Run the new SQL from `Supabase_SQL.sql` (three `ALTER TABLE jobsites` lines and the `sms_recipients` table)
  on the live DB **before** deploying: the server now selects `sms_nudges_enabled` and `timezone`, and a missing
  column breaks every `/api/jobsites` call.
- Leave all `TWILIO_*` env vars unset in production until approval. Nothing is sent; foremen can still save a
  number and GCs can still enter one (it just never gets the YES request text).
- Consider hiding or labelling the "Text reminders" card and Site Pro toggle until approval, since they collect
  phone numbers and consent for messages that cannot yet be delivered.

## Step 1: Read the rejection reason (cheapest path)

Most rejections are fixable and can be resubmitted from the Twilio console. Typical causes: opt-in evidence not
visible or not matching the described flow, privacy policy or terms URL missing or unreachable, business details
not matching, a message sample missing "Reply STOP to opt out".

- Fix what Twilio names and resubmit. The consent copy is in
  `client/src/features/company-settings/SmsOptInCard.tsx`; the two opt-in paths are in
  `docs/sms-nudges-design.md` (Consent). A public screenshot or URL of the Settings consent checkbox is the
  strongest evidence.
- Only continue to Step 2 if resubmission is rejected again or the use case is refused outright.

## Step 2: Choose a fallback (ask the user which)

1. **Email nudge instead of SMS (recommended).** Same schedule, tick and "missing subs" logic; Mailgun already
   exists in `server/services/email.js`. In `server/services/smsNudges.js`, replace the `smsService.sendSms`
   call with an email to the sub company's users. Phone numbers, the consent card, the YES/STOP webhook and
   Twilio are no longer needed, so do Steps 5, 6 and the `sms_recipients` part of Step 4, but **keep**
   `jobsites.sms_nudges_enabled`, `timezone` and `sms_last_nudged_on` (the toggle, timezone and weekly claim
   still apply). Rename the pricing copy from "SMS nudges" to "Automated reminders".
2. **Another channel or provider.** 10DLC (Twilio or Telnyx and similar) faces the same carrier vetting and
   takes weeks, so it helps only if the rejection was specific to toll-free. Web push is weak on iOS unless the
   PWA is installed.
3. **Drop the feature entirely.** Do Steps 3 to 7 in full.

## Step 3: Undo in code

- If the feature is merged: `git revert <merge commit or a0ed27d>` after checking nothing later touched the same
  files. The revert restores the Pricing waitlist section, the SMS "Coming soon" tags and the deferred entry in
  `docs/tasks.md`.
- Make sure public copy stops promising live SMS nudges: `client/src/data/plans.ts`, the Landing `GcSection.tsx`,
  `docs/pricing-and-positioning-strategy_V2.md`, and `docs/pricing-promise-gaps.md` (row "Site Pro, SMS nudges"
  back to `Missing`).
- Update `docs/tasks.md` 9e to "dropped: Twilio Toll-Free Verification rejected <date>" and record the
  replacement decision.

Files involved: `server/services/sms.js`, `server/services/smsNudges.js`, `server/controllers/sms.js`,
`server/routes/sms.js`, `server/routes/twilioWebhook.js`, `server/utility/phone.js`,
`server/utility/localTime.js`, the `twilio` group in `server/utility/envUtils.js`, the cron and route mounts in
`server.js`, the SMS fields in `server/services/jobsites.js` and its controller and route; on the client
`apiSms.ts`, `useMySmsOptIn.ts`, `useJobsiteSmsRecipients.ts`, `SmsOptInCard.tsx`, `SmsRecipientsPanel.tsx`,
`timeZones.ts`, and the additions to `JobsiteForm.tsx`, `Settings.tsx` and `JobsiteRosterModal.tsx`.

## Step 4: Undo in Supabase

**Order matters: deploy the code revert first, then drop the schema.** While the SMS code is live, dropping
`sms_nudges_enabled` or `timezone` breaks every `/api/jobsites` call.

Take a backup first (Supabase dashboard, Database, Backups). If real users opted in, export `sms_recipients`
(CSV) before dropping it; it holds phone numbers and consent records. Then in the SQL editor:

```sql
-- 1) table and its partial unique indexes (indexes drop with the table)
DROP TABLE IF EXISTS sms_recipients;

-- 2) jobsite columns (omit any column kept for the email fallback)
ALTER TABLE jobsites
  DROP COLUMN IF EXISTS sms_nudges_enabled,
  DROP COLUMN IF EXISTS timezone,
  DROP COLUMN IF EXISTS sms_last_nudged_on;
```

Remove section 15 and the three `jobsites` columns from `Supabase_SQL.sql` and `Supabase_Schema.md` so the docs
match the live DB. Verify:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jobsites'
  AND column_name IN ('sms_nudges_enabled','timezone','sms_last_nudged_on');  -- expect 0 rows
SELECT to_regclass('public.sms_recipients');  -- expect NULL
```

## Step 5: Undo in Twilio (console menu names may differ)

1. Withdraw or delete the Toll-Free Verification submission (Messaging, Regulatory Compliance / Toll-Free
   Verification).
2. Clear the inbound webhook on the number (Messaging configuration, "A message comes in") so no stray traffic
   reaches `/webhook/twilio/sms`.
3. Release the toll-free number (Phone Numbers, Manage, Active numbers, Release). This stops the monthly charge.
   Only do this when sure you will not resubmit.
4. Rotate the Auth Token (Account, API keys and tokens) so the copy in env vars is dead; delete any API keys or
   subaccount created for this.
5. A day later, check Billing, Usage for any lingering number, Messaging Service or A2P/10DLC brand fees.

## Step 6: Undo in hosting and local env

Delete `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_WEBHOOK_URL` and their `_PROD`
twins from the host's environment settings and the local root `.env`, then redeploy.

## Step 7: Verify

- `npm run test:server` (needs dummy `SUPABASE_URL`, `SUPABASE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`),
  `cd client && npm test`, and `npx tsc --noEmit` all pass.
- Smoke test: jobsite list loads, edit job site saves, Settings has no "Text reminders" card, Pricing shows the
  correct SMS copy.
- Supabase checks above return 0 rows and NULL; Twilio console shows no active number or pending verification,
  and the old Auth Token no longer works.
