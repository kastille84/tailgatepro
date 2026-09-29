// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md).
const { CADENCES, isStricterOrEqual, effectiveCadence, windowFor } = require("./cadence");

describe("cadence", () => {
  it("should list the supported cadences", () => {
    expect(CADENCES).toEqual(["daily", "weekly"]);
  });

  it("should treat daily as at least as strict as anything, weekly only as strict as weekly", () => {
    expect(isStricterOrEqual("daily", "weekly")).toBe(true);
    expect(isStricterOrEqual("daily", "daily")).toBe(true);
    expect(isStricterOrEqual("weekly", "weekly")).toBe(true);
    expect(isStricterOrEqual("weekly", "daily")).toBe(false);
  });

  it("should inherit the jobsite cadence when the sub has no override", () => {
    expect(effectiveCadence("weekly", null)).toBe("weekly");
    expect(effectiveCadence("daily", undefined)).toBe("daily");
  });

  it("should let a sub tighten weekly to daily", () => {
    expect(effectiveCadence("weekly", "daily")).toBe("daily");
  });

  it("should ignore a sub override that is looser than the jobsite's", () => {
    expect(effectiveCadence("daily", "weekly")).toBe("daily");
  });

  it("should build a one-day window for daily and a Mon-Sun window for weekly", () => {
    const input = { date: "2026-09-23", tzOffset: 0 };
    expect(windowFor("daily", input)).toEqual({
      start: "2026-09-23T00:00:00.000Z",
      end: "2026-09-24T00:00:00.000Z",
    });
    expect(windowFor("weekly", input)).toEqual({
      start: "2026-09-21T00:00:00.000Z",
      end: "2026-09-28T00:00:00.000Z",
    });
  });
});
