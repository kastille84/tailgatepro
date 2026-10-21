// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). Pure
// functions, so no mocking is needed.

const { computeRollingCompliance, buildScorecard } = require("./subScorecard");

// A 5-day window range, oldest first, mirroring what rollingWindow.js produces
// (half-open, contiguous, each day exactly 24h, carrying its local `date`).
// 2026-09-21 is a Monday, so the range is Thu, Fri, Sat, Sun, Mon.
const days = [
  { start: "2026-09-17T00:00:00.000Z", end: "2026-09-18T00:00:00.000Z", date: "2026-09-17" },
  { start: "2026-09-18T00:00:00.000Z", end: "2026-09-19T00:00:00.000Z", date: "2026-09-18" },
  { start: "2026-09-19T00:00:00.000Z", end: "2026-09-20T00:00:00.000Z", date: "2026-09-19" },
  { start: "2026-09-20T00:00:00.000Z", end: "2026-09-21T00:00:00.000Z", date: "2026-09-20" },
  { start: "2026-09-21T00:00:00.000Z", end: "2026-09-22T00:00:00.000Z", date: "2026-09-21" },
];
const [thu, fri, sat, , mon] = days;

// A full Mon-Sun week of day windows starting on `mondayDate`.
const weekOf = (mondayDate) =>
  Array.from({ length: 7 }, (_, i) => {
    const start = new Date(`${mondayDate}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() + i);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start: start.toISOString(), end: end.toISOString(), date: start.toISOString().slice(0, 10) };
  });
const logOn = (day, subId = "sub-1") => ({ subId, heldAt: `${day.date}T12:00:00.000Z` });

describe("computeRollingCompliance (daily)", () => {
  it("should return an empty array for an empty roster", () => {
    // Act
    const result = computeRollingCompliance({ roster: [], logs: [], windows: days });

    // Assert
    expect(result).toEqual([]);
  });

  it("should expect only weekdays: a sub who logs every weekday scores every one", () => {
    // Arrange
    const roster = [{ subId: "sub-1", since: thu.start }];
    const logs = [thu, fri, mon].map((day) => logOn(day));

    // Act
    const result = computeRollingCompliance({ roster, logs, windows: days });

    // Assert — Sat/Sun are not expected periods.
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 3, loggedPeriods: 3, excusedPeriods: 0 }]);
  });

  it("should count every weekday as a miss when a sub has no logs, and weekends as nothing", () => {
    // Arrange
    const roster = [{ subId: "sub-1", since: thu.start }];

    // Act
    const result = computeRollingCompliance({ roster, logs: [], windows: days });

    // Assert
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 3, loggedPeriods: 0, excusedPeriods: 0 }]);
  });

  it("should not count days before the sub's join date", () => {
    // Arrange — joined exactly at Sat's start: only Mon is a weekday on or after it.
    const roster = [{ subId: "sub-1", since: sat.start }];

    // Act
    const result = computeRollingCompliance({ roster, logs: [logOn(mon)], windows: days });

    // Assert
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 1, loggedPeriods: 1, excusedPeriods: 0 }]);
  });

  it("should floor expectedPeriods at 1 for a sub who joined partway through the final day", () => {
    // Arrange — joined 12h into the last window: every window's start is before `since`.
    const roster = [{ subId: "sub-1", since: "2026-09-21T12:00:00.000Z" }];

    // Act
    const result = computeRollingCompliance({ roster, logs: [], windows: days });

    // Assert
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 1, loggedPeriods: 0, excusedPeriods: 0 }]);
  });

  it("should isolate logs per sub, delegating to computeCompliance's own roster/log matching", () => {
    // Arrange
    const roster = [
      { subId: "sub-1", since: thu.start },
      { subId: "sub-2", since: thu.start },
    ];

    // Act
    const result = computeRollingCompliance({ roster, logs: [logOn(fri)], windows: days });

    // Assert
    expect(result).toEqual([
      { subId: "sub-1", expectedPeriods: 3, loggedPeriods: 1, excusedPeriods: 0 },
      { subId: "sub-2", expectedPeriods: 3, loggedPeriods: 0, excusedPeriods: 0 },
    ]);
  });

  it("should respect the half-open day boundary: a log at a day's end counts for the next day, not that one", () => {
    // Arrange — a log exactly at Fri's end (== Sat's start) belongs to Saturday.
    const roster = [{ subId: "sub-1", since: thu.start }];
    const logs = [{ subId: "sub-1", heldAt: fri.end }];

    // Act
    const result = computeRollingCompliance({ roster, logs, windows: days });

    // Assert — Thu and Fri stay misses; the Saturday log forgives one of them.
    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 3, loggedPeriods: 1, excusedPeriods: 0 }]);
  });

  describe("weekend make-up", () => {
    const week = weekOf("2026-09-07"); // Mon 09-07 .. Sun 09-13
    const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = week;
    const since = monday.start;

    it("should let a Saturday log forgive one missed weekday in the same week", () => {
      // Arrange — Wednesday rained out, crew logs Saturday.
      const logs = [monday, tuesday, thursday, friday, saturday].map((day) => logOn(day));

      // Act
      const [result] = computeRollingCompliance({ roster: [{ subId: "sub-1", since }], logs, windows: week });

      // Assert — 5 expected, 4 weekday logs + 1 forgiven = 5.
      expect(result).toMatchObject({ expectedPeriods: 5, loggedPeriods: 5 });
    });

    it("should forgive one miss per logged weekend day", () => {
      // Arrange — Mon and Tue missed, Wed-Fri logged, both weekend days logged.
      const logs = [wednesday, thursday, friday, saturday, sunday].map((day) => logOn(day));

      // Act
      const [result] = computeRollingCompliance({ roster: [{ subId: "sub-1", since }], logs, windows: week });

      // Assert — 3 logged + min(2 misses, 2 weekend days) = 5.
      expect(result).toMatchObject({ expectedPeriods: 5, loggedPeriods: 5 });
    });

    it("should forgive only as many misses as there are weekend days logged", () => {
      // Arrange — three weekdays missed, one weekend day logged.
      const logs = [thursday, friday, sunday].map((day) => logOn(day));

      // Act
      const [result] = computeRollingCompliance({ roster: [{ subId: "sub-1", since }], logs, windows: week });

      // Assert — 2 logged + min(3, 1) = 3 of 5.
      expect(result).toMatchObject({ expectedPeriods: 5, loggedPeriods: 3 });
    });

    it("should give a weekend log no credit when no weekday was missed", () => {
      // Arrange
      const logs = week.map((day) => logOn(day));

      // Act
      const [result] = computeRollingCompliance({ roster: [{ subId: "sub-1", since }], logs, windows: week });

      // Assert — never above 100%.
      expect(result).toMatchObject({ expectedPeriods: 5, loggedPeriods: 5 });
    });

    it("should not let a weekend log cover a miss from a previous week", () => {
      // Arrange — week 1 misses Friday with no weekend log; week 2 is fully logged, weekend included.
      const nextWeek = weekOf("2026-09-14");
      const logs = [
        ...[monday, tuesday, wednesday, thursday].map((day) => logOn(day)),
        ...nextWeek.map((day) => logOn(day)),
      ];

      // Act
      const [result] = computeRollingCompliance({
        roster: [{ subId: "sub-1", since }],
        logs,
        windows: [...week, ...nextWeek],
      });

      // Assert — week 2's weekend logs have no miss of their own to forgive.
      expect(result).toMatchObject({ expectedPeriods: 10, loggedPeriods: 9 });
    });

    it("should ignore a weekend log made before the sub joined", () => {
      // Arrange — joined Monday of the second week; the first week's Saturday log is pre-join.
      const nextWeek = weekOf("2026-09-14");

      // Act
      const [result] = computeRollingCompliance({
        roster: [{ subId: "sub-1", since: nextWeek[0].start }],
        logs: [logOn(saturday)],
        windows: [...week, ...nextWeek],
      });

      // Assert
      expect(result).toMatchObject({ expectedPeriods: 5, loggedPeriods: 0 });
    });
  });

  describe("days off (noWorkDates)", () => {
    const week = weekOf("2026-09-07");
    const [monday, tuesday, wednesday, thursday, friday, saturday] = week;
    const since = monday.start;

    it("should remove a marked weekday from the expected periods and count it as excused", () => {
      // Arrange — Thursday marked off (Thanksgiving-style), other weekdays logged.
      const logs = [monday, tuesday, wednesday, friday].map((day) => logOn(day));

      // Act
      const [result] = computeRollingCompliance({
        roster: [{ subId: "sub-1", since, noWorkDates: [thursday.date] }],
        logs,
        windows: week,
      });

      // Assert
      expect(result).toEqual({ subId: "sub-1", expectedPeriods: 4, loggedPeriods: 4, excusedPeriods: 1 });
    });

    it("should accept the marked dates as a Set as well as an array", () => {
      // Act
      const [result] = computeRollingCompliance({
        roster: [{ subId: "sub-1", since, noWorkDates: new Set([thursday.date]) }],
        logs: [monday, tuesday, wednesday, friday].map((day) => logOn(day)),
        windows: week,
      });

      // Assert
      expect(result).toMatchObject({ expectedPeriods: 4, excusedPeriods: 1 });
    });

    it("should let a log win over a day marked off: it scores as a normal logged day", () => {
      // Arrange
      const logs = [monday, tuesday, wednesday, thursday, friday].map((day) => logOn(day));

      // Act
      const [result] = computeRollingCompliance({
        roster: [{ subId: "sub-1", since, noWorkDates: [thursday.date] }],
        logs,
        windows: week,
      });

      // Assert
      expect(result).toEqual({ subId: "sub-1", expectedPeriods: 5, loggedPeriods: 5, excusedPeriods: 0 });
    });

    it("should give a weekend log no credit for a day marked off, since it is not a miss", () => {
      // Arrange — Wednesday marked off, the other four logged, plus a Saturday log.
      const logs = [monday, tuesday, thursday, friday, saturday].map((day) => logOn(day));

      // Act
      const [result] = computeRollingCompliance({
        roster: [{ subId: "sub-1", since, noWorkDates: [wednesday.date] }],
        logs,
        windows: week,
      });

      // Assert — 4 expected, 4 logged, Saturday forgives nothing.
      expect(result).toMatchObject({ expectedPeriods: 4, loggedPeriods: 4, excusedPeriods: 1 });
    });

    it("should still count an unmarked miss as a miss alongside a marked day", () => {
      // Arrange — Tuesday marked off, Wednesday missed (unmarked), no weekend log.
      const logs = [monday, thursday, friday].map((day) => logOn(day));

      // Act
      const [result] = computeRollingCompliance({
        roster: [{ subId: "sub-1", since, noWorkDates: [tuesday.date] }],
        logs,
        windows: week,
      });

      // Assert
      expect(result).toMatchObject({ expectedPeriods: 4, loggedPeriods: 3, excusedPeriods: 1 });
    });

    it("should ignore a marked weekend date: weekends are never required", () => {
      // Act
      const [result] = computeRollingCompliance({
        roster: [{ subId: "sub-1", since, noWorkDates: [saturday.date] }],
        logs: [],
        windows: week,
      });

      // Assert
      expect(result).toMatchObject({ expectedPeriods: 5, loggedPeriods: 0, excusedPeriods: 0 });
    });
  });
});

describe("computeRollingCompliance (weekly)", () => {
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

    const result = computeRollingCompliance({ roster, logs, windows: weeks, asOf, cadence: "weekly" });

    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 2, loggedPeriods: 2, excusedPeriods: 0 }]);
  });

  it("should count an open week that is already logged", () => {
    const roster = [{ subId: "sub-1", since: weeks[0].start }];
    const logs = [{ subId: "sub-1", heldAt: "2026-09-22T10:00:00.000Z" }];

    const result = computeRollingCompliance({ roster, logs, windows: weeks, asOf, cadence: "weekly" });

    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 3, loggedPeriods: 1, excusedPeriods: 0 }]);
  });

  it("should still count a completed week with no log as a miss", () => {
    const roster = [{ subId: "sub-1", since: weeks[0].start }];

    const result = computeRollingCompliance({ roster, logs: [], windows: weeks, asOf, cadence: "weekly" });

    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 2, loggedPeriods: 0, excusedPeriods: 0 }]);
  });

  it("should not count weeks before the sub joined, and ignore weekends and noWorkDates entirely", () => {
    const roster = [{ subId: "sub-1", since: weeks[1].start, noWorkDates: ["2026-09-15"] }];
    const logs = [{ subId: "sub-1", heldAt: "2026-09-26T10:00:00.000Z" }]; // a Saturday

    const result = computeRollingCompliance({ roster, logs, windows: weeks, cadence: "weekly" });

    expect(result).toEqual([{ subId: "sub-1", expectedPeriods: 2, loggedPeriods: 1, excusedPeriods: 0 }]);
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
