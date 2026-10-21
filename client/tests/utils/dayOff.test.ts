import { describe, expect, it } from "vitest";

import {
  addDays,
  dayOffRange,
  formatDayOff,
  isWeekendDate,
  toLocalDateString,
} from "../../src/utils/dayOff";

describe("dayOff utils", () => {
  it("formats a Date as its local YYYY-MM-DD, zero-padded", () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(toLocalDateString(new Date(2026, 10, 26, 0, 5))).toBe("2026-11-26");
  });

  it("adds and subtracts whole days across month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-09-21", 0)).toBe("2026-09-21");
  });

  it.each(["2026-09-26", "2026-09-27"])("treats %s as a weekend", (date) => {
    expect(isWeekendDate(date)).toBe(true);
  });

  it.each(["2026-09-21", "2026-09-25"])("treats %s as a weekday", (date) => {
    expect(isWeekendDate(date)).toBe(false);
  });

  it("allows 7 days back through 14 days ahead", () => {
    expect(dayOffRange("2026-09-23")).toEqual({
      min: "2026-09-16",
      max: "2026-10-07",
    });
  });

  it("writes a day as weekday, month and day", () => {
    expect(formatDayOff("2026-11-26")).toBe("Thu, Nov 26");
  });
});
