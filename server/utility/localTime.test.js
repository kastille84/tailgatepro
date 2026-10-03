// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { localParts, isValidTimeZone } = require("./localTime");

describe("localParts", () => {
  it("reads the wall clock in the given zone", () => {
    // Mon 2026-10-05 12:00 UTC = 07:00 CDT (UTC-5)
    expect(localParts(new Date("2026-10-05T12:00:00Z"), "America/Chicago")).toEqual({
      date: "2026-10-05",
      weekday: "Mon",
      hour: 7,
    });
  });

  it("crosses the date line correctly", () => {
    // Still Sunday evening in Los Angeles, already Monday in UTC.
    expect(localParts(new Date("2026-10-05T03:00:00Z"), "America/Los_Angeles")).toEqual({
      date: "2026-10-04",
      weekday: "Sun",
      hour: 20,
    });
  });

  it("follows DST: 07:00 local is a different UTC hour in winter", () => {
    // Mon 2026-12-07 13:00 UTC = 07:00 CST (UTC-6)
    expect(localParts(new Date("2026-12-07T13:00:00Z"), "America/Chicago")).toMatchObject({
      weekday: "Mon",
      hour: 7,
    });
  });

  it("reads midnight as hour 0, not 24", () => {
    expect(localParts(new Date("2026-10-05T05:00:00Z"), "America/Chicago").hour).toBe(0);
  });

  it("returns null for an unknown zone", () => {
    expect(localParts(new Date(), "Not/AZone")).toBeNull();
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects everything else", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(5)).toBe(false);
    expect(isValidTimeZone("x".repeat(65))).toBe(false);
  });
});
