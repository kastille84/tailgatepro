// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). A pure
// function, so no mocking is needed.

const { computeCompliance } = require("./compliance");

const dailyWindow = { start: "2026-09-21T00:00:00.000Z", end: "2026-09-22T00:00:00.000Z" };

describe("computeCompliance", () => {
  it("should mark a roster sub with a completed log inside the window as logged", () => {
    // Arrange
    const roster = [{ subId: "sub-1" }];
    const logs = [{ subId: "sub-1", heldAt: "2026-09-21T14:00:00.000Z" }];

    // Act
    const result = computeCompliance({ roster, logs, window: dailyWindow });

    // Assert
    expect(result).toEqual([
      { subId: "sub-1", status: "logged", lastLoggedAt: "2026-09-21T14:00:00.000Z", count: 1 },
    ]);
  });

  it("should mark a roster sub with no logs as missing", () => {
    // Act
    const result = computeCompliance({
      roster: [{ subId: "sub-1" }],
      logs: [],
      window: dailyWindow,
    });

    // Assert
    expect(result).toEqual([
      { subId: "sub-1", status: "missing", lastLoggedAt: null, count: 0 },
    ]);
  });

  it("should count multiple logs and report the latest as lastLoggedAt", () => {
    // Arrange
    const logs = [
      { subId: "sub-1", heldAt: "2026-09-21T08:00:00.000Z" },
      { subId: "sub-1", heldAt: "2026-09-21T16:30:00.000Z" },
    ];

    // Act
    const result = computeCompliance({
      roster: [{ subId: "sub-1" }],
      logs,
      window: dailyWindow,
    });

    // Assert
    expect(result).toEqual([
      { subId: "sub-1", status: "logged", lastLoggedAt: "2026-09-21T16:30:00.000Z", count: 2 },
    ]);
  });

  it("should ignore logs from a sub not on the roster", () => {
    // Act
    const result = computeCompliance({
      roster: [{ subId: "sub-1" }],
      logs: [{ subId: "sub-2", heldAt: "2026-09-21T14:00:00.000Z" }],
      window: dailyWindow,
    });

    // Assert
    expect(result).toEqual([
      { subId: "sub-1", status: "missing", lastLoggedAt: null, count: 0 },
    ]);
  });

  it("should exclude a log exactly at the window end (half-open range)", () => {
    // Act
    const result = computeCompliance({
      roster: [{ subId: "sub-1" }],
      logs: [{ subId: "sub-1", heldAt: dailyWindow.end }],
      window: dailyWindow,
    });

    // Assert
    expect(result[0].status).toBe("missing");
  });

  it("should include a log exactly at the window start (half-open range)", () => {
    // Act
    const result = computeCompliance({
      roster: [{ subId: "sub-1" }],
      logs: [{ subId: "sub-1", heldAt: dailyWindow.start }],
      window: dailyWindow,
    });

    // Assert
    expect(result[0].status).toBe("logged");
  });

  it("should exclude a log outside the window on either side", () => {
    // Act
    const result = computeCompliance({
      roster: [{ subId: "sub-1" }],
      logs: [
        { subId: "sub-1", heldAt: "2026-09-20T23:59:59.999Z" },
        { subId: "sub-1", heldAt: "2026-09-22T00:00:00.001Z" },
      ],
      window: dailyWindow,
    });

    // Assert
    expect(result[0]).toMatchObject({ status: "missing", count: 0 });
  });

  it("should be cadence-agnostic: work identically over a multi-day window", () => {
    // Arrange — a week-long window, cadence unknown to the function.
    const weekWindow = { start: "2026-09-15T00:00:00.000Z", end: "2026-09-22T00:00:00.000Z" };
    const logs = [
      { subId: "sub-1", heldAt: "2026-09-16T10:00:00.000Z" },
      { subId: "sub-1", heldAt: "2026-09-20T10:00:00.000Z" },
      { subId: "sub-2", heldAt: "2026-09-10T10:00:00.000Z" }, // before the window
    ];

    // Act
    const result = computeCompliance({
      roster: [{ subId: "sub-1" }, { subId: "sub-2" }],
      logs,
      window: weekWindow,
    });

    // Assert
    expect(result).toEqual([
      { subId: "sub-1", status: "logged", lastLoggedAt: "2026-09-20T10:00:00.000Z", count: 2 },
      { subId: "sub-2", status: "missing", lastLoggedAt: null, count: 0 },
    ]);
  });

  it("should return an empty array for an empty roster", () => {
    // Act
    const result = computeCompliance({ roster: [], logs: [], window: dailyWindow });

    // Assert
    expect(result).toEqual([]);
  });
});
