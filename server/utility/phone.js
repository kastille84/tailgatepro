// Pure, I/O-free: normalizes a user-typed phone number to E.164. Only North
// American numbers are accepted -- the Toll-Free Verified sender is US/Canada
// (docs/sms-nudges-design.md). Returns null when the input isn't one.
const toE164 = (input) => {
  const digits = String(input ?? "").replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  // NANP: area code and exchange can't start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return null;
  return `+1${national}`;
};

module.exports = { toE164 };
