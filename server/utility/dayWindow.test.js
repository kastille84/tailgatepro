// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). A pure
// function, so no mocking is needed.

const { dayWindow } = require("./dayWindow");

describe("dayWindow", () => {
  it("should return a UTC midnight window unchanged for tzOffset 0", () => {
    // Act
    const result = dayWindow({ date: "2026-09-21", tzOffset: 0 });

    // Assert
    expect(result).toEqual({
      start: "2026-09-21T00:00:00.000Z",
      end: "2026-09-22T00:00:00.000Z",
    });
  });

  it("should shift the window later for a positive (US) offset", () => {
    // Arrange — US Eastern, UTC-4 in September (DST): tzOffset = +240.
    // Act
    const result = dayWindow({ date: "2026-09-21", tzOffset: 240 });

    // Assert
    expect(result).toEqual({
      start: "2026-09-21T04:00:00.000Z",
      end: "2026-09-22T04:00:00.000Z",
    });
  });

  it("should shift the window earlier for a negative (ahead-of-UTC) offset", () => {
    // Arrange — Central European Summer Time, UTC+2: tzOffset = -120.
    // Act
    const result = dayWindow({ date: "2026-09-21", tzOffset: -120 });

    // Assert
    expect(result).toEqual({
      start: "2026-09-20T22:00:00.000Z",
      end: "2026-09-21T22:00:00.000Z",
    });
  });

  it("should accept the extreme +14h/-14h tzOffset bounds", () => {
    // Act / Assert
    expect(() => dayWindow({ date: "2026-09-21", tzOffset: 840 })).not.toThrow();
    expect(() => dayWindow({ date: "2026-09-21", tzOffset: -840 })).not.toThrow();
  });

  it("should throw a 400 AppError for a tzOffset outside +-14h", () => {
    // Act & Assert
    expect(() => dayWindow({ date: "2026-09-21", tzOffset: 841 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(() => dayWindow({ date: "2026-09-21", tzOffset: -841 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("should throw a 400 AppError for a non-integer tzOffset", () => {
    // Act & Assert
    expect(() => dayWindow({ date: "2026-09-21", tzOffset: 90.5 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("should throw a 400 AppError for a malformed date string", () => {
    // Act & Assert
    expect(() => dayWindow({ date: "09/21/2026", tzOffset: 0 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(() => dayWindow({ date: undefined, tzOffset: 0 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("should throw a 400 AppError for an impossible calendar date", () => {
    // Act & Assert — Date.UTC would otherwise silently roll Feb 31 into March.
    expect(() => dayWindow({ date: "2026-02-31", tzOffset: 0 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("should handle a real leap day", () => {
    // Act
    const result = dayWindow({ date: "2028-02-29", tzOffset: 0 });

    // Assert
    expect(result).toEqual({
      start: "2028-02-29T00:00:00.000Z",
      end: "2028-03-01T00:00:00.000Z",
    });
  });
});
