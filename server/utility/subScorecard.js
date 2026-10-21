// Pure, I/O-free: turns a rolling window of daily roster/log snapshots into a
// subcontractor's cross-project safety scorecard (Phase 9e,
// docs/sub-scorecard-design.md "Scoring model"). Built on top of
// `computeCompliance` rather than reimplementing its window matching -- this
// module only adds the period-by-period loop, the join-date proration, and the
// score rollup.
const { computeCompliance } = require("./compliance");
const { dayOfWeek } = require("./workweek");

const MONDAY = 1;

// Weekly cadence: one period per Mon-Sun week. `asOf` (ISO instant, the end of
// the client's "today") forgives a still-open week with no log yet.
const scoreWeeklyPeriods = ({ subId, sinceMs, logs, windows, asOf }) => {
  const asOfMs = asOf ? new Date(asOf).getTime() : null;
  let expectedPeriods = 0;
  let loggedPeriods = 0;

  for (const window of windows) {
    if (new Date(window.start).getTime() < sinceMs) continue; // hadn't joined yet

    const [result] = computeCompliance({ roster: [{ subId }], logs, window });
    const logged = result.status === "logged";
    const stillOpen = asOfMs !== null && new Date(window.end).getTime() > asOfMs;
    if (stillOpen && !logged) continue;

    expectedPeriods += 1;
    if (logged) loggedPeriods += 1;
  }

  return { expectedPeriods, loggedPeriods, excusedPeriods: 0 };
};

// Daily cadence (docs/no-work-days-design.md): Mon-Fri are required, Sat/Sun
// never are. A weekday the foreman marked off (`noWorkDates`) leaves the
// expected count unless a talk was logged that day (the log wins). Each logged
// weekend day forgives one missed weekday in the same Mon-Sun week, so a
// make-up Saturday can't push a score past 100% or cover an earlier week.
// Windows are oldest-first and carry their local calendar `date`.
const scoreDailyWorkweek = ({ subId, sinceMs, noWorkDates, logs, windows }) => {
  let expectedPeriods = 0;
  let loggedPeriods = 0;
  let excusedPeriods = 0;
  let missedThisWeek = 0;
  let weekendLoggedThisWeek = 0;

  const closeWeek = () => {
    loggedPeriods += Math.min(missedThisWeek, weekendLoggedThisWeek);
    missedThisWeek = 0;
    weekendLoggedThisWeek = 0;
  };

  for (const window of windows) {
    const day = dayOfWeek(window.date);
    if (day === MONDAY) closeWeek();
    if (new Date(window.start).getTime() < sinceMs) continue; // hadn't joined yet

    const [result] = computeCompliance({ roster: [{ subId }], logs, window });
    const logged = result.status === "logged";
    const isWeekend = day === 0 || day === 6;

    if (isWeekend) {
      if (logged) weekendLoggedThisWeek += 1;
    } else if (logged) {
      expectedPeriods += 1;
      loggedPeriods += 1;
    } else if (noWorkDates.has(window.date)) {
      excusedPeriods += 1;
    } else {
      expectedPeriods += 1;
      missedThisWeek += 1;
    }
  }
  closeWeek();

  return { expectedPeriods, loggedPeriods, excusedPeriods };
};

// For one jobsite: how many of `windows` (one per period -- a day for a daily
// cadence, a Mon-Sun week for a weekly one) a roster sub was expected to log
// in (it had already joined) and how many of those it actually logged in.
// `roster` is `[{ subId, since, noWorkDates }]` -- `since` is the ISO timestamp
// the sub became an accepted roster member of this jobsite (`jobsite_
// subcontractors.accepted_at`), which prorates the denominator for a recent
// join instead of penalizing periods before the sub was even on the jobsite;
// `noWorkDates` (optional `YYYY-MM-DD` list/Set) are the weekdays the sub
// marked off on this jobsite. `logs` is every completed log for this jobsite in
// the whole rolling range; each period's window narrows it the same way
// `computeCompliance` narrows any window.
//
// `cadence` picks the scoring rules ("daily", the default, or "weekly").
// `asOf` only applies to weekly: it forgives a still-open week with no log yet
// (daily has always counted today).
const computeRollingCompliance = ({ roster, logs, windows, asOf, cadence = "daily" }) =>
  roster.map(({ subId, since, noWorkDates }) => {
    const sinceMs = new Date(since).getTime();
    const counts =
      cadence === "weekly"
        ? scoreWeeklyPeriods({ subId, sinceMs, logs, windows, asOf })
        : scoreDailyWorkweek({
            subId,
            sinceMs,
            noWorkDates: new Set(noWorkDates ?? []),
            logs,
            windows,
          });

    // Floored at 1 so a rate is always defined, even for a sub who joined on
    // the final period of the range (expectedPeriods would otherwise be 0/0).
    return { subId, ...counts, expectedPeriods: Math.max(counts.expectedPeriods, 1) };
  });

// One sub's rollup across every jobsite it has with this GC. `perJobsite` is
// `[{ jobsiteId, jobsiteName, expectedPeriods, loggedPeriods }]`. Each jobsite gets
// its own rounded score; `overallScore` averages the *raw* fractions across
// jobsites and rounds once, rather than averaging the already-rounded
// per-jobsite percentages -- the two can differ by a point (e.g. raw rates
// 49.5% and 0.6%: round(avg(raw)) = round(25.05) = 25, but
// avg(round(raw)) = avg(50, 1) = round(25.5) = 26). Averaging raw first is
// the accurate figure; the ±1 discrepancy from a naive re-average of the
// displayed per-jobsite percentages is a documented, accepted v1 quirk (see
// the design doc's "Known v1 limitations").
const buildScorecard = ({ perJobsite }) => {
  const jobsites = perJobsite.map((entry) => ({
    ...entry,
    score: Math.round((entry.loggedPeriods / entry.expectedPeriods) * 100),
  }));

  if (jobsites.length === 0) return { overallScore: 0, jobsites };

  const rawRateSum = perJobsite.reduce(
    (sum, entry) => sum + entry.loggedPeriods / entry.expectedPeriods,
    0,
  );
  const overallScore = Math.round((rawRateSum / perJobsite.length) * 100);

  return { overallScore, jobsites };
};

module.exports = { computeRollingCompliance, buildScorecard };
