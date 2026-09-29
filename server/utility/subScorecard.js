// Pure, I/O-free: turns a rolling window of daily roster/log snapshots into a
// subcontractor's cross-project safety scorecard (Phase 9e,
// docs/sub-scorecard-design.md "Scoring model"). Built on top of
// `computeCompliance` rather than reimplementing its window matching -- this
// module only adds the period-by-period loop, the join-date proration, and the
// score rollup.
const { computeCompliance } = require("./compliance");

// For one jobsite: how many of `windows` (one per period -- a day for a daily
// cadence, a Mon-Sun week for a weekly one) a roster sub was expected to log
// in (it had already joined) and how many of those it actually logged in.
// `roster` is `[{ subId, since }]` -- `since` is the ISO timestamp the sub
// became an accepted roster member of this jobsite (`jobsite_subcontractors
// .accepted_at`), which prorates the denominator for a recent join instead of
// penalizing periods before the sub was even on the jobsite. `logs` is every
// completed log for this jobsite in the whole rolling range; each period's
// window narrows it the same way `computeCompliance` narrows any window.
//
// `asOf` (optional ISO instant, the end of the client's "today") forgives a
// still-open period: one ending after `asOf` that has no log yet isn't a miss
// (the week isn't over). Omit it for daily, where today has always counted.
const computeRollingCompliance = ({ roster, logs, windows, asOf }) =>
  roster.map(({ subId, since }) => {
    const sinceMs = new Date(since).getTime();
    const asOfMs = asOf ? new Date(asOf).getTime() : null;
    let expectedPeriods = 0;
    let loggedPeriods = 0;

    for (const window of windows) {
      const windowStartMs = new Date(window.start).getTime();
      if (windowStartMs < sinceMs) continue; // sub hadn't joined yet this period

      const [result] = computeCompliance({ roster: [{ subId }], logs, window });
      const logged = result.status === "logged";
      const stillOpen = asOfMs !== null && new Date(window.end).getTime() > asOfMs;
      if (stillOpen && !logged) continue;

      expectedPeriods += 1;
      if (logged) loggedPeriods += 1;
    }

    // Floored at 1 so a rate is always defined, even for a sub who joined on
    // the final period of the range (expectedPeriods would otherwise be 0/0).
    return { subId, expectedPeriods: Math.max(expectedPeriods, 1), loggedPeriods };
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
