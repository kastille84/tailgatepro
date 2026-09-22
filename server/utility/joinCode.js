const crypto = require("node:crypto");

// Uppercase letters and digits with the look-alikes removed (no 0/O, 1/I/L), so
// a code read off a phone screen or a jobsite trailer wall can be typed back
// without guessing. 31 characters; 8 of them is ~8.5e11 combinations.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 8;

// crypto.randomInt (not Math.random) so a code can't be predicted from the
// ones already handed out; it also avoids modulo bias over a 31-char alphabet.
const generateJoinCode = () => {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[crypto.randomInt(0, JOIN_CODE_ALPHABET.length)];
  }
  return code;
};

// Codes are stored uppercase; users type them in any case, with stray spaces.
const normalizeJoinCode = (input) => String(input ?? "").trim().toUpperCase();

module.exports = {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  generateJoinCode,
  normalizeJoinCode,
};
