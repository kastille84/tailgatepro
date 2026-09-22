// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const crypto = require("node:crypto");
const {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  generateJoinCode,
  normalizeJoinCode,
} = require("./joinCode");

describe("JOIN_CODE_ALPHABET", () => {
  it("should exclude the look-alike characters 0, O, 1, I and L", () => {
    // Assert
    for (const ch of ["0", "O", "1", "I", "L"]) {
      expect(JOIN_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("should contain only unique uppercase letters and digits", () => {
    // Assert
    expect(JOIN_CODE_ALPHABET).toMatch(/^[A-Z0-9]+$/);
    expect(new Set(JOIN_CODE_ALPHABET).size).toBe(JOIN_CODE_ALPHABET.length);
  });
});

describe("generateJoinCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return a code of the configured length made only of alphabet characters", () => {
    // Act
    const codes = Array.from({ length: 200 }, () => generateJoinCode());

    // Assert
    for (const code of codes) {
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      for (const ch of code) {
        expect(JOIN_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("should map each random index to the matching alphabet character", () => {
    // Arrange
    const randomIntSpy = vi.spyOn(crypto, "randomInt").mockReturnValue(0);

    // Act
    const code = generateJoinCode();

    // Assert
    expect(code).toBe(JOIN_CODE_ALPHABET[0].repeat(JOIN_CODE_LENGTH));
    expect(randomIntSpy).toHaveBeenCalledTimes(JOIN_CODE_LENGTH);
    expect(randomIntSpy).toHaveBeenCalledWith(0, JOIN_CODE_ALPHABET.length);
  });
});

describe("normalizeJoinCode", () => {
  it("should trim whitespace and uppercase the code", () => {
    // Assert
    expect(normalizeJoinCode("  ab3d-x9  ")).toBe("AB3D-X9");
  });

  it("should return an empty string for null or undefined input", () => {
    // Assert
    expect(normalizeJoinCode(null)).toBe("");
    expect(normalizeJoinCode(undefined)).toBe("");
  });
});
