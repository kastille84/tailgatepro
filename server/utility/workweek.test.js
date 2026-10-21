// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). Pure
// functions, so no mocking is needed.

const { dayOfWeek, isWeekend, shiftDate } = require("./workweek");

describe("dayOfWeek", () => {
  it("should return 0 for a Sunday and 1 for a Monday", () => {
    expect(dayOfWeek("2026-09-20")).toBe(0);
    expect(dayOfWeek("2026-09-21")).toBe(1);
  });

  it("should return 6 for a Saturday", () => {
    expect(dayOfWeek("2026-09-26")).toBe(6);
  });
});

describe("isWeekend", () => {
  it.each(["2026-09-26", "2026-09-27"])("should be true for the weekend day %s", (date) => {
    expect(isWeekend(date)).toBe(true);
  });

  it.each(["2026-09-21", "2026-09-23", "2026-09-25"])("should be false for the weekday %s", (date) => {
    expect(isWeekend(date)).toBe(false);
  });
});

describe("shiftDate", () => {
  it("should move a date earlier and later by whole days", () => {
    expect(shiftDate("2026-09-21", -1)).toBe("2026-09-20");
    expect(shiftDate("2026-09-21", 3)).toBe("2026-09-24");
  });

  it("should roll across month and year boundaries", () => {
    expect(shiftDate("2026-09-01", -1)).toBe("2026-08-31");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("should return the same date for a zero shift", () => {
    expect(shiftDate("2026-09-21", 0)).toBe("2026-09-21");
  });
});
