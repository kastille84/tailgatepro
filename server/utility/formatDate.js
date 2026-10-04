// Pure, I/O-free date formatting. Renders as e.g. "September 18, 2026 at
// 12:00 PM UTC". `timeZone: "UTC"` is pinned explicitly (every timestamp in
// this codebase is UTC) so the output is deterministic regardless of the
// host machine's local timezone; the zone label is appended manually because
// Intl won't combine the dateStyle/timeStyle presets with timeZoneName in one
// call. Extracted from pdfGeneration.js once email.js needed the same
// formatting for its template variables.
//
// Optional `tzOffset` (minutes, the sign of `Date#getTimezoneOffset()`: UTC
// minus local, so 420 = UTC-7) renders the instant in the foreman's local time
// with a "UTC-7"-style label. Missing or not an integer (a meeting completed
// before the offset was stored) falls back to plain UTC.
const formatOffsetLabel = (tzOffset) => {
  if (tzOffset === 0) return "UTC";
  const sign = tzOffset > 0 ? "-" : "+";
  const abs = Math.abs(tzOffset);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
};

const formatDate = (isoString, tzOffset) => {
  if (!isoString) return "Unknown";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const hasOffset = Number.isInteger(tzOffset);
  const shifted = hasOffset
    ? new Date(date.getTime() - tzOffset * 60 * 1000)
    : date;
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(shifted)} ${hasOffset ? formatOffsetLabel(tzOffset) : "UTC"}`;
};

module.exports = { formatDate };
