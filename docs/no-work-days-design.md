# Working Days & "Mark Day Off" Design (Phase 14)

Status: **built (14a-14f); manual smoke pending** — the three open questions were resolved as recommended
(no GC revoke or cap in v1, whole-site closures later, not tier-gated). Covers how a **daily**
cadence stops requiring weekends, how a crew's make-up weekend work is credited, and how a foreman
marks a weekday as a day off (holiday, weather, no crew). Builds on
`docs/gc-dashboard-design.md` ("Configurable cadence") and `docs/sub-scorecard-design.md`
("Scoring model", "Cadence").

## Why this exists

Today a daily-cadence sub is expected to log **every calendar day**, Saturdays, Sundays and
holidays included (`rollingDayWindows` builds 30 consecutive calendar-day windows; `getOverview`
scores "today" whatever day it is). There is no working-day, holiday or excused-day concept
anywhere in `server/` or `client/src/`. The effects:

- A Mon-Fri crew shows `missing` on the GC dashboard every weekend and loses ~28% of its 30-day
  scorecard (8-9 of 30 days) for not working when it was never expected to.
- A crew that rains out Wednesday and works Saturday to catch up gets no credit for Saturday.
- A crew closed for Thanksgiving takes a miss it cannot clear.

The only workaround is a weekly cadence, which loosens the requirement for the whole week.

## Decisions

Rules apply to a sub's **effective daily cadence** (`server/utility/cadence.js`: the stricter of the
jobsite default and the sub's own override — so a sub that tightens a weekly site to daily gets
these rules too). **Weekly cadence is untouched.**

1. **Mon-Fri are required.** An unlogged weekday is a miss, as today.
2. **Sat/Sun are never required.** An unlogged weekend day counts neither for nor against the sub.
3. **A weekend log forgives one missed weekday in the same Mon-Sun week**, one weekday per logged
   weekend day, earliest unforgiven miss first (order is irrelevant to the score). A make-up log
   therefore can never push a score past 100%, and cannot cover a miss from a previous week.
   A weekend log in a week with no missed weekday earns nothing.
4. **A foreman can mark a weekday `no_work`** ("Mark day off"). That day is removed from the
   expected periods: not a miss, and a weekend log forgives nothing for it. If the crew logs a talk
   on a day it marked off, the **log wins** and the day scores as a normal logged day.
5. **Marking is not tier-gated and needs no GC approval.** Visibility is the safeguard (see
   "Abuse and trust").

Rejected, deliberately out of v1 (the table below does not conflict with adding them later):

- **Configurable working days per jobsite** (`jobsites.working_days`): Mon-Fri is the rule for every
  daily crew. A Tue-Sat or 7-day crew uses weekly cadence or marks days off.
- **A seeded holiday calendar**: holidays are marked by the foreman, not computed or imported.
- **Weekend log as its own extra period**: would need a cap to stay ≤ 100%; "forgives a miss" matches
  the make-up use case and cannot inflate a score.
- **Whole-week "off" for weekly cadence**: a weekly sub already needs only one talk in the week.

## "Weekday" and "weekend" mean the viewer's local calendar day

