// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { encodeCursor, decodeCursor } = require("./cursor");

const ID = "0b9d2a52-7f0c-4f3e-9a41-3c1e5d6f7a88";
const encodeRaw = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

describe("cursor", () => {
  it("should round-trip a timestamp and id", () => {
    // Arrange
    const original = { value: "2026-09-02T12:00:00.123456+00:00", id: ID };

    // Act
    const result = decodeCursor(encodeCursor(original));

    // Assert
    expect(result).toEqual(original);
  });

  it("should accept a Z-suffixed timestamp without fractional seconds", () => {
    // Arrange
    const original = { value: "2026-09-02T12:00:00Z", id: ID };

    // Act & Assert
    expect(decodeCursor(encodeCursor(original))).toEqual(original);
  });

  it("should produce a URL-safe string", () => {
    // Act
    const encoded = encodeCursor({ value: "2026-09-02T12:00:00.000Z", id: ID });

    // Assert
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("should reject a cursor that is not valid base64 JSON with a 400", () => {
    // Act & Assert
    expect(() => decodeCursor("not-a-cursor")).toThrow(
      expect.objectContaining({ statusCode: 400, message: "Invalid cursor" }),
    );
  });

  it.each([
    ["a non-object payload", encodeRaw(null)],
    ["a missing id", encodeRaw({ value: "2026-09-02T12:00:00.000Z" })],
    ["a non-string value", encodeRaw({ value: 5, id: ID })],
    ["a malformed timestamp", encodeRaw({ value: "yesterday", id: ID })],
    ["a malformed id", encodeRaw({ value: "2026-09-02T12:00:00.000Z", id: "abc" })],
    [
      "filter syntax smuggled into the timestamp",
      encodeRaw({ value: "2026-09-02T12:00:00.000Z),id.neq.x,or(a.eq.1", id: ID }),
    ],
    [
      "filter syntax smuggled into the id",
      encodeRaw({ value: "2026-09-02T12:00:00.000Z", id: `${ID},company_id.neq.x` }),
    ],
  ])("should reject %s with a 400", (_label, cursor) => {
    // Act & Assert
    expect(() => decodeCursor(cursor)).toThrow(
      expect.objectContaining({ statusCode: 400, message: "Invalid cursor" }),
    );
  });
});
