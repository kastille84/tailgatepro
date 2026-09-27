// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). A pure
// function, so no mocking is needed.

const { rollingDayWindows } = require("./rollingWindow");
const { dayWindow } = require("./dayWindow");

describe("rollingDayWindows", () => {
  it("should return `days` windows, oldest first, ending on today's own dayWindow", () => {
    // Act
    const windows = rollingDayWindows({ date: "2026-09-21", tzOffset: 0, days: 30 });

    // Assert
    expect(windows).toHaveLength(30);
    expect(windows[windows.length - 1]).toEqual(dayWindow({ date: "2026-09-21", tzOffset: 0 }));
  });

  it("should return contiguous windows with no gaps or overlaps", () => {
    // Act
    const windows = rollingDayWindows({ date: "2026-09-21", tzOffset: 0, days: 30 });

    // Assert
    for (let i = 1; i < windows.length; i += 1) {
      expect(windows[i].start).toBe(windows[i - 1].end);
    }
  });

  it("should match dayWindow's own output exactly when days is 1", () => {
    // Act
    const windows = rollingDayWindows({ date: "2026-09-21", tzOffset: 240, days: 1 });

    // Assert
    expect(windows).toEqual([dayWindow({ date: "2026-09-21", tzOffset: 240 })]);
  });

  it("should apply the tzOffset shift to every window, not just the anchor day", () => {
    // Act
    const windows = rollingDayWindows({ date: "2026-09-21", tzOffset: 240, days: 2 });

    // Assert
    expect(windows).toEqual([
      { start: "2026-09-20T04:00:00.000Z", end: "2026-09-21T04:00:00.000Z" },
      { start: "2026-09-21T04:00:00.000Z", end: "2026-09-22T04:00:00.000Z" },
    ]);
  });

  it("should propagate dayWindow's validation error for a malformed date", () => {
    // Act & Assert
    expect(() => rollingDayWindows({ date: "not-a-date", tzOffset: 0, days: 30 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("should propagate dayWindow's validation error for an out-of-range tzOffset", () => {
    // Act & Assert
    expect(() => rollingDayWindows({ date: "2026-09-21", tzOffset: 841, days: 30 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});
