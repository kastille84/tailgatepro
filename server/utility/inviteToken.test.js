// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const crypto = require("node:crypto");
const {
  INVITE_TOKEN_BYTES,
  INVITE_TOKEN_TTL_DAYS,
  generateInviteToken,
  getInviteExpiry,
} = require("./inviteToken");

describe("generateInviteToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return a 64-character lowercase hex string", () => {
    // Act
    const token = generateInviteToken();

    // Assert
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should return a different token on each call", () => {
    // Act
    const first = generateInviteToken();
    const second = generateInviteToken();

    // Assert
    expect(first).not.toBe(second);
  });

  it("should request INVITE_TOKEN_BYTES bytes from crypto.randomBytes", () => {
    // Arrange
    const randomBytesSpy = vi.spyOn(crypto, "randomBytes");

    // Act
    generateInviteToken();

    // Assert
    expect(randomBytesSpy).toHaveBeenCalledWith(INVITE_TOKEN_BYTES);
  });
});

describe("getInviteExpiry", () => {
  it("should return exactly INVITE_TOKEN_TTL_DAYS days after the given date", () => {
    // Arrange
    const from = new Date("2026-01-01T00:00:00.000Z");

    // Act
    const expiry = getInviteExpiry(from);

    // Assert
    const expected = new Date("2026-01-01T00:00:00.000Z");
    expected.setDate(expected.getDate() + INVITE_TOKEN_TTL_DAYS);
    expect(expiry.toISOString()).toBe(expected.toISOString());
  });

  it("should default to now when no date is given", () => {
    // Arrange
    const before = Date.now();

    // Act
    const expiry = getInviteExpiry();

    // Assert
    const after = Date.now();
    const days = (expiry.getTime() - before) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(INVITE_TOKEN_TTL_DAYS - 1);
    expect(expiry.getTime()).toBeLessThanOrEqual(
      after + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
  });
});
