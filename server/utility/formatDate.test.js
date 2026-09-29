// Plain CommonJS â€” no `import` (see vitest.config.js / CLAUDE.md).
const { formatDate } = require("./formatDate");

describe("formatDate", () => {
  it("should render a long date, short time, and a trailing UTC label", () => {
    // Act
    const result = formatDate("2026-09-18T12:00:00.000Z");

    // Assert
    expect(result).toBe("September 18, 2026 at 12:00 PM UTC");
  });

  it("should return 'Unknown' when isoString is null or undefined", () => {
    // Act & Assert
    expect(formatDate(null)).toBe("Unknown");
    expect(formatDate(undefined)).toBe("Unknown");
  });

  it("should return 'Unknown' when isoString does not parse to a valid date", () => {
    // Act
    const result = formatDate("not-a-date");

    // Assert
    expect(result).toBe("Unknown");
  });

  describe("with a tzOffset", () => {
    it("should render a west-coast evening talk on its local calendar date with a UTC-7 label", () => {
      // Act — 03:00 UTC Sept 21 is 8:00 PM on Sept 20 in UTC-7
      const result = formatDate("2026-09-21T03:00:00.000Z", 420);

      // Assert
      expect(result).toBe("September 20, 2026 at 8:00 PM UTC-7");
    });

    it("should label a zone east of UTC with a plus sign and include half-hour minutes", () => {
      // Act
      const result = formatDate("2026-09-21T03:00:00.000Z", -330);

      // Assert
      expect(result).toBe("September 21, 2026 at 8:30 AM UTC+5:30");
    });

    it("should label a zero offset plain UTC", () => {
      // Act & Assert
      expect(formatDate("2026-09-18T12:00:00.000Z", 0)).toBe(
        "September 18, 2026 at 12:00 PM UTC",
      );
    });

    it("should fall back to plain UTC when the offset is null or not an integer", () => {
      // Act & Assert
      expect(formatDate("2026-09-18T12:00:00.000Z", null)).toBe(
        "September 18, 2026 at 12:00 PM UTC",
      );
      expect(formatDate("2026-09-18T12:00:00.000Z", "420")).toBe(
        "September 18, 2026 at 12:00 PM UTC",
      );
    });
  });
});
