# Cross-Project Sub Safety Scorecards Design (Phase 9e)

Status: **decided**. Covers the "Cross-project subcontractor safety scorecards" promised to
GC Portfolio (`docs/pricing-and-positioning-strategy_V2.md`: "adds cross-project subcontractor
safety scorecards"). Full plan: `~/.claude/plans/let-s-work-on-9e-quizzical-newell.md`. See
`docs/tasks.md` 9e and `docs/pricing-promise-gaps.md` (row "Portfolio — cross-project
scorecards," previously `Partial`) for how this was tracked before it was built.

## Scope

A rolling **30-day** window, one score per subcontractor, rolled up across every jobsite that
sub has with the caller's GC. A list page (`GET /api/gc/subcontractors`) shows every sub across
the GC's whole portfolio, worst score first; a detail page
(`GET /api/gc/subcontractors/:companyId/scorecard`) adds a per-jobsite breakdown so a GC can see
which specific site is dragging a sub's score down. Only active, non-archived jobsites count
toward the roster — the same filter `getOverview`'s `listActiveJobsites` already applies — so a
sub's finished, fully-compliant jobsite stops contributing to their score once it's archived.
That's a deliberate v1 limitation (see below), not an oversight.

## Gating: GC Portfolio only

`getPlanId(company.companyType, company.tier) === "gc-portfolio"` (`gc:premium` or
`gc:enterprise`), enforced server-side by `siteScopeService.assertScorecardsAvailable` — a new
function in `server/services/siteScope.js` that mirrors `assertSiteRolesAvailable`'s exact shape
(a 403 `PLAN_LIMIT`), since both gate a GC-Portfolio-only capability the same way. Both of the new
endpoints call it first, before any query.

Client: the "Subcontractors" nav link and both pages are **always visible to every GC**,
regardless of plan — the same "selling point" convention the OSHA Defense Bundle button
(`JobsiteList.tsx`) and `MeetingHistory.tsx`'s history-window upgrade banner already use. A
non-Portfolio GC sees `SubScorecardUpgradeNotice` in place of real data instead of the page being
hidden or blocked. The server remains the real authority: even if the client's `plan` check were
bypassed, `assertScorecardsAvailable` still 403s.

No locked-sub masking is needed anywhere in this feature. `gc:premium`/`gc:enterprise` both have
`unlockedSubs: null` in `PLAN_LIMITS` (`server/utility/entitlements.js`) — only a GC already on
Portfolio, where every sub is already unlocked, can reach this feature at all.

## Scoring model

**Roster unit.** One accepted `(sub_company_id, jobsite_id)` pair from `jobsite_subcontractors`
(`accepted_at IS NOT NULL`), on one of the GC's active, non-archived jobsites. `since =
accepted_at` anchors proration for a recently-joined sub.

**Window.** 30 single calendar-day windows ending "today" in the client's local timezone
(`date` + `tzOffset`, the same contract `dayWindow`/`GET /api/gc/overview` already use), built by
a new `server/utility/rollingWindow.js`'s `rollingDayWindows({ date, tzOffset, days })` — it
calls the existing `dayWindow` once to anchor "today," then walks backward in whole 24-hour
increments. It doesn't reimplement `dayWindow`'s date/tzOffset validation, only reuses it.

**Per (sub, jobsite), for each of the 30 day windows (oldest first):**

```
for each day window in the 30-day range:
  if day.start < since:           // sub hadn't joined this jobsite yet
    skip (not counted at all)
  else:
    expectedPeriods += 1
    result = computeCompliance({ roster: [{ subId }], logs: thatJobsite'sLogs, window: day })
    if result.status === "logged": loggedPeriods += 1
expectedPeriods = max(expectedPeriods, 1)   // always defined, never 0/0
```

This literally calls the existing, unmodified `computeCompliance` once per calendar day — the
new code (`server/utility/subScorecard.js`'s `computeRollingDailyCompliance`) only adds the
day-by-day loop and the join-date proration on top, rather than reimplementing
`computeCompliance`'s half-open window matching.

**Per-jobsite score:** `Math.round((loggedPeriods / expectedPeriods) * 100)`.

**Overall sub score:** average the **raw fractions** across all of that sub's jobsites with this
GC (equal weight per jobsite, not log-volume-weighted — see "Known v1 limitations"), then round
**once**:

```
overallScore = Math.round(avg(loggedPeriods / expectedPeriods over every jobsite) * 100)
```

**Why round once, not average the rounded percentages:** the two can differ by a point. Worked
example: jobsite A's raw rate is 49.5%, jobsite B's is 0.6%.
`round(avg(0.495, 0.006)) = round(25.05) = 25`, but `avg(round(49.5), round(0.6)) = avg(50, 1) =
round(25.5) = 26`. This codebase had no prior percentage-rounding convention, so this feature
establishes "average raw, round once" as the rule (`buildScorecard` in `subScorecard.js`) — the
resulting ±1-point gap from a naive re-average of the breakdown table's own displayed per-jobsite
percentages is an accepted, documented quirk, not a bug (see "Known v1 limitations").

**Proration anchor.** A jobsite membership younger than 30 days shrinks `expectedPeriods` down to
roughly the days since `accepted_at`, never penalizing days before the sub joined.
`accepted_at` (from `jobsite_subcontractors`) is used rather than a project's own `created_at`,
since a sub can have several projects on one jobsite, or a project that predates joining that
jobsite — there's no single per-(sub, jobsite) "start date" at the project level, but
`accepted_at` is exactly the tenure-start date `subLocking.js` already treats as canonical for
its own unrelated tie-break, so this is a precedent-consistent choice.

**Edge cases:**
- A sub with zero projects/jobsites under this GC never appears in either endpoint — it has no
  `jobsite_subcontractors` row for this GC at all.
- A sub accepted onto a jobsite with zero completed logs anywhere scores 0% on that jobsite.
- A sub logging on some jobsites but not others: each jobsite is scored independently, then
  averaged equally (not weighted by log volume).
- A jobsite membership younger than 30 days: `expectedPeriods` prorates down via the `since` check
  above; a join on the very last day of the range still gets `expectedPeriods` floored at 1 (never
  0/0).
- An empty portfolio (the GC has zero accepted subs anywhere): the list endpoint returns `[]`;
  the detail endpoint 404s for any `companyId`.

## Endpoint contract

Same conventions as `docs/gc-dashboard-design.md`'s table: `requireAuth → loadUserContext →
requireGcCompany`, camelCase, a company/jobsite outside the caller's authorization (wrong GC, or
outside a site-scoped superintendent's assigned sites, Phase 9d-2) is a 404, never a 403 —
existence is never leaked to an unauthorized caller.

| Endpoint | Returns |
| --- | --- |
| `GET /api/gc/subcontractors?date&tzOffset` | Every distinct sub across the GC's active portfolio jobsites with a rolling 30-day `overallScore` (0–100), worst-first. `[]` if the portfolio has no accepted subs. 403 `PLAN_LIMIT` unless GC Portfolio. |
| `GET /api/gc/subcontractors/:companyId/scorecard?date&tzOffset` | One sub's `overallScore` plus a `jobsites[]` breakdown (`jobsiteId`, `jobsiteName`, `expectedPeriods`, `loggedPeriods`, `score`). 404 if `companyId` isn't a current accepted roster member anywhere in the caller's (allowed) portfolio. 403 `PLAN_LIMIT` unless GC Portfolio. |

A site-scoped superintendent (Phase 9d-2) sees the roster narrowed to their assigned jobsites
only, the same `allowedJobsiteIds` threading every other GC endpoint uses; a sub who is also on a
jobsite outside that scope simply has that jobsite excluded from their breakdown rather than
404ing the whole request, matching `isJobsiteAllowed`'s existing filter-not-error convention.

## Client UX

`GcSubcontractors` (`/gc/subcontractors`) lists every sub with a `ScoreBadge`
(green ≥ 90%, orange 70–89%, red < 70%) and a drill-in link to `GcSubcontractorDetail`
(`/gc/subcontractors/:companyId`), which adds the `JobsiteBreakdownTable` (a card list, not an
HTML `<table>` — no table primitive exists elsewhere in this codebase). Both pages are online-only
and read-only, same as the rest of the GC dashboard (`docs/gc-dashboard-design.md` "Client
notes") — no offline cache fallback. No filter controls exist in v1 (`docs/ui-inputs.md`
confirms none are needed — there's no user input beyond navigation).

## Cadence (Phase 11f)

A "period" is a day for a daily cadence and a Monday–Sunday week for a weekly one; each (sub, jobsite) is scored
on its effective cadence (`rollingPeriodWindows`, `computeRollingCompliance`). Weekly periods are the weeks
overlapping the same 30-day range, and an unlogged, still-open weekly period isn't counted as a miss. The API
fields were renamed `expectedDays`/`loggedDays` → `expectedPeriods`/`loggedPeriods`, and each jobsite entry
carries `cadence`.

## Known v1 limitations

- **Archived jobsites are excluded from scoring.** A sub's finished, fully-compliant jobsite
  stops contributing to their score the moment it's archived, since the roster only draws from
  active jobsites (matching `getOverview`'s own filter). Revisit if a GC wants a sub's full
  historical record reflected, not just their current active sites.
- **Equal per-jobsite weighting, not log-volume-weighted.** A sub's score averages each
  jobsite's raw rate equally, so one tiny, recently-joined jobsite can swing the overall score as
  much as one large, long-running one.
- **A ±1-point rounding discrepancy is possible.** `overallScore` averages raw fractions and
  rounds once; a GC manually re-averaging the breakdown table's own displayed per-jobsite
  percentages can land one point off (see the worked example above). This is the accurate
  figure, not a bug.
- **`getSubcontractorScorecard` computes every sub's numbers to serve one.** Both endpoints
  share one `buildAllScorecards` builder for simplicity; fine at expected portfolio-roster
  sizes, worth revisiting only if a GC portfolio ever has hundreds of distinct subs.
- **No pagination.** Like `listMeetings`'s `MEETINGS_LIST_LIMIT` note, the subcontractor list
  has no page size cap or cursor — acceptable at expected portfolio sizes today.