Window dates come from the client's `date` (`YYYY-MM-DD`) plus `tzOffset` / `timeZone`, exactly as
`dayWindow` already works; the weekday is `getUTCDay()` on the UTC midnight of that calendar date
(the same trick `weekWindow` uses). The server never guesses a timezone. Same accepted v1 limitation
as the rest of the dashboard: a GC with sites in several zones sees one boundary (the viewer's), and
`off_date` below is a plain calendar date compared against that same local date string.

## Data model

```sql
CREATE TABLE IF NOT EXISTS no_work_days (
  id UUID PRIMARY KEY,                       -- generated client-side (offline-sync rule)
  jobsite_id UUID NOT NULL REFERENCES jobsites(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,  -- the sub (or in-house crew)
  off_date DATE NOT NULL,                    -- a local calendar date, not a timestamp
  reason TEXT NOT NULL CHECK (reason IN ('holiday', 'weather', 'no_crew', 'other')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- server-receipt audit stamp
  CONSTRAINT no_work_days_unique UNIQUE (jobsite_id, company_id, off_date)
);
CREATE INDEX IF NOT EXISTS no_work_days_jobsite_date_idx ON no_work_days (jobsite_id, off_date);
ALTER TABLE no_work_days ENABLE ROW LEVEL SECURITY;  -- no policies: server-brokered (docs/data-access.md)
```

- **Keyed by `(jobsite, company)`, not project.** A scorecard is per `(sub, jobsite)` and a sub can
  have several projects on one jobsite, so one mark covers the crew's day on that site. The
  endpoint takes a `projectId` (what the foreman has on screen) and the server derives
  `jobsite_id` and `company_id` from that project, **never from the body** — the same rule as
  in-house crews' parent GC.
- **A project with no `jobsite_id`** (not linked to any GC) has no dashboard or scorecard to affect,
  so the client hides "Mark day off" for it and the server returns `409` if it is posted anyway.
- **`UNIQUE (jobsite_id, company_id, off_date)`** makes a retried POST idempotent (`23505` on a row
  we own = already marked = success), the same way `attachCrew` treats it.
- **`created_at` vs `off_date`** is the audit trail: a mark created after its date shows a
  "marked later" cue to the GC, like `held_at` / `completed_at` ("received later") in
  `docs/gc-dashboard-design.md`. Not covered by the tamper-evidence seal (`docs/tamper-evidence-design.md`
  covers completed meetings only).
- Whole-site closures (a GC-wide holiday) would make `company_id` nullable; left to the follow-up.

## Scoring

### Scorecard (`computeRollingCompliance`, daily windows only)

Each window from `rollingDayWindows` gains a local `date`. New input `noWorkDates` (a `Set` of
`YYYY-MM-DD` for this `(sub, jobsite)`). Windows are walked oldest-first and grouped by Mon-Sun
week of their `date`:

```
for each week of day windows:
  missed = 0; weekendLogged = 0
  for each day window in the week:
    if day.start < since: skip                    // unchanged: sub hadn't joined yet
    logged = computeCompliance(...).status === "logged"
    if weekday:
      if logged:                 expected += 1; loggedPeriods += 1
      elif date in noWorkDates:  skip            // excused: not expected, not missed
      else:                      expected += 1; missed += 1
    else (Sat/Sun):
      if logged: weekendLogged += 1              // never adds to expected
  loggedPeriods += min(missed, weekendLogged)
expected = max(expected, 1)
```

- Worked example: Mon, Tue, Thu, Fri logged; Wed rained out (not marked); Saturday logged →
  expected 5, logged 4 + min(1, 1) = 5 → 100%. If Wed had been marked off instead: expected 4,
  logged 4, Saturday forgives nothing → 100%.
- Today still counts if unlogged (`asOf` is omitted for daily, unchanged). A weekend log can only
  forgive misses in the same week, so the current week's future Saturday cannot pre-forgive.
- A week cut by the 30-day range edge, or by `since`, only forgives misses that were counted.
- The weekly path (`rollingPeriodWindows` with `cadence: "weekly"`) is not changed.
- The result adds `excusedPeriods` (marked weekdays skipped) so the UI can show the count.
- **Existing daily scores rise on deploy**, since weekends stop being misses. Expected, not a bug;
  noted in `docs/sub-scorecard-design.md`.

### Today's dashboard status (`computeCompliance`, `getOverview`)

`computeCompliance` gains an optional `excused` map `{ subId -> reason }` and a third status,
**`off`** (`lastLoggedAt: null`, `count: 0`, plus `reason`). Precedence for a daily sub:
**`logged` > `off` > `missing`** — a log on a day off still reads `logged`. `getOverview`
builds `excused` from (a) today being Sat/Sun (`reason: "weekend"`) and (b) a `no_work_days` row
for today (`reason` from the row). Weekly subs never get `off`. `policyPush` and `smsNudges` call
`computeCompliance` without `excused` and are unaffected (SMS nudges are weekly-only).

`totals` gains `off`; `missing` no longer includes off subs. A locked sub's placeholder row keeps
nulling every field, including `reason`.

## Endpoint contract

Same conventions as the rest of the API (camelCase, `{ success, data }`, `AppError` → global
handler, `id` generated client-side). Role guard: the same as starting a meeting on that project
(confirm the exact middleware in 14d); the project must belong to the caller's company (404
otherwise — existence is never leaked).

| Endpoint | Behavior |
| --- | --- |
| `POST /api/no-work-days` `{ id, projectId, offDate, reason }` | Upsert. `201` new, `200` already marked (same `(jobsite, company, date)`). Range: **previous 7 days to next 14 days** around the server's UTC date with ±1 day slack for time zones. Outside it, or a Sat/Sun, → `200 { ignored: true }`, nothing written. Malformed `offDate`/`reason`/UUID → `422` (validator). Project with no jobsite → `409`. |
| `DELETE /api/no-work-days/:id` | Removes a mark the caller's company owns, within the same range. Already gone → `200` (idempotent, so an offline replay never strands). Out of range → `409`. |
| `GET /api/no-work-days?projectId` | Marks for that project's `(jobsite, company)` from 7 days back onward — feeds the sheet's "already marked" state and the remove action. |

**Why a weekend/out-of-range date is a no-op `200`, not a `422`:** same stance as `heldAt`
(`docs/gc-dashboard-design.md`). The client's offline outbox retries a failed row forever with the
same payload; a semantically rejected row would be stuck. Only a malformed value is a `422`, which
our own client cannot produce. The picker also limits the range up front, so a no-op is only reachable
by a stale offline queue.

The GC reads reach marks through existing endpoints only: `GET /api/gc/overview` (the `off` status
+ `reason`), the sub scorecard (`excusedPeriods`), and — for the "marked later" cue and the
reason — the per-sub detail already opened from the dashboard. No new GC endpoint in v1.

## Client UX

- **Button: "Mark day off"**, in the project card's Actions panel on the Projects page (the label is date-neutral on
  purpose — it can mark today, tomorrow or a past day). Hidden when the project has no jobsite.
