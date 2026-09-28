// Pure, I/O-free: turns a rolling window of daily roster/log snapshots into a
// subcontractor's cross-project safety scorecard (Phase 9e,
// docs/sub-scorecard-design.md "Scoring model"). Built on top of
// `computeCompliance` rather than reimplementing its window matching -- this
// module only adds the day-by-day loop, the join-date proration, and the
// score rollup.
const { computeCompliance } = require("./compliance");

// For one jobsite: how many of `dayWindows` a roster sub was expected to log
// in (it had already joined) and how many of those it actually logged in.
// `roster` is `[{ subId, since }]` -- `since` is the ISO timestamp the sub
// became an accepted roster member of this jobsite (`jobsite_subcontractors
// .accepted_at`), which prorates the denominator for a recent join instead of
// penalizing days before the sub was even on the jobsite. `logs` is every
// completed log for this jobsite in the whole rolling range; each day's
// window narrows it the same way `computeCompliance` narrows any window.
const computeRollingDailyCompliance = ({ roster, logs, dayWindows }) =>
  roster.map(({ subId, since }) => {
    const sinceMs = new Date(since).getTime();
    let expectedDays = 0;
    let loggedDays = 0;

    for (const window of dayWindows) {
      const windowStartMs = new Date(window.start).getTime();
      if (windowStartMs < sinceMs) continue; // sub hadn't joined yet this day

      expectedDays += 1;
      const [result] = computeCompliance({ roster: [{ subId }], logs, window });
      if (result.status === "logged") loggedDays += 1;
    }

    // Floored at 1 so a rate is always defined, even for a sub who joined on
    // the final day of the range (expectedDays would otherwise be 0/0).
    return { subId, expectedDays: Math.max(expectedDays, 1), loggedDays };
  });

// One sub's rollup across every jobsite it has with this GC. `perJobsite` is
// `[{ jobsiteId, jobsiteName, expectedDays, loggedDays }]`. Each jobsite gets
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
    score: Math.round((entry.loggedDays / entry.expectedDays) * 100),
  }));

  if (jobsites.length === 0) return { overallScore: 0, jobsites };

  const rawRateSum = perJobsite.reduce(
    (sum, entry) => sum + entry.loggedDays / entry.expectedDays,
    0,
  );
  const overallScore = Math.round((rawRateSum / perJobsite.length) * 100);

  return { overallScore, jobsites };
};

module.exports = { computeRollingDailyCompliance, buildScorecard };
