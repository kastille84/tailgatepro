// AES-256-GCM encrypt/decrypt for third-party credentials stored at rest
// (Phase 9f, docs/integrations-design.md). Pure: no Supabase, no Express.
// Output format is "v1.<iv>.<tag>.<ciphertext>", each part base64, so the
// scheme can be versioned later without a column change.
const crypto = require("crypto");
const envUtils = require("./envUtils");

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

const getKey = () => {
  const encoded = envUtils.keysBasedOnEnv().integrations.encryptionKey;
  if (!encoded) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not configured");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }
  return key;
};

/** @param {string} plaintext @returns {string} */
const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, ciphertext].map((part) =>
    Buffer.isBuffer(part) ? part.toString("base64") : part,
  ).join(".");
};

/** Throws if the value is malformed or was tampered with. @param {string} payload @returns {string} */
const decrypt = (payload) => {
  const [version, iv, tag, ciphertext] = String(payload).split(".");
  if (version !== "v1" || !iv || !tag || ciphertext === undefined) {
    throw new Error("Unrecognized encrypted payload");
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

module.exports = { encrypt, decrypt };