- Opens a **dialog** (the shared centered `Modal`, as built in 14e; not a true bottom sheet): date defaults to **today**; "Today" / "Tomorrow" quick buttons and a
  date picker limited to the 7-back / 14-forward range; a one-tap reason list (Holiday, Weather,
  No crew scheduled, Other); confirm button reads "Mark [date] off". Weekends are not selectable
  (they are never required). Existing marks in range are listed with a **Remove** action.
- **Offline:** new `SyncEntity` `"no_work_day"`; `create` / `delete` ops through the outbox with the
  client-generated `id`, `dependsOnEntityIds: [projectId]` when the project itself has not synced
  yet. A replayed `create` that hits `200 { ignored }` or an existing row is a success.
- Domain hooks per project convention: `apiNoWorkDays`, `useNoWorkDays` (query),
  `useNoWorkDayActions` (mutations) — no inline `useMutation`/`useQuery`.
- Styling: styled-components via theme tokens only, `Styled*` names, `$`-prefixed transient props,
  ≥ 48×48 px targets, 16px inputs, mobile-first.
- **GC dashboard:** `SubComplianceRow` shows a neutral **Day off** badge with the reason
  ("Weekend", "Holiday", "Weather", "No crew scheduled", "Other") for `off`; headline totals show an
  off count. **Sub scorecard:** an "N days off" line per jobsite so excused days stay visible.

## Abuse and trust

A foreman could mark every weekday off. Mitigations, none of which block the field:

- Every mark is visible to the GC with its reason, and the scorecard prints the **count** of days off
  beside the score, so an unusually high count is obvious.
- The range limit (7 days back) stops wholesale back-dating of a 30-day record; `created_at` is a
  server stamp and the "marked later" cue exposes late marks.
- Not sealed or tamper-proof — the same trust boundary as every other client-reported field.

## Gating

Not tier-gated. The dashboard `off` status appears on every GC tier; the scorecard is GC Portfolio
only (`assertScorecardsAvailable`), unchanged. A sub's foreman marking a day off is never a premium
action, and gating it would make a Trade Free sub's score depend on a GC's plan. (Meeting cadence
itself is not gated either; only SMS nudges and scorecards are — `server/services/jobsites.js`.)

## Known v1 limitations

- A weekday holiday or rain-out is still a miss until the foreman marks it or the crew makes it up
  that week.
- Mon-Fri only; a Tue-Sat crew's Saturday is a "make-up" log and its Monday a "required" day.
- Marks are per sub, so a GC-wide holiday needs each foreman to mark it.
- No GC revoke or approval, and no monthly cap.
- Weekly cadence cannot be excused.
- One viewer-local boundary for weekday/weekend, as for the rest of the dashboard.

## Open questions (resolved)

1. **GC revoke / monthly cap?** Recommendation: **no** for v1; visibility (reason, count, "marked
   later") is the safeguard, and an approval step defeats the purpose in the field. A cap
   (e.g. 5/month) is a one-line validator change if abuse appears.
2. **Whole-site closures** (`company_id IS NULL` row, or a GC-set closure) so a GC holiday does not
   need N foremen to mark it? Recommendation: follow-up, not v1.
3. **Tier gating?** Recommendation: **not gated** (see "Gating"). Needs the maintainer's yes.

## Manual smoke (14g)

Needs `Supabase_SQL.sql` section 19 applied. Use a foreman account on a daily-cadence sub that is on a GC jobsite,
and the GC account's dashboard and (Portfolio) scorecard.

1. **Mark in advance, offline:** go offline, Projects > Mark day off, pick a weekday inside the next 14 days, a reason, confirm.
   It appears under "Already marked off" at once. Go online; after sync the GC dashboard shows that day as **Day off** with the
   reason (set the date to that day or wait for it) and the day-off tile counts it.
2. **Remove:** remove the mark online; the GC row returns to Missing/Logged and the list updates. Repeat offline and sync.
3. **Make-up Saturday:** with a missed weekday earlier in the week and a completed log on that Saturday, the scorecard counts
   that week 5 of 5 (one weekend log forgives one miss).
4. **Weekend with no log:** on a Sat/Sun the daily sub shows **Day off · Weekend**, never Missing; a log that day still shows Logged.
5. **Refused dates:** a weekend, a day beyond 14 ahead or 7 back, and an already-marked day disable the confirm with a hint.
6. **Scorecard line:** a jobsite with marked days prints "· N days off" beside "Logged X of Y expected days".
7. **Weekly unchanged:** a weekly-cadence sub is never Day off on a weekend and shows no days-off suffix.
8. **Idempotence:** mark the same day twice (e.g. two devices); no error, one row.

## Files touched

Server: `utility/workweek.js` (new), `utility/rollingWindow.js`, `utility/subScorecard.js`, `utility/compliance.js`,
`services/gcDashboard.js`, `services/scorecards.js`; new `services/noWorkDays.js`, controller,
route, validator. Client: `interfaces/sync.ts`, `utils/db/outbox.ts` replay, new `apiNoWorkDays` /
hooks, a "Mark day off" sheet, `features/gc-dashboard/SubComplianceRow.tsx`, the scorecard
breakdown card. SQL: `Supabase_SQL.sql`, `Supabase_Schema.md`.
