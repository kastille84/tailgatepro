// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). A pure
// function, so no mocking is needed.

const {
  resolveHeldAt,
  HELD_AT_MAX_FUTURE_MS,
  HELD_AT_MAX_PAST_MS,
} = require("./heldAt");

const now = new Date("2026-09-21T12:00:00.000Z");
const nowMs = now.getTime();
const iso = (ms) => new Date(ms).toISOString();

describe("resolveHeldAt", () => {
  it("should use the reported time when it is inside the window", () => {
    // Arrange
    const heldAt = "2026-09-21T07:02:00.000Z";

    // Act
    const result = resolveHeldAt({ heldAt, now });

    // Assert
    expect(result).toBe(heldAt);
  });

  it("should normalize a reported time with a UTC offset to UTC", () => {
    // Act
    const result = resolveHeldAt({ heldAt: "2026-09-21T07:02:00-05:00", now });

    // Assert
    expect(result).toBe("2026-09-21T12:02:00.000Z");
  });

  it("should fall back to server receipt time when no time was reported", () => {
    // Act / Assert
    expect(resolveHeldAt({ heldAt: undefined, now })).toBe(now.toISOString());
    expect(resolveHeldAt({ heldAt: null, now })).toBe(now.toISOString());
    expect(resolveHeldAt({ heldAt: "", now })).toBe(now.toISOString());
  });

  it("should fall back to server receipt time when the value is not a parseable date", () => {
    // Act / Assert
    expect(resolveHeldAt({ heldAt: "not a date", now })).toBe(now.toISOString());
    expect(resolveHeldAt({ heldAt: 1758456000000, now })).toBe(now.toISOString());
  });

  it("should accept a time up to the future tolerance (phone clock skew)", () => {
    // Arrange
    const atLimit = iso(nowMs + HELD_AT_MAX_FUTURE_MS);

    // Act / Assert
    expect(resolveHeldAt({ heldAt: atLimit, now })).toBe(atLimit);
  });

  it("should fall back to server receipt time when the reported time is too far in the future", () => {
    // Arrange
    const tooFarAhead = iso(nowMs + HELD_AT_MAX_FUTURE_MS + 1);

    // Act / Assert
    expect(resolveHeldAt({ heldAt: tooFarAhead, now })).toBe(now.toISOString());
  });

  it("should accept a time exactly at the backdate limit (a crew offline for a week)", () => {
    // Arrange
    const atLimit = iso(nowMs - HELD_AT_MAX_PAST_MS);

    // Act / Assert
    expect(resolveHeldAt({ heldAt: atLimit, now })).toBe(atLimit);
  });

  it("should fall back to server receipt time rather than throwing when the reported time is older than the limit", () => {
    // Arrange
    const tooOld = iso(nowMs - HELD_AT_MAX_PAST_MS - 1);

    // Act
    const act = () => resolveHeldAt({ heldAt: tooOld, now });

    // Assert — never throws: a rejection would strand the completion in the
    // client's retry-forever outbox.
    expect(act).not.toThrow();
    expect(act()).toBe(now.toISOString());
  });
});
