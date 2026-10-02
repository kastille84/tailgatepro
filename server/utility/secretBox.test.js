// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const { encrypt, decrypt } = require("./secretBox");

describe("secretBox", () => {
  it("round-trips a value", () => {
    const payload = encrypt('{"clientSecret":"s3cret"}');
    expect(payload.startsWith("v1.")).toBe(true);
    expect(payload).not.toContain("s3cret");
    expect(decrypt(payload)).toBe('{"clientSecret":"s3cret"}');
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects a tampered ciphertext", () => {
    const [v, iv, tag, ct] = encrypt("hello").split(".");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 1;
    expect(() => decrypt([v, iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decrypt("nope")).toThrow("Unrecognized encrypted payload");
  });

  it("throws when the key is unset or the wrong length", () => {
    const original = process.env.INTEGRATIONS_ENCRYPTION_KEY;
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow("not configured");
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(8).toString("base64");
    expect(() => encrypt("x")).toThrow("32 bytes");
    process.env.INTEGRATIONS_ENCRYPTION_KEY = original;
  });
});
