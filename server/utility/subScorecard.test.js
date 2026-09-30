// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). Pure
// functions, so no mocking is needed.

const { computeRollingCompliance, buildScorecard } = require("./subScorecard");

// A small 5-day window range, oldest first, mirroring what rollingWindow.js
// produces (half-open, contiguous, each day exactly 24h).
const days = [
  { start: "2026-09-17T00:00:00.000Z", end: "2026-09-18T00:00:00.000Z" },
  { start: "2026-09-18T00:00:00.000Z", end: "2026-09-19T00:00:00.000Z" },
  { start: "2026-09-19T00:00:00.000Z", end: "2026-09-20T00:00:00.000Z" },
  { start: "2026-09-20T00:00:00.000Z", end: "2026-09-21T00:00:00.000Z" },
  { start: "2026-09-21T00:00:00.000Z", end: "2026-09-22T00:00:00.000Z" },
];

describe("computeRollingCompliance", () => {
  it("should return an empty array for an empty roster", () => {
    // Act
    const result = computeRollingCompliance({ roster: [], logs: [], windows: days });

    // Assert
    expect(result).toEqual([]);
  });

  it("should count every day as expected and logged when a sub logs every day", () => {
    // Arrange
    const roster = [{ subId: "sub-1", since: days[0].start }];
    const logs = days.map((day) => ({ subId: "sub-1", heldAt: day.start }));

    // Act
    const result = computeRollingCompliance({ roster, logs, windows: days });

    // Assert
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 5, loggedPeriods: 5 }]);
  });

  it("should count every day as expected but none as logged when a sub has no logs", () => {
    // Arrange
    const roster = [{ subId: "sub-1", since: days[0].start }];

    // Act
    const result = computeRollingCompliance({ roster, logs: [], windows: days });

    // Assert
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 5, loggedPeriods: 0 }]);
  });

  it("should not count days before the sub's join date", () => {
    // Arrange — joined exactly at day 2's start: days 0-1 don't count, days 2-4 do.
    const roster = [{ subId: "sub-1", since: days[2].start }];
    const logs = [
      { subId: "sub-1", heldAt: days[3].start }, // one logged day among the 3 expected
    ];

    // Act
    const result = computeRollingCompliance({ roster, logs, windows: days });

    // Assert
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 3, loggedPeriods: 1 }]);
  });

  it("should floor expectedPeriods at 1 for a sub who joined partway through the final day", () => {
    // Arrange — joined 12h into the last window: every window's start is before `since`.
    const roster = [{ subId: "sub-1", since: "2026-09-21T12:00:00.000Z" }];

    // Act
    const result = computeRollingCompliance({ roster, logs: [], windows: days });

    // Assert
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 1, loggedPeriods: 0 }]);
  });

  it("should isolate logs per sub, delegating to computeCompliance's own roster/log matching", () => {
    // Arrange
    const roster = [
      { subId: "sub-1", since: days[0].start },
      { subId: "sub-2", since: days[0].start },
    ];
    const logs = [{ subId: "sub-1", heldAt: days[2].start }];

    // Act
    const result = computeRollingCompliance({ roster, logs, windows: days });

    // Assert
    expect(result).toEqual([
      { subId: "sub-1", expectedPeriods: 5, loggedPeriods: 1 },
      { subId: "sub-2", expectedPeriods: 5, loggedPeriods: 0 },
    ]);
  });

  it("should respect the half-open day boundary: a log at a day's end counts for the next day, not that one", () => {
    // Arrange — a log exactly at days[0].end (== days[1].start) belongs to day 1.
    const roster = [{ subId: "sub-1", since: days[0].start }];
    const logs = [{ subId: "sub-1", heldAt: days[0].end }];

    // Act
    const result = computeRollingCompliance({ roster, logs, windows: days });

    // Assert
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 5, loggedPeriods: 1 }]);
  });
});

describe("computeRollingCompliance with a still-open weekly period", () => {
  const weeks = [
    { start: "2026-09-07T00:00:00.000Z", end: "2026-09-14T00:00:00.000Z" },
    { start: "2026-09-14T00:00:00.000Z", end: "2026-09-21T00:00:00.000Z" },
    { start: "2026-09-21T00:00:00.000Z", end: "2026-09-28T00:00:00.000Z" },
  ];
  const asOf = "2026-09-23T00:00:00.000Z"; // mid-way through the last week

  it("should not count an unlogged open week as expected", () => {
    const roster = [{ subId: "sub-1", since: weeks[0].start }];
    const logs = [
      { subId: "sub-1", heldAt: "2026-09-08T10:00:00.000Z" },
      { subId: "sub-1", heldAt: "2026-09-15T10:00:00.000Z" },
    ];

    const result = computeRollingCompliance({ roster, logs, windows: weeks, asOf });

    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 2, loggedPeriods: 2 }]);
  });

  it("should count an open week that is already logged", () => {
    const roster = [{ subId: "sub-1", since: weeks[0].start }];
    const logs = [{ subId: "sub-1", heldAt: "2026-09-22T10:00:00.000Z" }];

    const result = computeRollingCompliance({ roster, logs, windows: weeks, asOf });

    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 3, loggedPeriods: 1 }]);
  });

  it("should still count a completed week with no log as a miss", () => {
    const roster = [{ subId: "sub-1", since: weeks[0].start }];

    const result = computeRollingCompliance({ roster, logs: [], windows: weeks, asOf });

    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 2, loggedPeriods: 0 }]);
  });
});

describe("buildScorecard", () => {
  it("should return a zero score and an empty breakdown for no jobsites", () => {
    // Act
    const result = buildScorecard({ perJobsite: [] });

    // Assert
    expect(result).toEqual({ overallScore: 0, jobsites: [] });
  });

  it("should make the overall score equal a single jobsite's own score", () => {
    // Act
    const result = buildScorecard({
      perJobsite: [{ jobsiteId: "j-1", jobsiteName: "Riverside Tower", expectedPeriods: 10, loggedPeriods: 7 }],
    });

    // Assert
    expect(result).toEqual({
      overallScore: 70,
      jobsites: [{ jobsiteId: "j-1", jobsiteName: "Riverside Tower", expectedPeriods: 10, loggedPeriods: 7, score: 70 }],
    });
  });

  it("should average the raw fractions and round once, not average the already-rounded percentages", () => {
    // Arrange — raw rates of 49.5% and 0.6%: round(avg(raw)) = round(25.05) = 25,
    // but avg(round(raw)) = avg(50, 1) = round(25.5) = 26. The rule this codebase
    // adopts is "average raw, round once" -- the ±1 gap from a naive re-average of
    // the two rounded per-jobsite scores below is a documented v1 quirk, not a bug.
    const perJobsite = [
      { jobsiteId: "j-1", jobsiteName: "Site A", expectedPeriods: 1000, loggedPeriods: 495 },
      { jobsiteId: "j-2", jobsiteName: "Site B", expectedPeriods: 1000, loggedPeriods: 6 },
    ];

    // Act
    const result = buildScorecard({ perJobsite });

    // Assert
    expect(result.jobsites.map((j) => j.score)).toEqual([50, 1]);
    expect(result.overallScore).toBe(25);
  });
});
