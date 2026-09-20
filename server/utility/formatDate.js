// Pure, I/O-free date formatting. Renders as e.g. "September 18, 2026 at
// 12:00 PM UTC". `timeZone: "UTC"` is pinned explicitly (every timestamp in
// this codebase is UTC) so the output is deterministic regardless of the
// host machine's local timezone; "UTC" is appended manually because Intl
// won't combine the dateStyle/timeStyle presets with timeZoneName in one
// call. Extracted from pdfGeneration.js once email.js needed the same
// formatting for its template variables.
const formatDate = (isoString) => {
  if (!isoString) return "Unknown";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
};

module.exports = { formatDate };
