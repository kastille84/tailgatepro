// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { toE164 } = require("./phone");

describe("toE164", () => {
  it("normalizes common US formats", () => {
    expect(toE164("(512) 555-0123")).toBe("+15125550123");
    expect(toE164("512.555.0123")).toBe("+15125550123");
    expect(toE164("1 512 555 0123")).toBe("+15125550123");
    expect(toE164("+1 512-555-0123")).toBe("+15125550123");
  });

  it("rejects numbers that are not valid North American numbers", () => {
    expect(toE164("555-0123")).toBeNull();
    expect(toE164("012 555 0123")).toBeNull();
    expect(toE164("512 055 0123")).toBeNull();
    expect(toE164("+44 20 7946 0958")).toBeNull();
    expect(toE164("")).toBeNull();
    expect(toE164(undefined)).toBeNull();
  });
});
