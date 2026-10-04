import { describe, it, expect } from "vitest";

import {
  formatMonth,
  isValidMonth,
  monthRange,
} from "../../../src/features/meeting-history/monthUtils";

describe("isValidMonth", () => {
  it.each(["2026-01", "2026-09", "2026-12"])("accepts %s", (value) => {
    expect(isValidMonth(value)).toBe(true);
  });

  it.each([null, "", "2026-00", "2026-13", "2026-9", "26-09", "garbage"])(
    "rejects %s",
    (value) => {
      expect(isValidMonth(value)).toBe(false);
    },
  );
});

describe("formatMonth", () => {
  it("names the month and year", () => {
    expect(formatMonth("2026-09")).toMatch(/2026/);
    expect(formatMonth("2026-09")).toMatch(/Sep/);
  });
});

describe("monthRange", () => {
  it("spans local midnight on the 1st to local midnight on the next 1st", () => {
    const { from, to } = monthRange("2026-09");
    expect(new Date(from).getTime()).toBe(new Date(2026, 8, 1).getTime());
    expect(new Date(to).getTime()).toBe(new Date(2026, 9, 1).getTime());
  });

  it("rolls December over into the next year", () => {
    const { from, to } = monthRange("2026-12");
    expect(new Date(from).getTime()).toBe(new Date(2026, 11, 1).getTime());
    expect(new Date(to).getTime()).toBe(new Date(2027, 0, 1).getTime());
  });
});
