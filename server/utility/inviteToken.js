const crypto = require("node:crypto");

// A per-invite, per-email secret — distinct from joinCode.js's short,
// human-typed, non-expiring company code. This is a 256-bit URL-safe token
// meant to sit in an email link, plus an expiry (joinCode.js has none).
const INVITE_TOKEN_BYTES = 32; // 256 bits -> 64 hex chars
const INVITE_TOKEN_TTL_DAYS = 7;

const generateInviteToken = () => crypto.randomBytes(INVITE_TOKEN_BYTES).toString("hex");

const getInviteExpiry = (fromDate = new Date()) => {
  const expires = new Date(fromDate);
  expires.setDate(expires.getDate() + INVITE_TOKEN_TTL_DAYS);
  return expires;
};

module.exports = {
  INVITE_TOKEN_BYTES,
  INVITE_TOKEN_TTL_DAYS,
  generateInviteToken,
  getInviteExpiry,
};
