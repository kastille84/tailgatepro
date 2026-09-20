// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md).
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
});
